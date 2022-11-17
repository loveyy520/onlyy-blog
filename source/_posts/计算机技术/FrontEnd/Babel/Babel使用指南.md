---
title: Babel使用指南
date: '2022-11-16 23:06'
updated: '2022-11-16 23:06'
categories:
  - 前端
keywords:
  - 前端
  - Babel
  - babel
tags:
  - Babel
swiper_index: 12
abbrlink: b71a7a8
---

我们知道，`ES6+`语法目前尚未被各大浏览器全面支持，且`ES`语法新特性也在逐年增加。若想在项目中愉快地使用较新版本的`ES`语法，那就需要工具来对我们的代码里的语法进行 “降级” 处理。这里附上**[Babel 官网](https://babeljs.io/)**。依照官网的介绍，`Babel`便是这么一个我们需要的工具链，能够将使用`ES6+`语法编写的代码转换为向后兼容的`ES`语法。除了语法转换，`Babel`还能以`Polyfill`的方式向目标环境中添加特性以及完成源码转换等功能。

## 一、基本使用

首先要明确的是，`Babel`是一个工具链，由许许多多的工具组成。这里简要介绍一下`Babel`工具的使用，使得我们的`ES6+`语法的代码被处理成能够在浏览器上运行的代码。

### 1. `Babel` 初体验

#### 1.1 安装依赖

```shell
npm install --save-dev @babel/core @babel/cli @babel/preset-env
```

#### 1.2 编写配置文件

在项目的根目录下创建`babel.config.json`文件(`Babel`版本`>= v7.8.0`)，并编写(复制)以下内容：

```json
{
  "presets": [
    [
      "@babel/preset-env",
      {
        "targets": {
          "edge": "17",
          "firefox": "60",
          "chrome": "67",
          "safari": "11.1"
        },
        "useBuiltIns": "usage",
        "corejs": "3.6.5"
      }
    ]
  ]
}
```

如果是旧版本的`Babel`，则配置文件应是一个`js`文件，命名为`babel.config.js`，相应的内容也有所差别：

```js
const presets = [
  [
    "@babel/preset-env",
    {
      targets: {
        edge: "17",
        firefox: "60",
        chrome: "67",
        safari: "11.1",
      },
      useBuiltIns: "usage",
      corejs: "3.6.4",
    },
  ],
];

module.exports = { presets };
```

#### 1.3 编译

我们知道，`npm`在安装`cli`依赖时，会根据依赖包中的`package.json`文件里的`bin`字段，在`/node_modules/.bin/`目录下创建相应的文件以及软链接，于是，`@babel/cli`使得我们可以在命令行运行相应的命令。我们在命令行运行以下命令：

```shell
./node_modules/.bin/babel src --out-dir lib
```

就可以将`src`目录下的`js`文件编译并输出到`lib`目录。当然，更简洁的命令是`npx babel src --out-dir lib`。

### 2. `cli` 命令行的基本使用

事实上，每个`Babel`模块都是一个独立的`npm`包，而从版本`7`开始，包的名字都是以`@babel`开始。下面简要介绍一下核心库`@babel/core`和命令行工具`@babel/cli`。

#### 2.1 `@babel/core`

`@babel/core`是`Babel`的核心模块，包含了`Babel`的核心功能。

安装：

```shell
npm install --save-dev @babel/core
```

可以在`js`程序中直接使用：

```js
const babel = require("@babel/core");

babel.transformSync("code", optionsObject);
```

当然，我们通常不会这么做，而是安装其它的`Babel`工具并集成到开发流程中。不过，熟悉它的文档依旧十分重要，这不仅能帮助我们理解其它的`babel`工具，而且我们如果要自制一个`Babel`插件，也自然离不开`@babel/core`。

#### 2.2 `@babel/cli`

`@babel/cli`是`Babel`的命令行工具，为我们提供了在命令行使用`Babel`的能力。

```shell
# 安装cli
npm install --save-dev @babel/core @babel/cli
# 在命令行使用
npx babel src --out-dir lib
```

以上两条分明分别是安装和在命令行使用`Babel`的示例。

### 3. 插件 `plugin` 和 预设 `preset`

**插件`plugin`是利用`@babel/core`写的小型`js`程序，用于指示`Babel`如何将`js`代码进行编译**。除了官方提供的许多插件之外，也可以按需制定自己的插件。一般来说，一个插件实现一个单独的能力，例如`@babel/plugin-transform-arrow-functions`可以将箭头函数转化为普通函数。然而，对于层出不穷的新特性，如果一个一个去安装使用单独的插件，无疑会给我们这些用户戴上痛苦面具。好在，我们还有预设`preset`可以使用。**预设是一组预先设定的插件**，使用预设，就不用去一个一个去添加插件了。

例如，使用最常用的预设：`@babel/preset-env` 来指定针对目标环境的编译。

```shell
# 安装预设
npm install --save-dev @babel/preset-env
# 通过--presets= 来指定预设
npx babel src --out-dir lib --presets=@babel/env
```

当没有进行参数配置时，这个预设能支持所有最新的`ES`语法的编译。我们也可以传递参数来进行配置。

### 4. `babel` 配置

如果使用命令行传参来进行配置，一来没有可复用性，二来参数太多也不便阅读。因此，可以使用配置文件。

前面提到过，对于`7.8.0`及更高的版本，配置文件是`babel.config.json`；而旧版本是`babel.config.js`。以如下配置文件为示例：

```json
{
  "presets": [
    [
      "@babel/preset-env",
      {
        "targets": {
          "edge": "17",
          "firefox": "60",
          "chrome": "67",
          "safari": "11.1"
        }
      }
    ]
  ]
}
```

其中，`targets`字段指定了目标浏览器，则该预设只会为目标浏览器中没有的功能加载转换插件。

### 5. `Polyfill `垫片

事实上，从`Babel 7.4.0`版本开始，就不建议使用这个包了，推荐的做法是直接包含`core-js/stable`：

```js
npm install --save core-js/stable
import 'core-js/stable'
```

回归正题，`@babel/polyfill`模块包含`core-js`以及一个自定义的`generator runtime`来模拟完整的`ES6+`环境(全局添加各种新语法的`API`)，从而让我们可以使用`Map`、`Promise`、`Array.from`等。

```shell
npm install --save @babel/polyfill
```

这样仍有缺陷，对于那些已支持部分新`API`特性的环境，垫片会造成污染。好在，`env`这个预设中提供了`"useBuiltIns"`参数，将其指定为`"usage"`，可以让垫片模块先进行环境检测，只加载环境中缺失的那些`API`。

```json
{
  "presets": [
    [
      "@babel/preset-env",
      {
        "targets": {
          "edge": "17",
          "firefox": "60",
          "chrome": "67",
          "safari": "11.1"
        },
        "useBuiltIns": "usage"
      }
    ]
  ]
}
```

如果不将`"useBuiltIns"`指定为`"usage"`，则我们需要在所有代码运行前，先利用`require`加载一次完整的`polyfill`，由于`@babel/polyfill`的弃用，我们可以使用`core-js/stable`：

```
 import "core-js/stable";
```

### 6. 小结

- `@babel/core` 提供了`Babel`的核心能力；
- `@babel/cli`提供了在命令行使用`Babel`的能力；
- `@babel/polyfill` 能够模拟完整的`ES6+`的功能；
- `@babel/presets-env`：指定环境，可以让`Babel`只对我们所使用的且目标浏览器中缺失的功能加载`Polyfill`以及代码转换。

## 二、`Babel`配置文件

### 1. 配置文件

`Babel`在根目录(默认情况下为当前工作目录`cwd`)查找配置文件时，`babel.config.*`是整个项目内生效的，而`.babelrc.*`则是只对当前`package`中生效，对次级`package`无效。因此，可以根据使用场景进行选择。

- 如果采用的是单一仓库模式(`monorepo`)，或者需要对`node_modules`进行编译，则建议使用`babel.config.json`作为配置文件；
- 如果配置文件仅需用于项目的一部分，则用`.babelrc.json`作为配置文件更适合。

```json
{
  "presets": [...],
  "plugins": [...]
}
```

- 如果配置需要与`js`代码结合，则使用`babel.config.js`或者`.babelrc.js`作为配置文件：

```javascript
const presets = [ ... ];
const plugins = [ ... ];

module.exports = { presets, plugins };
```

- 此外，也可以将`Babel`的配置写在`package.json`里，效果同`babelrc.json`：

```json
{
  "name": "my-package",
  "version": "1.0.0",
  "babel": {
    "presets": [ ... ],
    "plugins": [ ... ],
  }
}
```

### 2. `js`配置文件`API`

使用`.js`配置文件时，导出的可以是一个函数，函数中可以使用`Babel`提供的`API`。

```js
module.exports = function (api) {
  // 返回配置，这里配置是空的
  return {};
};
```

#### 2.1 `api.version`

可以得到加载配置文件的`Babel`的版本(字符串)。

#### 2.2 `api.cache`

当`.js`配置文件导出的是函数时，`Babel`每次都要重新执行一边该函数，显然浪费性能。我们可以通过`api.cache`来缓存函数的执行结果，从而避免重新执行该函数。有多种缓存策略可选：

- `api.cache.forever()`：永久性缓存，函数不会执行第二次；
- `api.cache.never()`：永不缓存，该函数每次都要重新执行；
- `api.cache.using(() => process.env.NODE_ENV==="development")`：根据`NODE_ENV`的值来进行缓存，一旦`using()`的回调返回一个预期之外的值，则将重新执行配置函数，并添加一个新的缓存入口；
- `api.cache.invalidate(() => process.env.NODE_ENV==="development")`：根据`NODE_ENV`的值来进行缓存，一旦`using()`的回调返回一个预期之外的值，则将重新执行配置函数，并用执行结果替代原有的所有缓存入口；
- `api.cache(true)`：永久性缓存，等同于`api.cache.forever()`；
- `api.cache(false)`：用不缓存，等同于`api.cache.never()`。

#### 2.3 `api.env(...)`

`api.env(...)`用于检测运行环境，通常是检查`NODE_ENV`，有如下几种用法：

- `api.env("production")`：如果当前运行环境是`production`则返回`true`；
- `api.env(["development", "test"])`：如果`["development", "test"]`中包含当前运行环境则返回`true`；
- `api.env()`：返回当前运行环境(字符串)；
- `api.env(envName => envName.startsWith("test-"))`：根据回调函数的结果得到`true`或者`false`。

#### 2.4 `api.caller(cb)`

用于获取`caller`信息，回调`cb`的第一个参数即是`caller`。

```jade
function isBabelRegister(caller) {
  return !!(caller && caller.name === "@babel/register");
}

module.exports = function(api) {
  const isRegister = api.caller(isBabelRegister);

  return {
    // ...
  };
};
```

#### 2.5 `api.assertVersion(range)`

用于声明`Babel`本版本范围。

```js
module.exports = function (api) {
  api.assertVersion("^7.2");

  return {
    // ...
  };
};
```

## 三、`Plugin` 插件

现今`Babel`的代码编译能力基本都是插件提供的

### 1. 使用插件

在配置文件中通过`plugins`字段来使用插件，`babel`插件可以有多个，与预设不同，插件的执行是顺序执行，即从前往后执行，且先于预设。

- 安装在`node_modules`中的插件：

```json
{
  "plugins": ["babel-plugin-myPlugin", "@babel/plugin-transform-runtime"]
}
```

- 其它目录下的插件（如自己编写的），通过相对路径来使用：

```json
{
  "plugins": ["./node_modules/asdf/plugin"]
}
```

### 2. 插件参数

插件可以带参数。不带参数的插件可以用字符串表示；带参数的插件则用一个二元元组表示，元组的第一个成员为插件本身，第二个成员为参数对象，通过`key: value`的形式配置参数。这与预设完全一致。

```json
{
  "plugins": [
    [
      "transform-async-to-module-method",
      {
        "module": "bluebird",
        "method": "coroutine"
      }
    ]
  ]
}
```

### 3. 插件开发

可以参考 [babel-handbook](https://github.com/thejameskyle/babel-handbook) 来学习插件开发。

如下为一个简单的用于反转字符串的插件。

```js
export default function () {
  return {
    // 访问者
    visitor: {
      // 通过路径（响应式节点）来访问 Identifier
      // 实际上是 {Identifier: {enter(){...}}} 的缩写，即进入节点时触发
      // 每次在 ast 中遇到 Identifier 就会调用一次
      Identifier(path) {
        const name = path.node.name;
        // reverse the name: JavaScript -> tpircSavaJ
        path.node.name = name.split("").reverse().join("");
      },
    },
  };
}
```

## 四、`Preset` 预设

预设是一组插件的集合。

### 1. 常用的预设

- `@babel/preset-env`：处理`ES6+`语法；
- `@babel/preset-typescript`：处理`TS`；
- `@babel/preset-react`：处理`react`语法(`JSX`等)；
- `@babel/preset-flow`：处理`flow`。

### 2. 使用预设

在配置文件中通过`presets`字段来使用预设，预设可以有多个。不带参数的预设可以直接用字符串表示，带参数的预设则用一个二元元组表示，元组的第一个成员为预设本身，第二个成员为参数对象。

- 对于安装到`node_modules`中的预设：

```json
{
  "presets": ["babel-preset-myPreset", "@babel/preset-env"]
}
```

- 其它的预设（如自己编写的），可以使用相对路径：

```json
{
  "presets": ["./myProject/myPreset"]
}
```

### 3. 编写预设

预设是一组插件的集合，因此只需要导出一个配置对象。也可以是一个函数，返回一个具有插件数组的对象。

```js
module.exports = function () {
  return {
    plugins: ["pluginA", "pluginB", "pluginC"],
  };
};
```

预设里可以包含其它的预设，在导出或返回的配置对象里用`presets`字段表示；以及带有参数的插件，将该插件用元组表示，元组的第一个成员为插件本身，第二个成员为插件参数对象。

```js
module.exports = () => ({
  // 预设嵌套
  presets: [require("@babel/preset-env")],
  plugins: [
    // 带有参数的插件
    [require("@babel/plugin-proposal-class-properties"), { loose: true }],
    require("@babel/plugin-proposal-object-rest-spread"),
  ],
});
```

当有多个预设时，预设的顺序是逆向的，即从后往前执行：

```json
{
  "presets": ["a", "b", "c"]
}
```

以上预设执行顺序为：`c -> b -> a`

此外，和插件一样，预设也可以接收参数，且形式也和插件相同，一个预设用一个元组表示，元组的第一个成员为预设本身，第二个成员为预设的参数对象：

```json
{
  "presets": [
    [
      "@babel/preset-env",
      {
        "useBuiltIns": "entry",
        "corejs": "3.22"
      }
    ]
  ]
}
```
