---
title: Vue3 源码系列 (九)：异步组件 defineAsyncComponent 与 Suspense
date: 2022-11-10 17:34
updated: 2022-11-10 17:34
keywords:
  - 前端
  - Vue
  - Vue3
  - 源码
tags:
  - 前端
  - Vue3
categories:
  - 前端
---

前面几篇走完了`createApp`的流程，理清了`diff`算法的思路。现在回归到运行时的核心`API`上。在第一篇和第二篇中有解读过`watch`和`computed`，而本文则主要梳理异步组件的`API`。

## 一、`defineAsyncComponent`

用于定义异步组件。

### 1. `defineAsyncComponent`

入参`source`，可以是一个异步函数`loader`，也可以是一个包含有异步函数`loader`的对象`options`。当`source`为`options`时可以进行更细致的自定义，如推迟时间、异常处理、异常兜底组件、加载组件等。由于`import()`动态加载得到的是一个`Promise`，因此，`loader`常用来结合`import()`引入单文件组件来构成异步组件。

```typescript
export interface AsyncComponentOptions<T = any> {
  loader: AsyncComponentLoader<T>;
  loadingComponent?: Component;
  errorComponent?: Component;
  delay?: number;
  timeout?: number;
  suspensible?: boolean;
  onError?: (
    error: Error,
    retry: () => void,
    fail: () => void,
    attempts: number
  ) => any;
}
```

函数中主要是定义一个`load`函数，通过对结构`source`得到的`loader`进行异常处理(是否重试)，对加载成功的结果进行校验并得到正常的加载结果。`load`函数在返回结果中的`setup`里调用。

```typescript
// defineComponent
export function defineComponent(options: unknown) {
  return isFunction(options) ? { setup: options, name: options.name } : options;
}

// defineAsyncComponent
export function defineAsyncComponent<
  T extends Component = { new (): ComponentPublicInstance }
>(source: AsyncComponentLoader<T> | AsyncComponentOptions<T>): T {
  // 如果source本身是个函数，则包装成有loader的对象，方便后续统一处理
  if (isFunction(source)) {
    source = { loader: source };
  }

  // 解构source
  const {
    loader,
    loadingComponent,
    errorComponent,
    delay = 200,
    timeout, // undefined = never times out
    suspensible = true,
    onError: userOnError,
  } = source;

  let pendingRequest: Promise<ConcreteComponent> | null = null;
  let resolvedComp: ConcreteComponent | undefined;

  // 定义函数：失败重试
  let retries = 0;
  const retry = () => {
    retries++;
    pendingRequest = null;
    return load();
  };

  // 定义加载函数
  const load = (): Promise<ConcreteComponent> => {
    let thisRequest: Promise<ConcreteComponent>;
    return (
      pendingRequest ||
      (thisRequest = pendingRequest =
        // loader异步加载
        loader()
          // 处理加载异常
          .catch((err) => {
            err = err instanceof Error ? err : new Error(String(err));
            // 有userOnError时，失败重试
            if (userOnError) {
              return new Promise((resolve, reject) => {
                const userRetry = () => resolve(retry());
                const userFail = () => reject(err);
                userOnError(err, userRetry, userFail, retries + 1);
              });
              // 否则 失败抛错
            } else {
              throw err;
            }
          })
          // 加载成功
          .then((comp: any) => {
            if (thisRequest !== pendingRequest && pendingRequest) {
              return pendingRequest;
            }
            // 没有comp告警
            if (__DEV__ && !comp) {
              warn(
                `Async component loader resolved to undefined. ` +
                  `If you are using retry(), make sure to return its return value.`
              );
            }
            // 处理 es 模块
            // interop module default
            if (
              comp &&
              (comp.__esModule || comp[Symbol.toStringTag] === "Module")
            ) {
              comp = comp.default;
            }
            // comp 必须是对象或函数
            if (__DEV__ && comp && !isObject(comp) && !isFunction(comp)) {
              throw new Error(`Invalid async component load result: ${comp}`);
            }
            // 得到 resolveComponent
            resolvedComp = comp;
            return comp;
          }))
    );
  };

  return; // ... 这里暂时省略返回值
}
```

`defineAsyncComponent`的返回值是个经过`defineComponent`处理过的`options`。而`options`中的`setup`有着异步组件的渲染逻辑。主要是调用`load`，通过`createInnerComp`来创建加载成功的组件，`createVNode`来进行异常和加载中的渲染。

