---
title: 如何手写一个符合需求的Babel插件
date: '2022-11-27 00:52'
updated: '2022-11-27 00:52'
categories:
  - 前端
keywords:
  - 前端
  - Babel
  - babel
tags:
  - Babel
  - 前端工程化
swiper_index: 16
abbrlink: b71a7a8
---
作为一个强大的多功能`JS`转译器，`Babel`有许许多多的模块可用于静态分析。而在项目中，有时候我们也需要创建一个符合项目需求的`Babel`插件。本文旨在帮助大家深入理解`Babel`插件工作流程的同时，让大家掌握如何按需求编写自己的`Babel`插件。

## 一、基础知识

### 1. `Babel`对代码处理分为三个步骤：

**解析(`parse`)**、**转换(`transform`)**、**生成(`generate`)** 。

### 2. 解析

在 **解析** 这一步，`Babel`接收代码，处理后生成 `AST` 。该步骤分为 **词法分析(`Lexical Analysis`)** 和 **语法分析(`Syntactic Analysis`)** 两个阶段。

#### 2.1 词法分析

`Babel`接收的源代码为代码字符串，词法分析会把字符串代码转化为 **令牌(`tokens`)** 流，令牌是对代码词法的描述。可以看作一个扁平的语法片段数组。例如，对于以下语法片段：

```js
n * n;
```

将被转化为如下令牌，可以看到，除了具有`type`和`value`属性以外，令牌还和`AST`一样具有`start`, `end`, `loc`属性。

```js
[
  { type: { ... }, value: "n", start: 0, end: 1, loc: { ... } },
  { type: { ... }, value: "*", start: 2, end: 3, loc: { ... } },
  { type: { ... }, value: "n", start: 4, end: 5, loc: { ... } },
  ...
]
```

其中，每个`type`都有一组属性来描述该令牌：

```js
{
  type: {
    label: 'name',
    keyword: undefined,
    beforeExpr: false,
    startsExpr: true,
    rightAssociative: false,
    isLoop: false,
    isAssign: false,
    prefix: false,
    postfix: false,
    binop: null,
    updateContext: null
  },
  ...
}
```

#### 2.2 语法分析

词法分析将字符串代码转化为`tokens`，语法分析则是根据`tokens`生成`AST`的表述结构，这样更易于进行后续操作。

### 3. 转换

**转换** 步骤接收`AST`并对其进行遍历，这个过程中主要对节点进行增删改，是编译器最为复杂的过程，也是插件将要介入工作的部分。本文的主要内容也将围绕这个部分展开。

### 4. 生成

**生成** 的步骤相对简单，主要是对 经过一系列转化得到的最终 `AST` 进行 深度优先遍历 来生成字符串形式的代码，并创建 **源码映射(`source maps`)** 。

### 5. 抽象语法树 `AST`

`Babel`的处理过程每一步都涉及创建或操作`AST`，使用的是基于`ESTree`并修改过的`AST`。例如对于以下程序片段：

```js
function square(n) {
  return n * n;
}
```

会被处理为如下`AST`：

```toml
- FunctionDeclaration:
  - id:
    - Identifier:
      - name: square
  - params [1]
    - Identifier
      - name: n
  - body:
    - BlockStatement
      - body [1]
        - ReturnStatement
          - argument
            - BinaryExpression
              - operator: *
              - left
                - Identifier
                  - name: n
              - right
                - Identifier
                  - name: n
```

或者以`JS`对象来表示：

```js
{
  type: "FunctionDeclaration",
  id: {
    type: "Identifier",
    name: "square"
  },
  params: [{
    type: "Identifier",
    name: "n"
  }],
  body: {
    type: "BlockStatement",
    body: [{
      type: "ReturnStatement",
      argument: {
        type: "BinaryExpression",
        operator: "*",
        left: {
          type: "Identifier",
          name: "n"
        },
        right: {
          type: "Identifier",
          name: "n"
        }
      }
    }]
  }
}
```

可以看到，不同的层级各自具有一致的结构：

```js
{
  type: "FunctionDeclaration",
  id: {...},
  params: [...],
  body: {...}
}
```

```js
{
  type: "Identifier",
  name: ...
}
```

```js
{
  type: "BinaryExpression",
  operator: ...,
  left: {...},
  right: {...}
}
```

这样的每一层结构叫做 **节点(`Node`)** 。一个`AST`可以由一个或许多个节点构成。这些节点组合在一起可用以描述用于静态分析的程序语法。而每一个节点都有如下接口：

```typescript
interface Node {
	type: string;
}
```

`string`形式的`type`字段表示节点的类型，如`"FunctionDeclaration"`, `"Identifier"`, `"BinaryExpression"` 等。且每种类型的节点，又定义了一些附加属性来进一步描述该节点。此外，`Babel`还为每个节点生成了额外属性(`start`, `end`, `loc` 等)，用于描述该节点在原始代码中的位置，每个节点都有这些属性。

