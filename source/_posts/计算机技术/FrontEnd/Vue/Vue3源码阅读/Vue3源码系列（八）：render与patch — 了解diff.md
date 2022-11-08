---
title: Vue3源码系列（八）：render与patch — 了解diff
date: "2022-11-02 17:21"
updated: "2022-11-02 17:21"
tags:
  - 前 端
  - Vue3
  - 源码阅读
keywords:
  - 前端
  - Vue
  - Vue3
  - 源码
  - diff
  - patch
  - render
categories:
  - [源码]
  - [前端, Vue3]
abbrlink: "876e332"
swiper_index: 8
---

上一篇中，我们理清了`createApp`走的流程，最后通过`createAppAPI`创建了`app`。虽然`app`上的各种属性和方法也都已经有所了解，但其中的`mount`和`unmount`方法，都是通过调用`render`函数来完成的。尽管我们很好奇`render`函数的故事，可是`baseCreateRenderer`函数有`2000+`行，基本都和`render`相关，因此拆解到本文里叙述，以下方法都定义在`baseCreateRenderer`函数中。

## 一、`render`

`render`也不神秘了，毕竟在上一篇文章中露过面，当然这里也顺带提一下 `baseCreateRenderer`从参数`options`中解构的一些方法，基本都是些增删改查、复制节点的功能，见名知义了。主要看看`render`，接收`vnode`、`container`、`isSvg`三个参数。调用`unmount`卸载或者调用`patch`进行节点比较从而继续下一步。

- 判断`vnode`是否为`null`。如果对上一篇文章还有印象，那么就会知道，相当于是判断调用的是`app.mount`还是`app.unmount`方法，因为`app.unmount`方法传入的`vnode`就是`null`。那么这里对应的就是在`app.unmount`里使用`unmount`函数来卸载；而在`app.mount`里进行`patch`比较。
- 调用`flushPostFlushCbs()`，其中的单词`Post`的含义，看过第一篇讲解`watch`的同学也许能猜出来，表示执行时机是在组件更新后。这个函数便是执行组件更新后的一些回调。
- 把`vnode`挂到`container`上，即旧的虚拟`DOM`。

```typescript
const {
  insert: hostInsert,
  remove: hostRemove,
  patchProp: hostPatchProp,
  createElement: hostCreateElement,
  createText: hostCreateText,
  createComment: hostCreateComment,
  setText: hostSetText,
  setElementText: hostSetElementText,
  parentNode: hostParentNode,
  nextSibling: hostNextSibling,
  setScopeId: hostSetScopeId = NOOP,
  cloneNode: hostCloneNode,
  insertStaticContent: hostInsertStaticContent,
} = options;

// render
const render: RootRenderFunction = (vnode, container, isSVG) => {
  if (vnode == null) {
    if (container._vnode) {
      unmount(container._vnode, null, null, true);
    }
  } else {
    // 新旧节点的对比
    patch(container._vnode || null, vnode, container, null, null, null, isSVG);
  }
  flushPostFlushCbs();
  // 记录旧节点
  container._vnode = vnode;
};
```

## 二、`patch`

### 1. `patch`

`patch`函数里主要对新旧节点也就是**虚拟`DOM`的对比**，常说的`vue`里的`diff`算法，便是从`patch`开始。结合`render`函数来看，我们知道，旧的虚拟`DOM`存储在`container._vnode`上。那么`diff`的方式就在`patch`中了：

- 新旧节点相同，直接返回；

- 旧节点存在，且新旧节点类型不同，则旧节点不可复用，将其卸载(`unmount`)，锚点`anchor`移向下一个节点；

- 新节点是否静态节点标记；

- 根据新节点的类型，相应地调用不同类型的处理方法：

  - 文本：`processText`；
  - 注释：`processCommentNode`；
  - 静态节点：`mountStaticNode`或`patchStaticNode`；
  - 文档片段：`processFragment`；
  - 其它。

在 其它 这一项中，又根据形状标记 `shapeFlag`等，判断是 元素节点、组件节点，或是`Teleport`、`Suspense`等，然后调用相应的`process`去处理。最后处理`template`中的`ref`

```typescript
// Note: functions inside this closure should use `const xxx = () => {}`
// style in order to prevent being inlined by minifiers.
const patch: PatchFn = (
  n1,
  n2,
  container,
  anchor = null,
  parentComponent = null,
  parentSuspense = null,
  isSVG = false,
  slotScopeIds = null,
  optimized = __DEV__ && isHmrUpdating ? false : !!n2.dynamicChildren
) => {
  // 新旧节点相同，直接返回
  if (n1 === n2) {
    return;
  }

  // 旧节点存在，且新旧节点类型不同，卸载旧节点，锚点anchor后移
  // patching & not same type, unmount old tree
  if (n1 && !isSameVNodeType(n1, n2)) {
    anchor = getNextHostNode(n1);
    unmount(n1, parentComponent, parentSuspense, true);
    n1 = null;
  }

  // 是否静态节点优化
  if (n2.patchFlag === PatchFlags.BAIL) {
    optimized = false;
    n2.dynamicChildren = null;
  }

  //
  const { type, ref, shapeFlag } = n2;
  switch (type) {
    case Text:
      processText(n1, n2, container, anchor);
      break;
    case Comment:
      processCommentNode(n1, n2, container, anchor);
      break;
    case Static:
      if (n1 == null) {
        mountStaticNode(n2, container, anchor, isSVG);
      } else if (__DEV__) {
        patchStaticNode(n1, n2, container, isSVG);
      }
      break;
    case Fragment:
      processFragment(
        n1,
        n2,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds,
        optimized
      );
      break;
    default:
      if (shapeFlag & ShapeFlags.ELEMENT) {
        processElement(
          n1,
          n2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds,
          optimized
        );
      } else if (shapeFlag & ShapeFlags.COMPONENT) {
        processComponent(
          n1,
          n2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds,
          optimized
        );
      } else if (shapeFlag & ShapeFlags.TELEPORT) {
        (type as typeof TeleportImpl).process(
          n1 as TeleportVNode,
          n2 as TeleportVNode,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds,
          optimized,
          internals
        );
      } else if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
        (type as typeof SuspenseImpl).process(
          n1,
          n2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds,
          optimized,
          internals
        );
      } else if (__DEV__) {
        warn("Invalid VNode type:", type, `(${typeof type})`);
      }
  }

  // 处理 template 中的 ref
  // set ref
  if (ref != null && parentComponent) {
    setRef(ref, n1 && n1.ref, parentSuspense, n2 || n1, !n2);
  }
};
```

### 2. `processText`

文本节点的处理十分简单，没有旧节点则新建并插入新节点；有旧节点，且节点内容不一致，则设置为新节点的内容。

```typescript
const processText: ProcessTextOrCommentFn = (n1, n2, container, anchor) => {
  if (n1 == null) {
    hostInsert(
      (n2.el = hostCreateText(n2.children as string)),
      container,
      anchor
    );
  } else {
    const el = (n2.el = n1.el!);
    if (n2.children !== n1.children) {
      hostSetText(el, n2.children as string);
    }
  }
};
```

### 3. `processCommontNode`

不支持动态的注视节点，因此只要旧节点存在，就使用旧节点的内容。

```typescript
const processCommentNode: ProcessTextOrCommentFn = (
  n1,
  n2,
  container,
  anchor
) => {
  if (n1 == null) {
    hostInsert(
      (n2.el = hostCreateComment((n2.children as string) || "")),
      container,
      anchor
    );
  } else {
    // there's no support for dynamic comments
    n2.el = n1.el;
  }
};
```

### 4. `mountStaticNode` 和 `patchStaticNode`

事实上静态节点没啥好比较的，毕竟是静态的。当没有旧节点时，则通过`mountStaticNode`创建并插入新节点；即使有旧节点，也仅在`_DEV_`条件下在`hmr`，才会使用`patchStaticVnode`做一下比较并通过`removeStaticNode`移除某些旧节点。

```typescript
const mountStaticNode = (
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  isSVG: boolean
) => {
  // static nodes are only present when used with compiler-dom/runtime-dom
  // which guarantees presence of hostInsertStaticContent.
  [n2.el, n2.anchor] = hostInsertStaticContent!(
    n2.children as string,
    container,
    anchor,
    isSVG,
    n2.el,
    n2.anchor
  );
};

/**
 * Dev / HMR only
 */
const patchStaticNode = (
  n1: VNode,
  n2: VNode,
  container: RendererElement,
  isSVG: boolean
) => {
  // static nodes are only patched during dev for HMR
  if (n2.children !== n1.children) {
    const anchor = hostNextSibling(n1.anchor!);

    // 移除已有的静态节点，并插入新的节点
    // remove existing
    removeStaticNode(n1);
    // insert new
    [n2.el, n2.anchor] = hostInsertStaticContent!(
      n2.children as string,
      container,
      anchor,
      isSVG
    );
  } else {
    n2.el = n1.el;
    n2.anchor = n1.anchor;
  }
};

// removeStaticNode：从 n1.el 至 n1.anchor 的内容被遍历移除
const removeStaticNode = ({ el, anchor }: VNode) => {
  let next;
  while (el && el !== anchor) {
    next = hostNextSibling(el);
    hostRemove(el);
    el = next;
  }
  hostRemove(anchor!);
};
```

