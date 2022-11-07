---
title: Vue3源码系列 (一) watch
date: "2022-10-20 15:14"
updated: "2022-10-20 15:14"
tags:
  - 前端
  - Vue3
  - 源码阅读
keywords:
  - 前端
  - Vue
  - Vue3
  - 源码
  - watch
categories:
  - 前端
  - Vue3
  - [源码]
abbrlink: dd689204
---

想起上次面试，问了个古老的问题：**watch 和 computed 的区别**。多少有点感慨，现在已经很少见这种耳熟能详的问题了，网络上八股文不少。今天，我更想分享一下从源码的层面来区别这八竿子打不着的两者。本篇针对**watch**做分析，下一篇分析**computed**。

## 一、`watch`参数类型

我们知道，`vue3`里的`watch`接收三个参数：侦听的数据源`source`、回调`cb`、以及可选的`optiions`。

### 1. 选项`options`

我们可以在`options`里根据需要设置**`immediate`**来控制是否立即执行一次回调；设置**`deep`**来控制是否进行深度侦听；设置**`flush`**来控制回调的触发时机，默认为`{ flush: 'pre' }`，即`vue`组件更新前；若设置为`{ flush: 'post' }`则回调将在`vue`组件更新之后触发；此外还可以设置为`{ flush: 'sync' }`，表示同步触发；以及设置收集依赖时的`onTrack`和触发更新时的`onTrigger`两个`listener`，主要用于`debugger`。`watch`函数会返回一个`watchStopHandle`用于停止侦听。**`options`**的类型便是`WatchOptions`，在源码中的声明如下：

```typescript
// reactivity/src/effect.ts
export interface DebuggerOptions {
  onTrack?: (event: DebuggerEvent) => void;
  onTrigger?: (event: DebuggerEvent) => void;
}

// runtime-core/apiWatch.ts
export interface WatchOptionsBase extends DebuggerOptions {
  flush?: "pre" | "post" | "sync";
}

export interface WatchOptions<Immediate = boolean> extends WatchOptionsBase {
  immediate?: Immediate;
  deep?: boolean;
}
```

### 2. 回调`cb`

了解完`options`，接下来我们看看回调**`cb`**。通常我们的`cb`接收三个参数：`value`、`oldValue`和`onCleanUp`，然后执行我们需要的操作，比如侦听表格的页码，发生变化时重新请求数据。第三个参数`onCleanUp`，用于注册副作用清理的回调函数, 在副作用下次执行之前，这个回调函数会被调用，通常用来清除不需要的或者无效的副作用。

```typescript
// 副作用
export type WatchEffect = (onCleanup: OnCleanup) => void;

export type WatchCallback<V = any, OV = any> = (
  value: V,
  oldValue: OV,
  onCleanup: OnCleanup
) => any;

type OnCleanup = (cleanupFn: () => void) => void;
```

### 3. 数据源`source`

`watch`函数可以侦听单个数据或者多个数据，共有四种重载，对应四种类型的`source`。其中，单个数据源的类型有`WatchSource`和响应式的`object`，多个数据源的类型为`MultiWatchSources`，`Readonly<MultiWatchSources>`，而`MultiWatchSources`其实也就是由单个数据源组成的数组。

```typescript
// 单数据源类型：可以是 Ref 或 ComputedRef 或 函数
export type WatchSource<T = any> = Ref<T> | ComputedRef<T> | (() => T);

// 多数据源类型
type MultiWatchSources = (WatchSource<unknown> | object)[];
```

## 二、`watch`函数

下面是源码中的类型声明，以及`watch`的重载签名和实现签名：

