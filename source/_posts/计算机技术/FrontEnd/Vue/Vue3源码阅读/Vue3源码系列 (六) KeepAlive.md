---
title: Vue3源码系列 (六) KeepAlive
date: "2022-10-22 15:54"
updated: "2022-10-22 15:54"
tags:
  - 前 端
  - Vue3
keywords:
  - 前端
  - Vue
  - Vue3
  - 源码
  - KeepAlive
  - keep-alive
categories:
  - 前端
abbrlink: e80db997
swiper_index: 6
---

`KeepAlive`是个抽象组件，自身不会渲染一个 DOM 元素，也不会出现在父组件链中，我们用它来缓存组件的状态。`KeepAlive`只对插入的单个组件起效果，因此一般只给它安排一个组件。适合与`component`或`router-view`搭配使用。

## 一、`ts` 类型

先来和`KeepAlive`相关的类型：

- `MatchPattern`：匹配模式，是传递的参数`include`和`exclude`接收的类型；
- `KeepAliveProps`：可传递三个参数，`include`指定被缓存的组件，`exclude`指定不缓存的组件，`max`指定最大缓存组件数量；
- `Cache`：变量`cache`的类型，`cache`用于缓存组件；
- `Keys`：变量`keys`的类型，`keys`用于存储被缓存组件对应的`key`，用于`LRU`算法；
- `KeepAliveContext`：继承自`ComponentRenderContext`，并拓展了`renderer`，`activate`，`deactivate`三个字段。

```typescript
type MatchPattern = string | RegExp | (string | RegExp)[];

export interface KeepAliveProps {
  include?: MatchPattern;
  exclude?: MatchPattern;
  max?: number | string;
}

type CacheKey = string | number | symbol | ConcreteComponent;
type Cache = Map<CacheKey, VNode>;
type Keys = Set<CacheKey>;

export interface KeepAliveContext extends ComponentRenderContext {
  renderer: RendererInternals;
  activate: (
    vnode: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    isSVG: boolean,
    optimized: boolean
  ) => void;
  deactivate: (vnode: VNode) => void;
}
```

## 二、`KeepAliveImpl`

### 1. `KeepAliveImpl` 的成员

`KeepAliveImpl`是`KeepAlive`的核心实现。包含`name`，`__isKeepAlive`（用于判断组件是否是`KeepAlive`），`props`（上面提到的`KeepAliveProps`类型）以及`setup`方法。`KeepAlive`与实例化的`renderer`通过上下文来传递信息。在当前实例的上下文对象`ctx`上暴露了`activate`和`deactivate`两个方法。

```typescript
const KeepAliveImpl: ComponentOptions = {
  name: `KeepAlive`,

  // Marker for special handling inside the renderer. We are not using a ===
  // check directly on KeepAlive in the renderer, because importing it directly
  // would prevent it from being tree-shaken.
  __isKeepAlive: true,

  props: {
    include: [String, RegExp, Array],
    exclude: [String, RegExp, Array],
    max: [String, Number],
  },

  setup(props: KeepAliveProps, { slots }: SetupContext) {
    // ...
  },
};
```

### 2. `setup`

在`setup`中，拿到当前实例的上下文对象，并挂上`activate`和`deactivate`两个方法。

在`activate`中，通过调用`patch`来进行对比更新，以同步`props`传参可能的变更；调整组件为激活状态`instance.isDeactivated = false`；调用实例的`onActived`钩子等。