```typescript
export function defineAsyncComponent<
  T extends Component = { new (): ComponentPublicInstance }
>(source: AsyncComponentLoader<T> | AsyncComponentOptions<T>): T {
  if (isFunction(source)) {
    source = { loader: source };
  }

  const {
    loader,
    loadingComponent,
    errorComponent,
    delay = 200,
    timeout, // undefined = never times out
    suspensible = true,
    onError: userOnError,
  } = source;

  // ...

  return defineComponent({
    name: "AsyncComponentWrapper",

    __asyncLoader: load,

    get __asyncResolved() {
      return resolvedComp;
    },

    setup() {
      const instance = currentInstance!;

      // 已加载完成的case
      // already resolved
      if (resolvedComp) {
        return () => createInnerComp(resolvedComp!, instance);
      }

      // 定义错误处理程序
      const onError = (err: Error) => {
        pendingRequest = null;
        handleError(
          err,
          instance,
          ErrorCodes.ASYNC_COMPONENT_LOADER,
          !errorComponent /* do not throw in dev if user provided error component */
        );
      };

      // Suspense 或者 SSR：加载并返回
      // suspense-controlled or SSR.
      if (
        (__FEATURE_SUSPENSE__ && suspensible && instance.suspense) ||
        (__SSR__ && isInSSRComponentSetup)
      ) {
        return load()
          .then((comp) => {
            return () => createInnerComp(comp, instance);
          })
          .catch((err) => {
            onError(err);
            return () =>
              // 异常兜底组件
              errorComponent
                ? createVNode(errorComponent as ConcreteComponent, {
                    error: err,
                  })
                : null;
          });
      }

      // 状态初始化
      const loaded = ref(false);
      const error = ref();
      const delayed = ref(!!delay);

      // 采用定时器计时
      if (delay) {
        setTimeout(() => {
          delayed.value = false;
        }, delay);
      }

      // 既没有拿到结果，又没有异常，则超时处理
      if (timeout != null) {
        setTimeout(() => {
          if (!loaded.value && !error.value) {
            const err = new Error(
              `Async component timed out after ${timeout}ms.`
            );
            onError(err);
            error.value = err;
          }
        }, timeout);
      }

      // 加载
      load()
        .then(() => {
          loaded.value = true;
          // 对于KeepAlive的内容，加载成功后进行强制更新
          if (instance.parent && isKeepAlive(instance.parent.vnode)) {
            // parent is keep-alive, force update so the loaded component's
            // name is taken into account
            queueJob(instance.parent.update);
          }
        })
        .catch((err) => {
          onError(err);
          error.value = err;
        });

      return () => {
        // 加载成功
        if (loaded.value && resolvedComp) {
          return createInnerComp(resolvedComp, instance);
          // 异常
        } else if (error.value && errorComponent) {
          return createVNode(errorComponent as ConcreteComponent, {
            error: error.value,
          });
          // 加载中
        } else if (loadingComponent && !delayed.value) {
          return createVNode(loadingComponent as ConcreteComponent);
        }
      };
    },
  }) as T;
}
```

### 2. `createInnerComp`

当加载成功时，调用`createInnerComp`根据加载得到的`resolvedComp`来创建内部组件。实际上还是`createVNode`来创建的。这里继承了外部组件的`ref`。

```typescript
function createInnerComp(
  comp: ConcreteComponent,
  {
    vnode: { ref, props, children, shapeFlag },
    parent,
  }: ComponentInternalInstance
) {
  const vnode = createVNode(comp, props, children);
  // ensure inner component inherits the async wrapper's ref owner
  vnode.ref = ref;
  return vnode;
}
```

## 二、`Suspense`

在`vue3.2`中引入的新特性之一，便是异步组件`Suspense`。

### 1. `process`

和`KeepAlive`类型，`Suspense`暴露一个类似组件的`API`。当检查到`__isSuspense == true`时，判定当前组件为`<Suspense>`，会调用`process`方法并被传入`renderer`内部进行渲染。`process`也会根据旧节点是否存在，选择 挂载 或者 对比新旧节点并更新。

