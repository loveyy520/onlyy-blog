---
title: Vue3源码系列 (四) ref
date: "2022-10-21 17:11"
updated: "2022-10-21 17:11"
tags:
  - 前 端
  - Vue3
keywords:
  - 前端
  - Vue
  - Vue3
  - 源码
  - ref
categories:
  - 前端
abbrlink: f1070434
swiper_index: 4
---

我们知道，一般用`reactive`来定义一个响应式对象，`ref`常用来定义一个响应式的原始值。上篇文章已经聊过了`reactive`，知晓了如何通过`Proxy`来对目标对象进行代理从而实现响应式，而非对象的这些原始值的响应式问题就交给`ref`来解决了。

## 一、`ref` 和 `shallowRef`的函数签名

`ref`和`shallowRef`各有三种重载，入参各不相同，都返回一个`Ref`/`ShallowRef`类型的值。通过`createRef`函数创建一个响应式的值。和 `reactive` 相似，`reactive`也是通过调用`createReactiveObject`来创建一个响应式的对象。而`createRef`创建并返回一个 `RefImpl` 实例。

```typescript
// ref
export function ref<T extends object>(
  value: T
): [T] extends [Ref] ? T : Ref<UnwrapRef<T>>;
export function ref<T>(value: T): Ref<UnwrapRef<T>>;
export function ref<T = any>(): Ref<T | undefined>;
export function ref(value?: unknown) {
  return createRef(value, false);
}

// shallowRef
export function shallowRef<T extends object>(
  value: T
): T extends Ref ? T : ShallowRef<T>;
export function shallowRef<T>(value: T): ShallowRef<T>;
export function shallowRef<T = any>(): ShallowRef<T | undefined>;
export function shallowRef(value?: unknown) {
  return createRef(value, true);
}

// ...

// createRef
function createRef(rawValue: unknown, shallow: boolean) {
  if (isRef(rawValue)) {
    return rawValue;
  }
  return new RefImpl(rawValue, shallow);
}
```

## 二、`RefImpl`

顺带一说，在`ts`里，关键字`class`既声明了一个值，也声明了一个`ts`类型。`RefImpl`算是`ref`的核心内容了，构造器函数接收两个参数，`value`是传入的原本的值，`__v_isShallow`在上一篇讲`reeactive`和`readonly`的文章里，也有这个属性，用于区别深层/浅层。且`isShallow()`函数也会利用这个属性来做判断。在这里两个作用，一是作为实例属性供`isShallow`判断；而是根据传入时来值来判断是否是浅层的`Ref`，因为函数`shallowRef`也是创建一个`RefImpl`实例。

可以看到，`Ref`的响应式实现就比较简单了，用`_value`属性来存储实际的值，用`dep`属性存储依赖，用在`class`的`getter`里通过`trackRefValue(this)`来收集依赖，在`setter`里调用`triggerRefValue(this, newVal)`。和`vue2`里的实现相似，只是这里使用的 `class` 的`getter`和`setter`，而`vue2`里使用的是属性描述符里的`getter`和`setter`。

```typescript
class RefImpl<T> {
  private _value: T;
  private _rawValue: T;

  public dep?: Dep = undefined;
  public readonly __v_isRef = true;

  constructor(value: T, public readonly __v_isShallow: boolean) {
    this._rawValue = __v_isShallow ? value : toRaw(value);
    this._value = __v_isShallow ? value : toReactive(value);
  }

  get value() {
    trackRefValue(this);
    return this._value;
  }

  set value(newVal) {
    const useDirectValue =
      this.__v_isShallow || isShallow(newVal) || isReadonly(newVal);
    // shallowRef或者 新值 是浅层的或者只读的，则设置值的之前对新值解包
    newVal = useDirectValue ? newVal : toRaw(newVal);
    // 对比新值和旧值，如果有改变则触发更新
    if (hasChanged(newVal, this._rawValue)) {
      this._rawValue = newVal;
      this._value = useDirectValue ? newVal : toReactive(newVal);
      triggerRefValue(this, newVal);
    }
  }
}
```

## 三、`trackRefValue`

`trackRefValue`用于收集`Ref`的依赖，接收一个`RefBase`类型的值。在`ref`函数中则是接收`RefImpl`的实例。`shouldTrack`是从`effect`的模块引入的，用做暂停和恢复捕获依赖的标志；`activeEffect`也是从`effect`的模块引入，标记当前活跃的`effect`。可以看到，内部调用`trackEffects`函数来收集依赖，该函数来自`effect`的模块，放在`effect`的篇章里讲。

