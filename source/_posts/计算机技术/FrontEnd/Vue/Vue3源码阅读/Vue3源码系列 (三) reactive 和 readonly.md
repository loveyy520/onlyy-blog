---
title: Vue3源码系列 (三) reactive 和 readonly
date: "2022-10-21 13:39"
updated: "2022-10-21 13:39"
tags:
  - 前 端
  - Vue3
keywords:
  - 前端
  - Vue
  - Vue3
  - 源码
  - reactive
  - readonly
categories:
  - 前端
abbrlink: f9a32caf
swiper_index: 3
---

上次一起阅读了`watch`和`computed`的源码，其实应该先看副作用`effect`，因为各个响应式的`API`里基本都用到了，等结束了`reactive`和`readonly`和`ref`，就一起看看`effect`。这次要说的是`reactive`和`readonly`，两者在实现上流程大体一致。尤其是对`Map`和`Set`的方法的代理拦截，多少有点妙。

## 一、`reactive` 和 `readonly`

`Vue3`使用`Proxy`来替代`Vue2`中`Object.defineProperty`。

```typescript
const target = {
  name: "onlyy~",
};

// 创建一个对target的代理
const proxy = new Proxy(target, {
  // ...各种handler，例如get，set...
  get(target, property, receiver) {
    // 其它操作
    // ...
    return Reflect.get(target, property, receiver);
  },
});
```

### 1. `reactive`相关类型

`reactive`利用`Proxy`来定义一个响应式对象。

- `Target`：目标对象，包含几个标志，以及`__v_raw`字段，该字段表示它原本的非响应式状态的值；

```typescript
export interface Target {
  [ReactiveFlags.SKIP]?: boolean;
  [ReactiveFlags.IS_REACTIVE]?: boolean;
  [ReactiveFlags.IS_READONLY]?: boolean;
  [ReactiveFlags.IS_SHALLOW]?: boolean;
  [ReactiveFlags.RAW]?: any;
}

export const reactiveMap = new WeakMap<Target, any>();
export const shallowReactiveMap = new WeakMap<Target, any>();
export const readonlyMap = new WeakMap<Target, any>();
export const shallowReadonlyMap = new WeakMap<Target, any>();

const enum TargetType {
  INVALID = 0,
  COMMON = 1,
  COLLECTION = 2,
}
```

### 2. 相关全局变量与方法

- `ReactiveFlags`：定义了各种标志对应的字符串（作为`reactive`对象的属性）的枚举；
- `reactiveMap`
- `shallowReactiveMap`
- `readonlyMap`
- `shallowReadonlyMap`：这几个`Map`分别用于存放对应`API`生成的响应式对象（以目标对象为`key`，代理对象为`value`），便于后续判断某个对象是否存在已创建的响应式对象；
- `TargetType`：枚举成员的内容分别用于区分代理目标是否校验合法、普通对象、`Set`或`Map`；

```typescript
// 各个标志枚举
export const enum ReactiveFlags {
  SKIP = "__v_skip",
  IS_REACTIVE = "__v_isReactive",
  IS_READONLY = "__v_isReadonly",
  IS_SHALLOW = "__v_isShallow",
  RAW = "__v_raw",
}

// ...

export const reactiveMap = new WeakMap<Target, any>();
export const shallowReactiveMap = new WeakMap<Target, any>();
export const readonlyMap = new WeakMap<Target, any>();
export const shallowReadonlyMap = new WeakMap<Target, any>();

const enum TargetType {
  INVALID = 0,
  COMMON = 1,
  COLLECTION = 2,
}
```

然后是两个函数：`targetTypeMap`用于判断各种`JS`类型属于`TargetType`中的哪种；`getTargetType`用于获取`target`对应的`TargetType`类型。

```typescript
function targetTypeMap(rawType: string) {
  switch (rawType) {
    case "Object":
    case "Array":
      return TargetType.COMMON;
    case "Map":
    case "Set":
    case "WeakMap":
    case "WeakSet":
      return TargetType.COLLECTION;
    default:
      return TargetType.INVALID;
  }
}

function getTargetType(value: Target) {
  return value[ReactiveFlags.SKIP] || !Object.isExtensible(value)
    ? TargetType.INVALID
    : targetTypeMap(toRawType(value));
}
```