### 5. `processFragment`

#### 5.1 `processFragment`

`vue3`的单文件组件里，不再需要加一个根节点，因为使用了文档片段`fragment`来承载子节点，最后再一并添加到文档中。

- 若旧的片段节点为空，则插入起始锚点，挂载新的子节点；

- 旧的片段不为空：

  - 存在优化条件时：使用`patchBlockChildren`优化`diff`；
  - 不存在优化条件时：使用`patchChildren`进行全量`diff`。

```typescript
const processFragment = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  isSVG: boolean,
  slotScopeIds: string[] | null,
  optimized: boolean
) => {
  // 锚点
  const fragmentStartAnchor = (n2.el = n1 ? n1.el : hostCreateText(""))!;
  const fragmentEndAnchor = (n2.anchor = n1 ? n1.anchor : hostCreateText(""))!;

  let { patchFlag, dynamicChildren, slotScopeIds: fragmentSlotScopeIds } = n2;

  // 开发环境热更新时，强制全量diff
  if (
    __DEV__ &&
    // #5523 dev root fragment may inherit directives
    (isHmrUpdating || patchFlag & PatchFlags.DEV_ROOT_FRAGMENT)
  ) {
    // HMR updated / Dev root fragment (w/ comments), force full diff
    patchFlag = 0;
    optimized = false;
    dynamicChildren = null;
  }

  // 检查是否是插槽
  // check if this is a slot fragment with :slotted scope ids
  if (fragmentSlotScopeIds) {
    slotScopeIds = slotScopeIds
      ? slotScopeIds.concat(fragmentSlotScopeIds)
      : fragmentSlotScopeIds;
  }

  // 当旧的片段为空时，挂载新的片段的子节点
  if (n1 == null) {
    hostInsert(fragmentStartAnchor, container, anchor);
    hostInsert(fragmentEndAnchor, container, anchor);
    // a fragment can only have array children
    // since they are either generated by the compiler, or implicitly created
    // from arrays.
    mountChildren(
      n2.children as VNodeArrayChildren,
      container,
      fragmentEndAnchor,
      parentComponent,
      parentSuspense,
      isSVG,
      slotScopeIds,
      optimized
    );
  } else {
    // 当旧片段不为空时，启用优化则使用patchBlockChildren
    if (
      patchFlag > 0 &&
      patchFlag & PatchFlags.STABLE_FRAGMENT &&
      dynamicChildren &&
      // #2715 the previous fragment could've been a BAILed one as a result
      // of renderSlot() with no valid children
      n1.dynamicChildren
    ) {
      // a stable fragment (template root or <template v-for>) doesn't need to
      // patch children order, but it may contain dynamicChildren.
      patchBlockChildren(
        n1.dynamicChildren,
        dynamicChildren,
        container,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds
      );
      // 开发环境，热更新 处理静态子节点
      if (__DEV__ && parentComponent && parentComponent.type.__hmrId) {
        traverseStaticChildren(n1, n2);
      } else if (
        // #2080 if the stable fragment has a key, it's a <template v-for> that may
        //  get moved around. Make sure all root level vnodes inherit el.
        // #2134 or if it's a component root, it may also get moved around
        // as the component is being moved.
        n2.key != null ||
        (parentComponent && n2 === parentComponent.subTree)
      ) {
        traverseStaticChildren(n1, n2, true /* shallow */);
      }
    } else {
      // 不可优化时，使用patchChildren处理
      // keyed / unkeyed, or manual fragments.
      // for keyed & unkeyed, since they are compiler generated from v-for,
      // each child is guaranteed to be a block so the fragment will never
      // have dynamicChildren.
      patchChildren(
        n1,
        n2,
        container,
        fragmentEndAnchor,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds,
        optimized
      );
    }
  }
};
```

#### 5.2 `patchBlockChildren`

在文档片段中的`diff`中，当符合优化条件时，则调用`patchBlockChildren`来进行优化的`diff`。这里主要以新节点的子节点长度为准，遍历新旧节点的子节点，更新了每个子节点的`container`然后进行`patch`。

```typescript
// The fast path for blocks.
const patchBlockChildren: PatchBlockChildrenFn = (
  oldChildren,
  newChildren,
  fallbackContainer,
  parentComponent,
  parentSuspense,
  isSVG,
  slotScopeIds
) => {
  for (let i = 0; i < newChildren.length; i++) {
    const oldVNode = oldChildren[i];
    const newVNode = newChildren[i];
    // Determine the container (parent element) for the patch.
    const container =
      // oldVNode may be an errored async setup() component inside Suspense
      // which will not have a mounted element
      oldVNode.el &&
      // - In the case of a Fragment, we need to provide the actual parent
      // of the Fragment itself so it can move its children.
      (oldVNode.type === Fragment ||
        // - In the case of different nodes, there is going to be a replacement
        // which also requires the correct parent container
        !isSameVNodeType(oldVNode, newVNode) ||
        // - In the case of a component, it could contain anything.
        oldVNode.shapeFlag & (ShapeFlags.COMPONENT | ShapeFlags.TELEPORT))
        ? hostParentNode(oldVNode.el)!
        : // In other cases, the parent container is not actually used so we
          // just pass the block element here to avoid a DOM parentNode call.
          fallbackContainer;
    patch(
      oldVNode,
      newVNode,
      container,
      null,
      parentComponent,
      parentSuspense,
      isSVG,
      slotScopeIds,
      true
    );
  }
};
```

#### 5.3 `patchChildren`

在没有优化条件时，使用`patchChildren`对子节点进行全量的`diff`。

```typescript
const patchChildren: PatchChildrenFn = (
  n1,
  n2,
  container,
  anchor,
  parentComponent,
  parentSuspense,
  isSVG,
  slotScopeIds,
  optimized = false
) => {
  const c1 = n1 && n1.children;
  const prevShapeFlag = n1 ? n1.shapeFlag : 0;
  const c2 = n2.children;

  const { patchFlag, shapeFlag } = n2;

  // 走绿色通道：用patchFlag来保证children是数组
  // fast path
  if (patchFlag > 0) {
    if (patchFlag & PatchFlags.KEYED_FRAGMENT) {
      // 有key属性的时候，根据key来进行diff
      // this could be either fully-keyed or mixed (some keyed some not)
      // presence of patchFlag means children are guaranteed to be arrays
      patchKeyedChildren(
        c1 as VNode[],
        c2 as VNodeArrayChildren,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds,
        optimized
      );
      return;
    } else if (patchFlag & PatchFlags.UNKEYED_FRAGMENT) {
      // 没有key
      // unkeyed
      patchUnkeyedChildren(
        c1 as VNode[],
        c2 as VNodeArrayChildren,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds,
        optimized
      );
      return;
    }
  }

  // 没有patchFlag的保证，则children可能为文本、数组或空
  // 根据形状标识来判断
  // children has 3 possibilities: text, array or no children.
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    // 文本子节点的绿色通道
    // text children fast path
    if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      unmountChildren(c1 as VNode[], parentComponent, parentSuspense);
    }
    if (c2 !== c1) {
      hostSetElementText(container, c2 as string);
    }
  } else {
    // 旧的子节点是数组
    if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // prev children was array
      if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 新旧子节点都是数组，需要进行全量diff
        // two arrays, cannot assume anything, do full diff
        patchKeyedChildren(
          c1 as VNode[],
          c2 as VNodeArrayChildren,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds,
          optimized
        );
      } else {
        // 新的子节点为空，则只需要卸载旧的子节点
        // no new children, just unmount old
        unmountChildren(c1 as VNode[], parentComponent, parentSuspense, true);
      }
    } else {
      // 旧的子节点为文本节点或者空，新的为数组或空
      // prev children was text OR null
      // new children is array OR null
      if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
        // 旧的为文本节点，先将其文本置空
        hostSetElementText(container, "");
      }
      // 新的为数组，则通过mountChildren挂载子节点
      // mount new if array
      if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        mountChildren(
          c2 as VNodeArrayChildren,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds,
          optimized
        );
      }
    }
  }
};
```

#### 5.4 `patchKeyedChildren`

使用`patchKeyedChildren`来比较两组有`key`，或者有`key`和没有`key`混合的`children`，属于`diff`的核心内容了。