```typescript
// watch的重载与实现
export function watch<
  T extends MultiWatchSources,
  Immediate extends Readonly<boolean> = false
>(
  sources: [...T],
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

// overload: multiple sources w/ `as const`
// watch([foo, bar] as const, () => {})
// somehow [...T] breaks when the type is readonly
export function watch<
  T extends Readonly<MultiWatchSources>,
  Immediate extends Readonly<boolean> = false
>(
  source: T,
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

// overload: single source + cb
export function watch<T, Immediate extends Readonly<boolean> = false>(
  source: WatchSource<T>,
  cb: WatchCallback<T, Immediate extends true ? T | undefined : T>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

// overload: watching reactive object w/ cb
export function watch<
  T extends object,
  Immediate extends Readonly<boolean> = false
>(
  source: T,
  cb: WatchCallback<T, Immediate extends true ? T | undefined : T>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

// implementation
export function watch<T = any, Immediate extends Readonly<boolean> = false>(
  source: T | WatchSource<T>,
  cb: any,
  options?: WatchOptions<Immediate>
): WatchStopHandle {
  if (__DEV__ && !isFunction(cb)) {
    warn(
      ``watch(fn, options?)` signature has been moved to a separate API. ` +
        `Use `watchEffect(fn, options?)` instead. `watch` now only ` +
        `supports `watch(source, cb, options?) signature.`
    )
  }
  return doWatch(source as any, cb, options)
}
```

在`watch`的实现签名中可以看到，和`watchEffect`不同，`watch`的第二个参数`cb`必须是函数，否则会警告。最后，尾调用了`doWatch`，那么具体的实现细节就都得看`doWatch`了。让我们来瞅瞅它到底是何方神圣。

## 三、`watch`的核心：`doWatch` 函数

先瞄一下`doWatch`的签名：接收的参数大体和`watch`一致，其中`source`里多了个`WatchEffect`类型，这是由于在`watchApi.js`文件里，还导出了三个函数：`watchEffect`、`watchSyncEffect`和`watchPostEffect`，它们接收的第一个参数的类型就是`WatchEffect`，然后传递给`doWatch`，会在后面讲到，也可能不会；而`options`默认值为空对象，函数返回一个`WatchStopHandle`，用于停止侦听。

```typescript
function doWatch(
  source: WatchSource | WatchSource[] | WatchEffect | object,
  cb: WatchCallback | null,
  { immediate, deep, flush, onTrack, onTrigger }: WatchOptions = EMPTY_OBJ
): WatchStopHandle {
  // ...
}
```

再来看看`doWatch`的函数体，了解一下它干了些啥：

首先是判断在没有`cb`的情况下，如果`options`里设置了`immediate`和`deep`，就会告警，这俩属性只对有`cb`的`doWatch`签名有效。其实也就是上面说到的`watchEffect`等三个函数，它们是没有`cb`这个参数的，因此它们设置的`immediate`和`deep`是无效的。声明一个当`source`参数不合法时的警告函数，代码如下：

```typescript
if (__DEV__ && !cb) {
  if (immediate !== undefined) {
    warn(
      `watch() "immediate" option is only respected when using the ` +
        `watch(source, callback, options?) signature.`
    );
  }
  if (deep !== undefined) {
    warn(
      `watch() "deep" option is only respected when using the ` +
        `watch(source, callback, options?) signature.`
    );
  }
}

// 声明一个source参数不合法的警告函数
const warnInvalidSource = (s: unknown) => {
  warn(
    `Invalid watch source: `,
    s,
    `A watch source can only be a getter/effect function, a ref, ` +
      `a reactive object, or an array of these types.`
  );
};
// ...
```

接下来，就到了正文了。**第一步的目标是设置`getter`，顺便配置一下强制触发和深层侦听**等。**拿到`getter`的目的是为了之后创建`effect`**，`vue3`的响应式离不开`effect`，日后再出一篇文章介绍。

先拿到当前实例，声明了空的 getter，初始化关闭强制触发，且默认为单数据源的侦听，然后根据传入的`source`的类型，做不同的处理：

- `Ref`: `getter`返回值为`Ref`的·`value`,强制触发由`source`是否为浅层的`Ref`决定；
- `Reactive`响应式对象：`getter`的返回值为`source`本身，且设置深层侦听；
- `Array`：`source`为数组，则是多数据源侦听，将`isMultiSource`设置为`true`，强制触发由数组中是否存在`Reactive`响应式对象或者浅层的`Ref`来决定；并且设置`getter`的返回值为从`source`映射而来的新数组；
- `function`：当`source`为函数时，会判断有无`cb`，有`cb`则是`watch`，否则是`watchEffect`等。当有`cb`时，使用`callWithErrorHandling`包裹一层来调用`source`得到的结果，作为`getter`的返回值；
- `otherTypes`：其它类型，则告警`source`参数不合法，且`getter`设置为`NOOP`，一个空的函数。

```typescript
// 拿到当前实例，声明了空的getter，初始化关闭强制触发，且默认为单数据源的侦听
const instance = currentInstance;
let getter: () => any;
let forceTrigger = false;
let isMultiSource = false;