### 3. `reactive`函数

`reactive`入参类型为`object`，返回值类型是`UnwrapNestedRefs`，对嵌套的`Ref`进行了解包。意味着即使`reactive`接收一个`Ref`，其返回值也不用再像`Ref`那样通过`.value`来读取值。源码的注释中也给出了示例。

```typescript
/*
 * const count = ref(0)
 * const obj = reactive({
 *   count
 * })
 *
 * obj.count++
 * obj.count // -> 1
 * count.value // -> 1
 */
```

`reactive`内部调用`createReactiveObject`来创建响应式对象。瞄一眼入参有五个：

- `target`：代理目标；
- `false`：对应`createReactiveObject`的`isReadonly`参数；
- `mutableHandlers`：普通对象和数组的代理处理程序；
- `mutableCollectionHandlers`：`Set`和`Map`的代理处理程序；
- `reactiveMap`：之前定义的全局变量，收集`reactive`对应的依赖。

```typescript
export function reactive<T extends object>(target: T): UnwrapNestedRefs<T>;
export function reactive(target: object) {
  // if trying to observe a readonly proxy, return the readonly version.
  if (isReadonly(target)) {
    return target;
  }
  return createReactiveObject(
    target,
    false,
    mutableHandlers,
    mutableCollectionHandlers,
    reactiveMap
  );
}
```

### 4. 造物主`createReactiveObject`

不论是`reactive`，还是`shallowReactive`、`readonly`和`shallowReadonly`，都是内部调用`createReactiveObject`来创建代理的。`createReactiveObject`也没什么操作，主要判断了下`target`的类型，再决定是直接返回`target`还是返回一个新建的`proxy`。

以下情况直接返回`target`：

- `target`不是对象；
- `target`已经是一个响应式的对象，即由`createReactiveObject`创建的`proxy`；
- `target`类型校验不合法，例如`RegExp`、`Date`等；

当参数`proxyMap`对应的实参（可能为`reactiveMap`、`shallowReactiveMap`、`readonlyMap`或`shallowReadonlyMap`，分别对应`ractive`、`shallowReactive`、`readonly`和`shallowReadonly`四个`API`）里已经存在了`target`的响应式对象时，直接取出并返回该响应式对象；

否则，创建一个`target`的响应式对象`proxy`，将`proxy`加入到`proxyMap`中，然后返回该`proxy`。

```typescript
function createReactiveObject(
  target: Target,
  isReadonly: boolean,
  baseHandlers: ProxyHandler<any>,
  collectionHandlers: ProxyHandler<any>,
  proxyMap: WeakMap<Target, any>
) {
  if (!isObject(target)) {
    if (__DEV__) {
      console.warn(`value cannot be made reactive: ${String(target)}`);
    }
    return target;
  }
  // target is already a Proxy, return it.
  // exception: calling readonly() on a reactive object
  if (
    target[ReactiveFlags.RAW] &&
    !(isReadonly && target[ReactiveFlags.IS_REACTIVE])
  ) {
    return target;
  }
  // target already has corresponding Proxy
  const existingProxy = proxyMap.get(target);
  if (existingProxy) {
    return existingProxy;
  }
  // only specific value types can be observed.
  const targetType = getTargetType(target);
  if (targetType === TargetType.INVALID) {
    return target;
  }
  const proxy = new Proxy(
    target,
    targetType === TargetType.COLLECTION ? collectionHandlers : baseHandlers
  );
  proxyMap.set(target, proxy);
  return proxy;
}
```

我们知道，代理的重点其实在与代理的处理程序，`createReactiveObject`根据普通对象和数组类型、`Set`和`Map`类型来区分`baseHandlers`和`collectionHandlers`。

### 5. `shallowReactive`、`readonly`和`shallowReadonly`

事实上，`ractive`、`shallowReactive`、`readonly`和`shallowReadonly`这几个函数形式上基本一致，都是通过`createReactiveObject`来创建响应式对象，存储在对应的`proxyMap`里，但是对应的`baseHandlers`和`collectionHandlers`有区别。