```typescript
// props
export interface SuspenseProps {
  onResolve?: () => void;
  onPending?: () => void;
  onFallback?: () => void;
  timeout?: string | number;
}

// Suspense
export const SuspenseImpl = {
  name: "Suspense",
  // In order to make Suspense tree-shakable, we need to avoid importing it
  // directly in the renderer. The renderer checks for the __isSuspense flag
  // on a vnode's type and calls the `process` method, passing in renderer
  // internals.
  __isSuspense: true,
  process(
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    isSVG: boolean,
    slotScopeIds: string[] | null,
    optimized: boolean,
    // platform-specific impl passed from renderer
    rendererInternals: RendererInternals
  ) {
    if (n1 == null) {
      mountSuspense(
        n2,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds,
        optimized,
        rendererInternals
      );
    } else {
      patchSuspense(
        n1,
        n2,
        container,
        anchor,
        parentComponent,
        isSVG,
        slotScopeIds,
        optimized,
        rendererInternals
      );
    }
  },
  hydrate: hydrateSuspense,
  create: createSuspenseBoundary,
  normalize: normalizeSuspenseChildren,
};

// Force-casted public typing for h and TSX props inference
export const Suspense = (__FEATURE_SUSPENSE__ ? SuspenseImpl : null) as any as {
  __isSuspense: true;
  new (): { $props: VNodeProps & SuspenseProps };
};
```

#### 1.1 `mountSuspense`

首次加载组件时会进入挂载逻辑。通过`mountSuspense`来挂载异步组件。

```typescript
function mountSuspense(
  vnode: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  isSVG: boolean,
  slotScopeIds: string[] | null,
  optimized: boolean,
  rendererInternals: RendererInternals
) {
  const {
    p: patch,
    o: { createElement },
  } = rendererInternals;
  // 创建一个 div 作为容器，尚未加入到文档中
  const hiddenContainer = createElement("div");
  // 创建 suspense
  const suspense = (vnode.suspense = createSuspenseBoundary(
    vnode,
    parentSuspense,
    parentComponent,
    container,
    hiddenContainer,
    anchor,
    isSVG,
    slotScopeIds,
    optimized,
    rendererInternals
  ));

  // 旧节点为 null ，挂载
  // start mounting the content subtree in an off-dom container
  patch(
    null,
    (suspense.pendingBranch = vnode.ssContent!),
    hiddenContainer,
    null,
    parentComponent,
    suspense,
    isSVG,
    slotScopeIds
  );

  // 检查异步依赖
  // now check if we have encountered any async deps
  if (suspense.deps > 0) {
    // has async
    // invoke @fallback event
    triggerEvent(vnode, "onPending");
    triggerEvent(vnode, "onFallback");

    // 有异步依赖，先降级
    // mount the fallback tree
    patch(
      null,
      vnode.ssFallback!,
      container,
      anchor,
      parentComponent,
      null, // fallback tree will not have suspense context
      isSVG,
      slotScopeIds
    );
    // 活跃分支
    setActiveBranch(suspense, vnode.ssFallback!);
  } else {
    // 没有异步依赖
    // Suspense has no async deps. Just resolve.
    suspense.resolve();
  }
}
```

#### 1.2 `patchSuspense`

`patchSuspense` 进行新旧节点的对比与更新。`Suspense`有多个分支如活跃、等待、降级等。

- 当前（旧节点）有等待分支`pendingBranch`，根据新旧等待分支节点类型是否相同分别做处理；
- 当前（旧节点）没有等待分支`pendingBranch`，根据新的等待分支与当前(旧的)活跃分支节点类型是否相同分别进行处理。

同时也会考虑异步依赖和是否已经处于降级状态。