```js
{
  type: ...,
  start: 0,
  end: 38,
  loc: {
    start: {
      line: 1,
      column: 0
    },
    end: {
      line: 3,
      column: 1
    }
  },
  ...
}
```

### 6. 遍历

要想转换`AST`，则需要对`AST`进行递归遍历。假如有一个`FunctionDeclaration`类型，它有如下几个属性：`id`, `params`, `body`，且每个属性都有一些内嵌节点。

```js
{
  type: "FunctionDeclaration",
  id: {
    type: "Identifier",
    name: "square"
  },
  params: [{
    type: "Identifier",
    name: "n"
  }],
  body: {
    type: "BlockStatement",
    body: [{
      type: "ReturnStatement",
      argument: {
        type: "BinaryExpression",
        operator: "*",
        left: {
          type: "Identifier",
          name: "n"
        },
        right: {
          type: "Identifier",
          name: "n"
        }
      }
    }]
  }
}
```

按照如下顺序遍历以上`AST`：

- 我们从`FunctionDeclaration`开始依次访问每一个属性及其子节点；
- 随后来带`id`，是个`Identifier`，且它没有任何子节点属性；
- 于是继续访问下一个属性`params`，而`params`是一个数组节点，因此要遍历访问其中的每一个，它们都是`Identifier`类型的单一节点；
- 继续下去，变来到了`body`，是个`BlockStatement`，且内部还有个`body`节点，内部的`body`节点是个数组节点，因此我们遍历访问其中的每一个；
- 而在这里，内部的`body`节点唯一的子节点是个`ReturnStatement`，它有个`argument`，访问这个`argument`便找到了`BinaryExpression`。
- `BinaryExpression`有一个`operator`，一个`left`，一个`right`。
- `operator`只是一个值而不是一个节点，因此，我们只需要访问`left`和`right`。

### 7. `Visitors` (访问者)

说到 “进入” 一个节点，实际上是说我们在 **访问** 他们。这个术语出自 **访问者模式(`visitor`) **的概念。访问者是一个用于`AST`遍历的跨语言的模式。简单的说，他们就是一个对象，定义了用于在一个树状结构中获取具体节点的方法。例如：

```js
// 访问者
const MyVisitor = {
  Identifier() {
    console.log("Called!");
  }
};

// 你也可以先创建一个访问者对象，并在稍后给它添加方法。
let visitor = {};
visitor.MemberExpression = function() {};
visitor.FunctionDeclaration = function() {}
```

这便是一个极为简单的访问者，每当在`AST`中遇到`Identifier`时，就会调用`Identifier`方法。如果将这个访问者应用到如下代码中，`Identifier`方法便会执行`4`次(`square`和`3`个`n`各一次)：

```js
function square(n) {
  return n * n;
}
```

```js
path.traverse(MyVisitor);
/**
 * Called!
 * Called!
 * Called!
 * Called!
 */
```

这些调用都发生在 **进入** 节点时，有时候我们也可以在 **退出** 节点时调用访问者方法。例如对于如下树状结构：

```yaml
- FunctionDeclaration
  - Identifier (id)
  - Identifier (params[0])
  - BlockStatement (body)
    - ReturnStatement (body)
      - BinaryExpression (argument)
        - Identifier (left)
        - Identifier (right)
```

当向下遍历每一个分支时，会走到该分支的尽头，此时，便要向上遍历回去，以便访问下一个节点。向下遍历时我们 **进入(enter)** 每个节点，而向上遍历时我们 **退出(exit)** 每个节点。以遍历上面的树为例：

- 进入`FunctionDeclaration`

  - 进入 `Identifier (id)`
  - 走到尽头
  - 退出 `Identifier (id)`

  - 进入 `Identifier (params[0])`

  - 走到尽头

  - 退出 `Identifier (params[0])`

  - 进入 `BlockStatement (body)`

    - 进入 `ReturnStatement (body)`

      - 进入 `BinaryExpression (argument)`
        - 进入 `Identifier (left)`
        - 走到尽头
        - 退出 `Identifier (left)`
        - 进入 `Identifier (right)`
        - 走到尽头
        - 退出 `Identifier (right)`

      - 退出 `BinaryExpression (argument)`

    - 退出 `ReturnStatement (body)`

  - 退出 `BlockStatement (body)`

- 退出 `FunctionDeclarati`

因此，当创建访问者时，我们实际上有两次机会来访问一个节点，分别是 **进入(`enter`)** 和 **退出(`exit`)**：

```js
const MyVisitor = {
  Identifier: {
    enter() {
      console.log("Entered!");
    },
    exit() {
      console.log("Exited!");
    }
  }
};
```

而我们之前写的`Identifier() { ... }` 则是 `Identifier: { enter() { ... } }` 的简写形式，表示在进入时访问节点。

在有需要的情况下，也可以使用`|`来把方法名分隔为`Idenfifier|MemberExpression`形式的字符串，把同一个函数应用到多个访问节点。注意此时需要给方法名加上引号：