- 从前往后依次对比相同索引位置的节点类型，当遇到节点类型不同则退出比较；

- 再从后往前对比相同倒序位置上的节点类型，遇到不同类型则退出比较；

- 如果旧节点组遍历完，而新节点组还有内容，则挂载新节点组里的剩余内容；

- 如果新节点组遍历完，而旧节点组还有内容，则卸载旧节点组里的剩余内容；

- 如果都没有遍历完：

  - 将新节点组的剩余内容以`key=>index`的形式存入`Map`；
  - 遍历剩余的旧子节点，在`Map`中找到相同的`key`对应的`index`；
  - 如果旧子节点没有`key`，则找到新子节点组的剩余子节点中尚未被匹配到且类型相同的节点对应的`index`；
  - 求出最大递增子序列；
  - 卸载不匹配的旧子节点、挂载未被匹配的新子节点，移动需要移动的可复用子节点。

```typescript
// can be all-keyed or mixed
const patchKeyedChildren = (
  c1: VNode[],
  c2: VNodeArrayChildren,
  container: RendererElement,
  parentAnchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  isSVG: boolean,
  slotScopeIds: string[] | null,
  optimized: boolean
) => {
  let i = 0;
  const l2 = c2.length;
  // 两组各自的尾节点
  let e1 = c1.length - 1; // prev ending index
  let e2 = l2 - 1; // next ending index

  // (从前往后)
  // 以两组中最短的一组为基准
  // 从头结点开始，依次比较同一位置的节点类型，若头节点类型相同，则对两个节点进行patch进行比较;
  // 若类型不同则退出循环
  // 1. sync from start
  // (a b) c
  // (a b) d e
  while (i <= e1 && i <= e2) {
    const n1 = c1[i];
    const n2 = (c2[i] = optimized
      ? cloneIfMounted(c2[i] as VNode)
      : normalizeVNode(c2[i]));
    if (isSameVNodeType(n1, n2)) {
      patch(
        n1,
        n2,
        container,
        null,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds,
        optimized
      );
    } else {
      break;
    }
    //
    i++;
  }

  // (从后往前)
  // 从尾节点开始，尾节点类型相同，则通过patch比较尾节点；
  // 若类型不同则退出循环
  // 2. sync from end
  // a (b c)
  // d e (b c)
  while (i <= e1 && i <= e2) {
    const n1 = c1[e1];
    const n2 = (c2[e2] = optimized
      ? cloneIfMounted(c2[e2] as VNode)
      : normalizeVNode(c2[e2]));
    if (isSameVNodeType(n1, n2)) {
      patch(
        n1,
        n2,
        container,
        null,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds,
        optimized
      );
    } else {
      break;
    }
    e1--;
    e2--;
  }

  // 经过前后两轮比较之后，剩下的就是中间那部分类型不同的子节点了

  // 若旧的子节点组已经遍历完，而新的子节点组还有剩余内容
  // 通过patch处理剩下的新的子节点中的内容，由于旧的子节点为空，
  // 因此相当于在patch内部挂载剩余的新的子节点
  // 3. common sequence + mount
  // (a b)
  // (a b) c
  // i = 2, e1 = 1, e2 = 2
  // (a b)
  // c (a b)
  // i = 0, e1 = -1, e2 = 0
  if (i > e1) {
    if (i <= e2) {
      const nextPos = e2 + 1;
      const anchor = nextPos < l2 ? (c2[nextPos] as VNode).el : parentAnchor;
      while (i <= e2) {
        patch(
          null,
          (c2[i] = optimized
            ? cloneIfMounted(c2[i] as VNode)
            : normalizeVNode(c2[i])),
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds,
          optimized
        );
        i++;
      }
    }
  }

  // 旧的子节点还有剩余内容而新的子节点组已经遍历完，则卸载旧子节点组剩余的那部分
  // 4. common sequence + unmount
  // (a b) c
  // (a b)
  // i = 2, e1 = 2, e2 = 1
  // a (b c)
  // (b c)
  // i = 0, e1 = 0, e2 = -1
  else if (i > e2) {
    while (i <= e1) {
      unmount(c1[i], parentComponent, parentSuspense, true);
      i++;
    }
  }

  // 新旧子节点组都没有遍历完，如下注释中[]里的部分
  // 5. unknown sequence
  // [i ... e1 + 1]: a b [c d e] f g
  // [i ... e2 + 1]: a b [e d c h] f g
  // i = 2, e1 = 4, e2 = 5
  else {
    // 拿到上次比较完的起点
    const s1 = i; // prev starting index
    const s2 = i; // next starting index

    // 5.1 build key:index map for newChildren
    const keyToNewIndexMap: Map<string | number | symbol, number> = new Map();
    // 用Map存储新的子节点组的key和对应的index， key=>index 并给出重复的key的警告
    for (i = s2; i <= e2; i++) {
      const nextChild = (c2[i] = optimized
        ? cloneIfMounted(c2[i] as VNode)
        : normalizeVNode(c2[i]));
      if (nextChild.key != null) {
        if (__DEV__ && keyToNewIndexMap.has(nextChild.key)) {
          warn(
            `Duplicate keys found during update:`,
            JSON.stringify(nextChild.key),
            `Make sure keys are unique.`
          );
        }
        keyToNewIndexMap.set(nextChild.key, i);
      }
    }

    // 5.2 loop through old children left to be patched and try to patch
    // matching nodes & remove nodes that are no longer present
    let j;
    // 已比较的数量
    let patched = 0;
    // 未比较的数量
    const toBePatched = e2 - s2 + 1;
    let moved = false;
    // used to track whether any node has moved
    let maxNewIndexSoFar = 0;
    // works as Map<newIndex, oldIndex>
    // Note that oldIndex is offset by +1
    // and oldIndex = 0 is a special value indicating the new node has
    // no corresponding old node.
    // used for determining longest stable subsequence
    // 以新的子节点组中未完成比较的节点为基准
    const newIndexToOldIndexMap = new Array(toBePatched);
    // 先用0来填充，标记为没有key的节点。 ps:直接fill(0)不就好了么
    for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0;

    // 处理旧的子节点组
    for (i = s1; i <= e1; i++) {
      const prevChild = c1[i];
      // 当已经比较完了(patched >= toBePatched)，卸载旧的子节点
      if (patched >= toBePatched) {
        // all new children have been patched so this can only be a removal
        unmount(prevChild, parentComponent, parentSuspense, true);
        continue;
      }
      let newIndex;
      // 当旧的子节点的key存在，取出key在新的子节点组中对应的index
      if (prevChild.key != null) {
        newIndex = keyToNewIndexMap.get(prevChild.key);
      } else {
        // 若旧的子节点没有key，找出没有key且类型相同的节点对应在新子节点组中的index
        // key-less node, try to locate a key-less node of the same type
        for (j = s2; j <= e2; j++) {
          if (
            newIndexToOldIndexMap[j - s2] === 0 &&
            isSameVNodeType(prevChild, c2[j] as VNode)
          ) {
            newIndex = j;
            break;
          }
        }
      }
      // newIndex不存在，即根据key来找，发现旧的子节点不可复用，则卸载旧的子节点
      if (newIndex === undefined) {
        unmount(prevChild, parentComponent, parentSuspense, true);
      } else {
        // 找到了可复用的节点，在newIndexToOldIndexMap中标记 i+1，
        // 用于最大上升子序列算法
        newIndexToOldIndexMap[newIndex - s2] = i + 1;
        // 刷新目前找到的最大的新子节点的index，做节点移动标记
        if (newIndex >= maxNewIndexSoFar) {
          maxNewIndexSoFar = newIndex;
        } else {
          moved = true;
        }
        // 再递归详细比较两个节点
        patch(
          prevChild,
          c2[newIndex] as VNode,
          container,
          null,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds,
          optimized
        );
        // 已对比的数量+1
        patched++;
      }
    }

    // 当需要移动时，采用最大递增子序列算法，从而最大限度减少节点移动次数
    // 5.3 move and mount
    // generate longest stable subsequence only when nodes have moved
    const increasingNewIndexSequence = moved
      ? getSequence(newIndexToOldIndexMap)
      : EMPTY_ARR;
    j = increasingNewIndexSequence.length - 1;
    // 倒序遍历，好处是可以使用上一次对比的节点作为锚点
    // looping backwards so that we can use last patched node as anchor
    for (i = toBePatched - 1; i >= 0; i--) {
      const nextIndex = s2 + i;
      const nextChild = c2[nextIndex] as VNode;
      const anchor =
        nextIndex + 1 < l2 ? (c2[nextIndex + 1] as VNode).el : parentAnchor;
      if (newIndexToOldIndexMap[i] === 0) {
        // 等于0说明未被旧的子节点匹配到，属于全新的不可复用的子节点，则通过patch进行挂载
        // mount new
        patch(
          null,
          nextChild,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds,
          optimized
        );
      } else if (moved) {
        // 当计算出来的最大上升子序列为空数组，
        // 或者当前节点不处于最大上升子序列中
        // move if:
        // There is no stable subsequence (e.g. a reverse)
        // OR current node is not among the stable sequence
        if (j < 0 || i !== increasingNewIndexSequence[j]) {
          move(nextChild, container, anchor, MoveType.REORDER);
        } else {
          j--;
        }
      }
    }
  }
};
```

