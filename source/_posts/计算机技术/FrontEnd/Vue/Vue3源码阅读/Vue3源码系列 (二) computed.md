---
title: Vue3源码系列 (二) computed
date: "2022-10-21 13:37"
updated: "2022-10-21 13:37"
tags:
  - 前端
  - Vue3
  - 源码阅读
keywords:
  - 前端
  - Vue
  - Vue3
  - 源码
  - computed
categories:
  - [源码]
  - [前端, Vue3]
abbrlink: 16fef359
cover: https://assets.onlyy.vip/photos/dont-starve/bg_winters_feast.png
---

想起上次面试，被问了个古老的问题：**watch 和 computed 的区别**。多少有点感慨，现在已经很少见这种耳熟能详的问题了，网络上八股文不少。今天，我更想分享一下从源码的层面来区别这八竿子打不着的两者。上一篇看了`watch`的源码，本篇针对**computed**做分析。

## 一、类型声明

`computed`的源码在`reactivity/src/computed.ts`里，先来看看相关的类型定义：

- `ComputedRef`：调用`computed`得到的值的类型，继承自`WritableComputedRef`；
- `WritableComputedRef`：继承自`Ref`，拓展了一个`effect`属性；
- `ComputedGetter`：传递给`ComputedRef`的构造器函数，用于创建`effect`；
- `ComputedSetter`：传递给`ComputedRef`的构造器函数，用于在实例的值被更改时，即在`set`中调用；
- `WritableComputedOptions`：可写的`Computed`选项，包含`get`和`set`，是`computed`函数接收的参数类型之一。

```typescript
declare const ComputedRefSymbol: unique symbol;

// ComputedRef的接口，调用computed()得到一个ComputedRef类型的值
export interface ComputedRef<T = any> extends WritableComputedRef<T> {
  readonly value: T;
  [ComputedRefSymbol]: true;
}

// WritableComputedRef继承了Ref并拓展了一个只读属性effect
export interface WritableComputedRef<T> extends Ref<T> {
  readonly effect: ReactiveEffect<T>;
}

// ComputedGetter 用于创建 effect ， ComputedSetter 对应的值在 ComputedRef 实例中的 set 里调用
export type ComputedGetter<T> = (...args: any[]) => T;
export type ComputedSetter<T> = (v: T) => void;

// 可写的Computed
export interface WritableComputedOptions<T> {
  get: ComputedGetter<T>;
  set: ComputedSetter<T>;
}
```

## 二、`ComputedRef`

而`computed()`返回一个`ComputedRef`类型的值，那么这个`ComputedRef`就至关重要了。从接口声明中可以看出，它继承了`Ref`，因而其实现也和`Ref`较为相似：接收`getter`、`setter`等，用`getter`来创建`effect`，由`effect.run()`来获取`value`，在`get`中返回；而`setter`在实例的值更改时，即在`set`中调用。

```typescript
export class ComputedRefImpl<T> {
  // dep: 收集的依赖
  public dep?: Dep = undefined;

  // getter获取的实际值
  private _value!: T;
  // 一个响应式的effect
  public readonly effect: ReactiveEffect<T>;
  // __v_isRef 提供给 isRef() 判断实例是否为Ref
  public readonly __v_isRef = true;
  public readonly [ReactiveFlags.IS_READONLY]: boolean = false;

  public _dirty = true;
  // 是否可缓存
  public _cacheable: boolean;

  // 构造器接收 getter 和 setter ，是否只读，是否出自 SSR
  constructor(
    getter: ComputedGetter<T>,
    // 接收只读的私有的 _setter
    private readonly _setter: ComputedSetter<T>,
    isReadonly: boolean,
    isSSR: boolean
  ) {
    // 用传入的 getter 创建一个 effect
    this.effect = new ReactiveEffect(getter, () => {
      if (!this._dirty) {
        this._dirty = true;
        triggerRefValue(this);
      }
    });
    // 把 effect 的 computed 属性指回 ComputedRef 实例自身
    this.effect.computed = this;
    this.effect.active = this._cacheable = !isSSR;
    this[ReactiveFlags.IS_READONLY] = isReadonly;
  }

  // 收集依赖，返回 this._value 的值
  get value() {
    // the computed ref may get wrapped by other proxies e.g. readonly() #3376
    const self = toRaw(this);
    // 收集Ref
    trackRefValue(self);
    if (self._dirty || !self._cacheable) {
      self._dirty = false;
      // effect.run() 会拿到 getter() 的值
      // 即_value的值来自于 effect，或者说来自于传入的 getter 的返回值
      self._value = self.effect.run()!;
    }
    return self._value;
  }

  // 当设置ComputedRef的实例的值时，调用传入的_setter
  set value(newValue: T) {
    this._setter(newValue);
  }
}
```