```typescript
// shallowReactive
export function shallowReactive<T extends object>(
  target: T
): ShallowReactive<T> {
  return createReactiveObject(
    target,
    false,
    shallowReactiveHandlers,
    shallowCollectionHandlers,
    shallowReactiveMap
  );
}

// raedonly
// 注意readonly不是响应式的，而是一个原对象的只读的拷贝
// 具体实现在对应的handlers里
export function readonly<T extends object>(
  target: T
): DeepReadonly<UnwrapNestedRefs<T>> {
  return createReactiveObject(
    target,
    true,
    readonlyHandlers,
    readonlyCollectionHandlers,
    readonlyMap
  );
}

// shallowReadonly
// 是响应式的
// 只有最外层是只读的
export function shallowReadonly<T extends object>(target: T): Readonly<T> {
  return createReactiveObject(
    target,
    true,
    shallowReadonlyHandlers,
    shallowReadonlyCollectionHandlers,
    shallowReadonlyMap
  );
}
```

事实上，`ractive`、`shallowReactive`、`readonly`和`shallowReadonly`这几个函数形式上基本一致，都是通过`createReactiveObject`来创建响应式对象，存储在对应的`proxyMap`里，但是对应的`baseHandlers`和`collectionHandlers`有区别。那么我们就知道了，其实重点都在各种`handlers`里。

## 二、对应的 `Handlers`

`baseHandlers`用于普通对象和数组的代理，`collectionHandlers`用于`Set`、`Map`等的代理。对应`ractive`、`shallowReactive`、`readonly`和`shallowReadonly`四个`API`，每一个都有自己的`baseHandlers`和`collectionHandlers`。

### 1. `baseHandlers`

在`packages/reactivity/src/baseHandlers.ts`文件中。分别导出了这 4 个`API`对应的`baseHandlers`。

#### 1.1 `reactive`

`reactive`的`baseHandlers`中有 5 个代理程序。

```typescript
// reactive
export const mutableHandlers: ProxyHandler<object> = {
  get,
  set,
  deleteProperty,
  has,
  ownKeys,
};
```

在拦截过程中，在`get`、`has`和`ownKey`这几个访问程序中进行依赖捕获(`track`)，在`set`和`deleteProperty`这俩用于更改的程序中触发更新(`trigger`) 。

`get`和`set`分别由函数`createGetter`和`createSetter`创建，这俩函数根据入参的不同，返回不同的`get`和`set`，`readonly`等`API`的`baseHandlers`中的`get`和`set`也大都源于此，除了两种`readonly`中用于告警的`set`。

##### (1) `get`

`createGetter`两个入参：`isReadonly`和`isShallow`，两两组合正好对应四个`API`。

- `shallow`：为`true`时不会进入递归环节，因此是浅层的处理；
- `isReadonly`：在`createGetter`中影响`proxyMap`的选择和递归时`API`的选择，它主要发挥作用是在`set`中。