#### 5.5 `patchUnkeyedChildren`

没有`key`的时候就很直接了，只依照最短的那组的长度，来按位置进行比较。而后该卸载就卸载，该挂载就挂载。

```typescript
const patchUnkeyedChildren = (
  c1: VNode[],
  c2: VNodeArrayChildren,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  isSVG: boolean,
  slotScopeIds: string[] | null,
  optimized: boolean
) => {
  c1 = c1 || EMPTY_ARR;
  c2 = c2 || EMPTY_ARR;
  const oldLength = c1.length;
  const newLength = c2.length;
  const commonLength = Math.min(oldLength, newLength);
  let i;
  for (i = 0; i < commonLength; i++) {
    const nextChild = (c2[i] = optimized
      ? cloneIfMounted(c2[i] as VNode)
      : normalizeVNode(c2[i]));
    patch(
      c1[i],
      nextChild,
      container,
      null,
      parentComponent,
      parentSuspense,
      isSVG,
      slotScopeIds,
      optimized
    );
  }
  if (oldLength > newLength) {
    // remove old
    unmountChildren(
      c1,
      parentComponent,
      parentSuspense,
      true,
      false,
      commonLength
    );
  } else {
    // mount new
    mountChildren(
      c2,
      container,
      anchor,
      parentComponent,
      parentSuspense,
      isSVG,
      slotScopeIds,
      optimized,
      commonLength
    );
  }
};
```

#### 5.6 `mountChildren`

`mountChildren`用于挂载子节点，主要是遍历子节点，处理每个子节点，得到复制的或者标准化的单个子节点，然后递归调用`patch`。

```typescript
const mountChildren: MountChildrenFn = (
  children,
  container,
  anchor,
  parentComponent,
  parentSuspense,
  isSVG,
  slotScopeIds,
  optimized,
  start = 0
) => {
  for (let i = start; i < children.length; i++) {
    const child = (children[i] = optimized
      ? cloneIfMounted(children[i] as VNode)
      : normalizeVNode(children[i]));
    patch(
      null,
      child,
      container,
      anchor,
      parentComponent,
      parentSuspense,
      isSVG,
      slotScopeIds,
      optimized
    );
  }
};
```

#### 5.7 `unmountChildren`

遍历子节点组，调用`unmount`方法卸载子节点。

```typescript
const unmountChildren: UnmountChildrenFn = (
  children,
  parentComponent,
  parentSuspense,
  doRemove = false,
  optimized = false,
  start = 0
) => {
  for (let i = start; i < children.length; i++) {
    unmount(children[i], parentComponent, parentSuspense, doRemove, optimized);
  }
};
```

#### 5.8 `move`

在有`key`的子节点比较中，出现了需要移动子节点的情况，而移动就是通过`move`来完成的。按照不同的节点类型，处理方式有所差异。

```typescript
const move: MoveFn = (
  vnode,
  container,
  anchor,
  moveType,
  parentSuspense = null
) => {
  const { el, type, transition, children, shapeFlag } = vnode;
  // 对于组件节点，递归处理subTree
  if (shapeFlag & ShapeFlags.COMPONENT) {
    move(vnode.component!.subTree, container, anchor, moveType);
    return;
  }

  // 处理异步组件<Suspense>
  if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
    vnode.suspense!.move(container, anchor, moveType);
    return;
  }

  // 处理<Teleport>
  if (shapeFlag & ShapeFlags.TELEPORT) {
    (type as typeof TeleportImpl).move(vnode, container, anchor, internals);
    return;
  }

  // 文档片段，处理起始锚点和子节点
  if (type === Fragment) {
    hostInsert(el!, container, anchor);
    for (let i = 0; i < (children as VNode[]).length; i++) {
      move((children as VNode[])[i], container, anchor, moveType);
    }
    hostInsert(vnode.anchor!, container, anchor);
    return;
  }

  // 静态节点
  if (type === Static) {
    moveStaticNode(vnode, container, anchor);
    return;
  }

  // 处理<Transition>的钩子
  // single nodes
  const needTransition =
    moveType !== MoveType.REORDER &&
    shapeFlag & ShapeFlags.ELEMENT &&
    transition;
  if (needTransition) {
    if (moveType === MoveType.ENTER) {
      transition!.beforeEnter(el!);
      hostInsert(el!, container, anchor);
      queuePostRenderEffect(() => transition!.enter(el!), parentSuspense);
    } else {
      const { leave, delayLeave, afterLeave } = transition!;
      const remove = () => hostInsert(el!, container, anchor);
      const performLeave = () => {
        leave(el!, () => {
          remove();
          afterLeave && afterLeave();
        });
      };
      if (delayLeave) {
        delayLeave(el!, remove, performLeave);
      } else {
        performLeave();
      }
    }
  } else {
    hostInsert(el!, container, anchor);
  }
};
```

### 6. `processElement`

#### 6.1 `processElement`

`processElement`内容很简单，判断一下是否要当作`svg`处理；之后，如果旧节点为空，则直接通过`mountElement`挂载新的元素节点，否则通过`patchElement`对元素节点进行对比。

```typescript
const processElement = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  isSVG: boolean,
  slotScopeIds: string[] | null,
  optimized: boolean
) => {
  isSVG = isSVG || (n2.type as string) === "svg";
  if (n1 == null) {
    mountElement(
      n2,
      container,
      anchor,
      parentComponent,
      parentSuspense,
      isSVG,
      slotScopeIds,
      optimized
    );
  } else {
    patchElement(
      n1,
      n2,
      parentComponent,
      parentSuspense,
      isSVG,
      slotScopeIds,
      optimized
    );
  }
};
```

#### 6.2 `mountElement`

假如此时旧节点为空，那么就会调用`mountElement`，我们来看看它是怎么做的。

- 若`vndoe`上的`el`属性存在，开发环境下则简单对`el`进行复制；不存在则新建；
- 先进行子节点的挂载，因为某些`props`依赖于子节点的渲染；
- 指令的`created`阶段；
- 处理`props`并设置`scopeId`；
- 开发环境下设置`el.__vnode`和`el.vueParentComponent`的取值，并设置为不可枚举；
- 指令的`beforeMounted`阶段；
- 动画组件`Transition`的`beforeEnter`钩子；
- 执行`vnode`上的钩子、`Transition`的`enter`钩子、指令的`mounted`钩子等

