---
title: Vue3源码系列（七）：createApp — 一切的起源
date: "2022-10-29 16:46"
updated: "2022-10-29 16:46"
top_img: https://assets.onlyy.vip/photos/dont-starve/bg_goats.png
tags:
  - 前 端
  - Vue3
keywords:
  - 前端
  - Vue
  - Vue3
  - 源码
  - createApp
categories:
  - 前端
abbrlink: aec8236e
swiper_index: 9
---

前面几篇介绍的大都是`reactivity`相关的`API`。我们在使用`Vue3`作为前端框架时，往往在我们的`main.js/main.ts`里来创建`vue3`的`app`实例，就会用到`createApp`这个`API`。本篇就来简要了解一下`createApp`里发生的故事。

## 一、相关 `ts` 类型

可以先瞄一眼与`createAppApi`相关的`ts`类型，这样就更能理解它的使用，这里挑几个简要介绍一下。

### 1. `App`

`App`是`createApp`返回值的类型，可以看到项目里常用的一些方法都在这里，某些方法返回了`this`，则可以链式调用。此外，还兼容了`vue2`的`filter`，还有一些内部的属性。

```typescript
export interface App<HostElement = any> {
  version: string;
  // config 上有常用到的 globalProperties
  config: AppConfig;
  use(plugin: Plugin, ...options: any[]): this;
  mixin(mixin: ComponentOptions): this;
  component(name: string): Component | undefined;
  component(name: string, component: Component): this;
  directive(name: string): Directive | undefined;
  directive(name: string, directive: Directive): this;
  mount(
    rootContainer: HostElement | string,
    isHydrate?: boolean,
    isSVG?: boolean
  ): ComponentPublicInstance;
  unmount(): void;
  provide<T>(key: InjectionKey<T> | string, value: T): this;

  // internal, but we need to expose these for the server-renderer and devtools
  _uid: number;
  _component: ConcreteComponent;
  _props: Data | null;
  _container: HostElement | null;
  _context: AppContext;
  _instance: ComponentInternalInstance | null;

  /**
   * v2 compat only
   */
  filter?(name: string): Function | undefined;
  filter?(name: string, filter: Function): this;

  /**
   * @internal v3 compat only
   */
  _createRoot?(options: ComponentOptions): ComponentPublicInstance;
}
```

### 2. `AppConfig`

创建的`App`的配置，包含的内容在`vue2`里基本都有，重要的例如组件合并策略`optionMergeStrategies`，`Vue`全局属性`globalProperties`(`Vue2`里直接挂到原型上)、编译器选项`compilerOptions`、错误与告警处理程序等。

```typescript
export interface AppConfig {
  // @private
  readonly isNativeTag?: (tag: string) => boolean;

  performance: boolean;
  optionMergeStrategies: Record<string, OptionMergeFunction>;
  globalProperties: Record<string, any>;
  errorHandler?: (
    err: unknown,
    instance: ComponentPublicInstance | null,
    info: string
  ) => void;
  warnHandler?: (
    msg: string,
    instance: ComponentPublicInstance | null,
    trace: string
  ) => void;

  /**
   * Options to pass to `@vue/compiler-dom`.
   * Only supported in runtime compiler build.
   */
  compilerOptions: RuntimeCompilerOptions;

  /**
   * @deprecated use config.compilerOptions.isCustomElement
   */
  isCustomElement?: (tag: string) => boolean;

  /**
   * Temporary config for opt-in to unwrap injected refs.
   * TODO deprecate in 3.3
   */
  unwrapInjectedRef?: boolean;
}
```

### 3. `AppContext`

`App`的上下文，包含了对于`components`、`directives`、`mixins`、`provides`、`config`记录、对于`props`、`emits`的缓存、用于热更新的`reload`方法、兼容`vue2`的`filters`记录等。