```typescript
function createGetter(isReadonly = false, shallow = false) {
  return function get(target: Target, key: string | symbol, receiver: object) {
    // 以下几个if分支判断target是否已经是由这几个API创建的代理对象，代理得到的proxy才具有这些key
    if (key === ReactiveFlags.IS_REACTIVE) {
      // 是否是响应式对象
      return !isReadonly;
    } else if (key === ReactiveFlags.IS_READONLY) {
      // 是否是只读对象
      return isReadonly;
    } else if (key === ReactiveFlags.IS_SHALLOW) {
      // 是否是浅层的 响应式/只读 对象
      return shallow;
    } else if (
      // __v_raw 属性对应 代理对象的目标对象
      // 当该属性有值，且在相应的proxyMap中存在代理对象时，说明target已经是一个proxy了
      // __v_raw 属性对应的值为target本身
      key === ReactiveFlags.RAW &&
      receiver ===
        (isReadonly
          ? shallow
            ? shallowReadonlyMap
            : readonlyMap
          : shallow
          ? shallowReactiveMap
          : reactiveMap
        ).get(target)
    ) {
      return target;
    }

    const targetIsArray = isArray(target);

    // 对数组的几个方法进行代理，在'includes', 'indexOf', 'lastIndexOf'等方法中进行track捕获依赖
    if (!isReadonly && targetIsArray && hasOwn(arrayInstrumentations, key)) {
      return Reflect.get(arrayInstrumentations, key, receiver);
    }

    const res = Reflect.get(target, key, receiver);

    if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res;
    }

    // 如果不是readonly，则捕获依赖，因此，readonly 为非响应式的
    if (!isReadonly) {
      track(target, TrackOpTypes.GET, key);
    }

    if (shallow) {
      return res;
    }

    // 如果get到的值是一个Ref，会直接解包，无需再使用 .value 来获取真正需要的值
    // 除非目标对象target是数组，或者当前的key是整数
    // 例如，obj[0]，即使是一个Ref也不会直接解包，使用的时候依然要 obj[0].value
    // shallow没有走到这一步，因此也不会自动解包
    if (isRef(res)) {
      // ref unwrapping - skip unwrap for Array + integer key.
      return targetIsArray && isIntegerKey(key) ? res : res.value;
    }

    // 当get到的值是对象时，根据是否是readonly来递归操作，需要防止对象循环引用
    // shallow没有走到这一步，因此shallow是浅层的
    if (isObject(res)) {
      // Convert returned value into a proxy as well. we do the isObject check
      // here to avoid invalid value warning. Also need to lazy access readonly
      // and reactive here to avoid circular dependency.
      return isReadonly ? readonly(res) : reactive(res);
    }

    return res;
  };
}
```

##### (2) `set`

对于`reactive`，可以说最主要的任务就是在`set`中触发更新，`set`包括 新增 和 修改 属性值。如果当前的`key`对应的值是一个`Ref`，且其它条件满足时，则触发更新的操作是在`Ref`的内部。这些在后续讲解`Ref`的时候会提到。

```typescript
function createSetter(shallow = false) {
  return function set(
    target: object,
    key: string | symbol,
    value: unknown,
    receiver: object
  ): boolean {
    let oldValue = (target as any)[key];
    // 当前值是Readonly的Ref，而新值不是Ref时，不允许修改
    if (isReadonly(oldValue) && isRef(oldValue) && !isRef(value)) {
      return false;
    }
    // 如果是深层的修改
    if (!shallow) {
      // 解出原本的非proxy值
      if (!isShallow(value) && !isReadonly(value)) {
        oldValue = toRaw(oldValue);
        value = toRaw(value);
      }
      // 目标对象非数组，当前key的值是Ref而新值不是Ref，则通过 .value 赋值
      // 在Ref内部触发更新
      if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
        oldValue.value = value;
        return true;
      }
    } else {
      // 浅层模式下，忽略对象是否是响应式的
      // in shallow mode, objects are set as-is regardless of reactive or not
    }

    // 然后是触发更新的部分了

    // 判断当前key是否已经存在于target上
    const hadKey =
      isArray(target) && isIntegerKey(key)
        ? Number(key) < target.length
        : hasOwn(target, key);
    const result = Reflect.set(target, key, value, receiver);
    // don't trigger if target is something up in the prototype chain of original
    // 如果是原型链上的字段则不会触发更新
    if (target === toRaw(receiver)) {
      if (!hadKey) {
        // 当前的key已经存在，触发新增的更新
        trigger(target, TriggerOpTypes.ADD, key, value);
      } else if (hasChanged(value, oldValue)) {
        // 当前key不存在，触发修改的更新
        trigger(target, TriggerOpTypes.SET, key, value, oldValue);
      }
    }
    return result;
  };
}
```

##### (3) `deleteProperty`

删除操作的代理程序，和`set`一样，`deleteProperty`拦截`delete`和`Reflect.deleteProperty()`操作，它也能触发更新。

```typescript
function deleteProperty(target: object, key: string | symbol): boolean {
  const hadKey = hasOwn(target, key);
  const oldValue = (target as any)[key];
  const result = Reflect.deleteProperty(target, key);
  // 删除成功 且 target中原来有这个属性时，触发删除的更新
  if (result && hadKey) {
    trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue);
  }
  return result;
}
```