```typescript
function patchSuspense(
  n1: VNode,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  isSVG: boolean,
  slotScopeIds: string[] | null,
  optimized: boolean,
  { p: patch, um: unmount, o: { createElement } }: RendererInternals
) {
  // suspense复用
  const suspense = (n2.suspense = n1.suspense)!;
  // 虚拟DOM更新
  suspense.vnode = n2;
  // DOM复用
  n2.el = n1.el;
  const newBranch = n2.ssContent!;
  const newFallback = n2.ssFallback!;

  // 解构一份备用
  const { activeBranch, pendingBranch, isInFallback, isHydrating } = suspense;
  // 如果当前有等待分支
  if (pendingBranch) {
    // 刷新等待分支的内容
    suspense.pendingBranch = newBranch;
    // 新旧等待分支属于同样的节点类型
    if (isSameVNodeType(newBranch, pendingBranch)) {
      // patch 做更详细的比较
      // same root type but content may have changed.
      patch(
        pendingBranch,
        newBranch,
        suspense.hiddenContainer,
        null,
        parentComponent,
        suspense,
        isSVG,
        slotScopeIds,
        optimized
      );
      // 没有异步依赖，则直接resolve
      if (suspense.deps <= 0) {
        suspense.resolve();
        // 有异步依赖且处于 降级 状态
      } else if (isInFallback) {
        patch(
          activeBranch,
          newFallback,
          container,
          anchor,
          parentComponent,
          null, // fallback tree will not have suspense context
          isSVG,
          slotScopeIds,
          optimized
        );
        setActiveBranch(suspense, newFallback);
      }
    } else {
      // 新旧等待分支不属于同一类型的节点
      // toggled before pending tree is resolved
      suspense.pendingId++;
      // 处理旧节点
      if (isHydrating) {
        // if toggled before hydration is finished, the current DOM tree is
        // no longer valid. set it as the active branch so it will be unmounted
        // when resolved
        suspense.isHydrating = false;
        suspense.activeBranch = pendingBranch;
      } else {
        unmount(pendingBranch, parentComponent, suspense);
      }
      // 状态重置
      // increment pending ID. this is used to invalidate async callbacks
      // reset suspense state
      suspense.deps = 0;
      // discard effects from pending branch
      suspense.effects.length = 0;
      // discard previous container
      suspense.hiddenContainer = createElement("div");

      // 处理降级状态
      if (isInFallback) {
        // 挂载等待分支
        // already in fallback state
        patch(
          null,
          newBranch,
          suspense.hiddenContainer,
          null,
          parentComponent,
          suspense,
          isSVG,
          slotScopeIds,
          optimized
        );
        // 没有异步依赖，则resolve
        if (suspense.deps <= 0) {
          suspense.resolve();
        } else {
          // 对比旧的活跃分支与新的降级分支
          patch(
            activeBranch,
            newFallback,
            container,
            anchor,
            parentComponent,
            null, // fallback tree will not have suspense context
            isSVG,
            slotScopeIds,
            optimized
          );
          // 重设活跃分支
          setActiveBranch(suspense, newFallback);
        }

        // 不处于 降级状态，且活跃分支与新的等待分支节点类型一致
      } else if (activeBranch && isSameVNodeType(newBranch, activeBranch)) {
        // 对比当前活跃分支与新的等待分支
        // toggled "back" to current active branch
        patch(
          activeBranch,
          newBranch,
          container,
          anchor,
          parentComponent,
          suspense,
          isSVG,
          slotScopeIds,
          optimized
        );
        // 强制resolve
        // force resolve
        suspense.resolve(true);
      } else {
        // 不处于 降级状态，且新的等待分支与当前活跃分支节点类型不一致
        // 挂载新的等待分支
        // switched to a 3rd branch
        patch(
          null,
          newBranch,
          suspense.hiddenContainer,
          null,
          parentComponent,
          suspense,
          isSVG,
          slotScopeIds,
          optimized
        );
        // 没有异步依赖则 resolve
        if (suspense.deps <= 0) {
          suspense.resolve();
        }
      }
    }
    // 当前没有等待的分支
  } else {
    // 新的等待分支与当前活跃分支节点类型一致，则通过patch来对比更新
    if (activeBranch && isSameVNodeType(newBranch, activeBranch)) {
      // root did not change, just normal patch
      patch(
        activeBranch,
        newBranch,
        container,
        anchor,
        parentComponent,
        suspense,
        isSVG,
        slotScopeIds,
        optimized
      );
      // 重设活跃分支
      setActiveBranch(suspense, newBranch);
    } else {
      // 新的等待分支与当前活跃分支节点类型不同，挂载新的等待分支
      // root node toggled
      // invoke @pending event
      triggerEvent(n2, "onPending");
      // mount pending branch in off-dom container
      suspense.pendingBranch = newBranch;
      suspense.pendingId++;
      patch(
        null,
        newBranch,
        suspense.hiddenContainer,
        null,
        parentComponent,
        suspense,
        isSVG,
        slotScopeIds,
        optimized
      );
      // 没有异步依赖则 resolve
      if (suspense.deps <= 0) {
        // incoming branch has no async deps, resolve now.
        suspense.resolve();
      } else {
        // 有异步依赖
        const { timeout, pendingId } = suspense;
        // 有设置超时时间，定时器 超时降级
        if (timeout > 0) {
          setTimeout(() => {
            if (suspense.pendingId === pendingId) {
              suspense.fallback(newFallback);
            }
          }, timeout);
        } else if (timeout === 0) {
          //超时时间设置为0，即时降级
          suspense.fallback(newFallback);
        }
      }
    }
  }
}
```