```typescript
const mountElement = (
  vnode: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  isSVG: boolean,
  slotScopeIds: string[] | null,
  optimized: boolean
) => {
  let el: RendererElement;
  let vnodeHook: VNodeHook | undefined | null;
  const { type, props, shapeFlag, transition, patchFlag, dirs } = vnode;
  if (
    !__DEV__ &&
    vnode.el &&
    hostCloneNode !== undefined &&
    patchFlag === PatchFlags.HOISTED
  ) {
    // vnode的el元素存在，仅在生产环境下对可复用的静态节点进行复制
    // If a vnode has non-null el, it means it's being reused.
    // Only static vnodes can be reused, so its mounted DOM nodes should be
    // exactly the same, and we can simply do a clone here.
    // only do this in production since cloned trees cannot be HMR updated.
    el = vnode.el = hostCloneNode(vnode.el);
  } else {
    // vnode上的元素不存在则新建
    el = vnode.el = hostCreateElement(
      vnode.type as string,
      isSVG,
      props && props.is,
      props
    );

    // 注释：由于某些props依赖于子节点的渲染，先挂载子节点
    // mount children first, since some props may rely on child content
    // being already rendered, e.g. `<select value>`
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 设置元素文本
      hostSetElementText(el, vnode.children as string);
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 挂载子节点
      mountChildren(
        vnode.children as VNodeArrayChildren,
        el,
        null,
        parentComponent,
        parentSuspense,
        isSVG && type !== "foreignObject",
        slotScopeIds,
        optimized
      );
    }

    // 指令的created阶段
    if (dirs) {
      invokeDirectiveHook(vnode, null, parentComponent, "created");
    }

    // 处理元素的props
    // props
    if (props) {
      for (const key in props) {
        if (key !== "value" && !isReservedProp(key)) {
          hostPatchProp(
            el,
            key,
            null,
            props[key],
            isSVG,
            vnode.children as VNode[],
            parentComponent,
            parentSuspense,
            unmountChildren
          );
        }
      }
      /**
       * Special case for setting value on DOM elements:
       * - it can be order-sensitive (e.g. should be set *after* min/max, #2325, #4024)
       * - it needs to be forced (#1471)
       * #2353 proposes adding another renderer option to configure this, but
       * the properties affects are so finite it is worth special casing it
       * here to reduce the complexity. (Special casing it also should not
       * affect non-DOM renderers)
       */
      if ("value" in props) {
        hostPatchProp(el, "value", null, props.value);
      }
      if ((vnodeHook = props.onVnodeBeforeMount)) {
        invokeVNodeHook(vnodeHook, parentComponent, vnode);
      }
    }
    // scopeId
    setScopeId(el, vnode, vnode.scopeId, slotScopeIds, parentComponent);
  }
  // __DEV__环境下处理 __vnode属性和父组件为不可枚举
  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    Object.defineProperty(el, "__vnode", {
      value: vnode,
      enumerable: false,
    });
    Object.defineProperty(el, "__vueParentComponent", {
      value: parentComponent,
      enumerable: false,
    });
  }
  // 执行指令中的 beforeMount 阶段
  if (dirs) {
    invokeDirectiveHook(vnode, null, parentComponent, "beforeMount");
  }
  // #1583 For inside suspense + suspense not resolved case, enter hook should call when suspense resolved
  // #1689 For inside suspense + suspense resolved case, just call it

  // 是否需要执行动画组件钩子
  const needCallTransitionHooks =
    (!parentSuspense || (parentSuspense && !parentSuspense.pendingBranch)) &&
    transition &&
    !transition.persisted;
  if (needCallTransitionHooks) {
    transition!.beforeEnter(el);
  }
  hostInsert(el, container, anchor);
  if (
    (vnodeHook = props && props.onVnodeMounted) ||
    needCallTransitionHooks ||
    dirs
  ) {
    // 加入组件更新后的副作用执行队列，在合适的时机执行入队的函数
    // 这里是一些钩子函数、trasition的钩子、指令在mounted阶段的钩子
    queuePostRenderEffect(() => {
      vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode);
      needCallTransitionHooks && transition!.enter(el);
      dirs && invokeDirectiveHook(vnode, null, parentComponent, "mounted");
    }, parentSuspense);
  }
};
```

#### 6.3 `patchElement`

`patchElemengt`相当重要，因为其它和你多内容的`patch`，最终经过递归，依然会走到`patchElement`。当新旧元素节点都存在时，就会调用`patchElement`进行对比。可以看到顺序：

```
beforeUpdated -> 子节点 -> class/style -> 其它props/attrs -> updated
```

- 关闭`recurse`，处理`beforeUpdated`钩子；

- 处理指定的`beforeUpdated`阶段，再启用`recurse`；

- 在`__DEV__`环境下的热更新时，则会清理优化标记，从而强制对节点进行全量的比较(`full diff`)；

- 处理动态子节点：

  - 当新节点中有动态子节点，则通过`patchBlockChildren`来和旧节点的动态子节点进行对比；
  - 否则，如果没有优化(`!optimized`)，则使用`patchChildren`对子节点进行全量`diff`；

- 判断`patchFlag > 0`，大于`0`时则元素的`render`代码由`compiler`生成，有优化`buff`：

  - 如果`props`中有动态的`key`，则优化无效，进行全量`diff`；
  - 处理动态类名和动态`style`，优化`diff`；
  - 处理其它的`prop/attr`，如果其中有动态的`key`，则优化无效；
  - 处理文本：当元素只有文本子节点时，则将文本子节点设置为新的元素节点的内容；

- `patchFlag <= 0`，且没有设置优化时，对`props`进行全量`diff`；

- `updated`阶段。

```typescript
const patchElement = (
  n1: VNode,
  n2: VNode,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  isSVG: boolean,
  slotScopeIds: string[] | null,
  optimized: boolean
) => {
  const el = (n2.el = n1.el!);
  let { patchFlag, dynamicChildren, dirs } = n2;
  // #1426 take the old vnode's patch flag into account since user may clone a
  // compiler-generated vnode, which de-opts to FULL_PROPS
  patchFlag |= n1.patchFlag & PatchFlags.FULL_PROPS;
  const oldProps = n1.props || EMPTY_OBJ;
  const newProps = n2.props || EMPTY_OBJ;
  let vnodeHook: VNodeHook | undefined | null;

  // 关闭recurse，在 beforeUpdated 阶段不允许自己调用
  // disable recurse in beforeUpdate hooks
  parentComponent && toggleRecurse(parentComponent, false);
  // beforeUpdated钩子
  if ((vnodeHook = newProps.onVnodeBeforeUpdate)) {
    invokeVNodeHook(vnodeHook, parentComponent, n2, n1);
  }
  // 指令的 beforeUpdated 钩子
  if (dirs) {
    invokeDirectiveHook(n2, n1, parentComponent, "beforeUpdate");
  }
  // 允许自己调用
  parentComponent && toggleRecurse(parentComponent, true);

  // 开发环境呢下，关闭优化，全量diff
  if (__DEV__ && isHmrUpdating) {
    // HMR updated, force full diff
    patchFlag = 0;
    optimized = false;
    dynamicChildren = null;
  }

  const areChildrenSVG = isSVG && n2.type !== "foreignObject";
  // 新节点的动态子节点不为空，则比较新旧节点的动态子节点
  if (dynamicChildren) {
    patchBlockChildren(
      n1.dynamicChildren!,
      dynamicChildren,
      el,
      parentComponent,
      parentSuspense,
      areChildrenSVG,
      slotScopeIds
    );
    // 开发环境  递归遍历静态子节点
    if (__DEV__ && parentComponent && parentComponent.type.__hmrId) {
      traverseStaticChildren(n1, n2);
    }

    // 没有优化，全量 diff
  } else if (!optimized) {
    // full diff
    patchChildren(
      n1,
      n2,
      el,
      null,
      parentComponent,
      parentSuspense,
      areChildrenSVG,
      slotScopeIds,
      false
    );
  }

  // 注释：patchFlag 标识的存在意味着元素的 render 代码是由 compiler 生成的，
  // 且可以在 patch 时走快道，此时能保证新旧节点形状相同，即它们在源模板中正好处于相同的位置
  // 此时的对比是有着各种优化的
  if (patchFlag > 0) {
    // the presence of a patchFlag means this element's render code was
    // generated by the compiler and can take the fast path.
    // in this path old node and new node are guaranteed to have the same shape
    // (i.e. at the exact same position in the source template)
    if (patchFlag & PatchFlags.FULL_PROPS) {
      // 当props中含有动态的key，需要进行全量 diff
      // element props contain dynamic keys, full diff needed
      patchProps(
        el,
        n2,
        oldProps,
        newProps,
        parentComponent,
        parentSuspense,
        isSVG
      );
    } else {
      // 处理动态类名绑定
      // class
      // this flag is matched when the element has dynamic class bindings.
      if (patchFlag & PatchFlags.CLASS) {
        if (oldProps.class !== newProps.class) {
          hostPatchProp(el, "class", null, newProps.class, isSVG);
        }
      }

      // 处理动态的 style 绑定
      // style
      // this flag is matched when the element has dynamic style bindings
      if (patchFlag & PatchFlags.STYLE) {
        hostPatchProp(el, "style", oldProps.style, newProps.style, isSVG);
      }

      // 处理动态的 prop/attr 绑定，有迭代缓存，优化比较速度
      // 如果 `prop/attr`的 key 是动态的，那么这种优化则会失效
      // props
      // This flag is matched when the element has dynamic prop/attr bindings
      // other than class and style. The keys of dynamic prop/attrs are saved for
      // faster iteration.
      // Note dynamic keys like :[foo]="bar" will cause this optimization to
      // bail out and go through a full diff because we need to unset the old key
      if (patchFlag & PatchFlags.PROPS) {
        // if the flag is present then dynamicProps must be non-null
        const propsToUpdate = n2.dynamicProps!;
        for (let i = 0; i < propsToUpdate.length; i++) {
          const key = propsToUpdate[i];
          const prev = oldProps[key];
          const next = newProps[key];
          // value属性会被强行对比
          // #1471 force patch value
          if (next !== prev || key === "value") {
            hostPatchProp(
              el,
              key,
              prev,
              next,
              isSVG,
              n1.children as VNode[],
              parentComponent,
              parentSuspense,
              unmountChildren
            );
          }
        }
      }
    }

    // 处理文本：仅在元素只有文本子节点时触发
    // text
    // This flag is matched when the element has only dynamic text children.
    if (patchFlag & PatchFlags.TEXT) {
      if (n1.children !== n2.children) {
        hostSetElementText(el, n2.children as string);
      }
    }
  } else if (!optimized && dynamicChildren == null) {
    // 没有优化，全量 diff
    // unoptimized, full diff
    patchProps(
      el,
      n2,
      oldProps,
      newProps,
      parentComponent,
      parentSuspense,
      isSVG
    );
  }

  // updated 钩子 入队
  if ((vnodeHook = newProps.onVnodeUpdated) || dirs) {
    queuePostRenderEffect(() => {
      vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, n2, n1);
      dirs && invokeDirectiveHook(n2, n1, parentComponent, "updated");
    }, parentSuspense);
  }
};
```