##### (4) `has`

`has`用于判断`target`中是否有当前的`key`，拦截`a in obj`、`with(obj){(a)}`、`Reflect.has`等操作，属于访问程序，在其中进行`has`操作的依赖收集。

```typescript
function has(target: object, key: string | symbol): boolean {
  const result = Reflect.has(target, key);
  if (!isSymbol(key) || !builtInSymbols.has(key)) {
    track(target, TrackOpTypes.HAS, key);
  }
  return result;
}
```

##### (5) `ownKeys`

用于获取`target`所有自身拥有的`key`，拦截`Object.getOwnPropertyNames`、`Object.getOwnPropertySymbols`、`Object.keys`、`Reflect.ownKeys`，属于访问程序，在其中进行迭代的依赖收集。

```typescript
function ownKeys(target: object): (string | symbol)[] {
  track(target, TrackOpTypes.ITERATE, isArray(target) ? "length" : ITERATE_KEY);
  return Reflect.ownKeys(target);
}
```

现在我们算是都弄明白了，对于普通对象和数组，`reactive`创建`proxy`，通过`get`、`set`、`deleteProperty`、`has`、`ownKeys`五个代理处理程序，来拦截其属性访问操作，在其中进行依赖收集，拦截其增删改操作，其中触发更新。

#### 1.2 `readonly`

`readonly`的代理处理程序只有三个：

- `get`：由`createGetter(true)`创建，还记得我们上面讲到的`createSetter`吗？
- `set`
- `deleteProperty`：这两个代理处理程序用于告警，毕竟`readonly`不可修改。

毕加思索一下`createGetter(true)`，传入的`readonly=true`，使得`get`中不会进行`track`操作来收集依赖，因而不具有响应性。

```typescript
const readonlyGet = /*#__PURE__*/ createGetter(true);

export const readonlyHandlers: ProxyHandler<object> = {
  get: readonlyGet,
  set(target, key) {
    if (__DEV__) {
      warn(
        `Set operation on key "${String(key)}" failed: target is readonly.`,
        target
      );
    }
    return true;
  },
  deleteProperty(target, key) {
    if (__DEV__) {
      warn(
        `Delete operation on key "${String(key)}" failed: target is readonly.`,
        target
      );
    }
    return true;
  },
};
```

#### 1.3 `shallowReactive`

`shallowReactive`移植了`reactive`的`baseHandlers`，并且更新了`get`和`set`。具体实现也可以回顾上面说到的`createGetter`和`createSetter`。

回过头来看看`createGetter(false, true)`，`isReadonly = false`，则在`get`中，可以进行`track`依赖收集；`shallow = true`，则在`get`中不会对顶层的`Ref`进行解包，也不会进行递归操作。

而在`createSetter(true)`中，参数`shallow`几乎只影响是否要解出原本的`raw`值。如果新值`value`不是浅层且不是只读的，则需要解出它的原本`raw`值，之后才能进行赋值操作，否则我们的`shallowRef`将不再是浅层的了。

```typescript
const shallowGet = /*#__PURE__*/ createGetter(false, true);
const shallowSet = /*#__PURE__*/ createSetter(true);

export const shallowReactiveHandlers = /*#__PURE__*/ extend(
  {},
  mutableHandlers,
  {
    get: shallowGet,
    set: shallowSet,
  }
);
```

#### 1.4 `shallowReadonly`

移植了`readonly`的`baseHandlers`，更新了其中的`get`，这个`get`也试试由`createGetter`创建。我们知道，`readonly`的`baseHandlers`里，除了`get`，另外俩都是用来拦截修改操作并告警的。

回顾一下`createGetter`，当`isReadonly===true`时，不会进行`track`操作来收集依赖；`shallow===true`时，不会对`Ref`进行解包，也不会走到递归环节，即是浅层的`readonly`。

```typescript
const shallowReadonlyGet = /*#__PURE__*/ createGetter(true, true);

// Props handlers are special in the sense that it should not unwrap top-level
// refs (in order to allow refs to be explicitly passed down), but should
// retain the reactivity of the normal readonly object.
export const shallowReadonlyHandlers = /*#__PURE__*/ extend(
  {},
  readonlyHandlers,
  {
    get: shallowReadonlyGet,
  }
);
```