#### 1.3 `setActiveBranch`

`setActiveBranch`用来设置活跃分支。

```typescript
function setActiveBranch(suspense: SuspenseBoundary, branch: VNode) {
  suspense.activeBranch = branch;
  const { vnode, parentComponent } = suspense;
  const el = (vnode.el = branch.el);
  // in case suspense is the root node of a component,
  // recursively update the HOC el
  if (parentComponent && parentComponent.subTree === vnode) {
    parentComponent.vnode.el = el;
    updateHOCHostEl(parentComponent, el);
  }
}
```

### 2. `SuspenseBoundary`

#### 2.1 `ts` 类型

```typescript
export interface SuspenseBoundary {
  vnode: VNode<RendererNode, RendererElement, SuspenseProps>;
  parent: SuspenseBoundary | null;
  parentComponent: ComponentInternalInstance | null;
  isSVG: boolean;
  container: RendererElement;
  hiddenContainer: RendererElement;
  anchor: RendererNode | null;
  // 活跃分支
  activeBranch: VNode | null;
  // 等待分支
  pendingBranch: VNode | null;
  // 异步依赖数量
  deps: number;
  pendingId: number;
  timeout: number;
  isInFallback: boolean;
  isHydrating: boolean;
  isUnmounted: boolean;
  // 副作用
  effects: Function[];
  resolve(force?: boolean): void;
  // 降级
  fallback(fallbackVNode: VNode): void;
  move(
    container: RendererElement,
    anchor: RendererNode | null,
    type: MoveType
  ): void;
  next(): RendererNode | null;
  registerDep(
    instance: ComponentInternalInstance,
    setupRenderEffect: SetupRenderEffectFn
  ): void;
  // 卸载
  unmount(parentSuspense: SuspenseBoundary | null, doRemove?: boolean): void;
}
```

#### 2.2 `createSuspenseBoundary`

使用`createSuspenseBoundary`来生成一个`SuspenseBoundary`类型的`suspense`。由上面的`ts`类型我们知道，这个`suspense`具有`resolve`, `fallback`, `move`, `next`, `registerDep`, `unmount`等方法。下面就一个个分析每个方法的主要功能。

##### 2.2.1 `suspense.resolve`

在拿到期望的异步结果时，调用**`resolve`**来用等待分支替换掉当前的活跃分支，从而渲染期望的内容。

- 因此，首先就是要保证异步组件具有等待分支，且组件尚未被卸载（开发环境）；
- 之后调用从`suspenseInternals`中拿到的`move`函数将等待分支从离线容器移动到实际容器中，并将其设置为活跃分支；
- 沿着`suspense.parent`链向上查找，将所有副作用合并到最外层的未解决的`Suspense`中；
- 如果向上查找时没有发现未解决的先代`Suspense`，则处理当前`Suspense`的所有副作用，并将副作用列表清空；
- 触发`Suspense`的`onResolve`事件。