在`patchElement`中，注意到当新节点具有动态子节点时，调用了`patchBlockChildren`来进行子节点的比较，而在没有动态子节点且不符合优化条件时，则使用`patchChildren`来比较。这与`processFragment`类似。

而当`patchFlag <= 0`且没有设置优化时，对`props`进行全量`diff`。分别遍历新的`props`和旧的`props`，最后刷新`value`的值。

```typescript
const patchProps = (
  el: RendererElement,
  vnode: VNode,
  oldProps: Data,
  newProps: Data,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  isSVG: boolean
) => {
  if (oldProps !== newProps) {
    // 遍历新的props
    for (const key in newProps) {
      // empty string is not valid prop
      if (isReservedProp(key)) continue;
      const next = newProps[key];
      const prev = oldProps[key];
      // 先不比较 value
      // defer patching value
      if (next !== prev && key !== "value") {
        hostPatchProp(
          el,
          key,
          prev,
          next,
          isSVG,
          vnode.children as VNode[],
          parentComponent,
          parentSuspense,
          unmountChildren
        );
      }
    }
    // 遍历旧的props
    if (oldProps !== EMPTY_OBJ) {
      for (const key in oldProps) {
        if (!isReservedProp(key) && !(key in newProps)) {
          hostPatchProp(
            el,
            key,
            oldProps[key],
            null,
            isSVG,
            vnode.children as VNode[],
            parentComponent,
            parentSuspense,
            unmountChildren
          );
        }
      }
    }
    // 最后处理 value
    if ("value" in newProps) {
      hostPatchProp(el, "value", oldProps.value, newProps.value);
    }
  }
};
```

### 7. `processComponent`

#### 7.1 `processComponent`

当被`patch`的节点类型是组件时，通过`processComponent`来处理。

- 当旧组件节点存在时，则调用`updateComponent`进行更新；

- 否则：

  - 当新组件节点为`KeepAlive`时，调用其上下文对象上的`activate`方法；
  - 否则，使用`mountComponent`挂载新的组件节点；

```typescript
const processComponent = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  isSVG: boolean,
  slotScopeIds: string[] | null,
  optimized: boolean
) => {
  n2.slotScopeIds = slotScopeIds;
  if (n1 == null) {
    if (n2.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
      (parentComponent!.ctx as KeepAliveContext).activate(
        n2,
        container,
        anchor,
        isSVG,
        optimized
      );
    } else {
      mountComponent(
        n2,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        isSVG,
        optimized
      );
    }
  } else {
    updateComponent(n1, n2, optimized);
  }
};
```

#### 7.2 `mountComponent`

`mountComponent`在旧的组件节点不存在时被调用。所有的`mountXXX`最常见的调用时机都是首次渲染时，旧节点都是空的。

```typescript
const mountComponent: MountComponentFn = (
  initialVNode,
  container,
  anchor,
  parentComponent,
  parentSuspense,
  isSVG,
  optimized
) => {
  // 2.x compat may pre-create the component instance before actually
  // mounting
  const compatMountInstance =
    __COMPAT__ && initialVNode.isCompatRoot && initialVNode.component;
  const instance: ComponentInternalInstance =
    compatMountInstance ||
    (initialVNode.component = createComponentInstance(
      initialVNode,
      parentComponent,
      parentSuspense
    ));

  // 注册热更新
  if (__DEV__ && instance.type.__hmrId) {
    registerHMR(instance);
  }

  // 挂载性能检测
  if (__DEV__) {
    pushWarningContext(initialVNode);
    startMeasure(instance, `mount`);
  }

  // 注入renderer的内部内容
  // inject renderer internals for keepAlive
  if (isKeepAlive(initialVNode)) {
    (instance.ctx as KeepAliveContext).renderer = internals;
  }
  /** 这里备注一下 internals 的内容
   * const internals: RendererInternals = {
   *   p: patch,
   *   um: unmount,
   *   m: move,
   *   r: remove,
   *   mt: mountComponent,
   *   mc: mountChildren,
   *   pc: patchChildren,
   *   pbc: patchBlockChildren,
   *   n: getNextHostNode,
   *   o: options
   * }
   */

  // 处理props和插槽
  // resolve props and slots for setup context
  if (!(__COMPAT__ && compatMountInstance)) {
    // 检测初始化性能
    if (__DEV__) {
      startMeasure(instance, `init`);
    }
    // 处理setup：这个函数里使用其它方法，初始化了props和插槽，且调用了setup
    setupComponent(instance);
    if (__DEV__) {
      endMeasure(instance, `init`);
    }
  }

  // 处理异步的setup
  // setup() is async. This component relies on async logic to be resolved
  // before proceeding
  if (__FEATURE_SUSPENSE__ && instance.asyncDep) {
    parentSuspense && parentSuspense.registerDep(instance, setupRenderEffect);

    // Give it a placeholder if this is not hydration
    // TODO handle self-defined fallback
    if (!initialVNode.el) {
      const placeholder = (instance.subTree = createVNode(Comment));
      processCommentNode(null, placeholder, container!, anchor);
    }
    return;
  }

  // 接下来根据setup返回内容进行渲染
  // todo 阅读该函数的内容
  setupRenderEffect(
    instance,
    initialVNode,
    container,
    anchor,
    parentSuspense,
    isSVG,
    optimized
  );

  // mount性能检测结束点
  if (__DEV__) {
    popWarningContext();
    endMeasure(instance, `mount`);
  }
};
```

#### 7.3 `updateComponent`

当旧的组件节点存在时，对组件节点的处理会进入到更新阶段，也就是`updateComponent`。以旧组件为基准拿到实例`instance`，通过`shouldUpdateComponent`判断是否要更新组件。如果不需要更新，则只复制一下属性；否则，当实例是异步组件时，则只更新`props`和插槽；当实例是同步组件时，则设置`next`为新的组件节点，并调用组件的`update`方法进行更新。

```typescript
const updateComponent = (n1: VNode, n2: VNode, optimized: boolean) => {
  const instance = (n2.component = n1.component)!;
  if (shouldUpdateComponent(n1, n2, optimized)) {
    if (__FEATURE_SUSPENSE__ && instance.asyncDep && !instance.asyncResolved) {
      // async & still pending - just update props and slots
      // since the component's reactive effect for render isn't set-up yet
      if (__DEV__) {
        pushWarningContext(n2);
      }
      // 更新组件的预渲染：即处理props和插槽
      updateComponentPreRender(instance, n2, optimized);
      if (__DEV__) {
        popWarningContext();
      }
      return;
    } else {
      // normal update
      instance.next = n2;
      // in case the child component is also queued, remove it to avoid
      // double updating the same child component in the same flush.
      invalidateJob(instance.update);
      // instance.update is the reactive effect.
      instance.update();
    }
  } else {
    // no update needed. just copy over properties
    n2.el = n1.el;
    instance.vnode = n2;
  }
};
```

#### 7.4 `updateComponentPreRender`

组件的预渲染，即在这里处理`props`和插槽。

```typescript
const updateComponentPreRender = (
  instance: ComponentInternalInstance,
  nextVNode: VNode,
  optimized: boolean
) => {
  nextVNode.component = instance;
  const prevProps = instance.vnode.props;
  instance.vnode = nextVNode;
  instance.next = null;
  updateProps(instance, nextVNode.props, prevProps, optimized);
  updateSlots(instance, nextVNode.children, optimized);

  pauseTracking();
  // props update may have triggered pre-flush watchers.
  // flush them before the render update.
  flushPreFlushCbs(undefined, instance.update);
  resetTracking();
};
```

#### 7.4 `setupRenderEffect`

相当重要的一个函数。用`componentUpdateFn`来创建一个`effect`。最后执行的`update`函数以及实例的`update`方法，都是执行`effect.run`。而`effect.run`内部会进行与依赖收集相关的操作，还会调用新建`effect`时传入的函数`componentUpdateFn`。这里可以看到**`componentUpdateFn`分为挂载和更新两部分**。