### 2. `cellectionHandlers`

对于`Set`和`Map`较为复杂的数据结构，他们有自己的方法，因此代理程序会有些差别。基本都是拦截它们原本的方法，然后进行`track`或`trigger`。可以看到这几个`handlers`中，都只有由`createInstrumentationGetter`创建的`get`。

```typescript
export const mutableCollectionHandlers: ProxyHandler<CollectionTypes> = {
  get: /*#__PURE__*/ createInstrumentationGetter(false, false),
};

export const shallowCollectionHandlers: ProxyHandler<CollectionTypes> = {
  get: /*#__PURE__*/ createInstrumentationGetter(false, true),
};

export const readonlyCollectionHandlers: ProxyHandler<CollectionTypes> = {
  get: /*#__PURE__*/ createInstrumentationGetter(true, false),
};

export const shallowReadonlyCollectionHandlers: ProxyHandler<CollectionTypes> =
  {
    get: /*#__PURE__*/ createInstrumentationGetter(true, true),
  };
```

#### 1.1 `createInstrumentationGetter`

因为是代理`Set`和`Map`，在拦截它们的实例方法之前，对实例的访问，即`get`，这个`get`并非`Map`或`Set`实例的`get`方法，而是表示对实例的访问操作。例如：`const map = new Map([['name', 'cc']]); map.set('age', 18);`。这里`map.set()`首先就是访问`map`的`set`方法，对应的`key`就是字符串`'set'`，而这一步就会被代理的`get`程序拦截，而真正的对方法的拦截，都在相应的`instrumentations`里预设好了。拦截了之后，如果`key`在`instrumentations`里存在，返回预设的方法，在其中进行`track`和`trigger`操作，否则是其它属性/方法，直接返回即可，不会进行`track`和`trigger`。

```typescript
const [
  mutableInstrumentations,
  readonlyInstrumentations,
  shallowInstrumentations,
  shallowReadonlyInstrumentations,
] = /* #__PURE__*/ createInstrumentations();

function createInstrumentationGetter(isReadonly: boolean, shallow: boolean) {
  const instrumentations = shallow
    ? isReadonly
      ? shallowReadonlyInstrumentations
      : shallowInstrumentations
    : isReadonly
    ? readonlyInstrumentations
    : mutableInstrumentations;

  return (
    target: CollectionTypes,
    key: string | symbol,
    receiver: CollectionTypes
  ) => {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly;
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly;
    } else if (key === ReactiveFlags.RAW) {
      return target;
    }

    return Reflect.get(
      hasOwn(instrumentations, key) && key in target
        ? instrumentations
        : target,
      key,
      receiver
    );
  };
}
```

### 1.2 `instrumentations`

和`baseHandlers`相比，`Proxy`无法直接拦截`Map`和`Set`的方法的调用，而是通过`get`程序来拦截，再判断`key`是否为执行增删改查的方法，从而判断是否进行依赖收集或更新。因此，就需要先预设好，哪些`key`作为方法名时可以触发`track`和`trigger`。其实也就是`Map`和`Set`的那些实例方法和迭代器方法。而各种`Instrumentations`，就是这些预设的方法，`track`和`trigger`操作都在其中。