```typescript
// trackRefValue
export function trackRefValue(ref: RefBase<any>) {
  if (shouldTrack && activeEffect) {
    // 对Ref进行解包
    ref = toRaw(ref);
    if (__DEV__) {
      trackEffects(ref.dep || (ref.dep = createDep()), {
        target: ref,
        type: TrackOpTypes.GET,
        key: "value",
      });
    } else {
      trackEffects(ref.dep || (ref.dep = createDep()));
    }
  }
}
```

## 四、`triggerRefValue`

`triggerRefValue`函数用于触发`Ref`的响应式更新。`triggerEffects`函数来自`effect`的模块，在`effect`的篇章里讲到。

```typescript
export function triggerRefValue(ref: RefBase<any>, newVal?: any) {
  // 对Ref进行解包
  ref = toRaw(ref);
  // 当有收集到依赖时，触发更新
  if (ref.dep) {
    if (__DEV__) {
      triggerEffects(ref.dep, {
        target: ref,
        type: TriggerOpTypes.SET,
        key: "value",
        newValue: newVal,
      });
    } else {
      triggerEffects(ref.dep);
    }
  }
}
```

## 五、`customRef` 和 `CustomRefImpl`

`Vue3`还提供了自定义的`Ref`，自己传入`getter`和`setter`，可以自由选择`track`和`trigger`的时机。

```typescript
class CustomRefImpl<T> {
  public dep?: Dep = undefined;

  private readonly _get: ReturnType<CustomRefFactory<T>>["get"];
  private readonly _set: ReturnType<CustomRefFactory<T>>["set"];

  public readonly __v_isRef = true;

  constructor(factory: CustomRefFactory<T>) {
    const { get, set } = factory(
      () => trackRefValue(this),
      () => triggerRefValue(this)
    );
    this._get = get;
    this._set = set;
  }

  get value() {
    return this._get();
  }

  set value(newVal) {
    this._set(newVal);
  }
}

export function customRef<T>(factory: CustomRefFactory<T>): Ref<T> {
  return new CustomRefImpl(factory) as any;
}
```

## 六、`toRef`、`toRefs` 和 `ObjectRefImpl`

在`setup`函数中返参时，我们有时候想要对响应式对象的某个属性进行解构，往往是用到`toRef`来创建一个`ObjectRefImpl`实例。

可以看到，原来的响应式对象依然被这个`ObjectRefImpl`实例通过`_object`属性引用。而在`getter`里面，会通过原本的响应式对象`_object`来访问该值，因而依赖的收集是由原本的响应式对象`_object`来进行的；同样的，在`setter`里，也是通过引用原本的响应式对象`_object`来达到赋值的操作，从而在`_object`中触发更新。也就是说，`ObjectRefImpl`不负责依赖收集和响应式更新，这些都是借由原本的响应式对象`_object`完成的。

`toRef`简要判断入参是否是一个`Ref`，是则直接返回，否则返回一个新建的`ObjectRefImpl`。

```typescript
class ObjectRefImpl<T extends object, K extends keyof T> {
  public readonly __v_isRef = true;

  constructor(
    // 私有只读属性 原本的响应式对象
    private readonly _object: T,
    private readonly _key: K,
    private readonly _defaultValue?: T[K]
  ) {}

  get value() {
    const val = this._object[this._key];
    return val === undefined ? (this._defaultValue as T[K]) : val;
  }

  set value(newVal) {
    this._object[this._key] = newVal;
  }
}

// ts类型ToRef<T>
export type ToRef<T> = IfAny<T, Ref<T>, [T] extends [Ref] ? T : Ref<T>>;

// 重载
export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K
): ToRef<T[K]>;

export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K,
  defaultValue: T[K]
): ToRef<Exclude<T[K], undefined>>;

export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K,
  defaultValue?: T[K]
): ToRef<T[K]> {
  const val = object[key];
  return isRef(val)
    ? val
    : (new ObjectRefImpl(object, key, defaultValue) as any);
}
```

而`toRefs`则是对传入的对象/数组进行遍历并进行`toRef`解构。

```typescript
export function toRefs<T extends object>(object: T): ToRefs<T> {
  if (__DEV__ && !isProxy(object)) {
    console.warn(
      `toRefs() expects a reactive object but received a plain one.`
    );
  }
  const ret: any = isArray(object) ? new Array(object.length) : {};
  for (const key in object) {
    ret[key] = toRef(object, key);
  }
  return ret;
}
```