```typescript
const suspense: SuspenseBoundary = {
  // ...

  resolve(resume = false) {
    // 确保有等待分支且Suspense未被卸载
    if (__DEV__) {
      if (!resume && !suspense.pendingBranch) {
        throw new Error(
          `suspense.resolve() is called without a pending branch.`
        );
      }
      if (suspense.isUnmounted) {
        throw new Error(
          `suspense.resolve() is called on an already unmounted suspense boundary.`
        );
      }
    }
    // 解构变量
    const {
      vnode,
      activeBranch,
      pendingBranch,
      pendingId,
      effects,
      parentComponent,
      container,
    } = suspense;

    if (suspense.isHydrating) {
      suspense.isHydrating = false;
    } else if (!resume) {
      // 有transition的延迟切入，则在其transition.afterLeave中进行move
      // move的作用是将等待分支的内容从离线容器移动到实际容器中
      const delayEnter =
        activeBranch &&
        pendingBranch!.transition &&
        pendingBranch!.transition.mode === "out-in";
      if (delayEnter) {
        activeBranch!.transition!.afterLeave = () => {
          if (pendingId === suspense.pendingId) {
            move(pendingBranch!, container, anchor, MoveType.ENTER);
          }
        };
      }
      // this is initial anchor on mount
      let { anchor } = suspense;
      // 卸载当前的活跃分支
      // unmount current active tree
      if (activeBranch) {
        // if the fallback tree was mounted, it may have been moved
        // as part of a parent suspense. get the latest anchor for insertion
        anchor = next(activeBranch);
        unmount(activeBranch, parentComponent, suspense, true);
      }
      // 没有transition的延迟切入，则在此move
      if (!delayEnter) {
        // move content from off-dom container to actual container
        move(pendingBranch!, container, anchor, MoveType.ENTER);
      }
    }

    // 将等待分支设置为活跃分支
    setActiveBranch(suspense, pendingBranch!);
    // 由于等待分支已经成为了活跃分支，因此置空等待分支，不必渲染降级内容
    suspense.pendingBranch = null;
    suspense.isInFallback = false;

    // flush buffered effects
    // check if there is a pending parent suspense
    let parent = suspense.parent;
    let hasUnresolvedAncestor = false;
    // 向上查找Suspense，将所有未执行的副作用合并到最外层的处于等待期的Suspense中
    // 这样就能等所有的Suspense都解决之后，再一并执行副作用
    while (parent) {
      if (parent.pendingBranch) {
        // found a pending parent suspense, merge buffered post jobs
        // into that parent
        parent.effects.push(...effects);
        // 标记尚有未解决的先代异步组件
        hasUnresolvedAncestor = true;
        break;
      }
      parent = parent.parent;
    }
    // 向上查找的Suspense链没有未解决的，则处理副作用并清空副作用列表
    // no pending parent suspense, flush all jobs
    if (!hasUnresolvedAncestor) {
      queuePostFlushCb(effects);
    }
    suspense.effects = [];

    // 触发异步组件的onResolve事件
    // invoke @resolve event
    triggerEvent(vnode, "onResolve");
  },

  // ...
};
```

##### 2.2.2 `suspense.fallback`

**`fallback`**用于挂载降级内容`Fallback`。

- 触发`onFallback`事件；
- 有延迟动画`transition`则在其`afterLeave`动画钩子中挂载`Fallback`内容；
- 卸载当前活跃分支；
- 若没有延迟动画则直接挂载`Fallback`内容。

```typescript
const suspense: SuspenseBoundary = {
  // ...

  fallback(fallbackVNode) {
    // 没有等待分支则返回
    if (!suspense.pendingBranch) {
      return;
    }

    // 解构变量
    const { vnode, activeBranch, parentComponent, container, isSVG } = suspense;

    // 触发onFallback
    // invoke @fallback event
    triggerEvent(vnode, "onFallback");

    // 切换了锚点
    const anchor = next(activeBranch!);
    // 函数：挂载降级内容
    const mountFallback = () => {
      if (!suspense.isInFallback) {
        return;
      }
      // mount the fallback tree
      patch(
        null,
        fallbackVNode,
        container,
        anchor,
        parentComponent,
        null, // fallback tree will not have suspense context
        isSVG,
        slotScopeIds,
        optimized
      );
      setActiveBranch(suspense, fallbackVNode);
    };

    // transition延迟动画
    const delayEnter =
      fallbackVNode.transition && fallbackVNode.transition.mode === "out-in";
    // 有延迟动画则在afterLeave动画钩子中挂载降级内容
    if (delayEnter) {
      activeBranch!.transition!.afterLeave = mountFallback;
    }
    suspense.isInFallback = true;

    // 卸载活跃分支
    // unmount current active branch
    unmount(
      activeBranch!,
      parentComponent,
      null, // no suspense so unmount hooks fire now
      true // shouldRemove
    );

    // 没有延迟动画则直接挂载降级内容
    if (!delayEnter) {
      mountFallback();
    }
  },

  //...
};
```

##### 2.2.3 `suspense.move`

处理活跃分支和容器。