```typescript
function createInstrumentations() {
  // 对应reactive
  const mutableInstrumentations: Record<string, Function> = {
    get(this: MapTypes, key: unknown) {
      return get(this, key);
    },
    get size() {
      return size(this as unknown as IterableCollections);
    },
    has,
    add,
    set,
    delete: deleteEntry,
    clear,
    forEach: createForEach(false, false),
  };

  // 对应shallowReactive
  const shallowInstrumentations: Record<string, Function> = {
    get(this: MapTypes, key: unknown) {
      return get(this, key, false, true);
    },
    get size() {
      return size(this as unknown as IterableCollections);
    },
    has,
    add,
    set,
    delete: deleteEntry,
    clear,
    forEach: createForEach(false, true),
  };

  // 对应readonly
  const readonlyInstrumentations: Record<string, Function> = {
    get(this: MapTypes, key: unknown) {
      return get(this, key, true);
    },
    get size() {
      return size(this as unknown as IterableCollections, true);
    },
    has(this: MapTypes, key: unknown) {
      return has.call(this, key, true);
    },
    add: createReadonlyMethod(TriggerOpTypes.ADD),
    set: createReadonlyMethod(TriggerOpTypes.SET),
    delete: createReadonlyMethod(TriggerOpTypes.DELETE),
    clear: createReadonlyMethod(TriggerOpTypes.CLEAR),
    forEach: createForEach(true, false),
  };

  // 对应shallowReadonly
  const shallowReadonlyInstrumentations: Record<string, Function> = {
    get(this: MapTypes, key: unknown) {
      return get(this, key, true, true);
    },
    get size() {
      return size(this as unknown as IterableCollections, true);
    },
    has(this: MapTypes, key: unknown) {
      return has.call(this, key, true);
    },
    add: createReadonlyMethod(TriggerOpTypes.ADD),
    set: createReadonlyMethod(TriggerOpTypes.SET),
    delete: createReadonlyMethod(TriggerOpTypes.DELETE),
    clear: createReadonlyMethod(TriggerOpTypes.CLEAR),
    forEach: createForEach(true, true),
  };

  // 使用 createIterableMethod 给这些 Instrumentations 挂上几个迭代器
  const iteratorMethods = ["keys", "values", "entries", Symbol.iterator];
  iteratorMethods.forEach((method) => {
    mutableInstrumentations[method as string] = createIterableMethod(
      method,
      false,
      false
    );
    readonlyInstrumentations[method as string] = createIterableMethod(
      method,
      true,
      false
    );
    shallowInstrumentations[method as string] = createIterableMethod(
      method,
      false,
      true
    );
    shallowReadonlyInstrumentations[method as string] = createIterableMethod(
      method,
      true,
      true
    );
  });

  return [
    mutableInstrumentations,
    readonlyInstrumentations,
    shallowInstrumentations,
    shallowReadonlyInstrumentations,
  ];
}
```

函数`createInstrumentations`分为两部分，前部分是利用已有的`get`、`set`、`add`、`has`、`clear`等等来得到各个`instrumentations`，后部分是对各个`instrumentations`中的迭代方法的更新。只要不是`isReadonly`不是真值，则无论是`get`、`set`等方法还是`keys`、`values`等迭代器接口，都在内部进行了`track`或`trigger`，当然，`get`、`has`、`size`等方法 和 几个迭代器方法都属于访问操作，因此内部是使用`track`来收集依赖，而`trigger`发生在增、删、改操作里，当然，也要根据`isReadonly`和`shallow`有所区分，思路基本和`baseHandlers`一致。