```typescript
export interface AppContext {
  app: App; // for devtools
  config: AppConfig;
  mixins: ComponentOptions[];
  components: Record<string, Component>;
  directives: Record<string, Directive>;
  provides: Record<string | symbol, any>;

  /**
   * Cache for merged/normalized component options
   * Each app instance has its own cache because app-level global mixins and
   * optionMergeStrategies can affect merge behavior.
   * @internal
   */
  optionsCache: WeakMap<ComponentOptions, MergedComponentOptions>;
  /**
   * Cache for normalized props options
   * @internal
   */
  propsCache: WeakMap<ConcreteComponent, NormalizedPropsOptions>;
  /**
   * Cache for normalized emits options
   * @internal
   */
  emitsCache: WeakMap<ConcreteComponent, ObjectEmitsOptions | null>;
  /**
   * HMR only
   * @internal
   */
  reload?: () => void;
  /**
   * v2 compat only
   * @internal
   */
  filters?: Record<string, Function>;
}
```

### 4. `Plugin`

`Plugin`和`Plugin`中的`install`方法，基本和`vue2`一致。清晰可见，`Plugin`可以本身就是一个`PluginInstallFunction`类型函数，也可以是一个包含该类型函数的对象。

```typescript
type PluginInstallFunction = (app: App, ...options: any[]) => any;

export type Plugin =
  | (PluginInstallFunction & { install?: PluginInstallFunction })
  | {
      install: PluginInstallFunction;
    };
```

### 5. `CreateAppFunction`

`CreateAppFunction`就是我们的`createApp`函数的类型，接收一个根组件，以及一个可选参数`rootProps`对根组件进行传参。

```typescript
export type CreateAppFunction<HostElement> = (
  rootComponent: Component,
  rootProps?: Data | null
) => App<HostElement>;
```

## 二、`createApp`

从某种程度上可以说，`Vue3`的一切都是从`createApp`开始的。`createApp`这个`API`定义在`packages/runtime-dom/src/index.ts`文件里，接下来简要看一看它大致走了哪些流程。

### 1. `createApp`

- 首先在`ensureRenderer`中调用`createRenderer`得到`renderer`，`renderer`上有`createApp`的方法，从而得到`app`；
- 重写`app.mount`方法，对`app._component`和`container`的内容作处理；并且在其中调用原本的`mount`之前，先对`container`的内容进行清空。

```typescript
function ensureRenderer() {
  return (
    renderer ||
    (renderer = createRenderer<Node, Element | ShadowRoot>(rendererOptions))
  );
}

export const createApp = ((...args) => {
  const app = ensureRenderer().createApp(...args);

  if (__DEV__) {
    injectNativeTagCheck(app);
    injectCompilerOptionsCheck(app);
  }

  const { mount } = app;
  app.mount = (containerOrSelector: Element | ShadowRoot | string): any => {
    const container = normalizeContainer(containerOrSelector);
    if (!container) return;

    const component = app._component;
    if (!isFunction(component) && !component.render && !component.template) {
      // __UNSAFE__
      // Reason: potential execution of JS expressions in in-DOM template.
      // The user must make sure the in-DOM template is trusted. If it's
      // rendered by the server, the template should not contain any user data.
      component.template = container.innerHTML;
      // 2.x compat check
      if (__COMPAT__ && __DEV__) {
        for (let i = 0; i < container.attributes.length; i++) {
          const attr = container.attributes[i];
          if (attr.name !== "v-cloak" && /^(v-|:|@)/.test(attr.name)) {
            compatUtils.warnDeprecation(
              DeprecationTypes.GLOBAL_MOUNT_CONTAINER,
              null
            );
            break;
          }
        }
      }
    }

    // clear content before mounting
    container.innerHTML = "";
    const proxy = mount(container, false, container instanceof SVGElement);
    if (container instanceof Element) {
      container.removeAttribute("v-cloak");
      container.setAttribute("data-v-app", "");
    }
    return proxy;
  };

  return app;
}) as CreateAppFunction<Element>;
```

那么这里就会产生疑问，毕竟真正的`createApp`是在 renderer 上的。而`renderer`来自`createRenderer`，那么这个`createRenderer`又是如何创建`renderer`的呢？

```
createApp() -> ensureRenderer() -> createRenderer() => renderer -> renderer.createApp()
```

### 2. `createRenderer`

我们可以在`packages/runtime-core/src/renderer.ts`里找到`createRenderer`的定义。发现是调用了`baseCreateRenderer`。这个方法就比较长了，加上重载的话有 2000+行，其中包含了`patch`、`move`、`unmount`等许多`diff`相关的方法，目前就不在这里展开了，只看一下它的返回值，追踪一下我们说的`createApp`的来源。可以看到，返回的`renderer`对象上有`render`，`hydrate`方法和`createApp`，`hydrate`是用于`baseCreateRenderer`的另一种重载，`render`方法就非常重要了，而`createApp`的来源是`createAppAPI`，这个`API`定义在`packages/runtime-core/src/createAppAPI.ts`里。

