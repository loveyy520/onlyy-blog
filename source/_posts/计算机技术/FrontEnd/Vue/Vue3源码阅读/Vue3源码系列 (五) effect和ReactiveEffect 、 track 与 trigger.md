---
title: Vue3源码系列 (五) effect和ReactiveEffect 、 track 与 trigger
date: "2022-10-21 23:42"
updated: "2022-10-21 23:42"
tags:
  - 前端
  - Vue3
  - 源码阅读
keywords:
  - 前端
  - Vue
  - Vue3
  - 源码
  - effect
  - track
  - trigger
categories:
  - 前端
  - Vue3
  - [源码]
abbrlink: 9baf97c7
---

前面几篇文章里，介绍几个`API`的时候，我们发现里面常出现`effect`、`track`和`trigger`，虽然简单说了下`track`用于依赖收集，`trigger`来触发更新。但是毕竟没看到具体实现，心里没底。如今便可以一探究竟。

## 一、`ReactiveEffect`

### 1. 相关的全局变量

之前提到的`effect`，便是`ReactiveEffect`的实例。用到了一些重要的全局变量。

- `targetMap`：弱映射，以目标对象`target`为`key`，其收集到的依赖集`depsMap`为值，因此通过目标对象`target`可以获取到对应的所有依赖；
- `activeEffect`：当前活跃的`effect`，随后会被收集起来；
- `shouldTrack`：用作暂停和恢复依赖收集的标志；
- `trackStack`：历史`shouldTrack`的记录栈。

`targetMap`对比`reactive`篇章中提到的`proxyMap`：

- 两者都是弱映射；
- 都以目标对象`target`为`key`；
- `targetMap`全局只有一个；而`proxyMap`有四种，分别对应`reactive`、`shallowReactive`、`readonly`、`shallowReadonly`；
- 一个`target`在一种`proxyMap`中最多只有一个对应的代理`proxy`，因此`proxyMap`的值为单个的`proxy`对象；
- 一个`target`可以由很多的依赖`dep`，因此`targetMap`的值为数据集`Map`。

```typescript
const targetMap = new WeakMap<any, KeyToDepMap>();

export let activeEffect: ReactiveEffect | undefined;

export let shouldTrack = true;
const trackStack: boolean[] = [];
```

以及控制暂停、恢复依赖收集的函数：

```typescript
// 暂停收集
export function pauseTracking() {
  trackStack.push(shouldTrack);
  shouldTrack = false;
}

// 恢复收集
export function enableTracking() {
  trackStack.push(shouldTrack);
  shouldTrack = true;
}

// 重置为上一次的状态
export function resetTracking() {
  const last = trackStack.pop();
  shouldTrack = last === undefined ? true : last;
}
```

### 2. `class` 声明

在构造器中初始化`fn` ( 执行`run()`的过程中调用 ) 、调度器`scheduler`，并通过`recordEffectScope`来记录实例的作用域；声明一些实例属性，以及`run`、`stop`两个方法：

- `active`：`boolean`类型，表示当前的`effect`是否起作用；
- `deps`：当前`effect`的依赖；
- `parent`：指向上一个活跃的`effect`，形成链表；
- `computed`：可选，在`computed`函数得到的`ComputedRefImpl`里的`effect`具有这个属性；
- `allowRecurse`，可选，表示是否允许自调用；
- `deferStop`：私有，可选，表示`stop()`是否延迟执行；
- `onStop`：可选，函数，在执行`stop()`时会调用`onStop`；
- `onTrack`
- `onTrigger`：这两个`listener`为调试用，分别在依赖收集和响应式更新时触发；
- **run**：`effect`最核心的方法。
- **`stop`**：调用`cleanupEffect`让`effect`停止起作用，如果是`stop`当前活跃的`effect`，也就是自己停止自己，则会将`deferStop`调为`true`，从而延迟停止的时机；触发`onStop`；将`active`调为`false`。