```js
const MyVisitor = {
  "ExportNamedDeclaration|Flow"(path) {}
};
```

也可以使用别名作为方法名，例如`Function`是`FunctionDeclaration`、`FunctionExpression`、`ArrowFunctionExpression`、`ObjectMethod`和`ClassMethod`的别名。

```js
const MyVisitor = {
  Function(path) {}
};
```

### 8. `Paths` 路径

现在我们知道了，`AST`中有许多的节点。那么如何去把节点进行相互关联呢？我们可以使用一个巨大的可操作对象来描述节点之间的关系，但是显然这会比较麻烦。而使用 **路径(`Paths`)** 便能够解决这个问题。

`Path`是一个对象，用来描述两个节点之间的连接。例如，对于以下节点和其子节点：

```js
{
  type: "FunctionDeclaration",
  id: {
    type: "Identifier",
    name: "square"
  },
  ...
}
```

将子节点表示为一个路径(`Path`)：

```json
{
  "parent": {
    "type": "FunctionDeclaration",
    "id": {...},
    ....
  },
  "node": {
    "type": "Identifier",
    "name": "square"
  }
}
```

同时，它还会包含该路径的其它元数据：

```js
{
  "parent": {...},
  "node": {...},
  "hub": {...},
  "contexts": [],
  "data": {},
  "shouldSkip": false,
  "shouldStop": false,
  "removed": false,
  "state": null,
  "opts": null,
  "skipKeys": null,
  "parentPath": null,
  "context": null,
  "container": null,
  "listKey": null,
  "inList": false,
  "parentKey": null,
  "key": null,
  "scope": null,
  "type": null,
  "typeAnnotation": null
}
```

此外，**路径对象上还包含了增删、更新、移动等许多其它方法**。在某种意义上说，路径是一个节点在`AST`中的位置以及和节点相关的信息的**响应式(`Reactive`)**表示。每当调用了修改树的方法，相关路径信息也会随之更新，而这些都由`Babel`管理，使得我们操作节点更加简单，尽可能地做到无状态。

#### `Path in Visitors` 存在于访问者中的路径

当我们有一个`Identifier()`方法的`Visitor`时，实际上我们访问的是路径，而不是节点。通过这种方式，我们操作的就是节点的响应式表示（即路径），而非节点本身。

```js
const MyVisitor = {
  Identifier(path) {
    console.log("Visiting: " + path.node.name);
  }
};
```

```js
a + b + c;
```

```js
path.traverse(MyVisitor);
// Visiting: a
// Visiting: b
// Visiting: c
```

### 9. `State` 状态

对于`AST`而言，状态管理是极其麻烦的，往往会有一些未考虑到的语法来推翻我们之前对状态的假设。例如，对于以下代码：

```js
function square(n) {
  return n * n;
}
```

如果我们要写一个把`n`重命名为`x`的实现：

```js
let paramName;

const MyVisitor = {
  FunctionDeclaration(path) {
    const param = path.node.params[0];
    paramName = param.name;
    param.name = "x";
  },

  Identifier(path) {
    if (path.node.name === paramName) {
      path.node.name = "x";
    }
  }
};
```

以上访问者可以将函数参数中的`n`重命名为`x`，且之后所有名为`n`的`Identifier`，都将重命名为`x`。确实可以让`square`函数中的`n`重命名为`x`，但是也会出现预料之外的情况，因为全局的名字为`n`的`Identifier`都被会污染：

```js
function square(n) {
  return n * n;
}
// 以下的n也会被重命名为x
n;
```

因此，给访问者添加方法时，最好使用递归，以便消除对全局状态的影响。如下，可将一个`Visitor`放进另一个`Visitor`中，这时候的`Identifier()`只在`MyVisitor`的`FunctionDeclaration`中生效，不会造成全局污染。

```js
const updateParamNameVisitor = {
  Identifier(path) {
    if (path.node.name === this.paramName) {
      path.node.name = "x";
    }
  }
};

const MyVisitor = {
  FunctionDeclaration(path) {
    const param = path.node.params[0];
    const paramName = param.name;
    param.name = "x";

    path.traverse(updateParamNameVisitor, { paramName });
  }
};

path.traverse(MyVisitor);
```

### 10. `Scopes` 作用域

`JS`支持词法作用域，在树状嵌套结构中代码块创建出新的作用域。

```js
// global scope 全局作用域

function scopeOne() {
  // 局部作用域1
  // scope 1

  function scopeTwo() {
    // 局部作用域2
    // scope 2
  }
}
```

在`JS`中，当一个引用被创建出来，无论是通过变量(`variable`)，函数(`function`)，类型(`class`)，参数(`params`)，模块导入(`import`) 还是 标签(`label`)，它都属于当前作用域。更深的内部作用域可以使用其外部作用域中的引用，也可以创建和外部作用域同名的引用。当编写转换时，尤其需要注意作用域，确保在改变代码各个部分时不会破坏已经存在的代码。