```typescript
const setupRenderEffect: SetupRenderEffectFn = (
  instance,
  initialVNode,
  container,
  anchor,
  parentSuspense,
  isSVG,
  optimized
) => {
  const componentUpdateFn = () => {
    if (!instance.isMounted) {
      let vnodeHook: VNodeHook | null | undefined;
      const { el, props } = initialVNode;
      const { bm, m, parent } = instance;
      const isAsyncWrapperVNode = isAsyncWrapper(initialVNode);

      // 在beforeMounted期间 不允许effect自己调用
      toggleRecurse(instance, false);
      // beforeMount hook
      if (bm) {
        invokeArrayFns(bm);
      }
      // onVnodeBeforeMount
      if (
        !isAsyncWrapperVNode &&
        (vnodeHook = props && props.onVnodeBeforeMount)
      ) {
        invokeVNodeHook(vnodeHook, parent, initialVNode);
      }
      if (
        __COMPAT__ &&
        isCompatEnabled(DeprecationTypes.INSTANCE_EVENT_HOOKS, instance)
      ) {
        instance.emit("hook:beforeMount");
      }
      toggleRecurse(instance, true);

      if (el && hydrateNode) {
        // vnode has adopted host node - perform hydration instead of mount.
        const hydrateSubTree = () => {
          if (__DEV__) {
            startMeasure(instance, `render`);
          }
          instance.subTree = renderComponentRoot(instance);
          if (__DEV__) {
            endMeasure(instance, `render`);
          }
          if (__DEV__) {
            startMeasure(instance, `hydrate`);
          }
          hydrateNode!(
            el as Node,
            instance.subTree,
            instance,
            parentSuspense,
            null
          );
          if (__DEV__) {
            endMeasure(instance, `hydrate`);
          }
        };

        if (isAsyncWrapperVNode) {
          (initialVNode.type as ComponentOptions).__asyncLoader!().then(
            // note: we are moving the render call into an async callback,
            // which means it won't track dependencies - but it's ok because
            // a server-rendered async wrapper is already in resolved state
            // and it will never need to change.
            () => !instance.isUnmounted && hydrateSubTree()
          );
        } else {
          hydrateSubTree();
        }
      } else {
        if (__DEV__) {
          startMeasure(instance, `render`);
        }
        const subTree = (instance.subTree = renderComponentRoot(instance));
        if (__DEV__) {
          endMeasure(instance, `render`);
        }
        if (__DEV__) {
          startMeasure(instance, `patch`);
        }
        patch(
          null,
          subTree,
          container,
          anchor,
          instance,
          parentSuspense,
          isSVG
        );
        if (__DEV__) {
          endMeasure(instance, `patch`);
        }
        initialVNode.el = subTree.el;
      }
      // mounted钩子入队
      // mounted hook
      if (m) {
        queuePostRenderEffect(m, parentSuspense);
      }
      // onVnodeMounted
      if (!isAsyncWrapperVNode && (vnodeHook = props && props.onVnodeMounted)) {
        const scopedInitialVNode = initialVNode;
        queuePostRenderEffect(
          () => invokeVNodeHook(vnodeHook!, parent, scopedInitialVNode),
          parentSuspense
        );
      }
      if (
        __COMPAT__ &&
        isCompatEnabled(DeprecationTypes.INSTANCE_EVENT_HOOKS, instance)
      ) {
        queuePostRenderEffect(
          () => instance.emit("hook:mounted"),
          parentSuspense
        );
      }

      // <KeepAlive>组件的activated钩子，可能包含从子组件注入的钩子

      // activated hook for keep-alive roots.
      // #1742 activated hook must be accessed after first render
      // since the hook may be injected by a child keep-alive
      if (
        initialVNode.shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE ||
        (parent &&
          isAsyncWrapper(parent.vnode) &&
          parent.vnode.shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE)
      ) {
        instance.a && queuePostRenderEffect(instance.a, parentSuspense);
        // 兼容
        if (
          __COMPAT__ &&
          isCompatEnabled(DeprecationTypes.INSTANCE_EVENT_HOOKS, instance)
        ) {
          queuePostRenderEffect(
            () => instance.emit("hook:activated"),
            parentSuspense
          );
        }
      }
      // 变更组件挂载状态
      instance.isMounted = true;

      if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
        devtoolsComponentAdded(instance);
      }

      // #2458: deference mount-only object parameters to prevent memleaks
      initialVNode = container = anchor = null as any;
    } else {
      // updateComponent
      // This is triggered by mutation of component's own state (next: null)
      // OR parent calling processComponent (next: VNode)
      let { next, bu, u, parent, vnode } = instance;
      let originNext = next;
      let vnodeHook: VNodeHook | null | undefined;
      if (__DEV__) {
        pushWarningContext(next || instance.vnode);
      }

      // beforeUpdated 期间也不允许effect自调用
      // Disallow component effect recursion during pre-lifecycle hooks.
      toggleRecurse(instance, false);
      if (next) {
        next.el = vnode.el;
        updateComponentPreRender(instance, next, optimized);
      } else {
        next = vnode;
      }

      // beforeUpdate hook
      if (bu) {
        invokeArrayFns(bu);
      }
      // onVnodeBeforeUpdate
      if ((vnodeHook = next.props && next.props.onVnodeBeforeUpdate)) {
        invokeVNodeHook(vnodeHook, parent, next, vnode);
      }
      // 考虑兼容
      if (
        __COMPAT__ &&
        isCompatEnabled(DeprecationTypes.INSTANCE_EVENT_HOOKS, instance)
      ) {
        instance.emit("hook:beforeUpdate");
      }
      toggleRecurse(instance, true);

      // render
      if (__DEV__) {
        startMeasure(instance, `render`);
      }
      const nextTree = renderComponentRoot(instance);
      if (__DEV__) {
        endMeasure(instance, `render`);
      }
      const prevTree = instance.subTree;
      instance.subTree = nextTree;

      if (__DEV__) {
        startMeasure(instance, `patch`);
      }
      // 更新则比较新旧subTree
      patch(
        prevTree,
        nextTree,
        // parent may have changed if it's in a teleport
        hostParentNode(prevTree.el!)!,
        // anchor may have changed if it's in a fragment
        getNextHostNode(prevTree),
        instance,
        parentSuspense,
        isSVG
      );
      if (__DEV__) {
        endMeasure(instance, `patch`);
      }
      next.el = nextTree.el;
      if (originNext === null) {
        // self-triggered update. In case of HOC, update parent component
        // vnode el. HOC is indicated by parent instance's subTree pointing
        // to child component's vnode
        updateHOCHostEl(instance, nextTree.el);
      }
      // 处理updated钩子
      // updated hook
      if (u) {
        queuePostRenderEffect(u, parentSuspense);
      }
      // onVnodeUpdated
      if ((vnodeHook = next.props && next.props.onVnodeUpdated)) {
        queuePostRenderEffect(
          () => invokeVNodeHook(vnodeHook!, parent, next!, vnode),
          parentSuspense
        );
      }
      if (
        __COMPAT__ &&
        isCompatEnabled(DeprecationTypes.INSTANCE_EVENT_HOOKS, instance)
      ) {
        queuePostRenderEffect(
          () => instance.emit("hook:updated"),
          parentSuspense
        );
      }

      if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
        devtoolsComponentUpdated(instance);
      }

      if (__DEV__) {
        popWarningContext();
      }
    }
  };

  // 使用componentUpdateFn创建effect
  // create reactive effect for rendering
  const effect = (instance.effect = new ReactiveEffect(
    componentUpdateFn,
    () => queueJob(update),
    instance.scope // track it in component's effect scope
  ));

  const update: SchedulerJob = (instance.update = () => effect.run());
  update.id = instance.uid;
  // allowRecurse
  // #1801, #2043 component render effects should allow recursive updates
  toggleRecurse(instance, true);

  // 用于开发调试
  if (__DEV__) {
    effect.onTrack = instance.rtc
      ? (e) => invokeArrayFns(instance.rtc!, e)
      : void 0;
    effect.onTrigger = instance.rtg
      ? (e) => invokeArrayFns(instance.rtg!, e)
      : void 0;
    update.ownerInstance = instance;
  }

  // 调用一次更新
  update();
};
```

### 8. `unmount`

旧节点的卸载通过`unmount`来处理，其中根据节点类型不同，又有着不同的函数来实施卸载。

#### 8.1 `unmount`

经过置空`ref`、判断与处理`KeepAlive`、`beforeUnmounted`的钩子函数和指令、判断组件的类型并相应卸载、处理`unmounted`钩子和指令等过程。