```typescript
export class ReactiveEffect<T = any> {
  active = true;
  deps: Dep[] = [];
  parent: ReactiveEffect | undefined = undefined;

  /**
   * Can be attached after creation
   * @internal
   */
  computed?: ComputedRefImpl<T>;
  /**
   * @internal
   */
  allowRecurse?: boolean;
  /**
   * @internal
   */
  private deferStop?: boolean;

  onStop?: () => void;
  // dev only
  onTrack?: (event: DebuggerEvent) => void;
  // dev only
  onTrigger?: (event: DebuggerEvent) => void;

  constructor(
    public fn: () => T,
    public scheduler: EffectScheduler | null = null,
    scope?: EffectScope
  ) {
    recordEffectScope(this, scope);
  }

  run() {
    if (!this.active) {
      return this.fn();
    }
    // 当前活跃的effect
    let parent: ReactiveEffect | undefined = activeEffect;
    let lastShouldTrack = shouldTrack;
    // 如果当前活跃的effect就是这个effect本身，则直接返回
    while (parent) {
      if (parent === this) {
        return;
      }
      parent = parent.parent;
    }
    // 依次活跃的effect形成链表，由parent属性连接
    try {
      this.parent = activeEffect;
      activeEffect = this;
      shouldTrack = true;

      trackOpBit = 1 << ++effectTrackDepth;

      if (effectTrackDepth <= maxMarkerBits) {
        // 遍历 this.deps 将其中的effect设置为已捕获 tracked
        initDepMarkers(this);
      } else {
        // 层级溢出则清除当前副作用
        cleanupEffect(this);
      }
      // 尾调用传入的fn
      return this.fn();
    } finally {
      // 因为前面有return，因此当 try 的代码块发生异常时执行

      if (effectTrackDepth <= maxMarkerBits) {
        // 该方法遍历 this.deps，将其中过气的effect删除，未捕获的effect加入
        // effect 就是其中的 dep
        finalizeDepMarkers(this);
      }

      trackOpBit = 1 << --effectTrackDepth;

      // 复原一些状态
      activeEffect = this.parent;
      shouldTrack = lastShouldTrack;
      this.parent = undefined;

      // 若设置了延迟停止，则执行stop，进行延迟清理
      if (this.deferStop) {
        this.stop();
      }
    }
  }

  // 清除副作用
  stop() {
    // stopped while running itself - defer the cleanup
    if (activeEffect === this) {
      this.deferStop = true;
    } else if (this.active) {
      cleanupEffect(this);
      if (this.onStop) {
        this.onStop();
      }
      this.active = false;
    }
  }
}
```

### 3. `cleanupEffect`

`cleanupEffect`用于清除副作用。接收一个`effect`，遍历`effect.deps`，并逐个删除副作用`effect`。随后清空`effect.deps`。

```typescript
function cleanupEffect(effect: ReactiveEffect) {
  const { deps } = effect;
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect);
    }
    deps.length = 0;
  }
}
```

## 二、`effect` 函数

### 1. 相关`ts`类型

`effect`函数有几个相关的类型：

- `ReactiveEffectOptions`：`effect`函数的入参类型之一；
- `ReactiveEffectRunner`：是一个函数，且具有`effect`属性的类型；

```typescript
export interface DebuggerOptions {
  onTrack?: (event: DebuggerEvent) => void;
  onTrigger?: (event: DebuggerEvent) => void;
}

export interface ReactiveEffectOptions extends DebuggerOptions {
  lazy?: boolean;
  scheduler?: EffectScheduler;
  scope?: EffectScope;
  allowRecurse?: boolean;
  onStop?: () => void;
}

export interface ReactiveEffectRunner<T = any> {
  (): T;
  effect: ReactiveEffect;
}
```

### 2. 函数声明

`effect`函数有两个入参：

- `fn`：是一个函数，经处理后用于创建 `ReactiveEffect`实例`_effect`；
- `options`：可选，用于覆盖`_effect`上的属性。

```typescript
export function effect<T = any>(
  fn: () => T,
  options?: ReactiveEffectOptions
): ReactiveEffectRunner {
  // 处理fn
  if ((fn as ReactiveEffectRunner).effect) {
    fn = (fn as ReactiveEffectRunner).effect.fn;
  }

  // 根据 fn 创建一个 _effect
  const _effect = new ReactiveEffect(fn);
  if (options) {
    // 用 options 覆盖 _effect 上的属性
    extend(_effect, options);
    if (options.scope) recordEffectScope(_effect, options.scope);
  }
  // 没有 lazy , 则 _effect 立即执行一次 run()
  if (!options || !options.lazy) {
    _effect.run();
  }

  // runner：拿到 _effect.run 并挂上 effect 属性，包装成 ReactiveEffectRunner 类型
  const runner = _effect.run.bind(_effect) as ReactiveEffectRunner;
  // effect属性指回 _effect 自身，方便使用 runner 调用 run 和 stop
  runner.effect = _effect;

  // 返回 runner
  return runner;
}
```