```typescript
// function createSuspenseBoundary
const {
  p: patch,
  // 这个move想下面的suspense.move里用到的
  m: move,
  um: unmount,
  n: next,
  o: { parentNode, remove },
} = rendererInternals;

const suspense: SuspenseBoundary = {
  // ...

  move(container, anchor, type) {
    suspense.activeBranch &&
      // 这个move不是suspense.move，而是在 createSuspenseBoundary 函数中解构 rendererInternals 得到的
      move(suspense.activeBranch, container, anchor, type);
    suspense.container = container;
  },

  // ...
};
```

##### 2.2.4 `suspense.next`

`next()`递归取到`supense`的活跃分支链的末端。

```typescript
const suspense: SuspenseBoundary = {
  // ...
  next() {
    return suspense.activeBranch && next(suspense.activeBranch);
  },
};
```

##### 2.2.5 `suspense.registerDep`

`registerDep`用于注册依赖，接收一个实例`instance`和渲染副作用函数`setupRenderEffect`。若注册时，`suspense`处于等待期，则其异步依赖数量`+1`；随后注册实例`instance`上的异步依赖`asyncDep`，得到一个`Promise`。在`then`中使用` handleSetupResult`来处理异步依赖的解决结果，并执行渲染副作用`setupRenderEffect`；如果`suspense`处于等待期，则将其`deps`数量`-1`，因为一开始`+1`。

```typescript
const suspense: SuspenseBoundary = {
  // ...
  registerDep(instance, setupRenderEffect) {
    // 等待期 异步依赖数量+1
    const isInPendingSuspense = !!suspense.pendingBranch;
    if (isInPendingSuspense) {
      suspense.deps++;
    }
    const hydratedEl = instance.vnode.el;
    // 注册异步依赖
    instance
      .asyncDep!.catch((err) => {
        handleError(err, instance, ErrorCodes.SETUP_FUNCTION);
      })
      .then((asyncSetupResult) => {
        // retry when the setup() promise resolves.
        // component may have been unmounted before resolve.
        if (
          instance.isUnmounted ||
          suspense.isUnmounted ||
          suspense.pendingId !== instance.suspenseId
        ) {
          return;
        }
        // retry from this component
        instance.asyncResolved = true;
        const { vnode } = instance;
        if (__DEV__) {
          pushWarningContext(vnode);
        }
        // 处理异步依赖运行的结果
        handleSetupResult(instance, asyncSetupResult, false);
        if (hydratedEl) {
          // vnode may have been replaced if an update happened before the
          // async dep is resolved.
          vnode.el = hydratedEl;
        }
        const placeholder = !hydratedEl && instance.subTree.el;
        // 调用传入的setupRenderEffect处理渲染副作用
        setupRenderEffect(
          instance,
          vnode,
          // component may have been moved before resolve.
          // if this is not a hydration, instance.subTree will be the comment
          // placeholder.
          parentNode(hydratedEl || instance.subTree.el!)!,
          // anchor will not be used if this is hydration, so only need to
          // consider the comment placeholder case.
          hydratedEl ? null : next(instance.subTree),
          suspense,
          isSVG,
          optimized
        );
        if (placeholder) {
          remove(placeholder);
        }
        updateHOCHostEl(instance, vnode.el);
        if (__DEV__) {
          popWarningContext();
        }
        // 异步依赖已解决，若suspense还在等待期，则异步依赖数量-1，当归零时调用resolve
        // only decrease deps count if suspense is not already resolved
        if (isInPendingSuspense && --suspense.deps === 0) {
          suspense.resolve();
        }
      });
  },
};
```

##### 2.2.6 `unmount`

卸载`suspense`：将`suspense.isUnmounted`置为`true`，卸载活跃分支和等待分支。

```typescript
const suspense: SuspenseBoundary = {
  // ...
  unmount(parentSuspense, doRemove) {
    suspense.isUnmounted = true;
    if (suspense.activeBranch) {
      // 从suspenseInternals中拿到的unmount
      unmount(suspense.activeBranch, parentComponent, parentSuspense, doRemove);
    }
    if (suspense.pendingBranch) {
      // 从suspenseInternals中拿到的unmount
      unmount(
        suspense.pendingBranch,
        parentComponent,
        parentSuspense,
        doRemove
      );
    }
  },
};
```