## 三、`computed`

### 1. `computed`的重载签名

**`computed`有两个**，主要是接收的第一个参数不同。**一是类型为`ComputedGetter`的函数`getter`，该函数返回一个值**；二是类型为`WritableComputedOptions`的**`options`，它是一个对象，包含`get`和`set`两个函数，作用可以大致理解为与属性描述符里的`get`和`set`相似**，但不是一回事，只是实现了相似的能力。事实上这个`get`的作用和第一种重载里的`getter`完全一致。换句话说，第一种重载没有`set`只有`get`，在后续的处理中，会给它包装一个`set`，只是包装的`set`只会触发警告。而第二种重载里自带`set`（由我们写代码时传入），除非我们传入的`set`是故意用于告警，否则是可以起作用的（通常在其中更新依赖数据的值，尤其是通过`emit`来告知父组件更新依赖数据）。

```typescript
export function computed<T>(
  getter: ComputedGetter<T>,
  debugOptions?: DebuggerOptions
): ComputedRef<T>;
export function computed<T>(
  options: WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions
): WritableComputedRef<T>;
```

### 2. `computed`的实现

- 判断我们传入的第一个参数是`getter`还是`options`；
- 如果是`getter`，则包装一个`setter`用于开发环境下告警；
- 如果是`options`，则取出其中的`get`和`set`，分别作为`getter`和`setter`；
- 用`getter`和`setter`创建一个`ComputedRef`实例并返回该实例。

```typescript
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions,
  isSSR = false
) {
  let getter: ComputedGetter<T>;
  let setter: ComputedSetter<T>;

  // 判断是getter还是options
  const onlyGetter = isFunction(getterOrOptions);
  if (onlyGetter) {
    getter = getterOrOptions;
    // 包装setter
    setter = __DEV__
      ? () => {
          console.warn("Write operation failed: computed value is readonly");
        }
      : NOOP;
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }

  // 创建并返回一个ComputedRef，
  // 第三个参数控制是否是只读的ComputedRef实例
  const cRef = new ComputedRefImpl(
    getter,
    setter,
    onlyGetter || !setter,
    isSSR
  );

  // 主要是开发环境下调试用
  if (__DEV__ && debugOptions && !isSSR) {
    cRef.effect.onTrack = debugOptions.onTrack;
    cRef.effect.onTrigger = debugOptions.onTrigger;
  }

  return cRef as any;
}
```

我们知道，在`computed`里是不允许异步操作的，但是看完了`computed`的源码，好像也没发现哪里不允许异步操作。确实，单纯就`computed`的源码来看，它是允许异步操作的，但是`computed`作为计算属性，大致上是取`getter`的返回值，`return`是等不到异步操作结束的。而禁用异步操作的规定是在`eslint-plugin-vue`这个包中的`lib/rules/no-async-in-computed-properties.js`文件里的规定。

看完这两篇，下次如果还有人问`watch`和`computed`的区别这种古董问题，就从源码上逐一比较吧。