```typescript
function get(
  target: MapTypes,
  key: unknown,
  isReadonly = false,
  isShallow = false
) {
  // #1772: readonly(reactive(Map)) should return readonly + reactive version
  // of the value
  target = (target as any)[ReactiveFlags.RAW];
  const rawTarget = toRaw(target);
  const rawKey = toRaw(key);
  if (!isReadonly) {
    if (key !== rawKey) {
      track(rawTarget, TrackOpTypes.GET, key);
    }
    track(rawTarget, TrackOpTypes.GET, rawKey);
  }
  const { has } = getProto(rawTarget);
  const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
  if (has.call(rawTarget, key)) {
    return wrap(target.get(key));
  } else if (has.call(rawTarget, rawKey)) {
    return wrap(target.get(rawKey));
  } else if (target !== rawTarget) {
    // #3602 readonly(reactive(Map))
    // ensure that the nested reactive `Map` can do tracking for itself
    target.get(key);
  }
}

function has(this: CollectionTypes, key: unknown, isReadonly = false): boolean {
  const target = (this as any)[ReactiveFlags.RAW];
  const rawTarget = toRaw(target);
  const rawKey = toRaw(key);
  if (!isReadonly) {
    if (key !== rawKey) {
      track(rawTarget, TrackOpTypes.HAS, key);
    }
    track(rawTarget, TrackOpTypes.HAS, rawKey);
  }
  return key === rawKey
    ? target.has(key)
    : target.has(key) || target.has(rawKey);
}

function size(target: IterableCollections, isReadonly = false) {
  target = (target as any)[ReactiveFlags.RAW];
  !isReadonly && track(toRaw(target), TrackOpTypes.ITERATE, ITERATE_KEY);
  return Reflect.get(target, "size", target);
}

function add(this: SetTypes, value: unknown) {
  value = toRaw(value);
  const target = toRaw(this);
  const proto = getProto(target);
  const hadKey = proto.has.call(target, value);
  if (!hadKey) {
    target.add(value);
    trigger(target, TriggerOpTypes.ADD, value, value);
  }
  return this;
}

function set(this: MapTypes, key: unknown, value: unknown) {
  value = toRaw(value);
  const target = toRaw(this);
  const { has, get } = getProto(target);

  let hadKey = has.call(target, key);
  if (!hadKey) {
    key = toRaw(key);
    hadKey = has.call(target, key);
  } else if (__DEV__) {
    checkIdentityKeys(target, has, key);
  }

  const oldValue = get.call(target, key);
  target.set(key, value);
  if (!hadKey) {
    trigger(target, TriggerOpTypes.ADD, key, value);
  } else if (hasChanged(value, oldValue)) {
    trigger(target, TriggerOpTypes.SET, key, value, oldValue);
  }
  return this;
}

function deleteEntry(this: CollectionTypes, key: unknown) {
  const target = toRaw(this);
  const { has, get } = getProto(target);
  let hadKey = has.call(target, key);
  if (!hadKey) {
    key = toRaw(key);
    hadKey = has.call(target, key);
  } else if (__DEV__) {
    checkIdentityKeys(target, has, key);
  }

  const oldValue = get ? get.call(target, key) : undefined;
  // forward the operation before queueing reactions
  const result = target.delete(key);
  if (hadKey) {
    trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue);
  }
  return result;
}

function clear(this: IterableCollections) {
  const target = toRaw(this);
  const hadItems = target.size !== 0;
  const oldTarget = __DEV__
    ? isMap(target)
      ? new Map(target)
      : new Set(target)
    : undefined;
  // forward the operation before queueing reactions
  const result = target.clear();
  if (hadItems) {
    trigger(target, TriggerOpTypes.CLEAR, undefined, undefined, oldTarget);
  }
  return result;
}
```

### 1.3 `createIterableMethod`

这里稍微提一下`createIterableMethod`，用于利用`Map`和`Set`本身的迭代器方法，并做了一点修改，在其中加入了`track`来收集依赖。

```typescript
function createIterableMethod(
  method: string | symbol,
  isReadonly: boolean,
  isShallow: boolean
) {
  return function (
    this: IterableCollections,
    ...args: unknown[]
  ): Iterable & Iterator {
    const target = (this as any)[ReactiveFlags.RAW];
    const rawTarget = toRaw(target);
    const targetIsMap = isMap(rawTarget);
    const isPair =
      method === "entries" || (method === Symbol.iterator && targetIsMap);
    const isKeyOnly = method === "keys" && targetIsMap;
    const innerIterator = target[method](...args);
    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
    !isReadonly &&
      track(
        rawTarget,
        TrackOpTypes.ITERATE,
        isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY
      );
    // return a wrapped iterator which returns observed versions of the
    // values emitted from the real iterator
    return {
      // iterator protocol
      next() {
        const { value, done } = innerIterator.next();
        return done
          ? { value, done }
          : {
              value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
              done,
            };
      },
      // iterable protocol
      [Symbol.iterator]() {
        return this;
      },
    };
  };
}
```

### 1.4 小结

分析完各个部分，可以看到，无论是`baseHandlers`还是`collectionHandlers`，思路都是一致的。

但是`collectionHandlers`只有`get`这一个代理程序，通过拦截到的`key`判断是否是`Map`和`Set`实例自带的增删改查的方法，从而返回预设好的`hack`版本的方法或原本的属性值，然后继续后续的操作。在`hack`版本的方法里进行`track`和`trigger`。