```typescript
export function createRenderer<
  HostNode = RendererNode,
  HostElement = RendererElement
>(options: RendererOptions<HostNode, HostElement>) {
  return baseCreateRenderer<HostNode, HostElement>(options);
}

// baseCreateRenderer

function baseCreateRenderer(
  options: RendererOptions,
  createHydrationFns?: typeof createHydrationFunctions
): any {
  // 此处省略上万字

  // render方法，虽重要，但不是本文的主角，先露个脸吧
  const render: RootRenderFunction = (vnode, container, isSVG) => {
    if (vnode == null) {
      if (container._vnode) {
        unmount(container._vnode, null, null, true);
      }
    } else {
      patch(
        container._vnode || null,
        vnode,
        container,
        null,
        null,
        null,
        isSVG
      );
    }
    flushPostFlushCbs();
    container._vnode = vnode;
  };

  // ...

  return {
    render,
    hydrate,
    createApp: createAppAPI(render, hydrate),
  };
}
```

### 3. `createAppAPI`

好家伙，走了这么长个流程，终于轮到主角登场了。在`baseCreateRenderer`的返回值中，我们可以看到，`createApp`方法就是以`render`和`hydrate`作为入参，提供给`createAppAPI`，从而诞生的。而这个近`200`行的函数，直接返回了我们用的`createApp`这个函数，这下子终于得到了真正的`createApp`。而逻辑也非常简单清晰：

- 创建上下文`context`；
- 声明一个不可重复的插件容器；
- 初始化`isMounted`状态为`false`；
- 创建`app`并挂到`context`上，最后返回`app`。

```typescript
export function createAppAPI<HostElement>(
  render: RootRenderFunction,
  hydrate?: RootHydrateFunction
): CreateAppFunction<HostElement> {
  return function createApp(rootComponent, rootProps = null) {
    if (!isFunction(rootComponent)) {
      rootComponent = { ...rootComponent };
    }

    if (rootProps != null && !isObject(rootProps)) {
      __DEV__ && warn(`root props passed to app.mount() must be an object.`);
      rootProps = null;
    }

    // 创建上下文
    const context = createAppContext();
    // 插件容器
    const installedPlugins = new Set();

    // 还没进行 mount() 呢，isMounted 自然是 false
    let isMounted = false;

    // 终于创建了app了
    const app: App = (context.app = {
      // ...
    });

    // 考虑兼容的属性
    if (__COMPAT__) {
      installAppCompatProperties(app, context, render);
    }

    return app;
  };
}
```

那么重点就是创建的`app`了，让我们掀开它神秘的面纱。

- 配置了一些内部属性；
- 利用存取器配置了只读的`config`属性；
- 定义了一些方法，如`use`、`mount`、`component`、`directive`、`mixin`、`unmount`、`provide`等，这时候回顾一下最开始我们说到的相关`ts`类型中的`App`类型，就对应上了。
- 其中，`component`、`directive`、`mixin`、`provide`都是用于定义一些全局可用的东西。这几个方法的逻辑也都一致，把定义的全局的内容添加到上下文`context`对象的相应字段中。
- `use`：这个应该家喻户晓了，就是使用插件，调用其中的`install`方法或者插件本身(当插件本身就是一个函数且没有`install`方法时) 来安装插件，并且用`installedPlugins`来判断是否已安装；
- `mount`：根据闭包的变量`isMounted`来判断`app`是否已经挂载；用根组件`rootComponent`作为参数，调用`createVnode`来生成根节点，并将上下文`context`也保存在`vnode.appContext`中；执行`render`函数将`vnode`渲染到`rootContainer`中，这一步我们应该很熟，就是替换`innerHTML`；之后变更`isMounted`状态为`true`等；
- `unmount`：同样是执行`render`函数，只是这次是把`null`空值渲染到`rootContainer`中，用空的内容替换之前`mount`时渲染的内容，从而达到卸载应用的效果。