```typescript
{
  // ...
  setup(props: KeepAliveProps, { slots }: SetupContext) {
    const instance = getCurrentInstance()!
    // KeepAlive communicates with the instantiated renderer via the
    // ctx where the renderer passes in its internals,
    // and the KeepAlive instance exposes activate/deactivate implementations.
    // The whole point of this is to avoid importing KeepAlive directly in the
    // renderer to facilitate tree-shaking.
    const sharedContext = instance.ctx as KeepAliveContext

    // if the internal renderer is not registered, it indicates that this is server-side rendering,
    // for KeepAlive, we just need to render its children
    if (__SSR__ && !sharedContext.renderer) {
      return () => {
        const children = slots.default && slots.default()
        return children && children.length === 1 ? children[0] : children
      }
    }

    // 用于缓存组件
    const cache: Cache = new Map()
    const keys: Keys = new Set()
    let current: VNode | null = null

    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
      ;(instance as any).__v_cache = cache
    }

    const parentSuspense = instance.suspense

    const {
      renderer: {
        p: patch,
        m: move,
        um: _unmount,
        o: { createElement }
      }
    } = sharedContext
    const storageContainer = createElement('div')

    sharedContext.activate = (vnode, container, anchor, isSVG, optimized) => {
      const instance = vnode.component!
      move(vnode, container, anchor, MoveType.ENTER, parentSuspense)
      // in case props have changed
      patch(
        instance.vnode,
        vnode,
        container,
        anchor,
        instance,
        parentSuspense,
        isSVG,
        vnode.slotScopeIds,
        optimized
      )
      queuePostRenderEffect(() => {
        instance.isDeactivated = false
        if (instance.a) {
          invokeArrayFns(instance.a)
        }
        const vnodeHook = vnode.props && vnode.props.onVnodeMounted
        if (vnodeHook) {
          invokeVNodeHook(vnodeHook, instance.parent, vnode)
        }
      }, parentSuspense)

      if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
        // Update components tree
        devtoolsComponentAdded(instance)
      }
    }

    // ...
  }
}
```

在`deactivate`中的操作类似。

```typescript
{
  setup(){
    // ...

    sharedContext.deactivate = (vnode: VNode) => {
      const instance = vnode.component!
      move(vnode, storageContainer, null, MoveType.LEAVE, parentSuspense)
      queuePostRenderEffect(() => {
        if (instance.da) {
          invokeArrayFns(instance.da)
        }
        const vnodeHook = vnode.props && vnode.props.onVnodeUnmounted
        if (vnodeHook) {
          invokeVNodeHook(vnodeHook, instance.parent, vnode)
        }
        instance.isDeactivated = true
      }, parentSuspense)

      if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
        // Update components tree
        devtoolsComponentAdded(instance)
      }
    }

    // ...
  }
}
```

随之声明了组件卸载以及销毁缓存的方法。基本都用在`setup`返回的函数里。

```typescript
{
  setup(){
    // ...

    // 组件卸载
    function unmount(vnode: VNode) {
      // reset the shapeFlag so it can be properly unmounted
      resetShapeFlag(vnode)
      _unmount(vnode, instance, parentSuspense, true)
    }

    // 根据组件名 和 filter 销毁缓存
    function pruneCache(filter?: (name: string) => boolean) {
      cache.forEach((vnode, key) => {
        const name = getComponentName(vnode.type as ConcreteComponent)
        if (name && (!filter || !filter(name))) {
          pruneCacheEntry(key)
        }
      })
    }

    function pruneCacheEntry(key: CacheKey) {
      const cached = cache.get(key) as VNode
      if (!current || cached.type !== current.type) {
        unmount(cached)
      } else if (current) {
        // current active instance should no longer be kept-alive.
        // we can't unmount it now but it might be later, so reset its flag now.
        resetShapeFlag(current)
      }
      cache.delete(key)
      keys.delete(key)
    }

    // ...
  }
}
```

使用`watch API`侦听`include`、`exclude`的变化，一旦改变，根据`match`函数得到的`filter`去销毁相应的缓存。`match`函数根据`include`、`exclude`匹配模式来筛选出需要被销毁的缓存。

```typescript
{
  setup( props ){
    // ...

     // prune cache on include/exclude prop change
    watch(
      () => [props.include, props.exclude],
      ([include, exclude]) => {
        include && pruneCache(name => matches(include, name))
        exclude && pruneCache(name => !matches(exclude, name))
      },
      // prune post-render after `current` has been updated
      { flush: 'post', deep: true }
    )

    // ...
  }
}

// match
function matches(pattern: MatchPattern, name: string): boolean {
  if (isArray(pattern)) {
    return pattern.some((p: string | RegExp) => matches(p, name))
  } else if (isString(pattern)) {
    return pattern.split(',').includes(name)
  } else if (pattern.test) {
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}
```

接下来给`onMounted`和`onUpdated`和`onBeforeUnmount`安排任务。在挂载和更新时执行`cacheSubtree`来缓存子组件树，**卸载前调用其中的组件的`onDeactived`钩子**，再卸载组件。