// 根据侦听数据源的类型做相应的处理
if (isRef(source)) {
  getter = () => source.value;
  forceTrigger = isShallow(source);
} else if (isReactive(source)) {
  getter = () => source;
  deep = true;
} else if (isArray(source)) {
  isMultiSource = true;
  forceTrigger = source.some((s) => isReactive(s) || isShallow(s));
  getter = () =>
    // 可见，数组成员只能是Ref、Reactive或者函数，其它类型无法通过校验，将引发告警
    source.map((s) => {
      if (isRef(s)) {
        return s.value;
      } else if (isReactive(s)) {
        return traverse(s);
      } else if (isFunction(s)) {
        return callWithErrorHandling(s, instance, ErrorCodes.WATCH_GETTER);
      } else {
        __DEV__ && warnInvalidSource(s);
      }
    });
} else if (isFunction(source)) {
  if (cb) {
    // getter with cb
    getter = () =>
      callWithErrorHandling(source, instance, ErrorCodes.WATCH_GETTER);
  } else {
    // no cb -> simple effect
    getter = () => {
      if (instance && instance.isUnmounted) {
        return;
      }
      if (cleanup) {
        cleanup();
      }
      return callWithAsyncErrorHandling(
        source,
        instance,
        ErrorCodes.WATCH_CALLBACK,
        [onCleanup]
      );
    };
  }
} else {
  getter = NOOP;
  __DEV__ && warnInvalidSource(source);
}
```

然后还顺便兼容了下`vue2.x`版本的`watch`：

```typescript
// 2.x array mutation watch compat
if (__COMPAT__ && cb && !deep) {
  const baseGetter = getter;
  getter = () => {
    const val = baseGetter();
    if (
      isArray(val) &&
      checkCompatEnabled(DeprecationTypes.WATCH_ARRAY, instance)
    ) {
      traverse(val);
    }
    return val;
  };
}
```

然后判断了下`deep`和`cb`，在深度侦听且有`cb`的情况下（说白了就是`watch`而不是`watchEffect`等），对`getter`做个`traverse`，该函数的作用是对`getter`的返回值做一个递归遍历，将遍历到的值添加到一个叫做`seen`的集合中，`seen`的成员即为当前`watch`要侦听的那些数据。代码如下（影响主线可先跳过）：

```typescript
export function traverse(value: unknown, seen?: Set<unknown>) {
  if (!isObject(value) || (value as any)[ReactiveFlags.SKIP]) {
    return value;
  }
  seen = seen || new Set();
  if (seen.has(value)) {
    return value;
  }
  seen.add(value);
  // Ref
  if (isRef(value)) {
    traverse(value.value, seen);
  } else if (isArray(value)) {
    // 数组
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], seen);
    }
  } else if (isSet(value) || isMap(value)) {
    // 集合与映射
    value.forEach((v: any) => {
      traverse(v, seen);
    });
  } else if (isPlainObject(value)) {
    // 普通对象
    for (const key in value) {
      traverse((value as any)[key], seen);
    }
  }
  return value;
}
```

至此，`getter`就设置好了。之后声明了`cleanup`和`onCleanup`，用于清除副作用。以及`SSR`检测。虽然不是本文的重点，但还是贴一下源码：

```typescript
let cleanup: () => void;
let onCleanup: OnCleanup = (fn: () => void) => {
  cleanup = effect.onStop = () => {
    callWithErrorHandling(fn, instance, ErrorCodes.WATCH_CLEANUP);
  };
};

// in SSR there is no need to setup an actual effect, and it should be noop
// unless it's eager
if (__SSR__ && isInSSRComponentSetup) {
  // we will also not call the invalidate callback (+ runner is not set up)
  onCleanup = NOOP;
  if (!cb) {
    getter();
  } else if (immediate) {
    callWithAsyncErrorHandling(cb, instance, ErrorCodes.WATCH_CALLBACK, [
      getter(),
      isMultiSource ? [] : undefined,
      onCleanup,
    ]);
  }
  return NOOP;
}
```

随后就是重头戏了，拿到`oldValue`，以及在`job`函数中取得`newValue`，这不就是我们在使用`watch`的时候的熟悉套路嘛。

```typescript
let oldValue = isMultiSource ? [] : INITIAL_WATCHER_VALUE;