```typescript
const app: App = (context.app = {
  _uid: uid++,
  _component: rootComponent as ConcreteComponent,
  _props: rootProps,
  _container: null,
  _context: context,
  _instance: null,

  version,

  get config() {
    return context.config
  },

  set config(v) {
    if (__DEV__) {
      warn(
        `app.config cannot be replaced. Modify individual options instead.`
      )
    }
  },

  use(plugin: Plugin, ...options: any[]) {
    if (installedPlugins.has(plugin)) {
      __DEV__ && warn(`Plugin has already been applied to target app.`)
    } else if (plugin && isFunction(plugin.install)) {
      installedPlugins.add(plugin)
      plugin.install(app, ...options)
    } else if (isFunction(plugin)) {
      installedPlugins.add(plugin)
      plugin(app, ...options)
    } else if (__DEV__) {
      warn(
        `A plugin must either be a function or an object with an "install" ` +
          `function.`
      )
    }
    return app
  },

  mixin(mixin: ComponentOptions) {
    if (__FEATURE_OPTIONS_API__) {
      if (!context.mixins.includes(mixin)) {
        context.mixins.push(mixin)
      } else if (__DEV__) {
        warn(
          'Mixin has already been applied to target app' +
            (mixin.name ? `: ${mixin.name}` : '')
        )
      }
    } else if (__DEV__) {
      warn('Mixins are only available in builds supporting Options API')
    }
    return app
  },

  component(name: string, component?: Component): any {
    if (__DEV__) {
      validateComponentName(name, context.config)
    }
    if (!component) {
      return context.components[name]
    }
    if (__DEV__ && context.components[name]) {
      warn(`Component "${name}" has already been registered in target app.`)
    }
    context.components[name] = component
    return app
  },

  directive(name: string, directive?: Directive) {
    if (__DEV__) {
      validateDirectiveName(name)
    }

    if (!directive) {
      return context.directives[name] as any
    }
    if (__DEV__ && context.directives[name]) {
      warn(`Directive "${name}" has already been registered in target app.`)
    }
    context.directives[name] = directive
    return app
  },

  mount(
    rootContainer: HostElement,
    isHydrate?: boolean,
    isSVG?: boolean
  ): any {
    if (!isMounted) {
      // #5571
      if (__DEV__ && (rootContainer as any).__vue_app__) {
        warn(
          `There is already an app instance mounted on the host container.\n` +
            ` If you want to mount another app on the same host container,` +
            ` you need to unmount the previous app by calling `app.unmount()` first.`
        )
      }
      const vnode = createVNode(
        rootComponent as ConcreteComponent,
        rootProps
      )
      // store app context on the root VNode.
      // this will be set on the root instance on initial mount.
      vnode.appContext = context

      // HMR root reload
      if (__DEV__) {
        context.reload = () => {
          render(cloneVNode(vnode), rootContainer, isSVG)
        }
      }

      if (isHydrate && hydrate) {
        hydrate(vnode as VNode<Node, Element>, rootContainer as any)
      } else {
        render(vnode, rootContainer, isSVG)
      }
      isMounted = true
      app._container = rootContainer
      // for devtools and telemetry
      ;(rootContainer as any).__vue_app__ = app

      if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
        app._instance = vnode.component
        devtoolsInitApp(app, version)
      }

      return getExposeProxy(vnode.component!) || vnode.component!.proxy
    } else if (__DEV__) {
      warn(
        `App has already been mounted.\n` +
          `If you want to remount the same app, move your app creation logic ` +
          `into a factory function and create fresh app instances for each ` +
          `mount - e.g. `const createMyApp = () => createApp(App)``
      )
    }
  },

  unmount() {
    if (isMounted) {
      render(null, app._container)
      if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
        app._instance = null
        devtoolsUnmountApp(app)
      }
      delete app._container.__vue_app__
    } else if (__DEV__) {
      warn(`Cannot unmount an app that is not mounted.`)
    }
  },

  provide(key, value) {
    if (__DEV__ && (key as string | symbol) in context.provides) {
      warn(
        `App already provides property with key "${String(key)}". ` +
          `It will be overwritten with the new value.`
      )
    }

    context.provides[key as string | symbol] = value

    return app
  }
})
```

`createApp`流程基本都弄明白了，但是我们并不清楚`render`的过程是如何进行的。后续会抽时间解读`render`函数的故事。