### 3. `stop`函数

`stop`用于清除`effect`。入参为`ReactiveEffectRunner`；

```typescript
export function stop(runner: ReactiveEffectRunner) {
  runner.effect.stop();
}
```

## 三、`track` 依赖收集

### 1. `track`

一直在说`track`进行依赖收集，这里看下它到底怎么做的。

- 以目标对象`target`为`key`，`depsMap`为`targetMap`的值；以`target`的`key`为`key`，使用`createDep()`创建依赖`dep`为值，存放在`target`对应的`depsMap`中。
- 通过`trackEffects(dep, eventInfo)`来收集副作用。

```typescript
// 全局变量 targetMap
const targetMap = new WeakMap<any, KeyToDepMap>();

export function track(target: object, type: TrackOpTypes, key: unknown) {
  if (shouldTrack && activeEffect) {
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()));
    }
    let dep = depsMap.get(key);
    if (!dep) {
      depsMap.set(key, (dep = createDep()));
    }

    const eventInfo = __DEV__
      ? { effect: activeEffect, target, type, key }
      : undefined;

    trackEffects(dep, eventInfo);
  }
}
```

### 2. `createDep`

使用`createDep`创建一个新的`dep`。可以看到，`dep`是个`Set`实例，且添加了两个属性：

- `w`：`wasTracked`的首字母，表示当前依赖是否被收集；
- `n`：`newlyTracked`的首字母，表示当前依赖是否是新收集的。

```typescript
export const createDep = (effects?: ReactiveEffect[]): Dep => {
  const dep = new Set<ReactiveEffect>(effects) as Dep;
  dep.w = 0;
  dep.n = 0;
  return dep;
};
```

### 3. `trackEffects`

`trackEffects`用于收集副作用。主要把当前活跃的`activeEffect`加入`dep`，以及在`activeEffect.deps`中加入该副作用影响到的所有依赖。

```typescript
export function trackEffects(
  dep: Dep,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo
) {
  let shouldTrack = false;
  if (effectTrackDepth <= maxMarkerBits) {
    if (!newTracked(dep)) {
      dep.n |= trackOpBit; // set newly tracked
      shouldTrack = !wasTracked(dep);
    }
  } else {
    // Full cleanup mode.
    shouldTrack = !dep.has(activeEffect!);
  }

  // 当前依赖 dep 还未被捕获 / 当前依赖 dep 中，还没有当前活跃的副作用时，
  // 将当前活跃的副作用 effect 添加进 dep 里，同时在把 dep 加入受副作用影响的依赖集合 activeEffect.deps 中
  if (shouldTrack) {
    dep.add(activeEffect!);
    activeEffect!.deps.push(dep);
    if (__DEV__ && activeEffect!.onTrack) {
      activeEffect!.onTrack({
        effect: activeEffect!,
        ...debuggerEventExtraInfo!,
      });
    }
  }
}
```

### 4. 小结

用一句比较拗口的话来说，依赖收集就是把当前活跃的副作用`activeEffect`存入全局变量`targetMap`中的 ( `target` 对应的 `depsMap`) 中 （`target`的`key`）对应的 `dep` ( 类型为`Set`) 中，并把这个`dep`加入到受`activeEffect`副作用影响的所有依赖`activeEffect.deps`列表中。

## 四、`trigger`

触发更新实际上就是触发副作用，因此这一小节决定以与`track`相反的顺序来介绍。

### 1. `triggerEffect`

`triggerEffect`触发副作用从而更新。当触发更新的副作用`effect`允许自调用，且不是当前活跃的副作用时，通过调度器`scheduler`执行副作用或者直接执行`run`，是实际上触发更新的地方。

```typescript
function triggerEffect(
  effect: ReactiveEffect,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo
) {
  if (effect !== activeEffect || effect.allowRecurse) {
    if (__DEV__ && effect.onTrigger) {
      effect.onTrigger(extend({ effect }, debuggerEventExtraInfo));
    }
    // 实际触发更新的地方
    if (effect.scheduler) {
      effect.scheduler();
    } else {
      effect.run();
    }
  }
}
```