```typescript
{
  setup(){
    // ...

    // cache sub tree after render
    let pendingCacheKey: CacheKey | null = null
    const cacheSubtree = () => {
      // fix #1621, the pendingCacheKey could be 0
      if (pendingCacheKey != null) {
        cache.set(pendingCacheKey, getInnerChild(instance.subTree))
      }
    }
    onMounted(cacheSubtree)
    onUpdated(cacheSubtree)

    // 卸载前，在其中调用组件的 onDeactived 钩子
    onBeforeUnmount(() => {
      cache.forEach(cached => {
        const { subTree, suspense } = instance
        const vnode = getInnerChild(subTree)
        if (cached.type === vnode.type) {
          // current instance will be unmounted as part of keep-alive's unmount
          resetShapeFlag(vnode)
          // but invoke its deactivated hook here
          const da = vnode.component!.da
          da && queuePostRenderEffect(da, suspense)
          return
        }
        unmount(cached)
      })
    })

    return () => {
      // ...
    }
  }
}
```

最后是`KeepAlive`的`setup`的返回值的部分了，这里`setup`返回一个函数。可以看到`KeepAlive`只对插入单个组件有效果，即`rawVNode = $slots.default()[0]`。根据`rawVNode`获取到`vnode`：`let vnode = getInnerChild(rawVNode)`。

以下各项条件会直接返回该组件，且无法进入缓存流程。

- 默认插槽有多个组件，即`slots.default()`的长度大于`1`，则直接返回`$slots.default()`；
- `rawVNode`不属于`VNode`类型，直接返回`rawVNode`；
- `rawVNode`的形状标志被重置了，发生在当前组件是缓存组件且处于卸载流程时；

此外，当`rawVNode`是异步组件时，也会返回`rawVNode`，但是缓存程序会执行。

而当`rawVNode`未被直接返回，且不是异步组件时：

- 如果已有缓存，则取缓存的值更新到`vnode`里，更新`key`的位置(`LRU`算法)，最后返回`vnode`；
- 没有缓存的值，则进行缓存，并返回`vnode`。

```typescript
() => {
  pendingCacheKey = null;

  if (!slots.default) {
    return null;
  }

  // 取默认插槽中的第一个组件
  const children = slots.default();
  const rawVNode = children[0];

  // 如果默认插槽中有多个组件，则直接返回它们，导致无法进入缓存流程
  if (children.length > 1) {
    if (__DEV__) {
      warn(`KeepAlive should contain exactly one component child.`);
    }
    current = null;

    // 返回这些组件
    return children;
  } else if (
    // 不是vnode，或者没有缓存标志了，直接返回，不进入缓存流程
    !isVNode(rawVNode) ||
    (!(rawVNode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) &&
      !(rawVNode.shapeFlag & ShapeFlags.SUSPENSE))
  ) {
    current = null;
    return rawVNode;
  }

  let vnode = getInnerChild(rawVNode);
  /** 把 getInnerChild 函数搬到这里方便阅读
   *
   *   function getInnerChild(vnode: VNode) {
   *     return vnode.shapeFlag & ShapeFlags.SUSPENSE ? vnode.ssContent! : vnode
   *   }
   */
  const comp = vnode.type as ConcreteComponent;

  // for async components, name check should be based in its loaded
  // inner component if available
  const name = getComponentName(
    isAsyncWrapper(vnode)
      ? (vnode.type as ComponentOptions).__asyncResolved || {}
      : comp
  );

  const { include, exclude, max } = props;

  // 根据 匹配模式 和 组件名 校验
  if (
    (include && (!name || !matches(include, name))) ||
    (exclude && name && matches(exclude, name))
  ) {
    current = vnode;
    return rawVNode;
  }

  // 取缓存的值
  const key = vnode.key == null ? comp : vnode.key;
  const cachedVNode = cache.get(key);

  // clone vnode if it's reused because we are going to mutate it
  if (vnode.el) {
    vnode = cloneVNode(vnode);
    if (rawVNode.shapeFlag & ShapeFlags.SUSPENSE) {
      rawVNode.ssContent = vnode;
    }
  }
  // #1513 it's possible for the returned vnode to be cloned due to attr
  // fallthrough or scopeId, so the vnode here may not be the final vnode
  // that is mounted. Instead of caching it directly, we store the pending
  // key and cache `instance.subTree` (the normalized vnode) in
  // beforeMount/beforeUpdate hooks.
  pendingCacheKey = key;

  // 存在缓存的值，就
  if (cachedVNode) {
    // copy over mounted state
    vnode.el = cachedVNode.el;
    vnode.component = cachedVNode.component;
    if (vnode.transition) {
      // recursively update transition hooks on subTree
      setTransitionHooks(vnode, vnode.transition!);
    }
    // avoid vnode being mounted as fresh
    vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE;
    // make this key the freshest
    keys.delete(key);
    keys.add(key);
  } else {
    // 限制最大缓存数量
    keys.add(key);
    // prune oldest entry
    if (max && keys.size > parseInt(max as string, 10)) {
      pruneCacheEntry(keys.values().next().value);
    }
  }
  // avoid vnode being unmounted
  vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE;

  current = vnode;
  return isSuspense(rawVNode.type) ? rawVNode : vnode;
};
```