- 当添加一个新的引用时，确保不会和已有的引用发生冲突；
- 查找使用某个引用的所有变量时，确保是在给定的作用域中进行；

作用域可以表示为如下形式：

```js
{
  path: path,
  block: path.node,
  parentBlock: path.parent,
  parent: parentScope,
  bindings: [...]
}
```

每当创建一个新的作用域时，需要给出它的路径和父作用域。之后在遍历过程中它会收集所有的引用(“`Bindings`”)，一旦收集完毕，就可以在作用域上使用各种方法，这些方法会在后续介绍。

#### `Bindings` 绑定

每个 引用 都属于特定的 作用域，引用 和 作用域 之间的这种关系被称为 **绑定(binding)**。单个绑定看起来如下所示：

```js
{
  identifier: node,
  scope: scope,
  path: path,
  kind: 'var',

  referenced: true,
  references: 3,
  referencePaths: [path, path, path],

  constant: false,
  constantViolations: [path]
}
```

根据这些信息，就可以查找到一个绑定的所有引用，以及该绑定的类型信息、所属作用域、是否是常量，或者拷贝它的标识符等等。

有些情况下，知道一个绑定是否是常量非常有帮助，最有用的一种情形就是压缩代码时：

```js
function scopeOne() {
  var ref1 = "This is a constant binding";

  // 没有修改ref1，则ref1是常量
  becauseNothingEverChangesTheValueOf(ref1);

  function scopeTwo() {
    var ref2 = "This is *not* a constant binding";
    ref2 = "Because this changes the value";
  }
}
```

## 二、`API`

`Babel`是一组模块的集合，这里我们介绍一些主要模块的功能与使用。

### 1. `babylon`

`Babylon`是`Babel`的解析器。

- 安装

```shell
npm install --save babylon
```

先来试着使用`Babylon`的`parse()`方法，来解析一个简单的代码字符串：

```js
import * as babylon from "babylon";

const code = `function square(n) {
  return n * n;
}`;

babylon.parse(code);
// 将会被解析为如下形式的ast

// Node {
//   type: "File",
//   start: 0,
//   end: 38,
//   loc: SourceLocation {...},
//   program: Node {...},
//   comments: [],
//   tokens: [...]
// }
```

`parse()`方法还能接收第二个参数，用于指示`Babylon`如何解析。

```js
babylon.parse(code, {
  sourceType: "module", // default: "script"
  plugins: ["jsx"] // default: []
});
```

`sourceType` 可以是 `"module"` 或者 `"script"`，它表示 Babylon 应该用哪种模式来解析。 `"module"` 将会在严格模式下解析并且允许模块定义，`"script"` 则不会。默认值为`"script"`，该模式下如果发现`import`或者`export`则会报错，需要指定`scourceType: "module"` 来避免这些错误。