### 2. `triggerEffects`

接收一个`dep`和用于调试的额外信息。遍历`dep`中的`effect`，逐一使用`triggerEffect`来执行副作用。源码在这里有点蜜汁操作。

```typescript
export function triggerEffects(
  dep: Dep | ReactiveEffect[],
  debuggerEventExtraInfo?: DebuggerEventExtraInfo
) {
  // spread into array for stabilization
  const effects = isArray(dep) ? dep : [...dep];

  // 两者互斥，但是执行的操作相同？而且为什么不写在一个 for...of... 里 ？
  for (const effect of effects) {
    if (effect.computed) {
      triggerEffect(effect, debuggerEventExtraInfo);
    }
  }
  for (const effect of effects) {
    if (!effect.computed) {
      triggerEffect(effect, debuggerEventExtraInfo);
    }
  }
}
```

### 3. `trigger`

之前一直说`trigger`触发更新，其实是现在已经知道了，实际是`triggerEffect`来执行副作用从而实现更新。

这里是创建一个`deps`数组，根据`target`、`key`和触发更新的操作类型`type`等参数，来获取所有的相关`dep`，放入`deps`。再取出`deps`中所有的`dep`里的所有`effect`，放入`effects`列表中，通过`triggerEffects(effects)`来触发所有的相关副作用，最终实现更新。

需要注意的是对于数组：

- 修改`length`属性会导致该数组所有依赖的更新；
- 修数组新增成员会引起`length`属性相关的依赖的更新，因为`length`的值发生了变化。

```typescript
export function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown,
  oldTarget?: Map<unknown, unknown> | Set<unknown>
) {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    // never been tracked
    return;
  }

  // 用于聚集所有相关依赖
  let deps: (Dep | undefined)[] = [];

  if (type === TriggerOpTypes.CLEAR) {
    // 调用了Set、Map实例的clear方法，将触发全部相关的副作用
    // collection being cleared
    // trigger all effects for target
    deps = [...depsMap.values()];
  } else if (key === "length" && isArray(target)) {
    // 目标对象是数组，且修改了length属性时，会触发全部相关的副作用
    depsMap.forEach((dep, key) => {
      if (key === "length" || key >= (newValue as number)) {
        deps.push(dep);
      }
    });
  } else {
    // schedule runs for SET | ADD | DELETE
    if (key !== void 0) {
      deps.push(depsMap.get(key));
    }

    // also run for iteration key on ADD | DELETE | Map.SET
    switch (type) {
      case TriggerOpTypes.ADD:
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY));
          if (isMap(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY));
          }
        } else if (isIntegerKey(key)) {
          // 数组下标成员的更改 会引起 length 属性相关的更新
          // new index added to array -> length changes
          deps.push(depsMap.get("length"));
        }
        break;
      case TriggerOpTypes.DELETE:
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY));
          if (isMap(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY));
          }
        }
        break;
      case TriggerOpTypes.SET:
        if (isMap(target)) {
          deps.push(depsMap.get(ITERATE_KEY));
        }
        break;
    }
  }

  const eventInfo = __DEV__
    ? { target, type, key, newValue, oldValue, oldTarget }
    : undefined;

  if (deps.length === 1) {
    if (deps[0]) {
      if (__DEV__) {
        triggerEffects(deps[0], eventInfo);
      } else {
        triggerEffects(deps[0]);
      }
    }
  } else {
    const effects: ReactiveEffect[] = [];
    for (const dep of deps) {
      if (dep) {
        effects.push(...dep);
      }
    }
    // 这里triggerEffects接受的参数类型为Set，之前的是数组
    if (__DEV__) {
      triggerEffects(createDep(effects), eventInfo);
    } else {
      triggerEffects(createDep(effects));
    }
  }
}
```

## 五、小结

### 1. 依赖收集

`targetMap`中有`depsMap`（以`target`为`key`）；`depsMap`中有许多`dep`（以`targetMap`的`key`为`key`）；简单理解为：在编译时根据`target`和`key`，创建副作用，将`activeEffect`指向新建的副作用，并存放到相关的依赖`dep`里的过程就是依赖收集。

### 2. 触发更新

反过来，触发`target`、`key`相关的`dep`中所有相关的副作用，通过各个副作用上的`effect.scheduler()`或者`effect.run()`来实现更新。