## 三、`KeepAlive`

`KeepAlive`就是`KeepAliveImpl`，重新声明了类型。

```typescript
/ export the public type for h/tsx inference
// also to avoid inline import() in generated d.ts files
export const KeepAlive = KeepAliveImpl as any as {
  __isKeepAlive: true
  new (): {
    $props: VNodeProps & KeepAliveProps
  }
}
```

## 四、`onActived` 和 `onDeactived`

这两个生命周期钩子通过`registerKeepAliveHook`来注册。

```typescript
export function onActivated(
  hook: Function,
  target?: ComponentInternalInstance | null
) {
  registerKeepAliveHook(hook, LifecycleHooks.ACTIVATED, target);
}

export function onDeactivated(
  hook: Function,
  target?: ComponentInternalInstance | null
) {
  registerKeepAliveHook(hook, LifecycleHooks.DEACTIVATED, target);
}
```

`registerKeepAliveHook`把`hook`包装成`wrappedHook`并注入钩子。此外，通过`injectToKeepAliveRoot`把包装的钩子`wrappedHook`注入到`KeepAlive`里相应的钩子列表的前面（`unshift`方法），之后可以不用再去递归遍历整个组件树了查找相应组件的`onActived`或`onDeactived`钩子了，只需要遍历调用`KeepAlive`中的钩子列表，当然，需要注意在组件卸载时移除相应的钩子。

```typescript
function registerKeepAliveHook(
  hook: Function & { __wdc?: Function },
  type: LifecycleHooks,
  target: ComponentInternalInstance | null = currentInstance
) {
  // cache the deactivate branch check wrapper for injected hooks so the same
  // hook can be properly deduped by the scheduler. "__wdc" stands for "with
  // deactivation check".
  const wrappedHook =
    hook.__wdc ||
    (hook.__wdc = () => {
      // only fire the hook if the target instance is NOT in a deactivated branch.
      let current: ComponentInternalInstance | null = target;
      while (current) {
        if (current.isDeactivated) {
          return;
        }
        current = current.parent;
      }
      return hook();
    });
  injectHook(type, wrappedHook, target);
  // In addition to registering it on the target instance, we walk up the parent
  // chain and register it on all ancestor instances that are keep-alive roots.
  // This avoids the need to walk the entire component tree when invoking these
  // hooks, and more importantly, avoids the need to track child components in
  // arrays.
  if (target) {
    let current = target.parent;
    while (current && current.parent) {
      if (isKeepAlive(current.parent.vnode)) {
        injectToKeepAliveRoot(wrappedHook, type, target, current);
      }
      current = current.parent;
    }
  }
}

// injectHook(type, hook, keepAliveRoot, true /* prepend */)
// true 表示把 hook 放到 keepAliveRoot[type] 对应的钩子列表的前面，即使用 unshift() 方法
function injectToKeepAliveRoot(
  hook: Function & { __weh?: Function },
  type: LifecycleHooks,
  target: ComponentInternalInstance,
  keepAliveRoot: ComponentInternalInstance
) {
  // injectHook wraps the original for error handling, so make sure to remove
  // the wrapped version.
  const injected = injectHook(type, hook, keepAliveRoot, true /* prepend */);
  // 卸载时移除
  onUnmounted(() => {
    remove(keepAliveRoot[type]!, injected);
  }, target);
}
```