// job为当前watch要做的工作，后续通过调度器来处理
const job: SchedulerJob = () => {
  // 当前effect不在active状态，说明没有触发该effect的响应式变化，直接返回
  if (!effect.active) {
    return;
  }
  // cb存在，说明是watch，而不是watchEffect
  if (cb) {
    // watch(source, cb)
    // 调用 effect.run 得到新的值 newValue
    const newValue = effect.run();
    if (
      deep ||
      forceTrigger ||
      // 取到的新值和旧值是否相同，如果有变化则进入分支
      (isMultiSource
        ? (newValue as any[]).some((v, i) =>
            hasChanged(v, (oldValue as any[])[i])
          )
        : hasChanged(newValue, oldValue)) ||
      // 兼容2.x
      (__COMPAT__ &&
        isArray(newValue) &&
        isCompatEnabled(DeprecationTypes.WATCH_ARRAY, instance))
    ) {
      // cleanup before running cb again
      if (cleanup) {
        cleanup();
      }
      // 用异步异常处理程序包裹了一层来调用cb
      callWithAsyncErrorHandling(cb, instance, ErrorCodes.WATCH_CALLBACK, [
        newValue,
        // pass undefined as the old value when it's changed for the first time
        oldValue === INITIAL_WATCHER_VALUE ? undefined : oldValue,
        onCleanup,
      ]);
      // cb执行完成，当前的新值就变成了旧值
      oldValue = newValue;
    }
  } else {
    // cb不存在，则是watchEffect
    // watchEffect
    effect.run();
  }
};

// 设置allowRecurse，让调度器知道它可以自己触发
job.allowRecurse = !!cb;
```

一看`job`里，在`watch`的分支出现了`effect`，但是这个分支并没有`effect`呀，再往下看，噢，原来是由之前取得的`getter`来创建的`effect`。在这之前，还定义了调度器，调度器`scheduler`被糅合进了`effect`里，影响了`newValue`的获取，从而影响`cb`的调用时机：

- `sync`：同步执行，也就是回调`cb`直接执行；
- `pre`：默认值是`pre`，表示组件更新前执行；
- `post`：组件更新后执行。

```typescript
let scheduler: EffectScheduler;

// 根据flush的值来创建不同的调度器
if (flush === "sync") {
  scheduler = job as any; // the scheduler function gets called directly
} else if (flush === "post") {
  scheduler = () => queuePostRenderEffect(job, instance && instance.suspense);
} else {
  // default: 'pre'
  scheduler = () => queuePreFlushCb(job);
}

// 为 watch 创建 effect ，watchEffect就不必了，因为自带的有
const effect = new ReactiveEffect(getter, scheduler);

// 主要是调试用的onTrack和onTrigger，当收集依赖和触发更新时做一些操作
if (__DEV__) {
  effect.onTrack = onTrack;
  effect.onTrigger = onTrigger;
}
```

现在来到了`doWatch`最后的环节了：侦听器的初始化。

- `immediate`：如果为真值。将直接调用一次`job`，上文我们知道，`job`是包裹了一层错误处理程序来调用`cb`，所以我们现在终于亲眼看到了为什么`immediate`能让`cb`立即触发一次。

```typescript
// initial run
// 有cb，是 watch
if (cb) {
  if (immediate) {
    job();
  } else {
    // 获取一下当前的值作为旧值
    oldValue = effect.run();
  }
} else if (flush === "post") {
  // 没有cb，是watchEffect，副作用的时机在组件更新之后，用queuePostRenderEffect包裹一层来调整时机
  queuePostRenderEffect(effect.run.bind(effect), instance && instance.suspense);
} else {
  // watchEffect，副作用的时机在组件更新之前，直接执行一次effect.run
  effect.run();
}

// 返回一个WatchStopHandle，内部执行 effect.stop来达到停止侦听的作用
return () => {
  effect.stop();
  // 移除当前实例作用域下的当前effect
  if (instance && instance.scope) {
    remove(instance.scope.effects!, effect);
  }
};
```

到这里，`watch`的源码算是差不多结束了。小结一下核心流程：

- `watch`：判断若没有`cb`则告警；
- `watch`：尾调用`doWatch`，之后的操作都在`doWatch`里进行；
- `doWatch`：判断没有`cb`时若设置了`deep`或`immediate`则告警；
- `doWatch`：根据`source`的类型得到`getter`；
- `doWatch`：如果`cb`存在且`deep`为真则对`getter()`进行递归遍历；
- `doWatch`：获取`oldValue`，声明`job`函数，在`job`内部获取`newValue`并使用`callWithAsyncErrorHandling`来调用`cb`。
- `doWatch`：根据`post`的值定义的调度器`scheduler`；
- `doWatch`：根据`getter`和`scheduler`创建`effect`；
- `doWatch`：初始化侦听器，如果有`cb`且`immediate`为真值，则立即调用`job`函数，相当于调用我们写的`cb`；如果`immediate`为假值，则只调用`effect.run()`来初始化`oldValue`；
- `doWatch`：返回一个`WatchStopHandle`，内部通过`effect.stop()`来实现停止侦听。
- `watch`：接收到`doWatch`返回的`WatchStopHandle`，并返回给外部使用。