`Babylon`使用了基于插件的架构，有一个`plugins`来控制内部插件的启用和关闭。对于详细的插件列表，可参考[Babylon README文件](https://github.com/babel/babylon/blob/master/README.md#plugins)。

### 2. `babel-traverse`

这个模块负责维护整个树的状态，且负责替换、移除、添加节点。

- 安装

```shell
npm install --save babel-traverse
```

可以将其和`Babylon`一起使用来遍历和更新节点：

```js
import * as babylon from "babylon";
import traverse from "babel-traverse";

const code = `function square(n) {
  return n * n;
}`;

const ast = babylon.parse(code);

// 遍历这段 AST，在进入节点时将其中所有命名为 n 的 Identifier 重命名为 x
traverse(ast, {
  enter(path) {
    if (
      path.node.type === "Identifier" &&
      path.node.name === "n"
    ) {
      path.node.name = "x";
    }
  }
});
```

### 3. `babel-types`

这是一个用于`AST`节点的工具库，包含了构造、验证以及变换`AST`节点的工具方法。

- 安装

```shell
npm install --save babel-types
```

- 使用

```json
import traverse from "babel-traverse";
import * as t from "babel-types";

traverse(ast, {
  enter(path) {
    if (t.isIdentifier(path.node, { name: "n" })) {
      path.node.name = "x";
    }
  }
});
```

#### 3.1 `Definitions` 定义

每一个但一类型的节点都具有相应的定义，包括节点包含哪些属性，什么是合法值，如何构建节点、遍历节点，节点的别名信息等。单一类型节点的定义形式如下：

```js
defineType("BinaryExpression", {
  builder: ["operator", "left", "right"],
  fields: {
    operator: {
      validate: assertValueType("string")
    },
    left: {
      validate: assertNodeType("Expression")
    },
    right: {
      validate: assertNodeType("Expression")
    }
  },
  visitor: ["left", "right"],
  aliases: ["Binary", "Expression"]
});
```

#### 3.2 `Builders` 构建器

在上面的`DefineType`中，有一个`builder`字段：`builder: ["operator", "left", "right"]`。每一个节点类型都有构造器方法，按类似以下方式使用：

```js
// builder: ["operator", "left", "right"]
// a * b
t.binaryExpression("*", t.identifier("a"), t.identifier("b"));
```

创建的`AST`如下：

```js
{
  type: "BinaryExpression",
  operator: "*",
  left: {
    type: "Identifier",
    name: "a"
  },
  right: {
    type: "Identifier",
    name: "b"
  }
}
```

打印出来则是：`a * b`。

构建器还会验证自身创建的节点，并在错误使用的情形下抛出描述性错误。验证时使用了验证器方法。

#### 3.3 `Validators` 验证器

`BinaryExpression` 的定义中包含了节点的字段 `fields` 信息，以及如何验证这些字段。

可以创建两种验证方法：

- `isX`:

```js
t.isBinaryExpression(maybeBinaryExpressionNode);
```

也可以传入第二个参数来确保节点包含特定的属性和值：

```js
t.isBinaryExpression(maybeBinaryExpressionNode, { operator: "*" });
```

- `assertX`：

断言式校验版本，会抛出异常而不是返回 `true` 或 `false`。

```js
t.assertBinaryExpression(maybeBinaryExpressionNode);
t.assertBinaryExpression(maybeBinaryExpressionNode, { operator: "*" });
// Error: Expected type "BinaryExpression" with option { "operator": "*" }
```

#### 3.4 `Converts` 变换器

此处不做介绍。

### 4. `babel-generator`

这是`Babel`的代码生成器，负责读取`AST`并将其转化为代码和源码映射(`source maps`)。

- 安装

```shell
npm install --save babel-generator
```

- 使用

```js
import * as babylon from "babylon";
import generate from "babel-generator";

const code = `function square(n) {
  return n * n;
}`;

const ast = babylon.parse(code);

// 接收AST，生成代码 code 和 源码映射 map
generate(ast, {}, code);
// {
//   code: "...",
//   map: "..."
// }
```

也可以通过第二个参数传递一些选项：

```js
generate(ast, {
  retainLines: false,
  compact: "auto",
  concise: false,
  quotes: "double",
  // ...
}, code);
```

### 5. `babel-template`

这个模块能让我们编写字符串形式且带有占位符的代码来代替手动编码，在生成大规模`AST`的时候尤其有用。

- 安装

```shell
npm install --save babel-template
```

- 使用

```js
import template from "babel-template";
import generate from "babel-generator";
import * as t from "babel-types";

// 定义模板
const buildRequire = template(`
  var IMPORT_NAME = require(SOURCE);
`);

// 生成AST
const ast = buildRequire({
  IMPORT_NAME: t.identifier("myModule"),
  SOURCE: t.stringLiteral("my-module")
});

// 由AST生成代码
console.log(generate(ast).code);
```

于是`generate(ast).code`便能得到：

```js
var myModule = require("my-module");
```

## 三. 编写第一个 `Babel` 插件

终于熟悉了`Babel`的基础知识了，现在可以愉快地写插件了。

先从一个接收当前`babel`对象作为参数的`function`开始：

```js
export default function(babel) {
  // plugin contents 插件内容
}
```

由于`babel`对象里常用的是`babel.types`，因此可以在参数中解构以方便使用：

```js
export default function({ types: t }) {
  // plugin contents
}
```

然后返回一个对象，其中的`visitor`属性是这个插件的主要访问者：

```js
export default function({ types: t }) {
  return {
    visitor: {
      // visitor contents
    }
  };
};
```

`visitor`的每个方法都接收两个参数：`path`和`state`。

```js
export default function({ types: t }) {
  return {
    visitor: {
      Identifier(path, state) {},
      ASTNodeTypeHere(path, state) {}
    }
  };
};
```

接下来完成一个简单的插件，来展示一下插件是如何工作的，假设要处理的源代码为：

```js
foo === bar;
```

其`AST`形式如下：

```js
{
  type: "BinaryExpression",
  operator: "===",
  left: {
    type: "Identifier",
    name: "foo"
  },
  right: {
    type: "Identifier",
    name: "bar"
  }
}
```

可以看到，有`BinaryExpression`和`Identifier`两种节点。我们先从添加`BinaryExpression`访问者方法开始。

```js
export default function({ types: t }) {
  return {
    visitor: {
      BinaryExpression(path) {
        // ...
      }
    }
  };
}
```

对于源代码`foo === bar;`，我们可以更加精确一点，只关注操作符为 `===` 的`BinaryExpression`。

```js
{
  visitor: {
  	BinaryExpression(path) {
    	if (path.node.operator !== "===") {
      	return;
    	}

    	// ...
  	}
	}
}
```

现在，用新的标识符来替换`left`属性：

```js
BinaryExpression(path) {
  if (path.node.operator !== "===") {
    return;
  }

  // 使用babel-types模块提供的方法
  path.node.left = t.identifier("cc");
  // ...
}
```

此时，如果运行这个插件，则会将源代码转换成:

```js
cc === bar;
```

接下来，就剩下替换右边的标识符的工作了。

```js
BinaryExpression(path) {
  if (path.node.operator !== "===") {
    return;
  }

  path.node.left = t.identifier("cc");
  path.node.right = t.identifier("yy");
}
```

这时候运行这个插件，就能得到最终结果了：

```js
cc === yy;
```

于是，轻松实现了第一个`Babel`插件！

## 四、转换操作

项目中需要用到的插件，应用场景往往没这么简单。因此，我们还得学会更多的操作，来使我们拥有能编写更强大的插件的能力。

### 1. 访问

#### 1.1 获取子节点的 `Path`

要得到一个`AST`节点的属性值，我们一般先访问到该节点，再通过`path.node.property`即可。

```js
// BinaryExpression AST 节点 有三个属性: `left`, `right`, `operator`
BinaryExpression(path) {
  path.node.left;
  path.node.right;
  path.node.operator;
}
```

如果要访问到该属性内部的`path`，则需要用到`path`对象的`get`方法，传递该属性的字符串形式作为参数：

```js
BinaryExpression(path) {
  path.get('left');
}
Program(path) {
  // 数字索引也是用 . 分隔
  path.get('body.0');
}
```

#### 1.2 检查节点的类型

检查节点的类型可以通过`path.node`来进行，但是不建议这么做：

```js
BinaryExpression(path) {
  if (
    path.node.left != null &&
    path.node.left.type === "Identifier" &&
    path.node.left.name === "n"
  ) {
    // ...
  }
}
```

推荐的做法是使用`babel-types`模块提供的方法来进行检查：

```js
BinaryExpression(path) {
  if (t.isIdentifier(path.node.left, { name: "n" })) {
    // ...
  }
}
```

#### 1.3 检查路径类型

路径具有和`babel-types`提供的相同的检查方法：

```js
BinaryExpression(path) {
  if (path.get('left').isIdentifier({ name: "n" })) {
    // ...
  }
}
```

这就相当于：

```js
BinaryExpression(path) {
  if (t.isIdentifier(path.node.left, { name: "n" })) {
    // ...
  }
}
```

#### 1.4 检查标识符(`Identifier`)是否被引用

```js
Identifier(path) {
  if (path.isReferencedIdentifier()) {
    // ...
  }
}
```

或者使用`babel-types`提供的能力：

```js
Identifier(path) {
  if (t.isReferenced(path.node, path.parent)) {
    // ...
  }
}
```

#### 1.5 找到特定的父路径

有时候需要向上遍历`AST`，直到满足某些条件。

- 以下方法，对于每一个父路径调用`cb`，当`cb`返回真值，则将其`NodePath`返回。

```js
path.findParent((path) => path.isObjectExpression());
```

- 如果是从当前节点开始遍历，则使用`find`方法：

```js
path.find((path) => path.isObjectExpression());
```

- 查找最临近的父函数或者程序：

```js
path.getFunctionParent();
```

- 向上遍历语法树，知道找到在列表中的父节点路径：

```js
path.getStatementParent();
```

#### 1.6 查找同级路径

当一个路径是在一个`Function/Program`中的列表里面，则它会有同级路径。

- 使用 `path.inList` 可以判断是否有同级路径；
- 使用 `path.getSibling(index)`来获得同级路径;
- 使用 `path.key`获取路径在容器中的索引;
- 使用 `path.container`获取路径的容器（包含所有同级节点的数组）;
- 使用 `path.listKey`获取容器的key。

在`transform-merge-sibling-variables`插件中使用到了这些`API`。

#### 1.7 停止遍历

如果需要插件在某些情况下不继续运作，应该尽早返回。

```js
BinaryExpression(path) {
  if (path.node.operator !== '**') return;
}
```

如果是在顶级的`path`中进行子遍历，则可以通过`path.skip`或者`path.stop`来停止遍历。

- `path.skip`：跳过当前路径的子遍历；
- `path.stop`：停止当前路径的遍历（包括子遍历）。

```js
outerPath.traverse({
  Function(innerPath) {
    innerPath.skip(); // if checking the children is irrelevant
  },
  ReferencedIdentifier(innerPath, state) {
    state.iife = true;
    innerPath.stop(); // if you want to save some state and then stop traversal, or deopt
  }
});
```

### 2. 处理

在实际编写插件时，我们常需要进行各种增删改等处理。

#### 2.1 替换一个节点

使用`path.replaceWith`来替换一个节点。

```js
BinaryExpression(path) {
  path.replaceWith(
    // [operator, left, right]
    t.binaryExpression("**", path.node.left, t.numberLiteral(2))
  );
}
```

```diff
  function square(n) {
-   return n * n;
+   return n ** 2;
  }
```

#### 2.2 用多节点来替换单节点

`path.replaceWithMultiple`方法用多节点来替换单个节点。注意，参数是声明数组。**当用多个节点替换一个表达式时，它们必须是 声明**。 这是因为`Babel`在更换节点时广泛使用启发式算法，这意味着您可以做一些非常疯狂的转换，否则将会非常冗长。

```js
ReturnStatement(path) {
  path.replaceWithMultiple([
    // 声明（字符串字面量节点）
    t.expressionStatement(t.stringLiteral("Is this the real life?")),
    t.expressionStatement(t.stringLiteral("Is this just fantasy?")),
    t.expressionStatement(t.stringLiteral("(Enjoy singing the rest of the song in your head)")),
  ]);
}
```

```diff
  function square(n) {
-   return n * n;
+   "Is this the real life?";
+   "Is this just fantasy?";
+   "(Enjoy singing the rest of the song in your head)";
  }
```

#### 2.3 用字符串源码替换节点

使用`path.replaceWithSourceString`，将直接用源码字符串来替换当前节点(**不建议使用**)。

```js
FunctionDeclaration(path) { 
	path.replaceWithSourceString(
    `function add(a, b) { 
			return a + b; 
		}`
  ); 
}
```

```diff
- function square(n) {
-   return n * n;
+ function add(a, b) {
+   return a + b;
  }
```

#### 2.4 插入兄弟节点

使用`path.insertBefore`和`path.insertAfter`来在前或后一个位置插入兄弟节点。如果是**插入单个节点，则使用声明，如果是插入多个节点，则应使用声明数组。**

```js
FunctionDeclaration(path) { 
	path.insertBefore(
		t.expressionStatement(
			t.stringLiteral("Because I'm easy come, easy go.")
		)
	); 
	path.insertAfter(
		t.expressionStatement(
			t.stringLiteral("A little high, little low.")
		)
	); 
}
```

```diff
+ "Because I'm easy come, easy go.";
  function square(n) {
    return n * n;
  }
+ "A little high, little low.";
```

#### 2.5 插入到容器中

在容器中插入节点和插入兄弟节点类似，只不过需要指定`listKey`。注意要使用声明。

```js
ClassMethod(path) { 
	path
	.get('body')
	.unshiftContainer(
		'body', 
		t.expressionStatement(t.stringLiteral('before'))
	);
	path
	.get('body')
	.pushContainer(
		'body', 
		t.expressionStatement(t.stringLiteral('after'))
	); 
}
```

```diff
class A {
  constructor() {
+   "before"
    var a = 'middle';
+   "after"
  }
 }
```

#### 2.6 删除一个节点

使用`path.remove`即可轻松删除当前节点。

```js
FunctionDeclaration(path) {
  path.remove();
}
```

```diff
- function square(n) {
-   return n * n;
- }
```

#### 2.7 替换父节点

只需要获取到父节点的路径`parentPath`，然后调用`replaceWith`方法即可。

```js
BinaryExpression(path) {
  path.parentPath.replaceWith(
    t.expressionStatement(
      t.stringLiteral("Anyway the wind blows, doesn't really matter to me, to me."))
  );
}
```

#### 2.8 删除父节点

获取父节点并执行`remove`方法即可。

```js
BinaryExpression(path) {
  path.parentPath.remove();
}
```

```diff
  function square(n) {
-   return n * n;
  }
```

#### 2.9 处理作用域

- `path.scope.hasBinding()`：检查本地变量是否被绑定

```js
FunctionDeclaration(path) {
  if (path.scope.hasBinding("n")) {
    // ...
  }
}
```

这个方法会遍历范围树来检查特定的绑定。

- `path.scope.hasOwnBinding()`：检查一个作用域是否有自己的绑定。

```js
FunctionDeclaration(path) {
  if (path.scope.hasOwnBinding("n")) {
    // ...
  }
}
```

- `path.scope.generateUidIdentifierBasedOnNode`：创建`UID`。

```js
FunctionDeclaration(path) {
  path.scope.generateUidIdentifier("uid");
  // Node { type: "Identifier", name: "_uid" }
  path.scope.generateUidIdentifier("uid");
  // Node { type: "Identifier", name: "_uid2" }
}
```

- ` path.scope.parent.push`：提升变量声明到父级作用域。

```js
FunctionDeclaration(path) {
  const id = path.scope.generateUidIdentifierBasedOnNode(path.node.id);
  path.remove();
  path.scope.parent.push({ id, init: path.node });
}
```

```diff
- function square(n) {
+ var _square = function square(n) {
    return n * n;
- }
+ };
```

- `path.scope.rename`：重命名绑定及其引用。

```js
FunctionDeclaration(path) {
  path.scope.rename("n", "x");
}
```

```diff
- function square(n) {
-   return n * n;
+ function square(x) {
+   return x * x;
  }
```

也可以将绑定重命名为唯一的标识符：

```js
FunctionDeclaration(path) {
  path.scope.rename("n");
}
```

```diff
- function square(n) {
-   return n * n;
+ function square(_n) {
+   return _n * _n;
  }
```

## 五、插件选项

### 1. 插件选项的使用

接收插件选项，可以允许用户自定义插件的某些行为，如下：

```js
{
  plugins: [
    ["my-plugin", {
      "option1": true,
      "option2": false
    }]
  ]
}
```

这些选项通过状态参数`state`来传递给访问者。这些选项是特定于插件的，我们不能访问其它插件中的选项。

```js
export default function({ types: t }) {
  return {
    visitor: {
      FunctionDeclaration(path, state) {
        console.log(state.opts);
        // { option1: true, option2: false }
      }
    }
  }
}
```

### 2. 插件的准备和收尾工作

插件可以具有在插件之前(`pre`)或之后(`post`)执行的函数，他们可用于设置或清理/分析的目的。

```js
export default function({ types: t }) {
  return {
    pre(state) {
      this.cache = new Map();
    },
    visitor: {
      StringLiteral(path) {
        this.cache.set(path.node.value, 1);
      }
    },
    post(state) {
      console.log(this.cache);
    }
  };
}
```

### 3. 在插件中启用其它语法

插件可以启用`babylon plugins`，以便不需要用户来安装/启用他们。

```js
export default function({ types: t }) {
  return {
    inherits: require("babel-plugin-syntax-jsx")
  };
}
```

也可以结合`babel-code-frame`来抛出错误。

```js
export default function({ types: t }) {
  return {
    visitor: {
      StringLiteral(path) {
        throw path.buildCodeFrameError("Error message here");
      }
    }
  };
}
```

## 六。构建节点

在编写转换时，往往需要构建一些要插入的节点进`AST`。可以使用`babel-types`包中的`builder`方法来简化操作。

构建器的方法名称就是我们想要的节点类型的名称，除了首字母小写。例如想建立一个`Identifier`则可以使用`t.identifier(...)`。这些构建器的参数由节点定义决定。

这里正好再复习一下节点定义的形式：

```js
defineType("MemberExpression", {
  builder: ["object", "property", "computed"],
  visitor: ["object", "property"],
  aliases: ["Expression", "LVal"],
  fields: {
    object: {
      validate: assertNodeType("Expression")
    },
    property: {
      validate(node, key, val) {
        let expectedType = node.computed ? "Expression" : "Identifier";
        assertNodeType(expectedType)(node, key, val);
      }
    },
    computed: {
      default: false
    }
  }
});
```

这里附上[全部节点定义](https://github.com/babel/babel/tree/master/packages/babel-types/src/definitions)。

## 七、最佳实践

### 1.创建 构建器 和 校验器 辅助函数

将节点检验和节点类型抽离出来作为单独的函数。

```js
function isAssignment(node) {
  return node && node.operator === opts.operator + "=";
}

function buildAssignment(left, right) {
  return t.assignmentExpression("=", left, right);
}
```

### 2. 尽量避免遍历 `AST`

遍历`AST`是一项消耗巨大的任务，应尽量避免不必要的`AST`遍历。

### 3. 及时合并访问者

另外，如果合并后能子一次遍历中完成多个访问者的工作，那就将访问者合并到一起。

```js
path.traverse({
  Identifier(path) {
    // ...
  }
});

path.traverse({
  BinaryExpression(path) {
    // ...
  }
});
```

以上可以合并到一个`visitor`中：

```js
path.traverse({
  Identifier(path) {
    // ...
  },
  BinaryExpression(path) {
    // ...
  }
});
```

### 4. 优化嵌套的访问者对象

将访问者进行嵌套往往是有意义的，如下：

```js
const MyVisitor = {
  FunctionDeclaration(path) {
    path.traverse({
      Identifier(path) {
        // ...
      }
    });
  }
};
```

但是，每当调用`FunctionDeclaration()`时，都会创建一个新的访问者对象。因此，将该访问者保存在一个变量里进行复用，可以减少开销。

```js
const nestedVisitor = {
  Identifier(path) {
    // ...
  }
};

const MyVisitor = {
  FunctionDeclaration(path) {
    path.traverse(nestedVisitor);
  }
};
```

如果嵌套的访问者中需要一些状态:

```js
const MyVisitor = {
  FunctionDeclaration(path) {
    var exampleState = path.node.params[0].name;

    path.traverse({
      Identifier(path) {
        // 需要状态
        if (path.node.name === exampleState) {
          // ...
        }
      }
    });
  }
};
```

可以将状态通过`traverse`方法来传递，在内嵌的`visitor`中就可以通过`this`来访问：

```js
const nestedVisitor = {
  Identifier(path) {
    // 嵌套的visitor可以通过this来访问状态
    if (path.node.name === this.exampleState) {
      // ...
    }
  }
};

const MyVisitor = {
  FunctionDeclaration(path) {
    var exampleState = path.node.params[0].name;
    // traverse传递状态
    path.traverse(nestedVisitor, { exampleState });
  }
};
```

事实上，可以优化的点还有不少，例如结构嵌套、手动查找代替遍历等，以及对`Babel`插件进行单元测试等，就不在此展开了。掌握了这些知识，想必写出一个符合需要的`Babel`插件也不再是什么难事。