```typescript
const unmount: UnmountFn = (
  vnode,
  parentComponent,
  parentSuspense,
  doRemove = false,
  optimized = false
) => {
  const {
    type,
    props,
    ref,
    children,
    dynamicChildren,
    shapeFlag,
    patchFlag,
    dirs,
  } = vnode;
  // 置空ref
  // unset ref
  if (ref != null) {
    setRef(ref, null, parentSuspense, vnode, true);
  }

  // 组件被缓存，则调用<KeepAlive>的失活方法 deactivate
  if (shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
    (parentComponent!.ctx as KeepAliveContext).deactivate(vnode);
    return;
  }

  // 是否调用指令和钩子
  const shouldInvokeDirs = shapeFlag & ShapeFlags.ELEMENT && dirs;
  const shouldInvokeVnodeHook = !isAsyncWrapper(vnode);

  // beforeUnmounted 钩子
  let vnodeHook: VNodeHook | undefined | null;
  if (
    shouldInvokeVnodeHook &&
    (vnodeHook = props && props.onVnodeBeforeUnmount)
  ) {
    invokeVNodeHook(vnodeHook, parentComponent, vnode);
  }

  if (shapeFlag & ShapeFlags.COMPONENT) {
    // 卸载组件
    unmountComponent(vnode.component!, parentSuspense, doRemove);
  } else {
    // 卸载异步组件
    if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
      vnode.suspense!.unmount(parentSuspense, doRemove);
      return;
    }

    // 处理指令的 beforeUnmounted 阶段
    if (shouldInvokeDirs) {
      invokeDirectiveHook(vnode, null, parentComponent, "beforeUnmount");
    }

    // 卸载 Teleport
    if (shapeFlag & ShapeFlags.TELEPORT) {
      (vnode.type as typeof TeleportImpl).remove(
        vnode,
        parentComponent,
        parentSuspense,
        optimized,
        internals,
        doRemove
      );
    } else if (
      dynamicChildren &&
      // #1153: fast path should not be taken for non-stable (v-for) fragments
      (type !== Fragment ||
        (patchFlag > 0 && patchFlag & PatchFlags.STABLE_FRAGMENT))
    ) {
      // 对于优化过的块状节点，仅需移除动态子节点
      // fast path for block nodes: only need to unmount dynamic children.
      unmountChildren(
        dynamicChildren,
        parentComponent,
        parentSuspense,
        false,
        true
      );
    } else if (
      // 文档片段  移除其子节点
      (type === Fragment &&
        patchFlag &
          (PatchFlags.KEYED_FRAGMENT | PatchFlags.UNKEYED_FRAGMENT)) ||
      (!optimized && shapeFlag & ShapeFlags.ARRAY_CHILDREN)
    ) {
      unmountChildren(children as VNode[], parentComponent, parentSuspense);
    }

    // 处理节点自身
    if (doRemove) {
      remove(vnode);
    }
  }

  // 处理 unmounted 钩子以及指令中的 unmounted 阶段
  if (
    (shouldInvokeVnodeHook && (vnodeHook = props && props.onVnodeUnmounted)) ||
    shouldInvokeDirs
  ) {
    queuePostRenderEffect(() => {
      vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode);
      shouldInvokeDirs &&
        invokeDirectiveHook(vnode, null, parentComponent, "unmounted");
    }, parentSuspense);
  }
};
```

#### 8.2 `remove`

使用`remove`来移除一个节点。根据节点类型与环境，执行的逻辑也稍有差别。

```typescript
const remove: RemoveFn = (vnode) => {
  const { type, el, anchor, transition } = vnode;
  if (type === Fragment) {
    if (
      __DEV__ &&
      vnode.patchFlag > 0 &&
      vnode.patchFlag & PatchFlags.DEV_ROOT_FRAGMENT &&
      transition &&
      !transition.persisted
    ) {
      // __DEV__环境
      // 遍历移除子节点
      (vnode.children as VNode[]).forEach((child) => {
        if (child.type === Comment) {
          hostRemove(child.el!);
        } else {
          remove(child);
        }
      });
    } else {
      // 移除片段
      removeFragment(el!, anchor!);
    }
    return;
  }

  // 移除静态节点
  if (type === Static) {
    removeStaticNode(vnode);
    return;
  }

  /** 遍历移除静态节点
   *  const removeStaticNode = ({ el, anchor }: VNode) => {
   *    let next
   *    while (el && el !== anchor) {
   *      next = hostNextSibling(el)
   *      hostRemove(el)
   *      el = next
   *    }
   *    hostRemove(anchor!)
   *  }
   */

  const performRemove = () => {
    // 移除el
    hostRemove(el!);
    if (transition && !transition.persisted && transition.afterLeave) {
      // 动画的 afterLeave 钩子
      transition.afterLeave();
    }
  };

  if (
    vnode.shapeFlag & ShapeFlags.ELEMENT &&
    transition &&
    !transition.persisted
  ) {
    const { leave, delayLeave } = transition;
    const performLeave = () => leave(el!, performRemove);
    // 推迟 leave 动画
    if (delayLeave) {
      delayLeave(vnode.el!, performRemove, performLeave);
    } else {
      performLeave();
    }
  } else {
    // 执行
    performRemove();
  }
};
```

#### 8.3 `removeFragment`

直接遍历移除所有包含的节点，这一点与移除静态节点十分相似。

```typescript
const removeFragment = (cur: RendererNode, end: RendererNode) => {
  // For fragments, directly remove all contained DOM nodes.
  // (fragment child nodes cannot have transition)
  let next;
  while (cur !== end) {
    next = hostNextSibling(cur)!;
    hostRemove(cur);
    cur = next;
  }
  hostRemove(end);
};
```

#### 8.4 `unmountComponent`

对于组件的卸载，步骤稍微多一点。毕竟除了要遍历卸载子组件树，要处理组件的钩子函数，甚至考虑异步组件。

```typescript
const unmountComponent = (
  instance: ComponentInternalInstance,
  parentSuspense: SuspenseBoundary | null,
  doRemove?: boolean
) => {
  if (__DEV__ && instance.type.__hmrId) {
    unregisterHMR(instance);
  }

  const { bum, scope, update, subTree, um } = instance;

  // 调用 beforeUnmounted 钩子
  // beforeUnmount hook
  if (bum) {
    invokeArrayFns(bum);
  }

  if (
    __COMPAT__ &&
    isCompatEnabled(DeprecationTypes.INSTANCE_EVENT_HOOKS, instance)
  ) {
    instance.emit("hook:beforeDestroy");
  }

  // 停止副作用
  // stop effects in component scope
  scope.stop();

  // 关闭 update，卸载子组件树
  // update may be null if a component is unmounted before its async
  // setup has resolved.
  if (update) {
    // so that scheduler will no longer invoke it
    update.active = false;
    unmount(subTree, instance, parentSuspense, doRemove);
  }
  // 调用unmounted钩子
  // unmounted hook
  if (um) {
    queuePostRenderEffect(um, parentSuspense);
  }
  // 向后兼容：destroyed 钩子
  if (
    __COMPAT__ &&
    isCompatEnabled(DeprecationTypes.INSTANCE_EVENT_HOOKS, instance)
  ) {
    queuePostRenderEffect(
      () => instance.emit("hook:destroyed"),
      parentSuspense
    );
  }
  // 更改状态为已卸载
  queuePostRenderEffect(() => {
    instance.isUnmounted = true;
  }, parentSuspense);

  // 处理<Suspense>
  // A component with async dep inside a pending suspense is unmounted before
  // its async dep resolves. This should remove the dep from the suspense, and
  // cause the suspense to resolve immediately if that was the last dep.
  if (
    __FEATURE_SUSPENSE__ &&
    parentSuspense &&
    parentSuspense.pendingBranch &&
    !parentSuspense.isUnmounted &&
    instance.asyncDep &&
    !instance.asyncResolved &&
    instance.suspenseId === parentSuspense.pendingId
  ) {
    parentSuspense.deps--;
    if (parentSuspense.deps === 0) {
      parentSuspense.resolve();
    }
  }

  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    devtoolsComponentRemoved(instance);
  }
};
```

#### 8.5 `unmountChildren`

卸载子节点，遍历递归`unmount`方法进行卸载。

```typescript
const unmountChildren: UnmountChildrenFn = (
  children,
  parentComponent,
  parentSuspense,
  doRemove = false,
  optimized = false,
  start = 0
) => {
  for (let i = start; i < children.length; i++) {
    unmount(children[i], parentComponent, parentSuspense, doRemove, optimized);
  }
};
```

### 9. 小结

`render`只是个引子，绝大部分功能如节点挂载、节点更新都被`patch`涵盖了。`diff`算法在同层级进行遍历比较，核心内容都在`patchKeyedChildren`中，首尾节点各自循环一轮，对于中间的节点，则利用`Map`来映射`key`和节点在新子节点组中的`index`，再遍历剩余的旧子节点组，在`Map`中找相同的`key`里确定这个旧节点是否可复用。没有`key`的情况则使用`patchUnkeyedChildren`进行`diff`，简单粗暴。
