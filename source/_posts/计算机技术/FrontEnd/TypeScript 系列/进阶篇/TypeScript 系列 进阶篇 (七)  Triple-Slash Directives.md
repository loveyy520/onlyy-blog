---
title: TypeScript 系列 进阶篇 (六) Triple-Slash Directives
date: "2022-03-15 16:41"
updated: "2022-03-15 16:41"
tags:
  - 前端
  - TypeScript
keywords:
  - 前端
  - TypeScript
  - TS
  - 指令
categories:
  - 前端
  - TypeScript
abbrlink: ac0adb9b
---

上一篇介绍`namespace`多文件拆分的内容时，用到了一个三斜杠指令`/// <reference path="xxx" />`。这组指令有多个，其作用分别有所不同。有些同学还不是很了解这个语法，因而本文专门来介绍相关指令。

## 〇、注意事项

三斜杠指令是**包含一个`XML`单标签的单行三斜杠注释**，注释的内容可被编译器识别，用来指示编译器在编译的过程中包含其它文件，或者用作规定文件输出顺序的方法。使用三斜杠指令时需要注意：**只有出现在文件的开头才有效，否则将被当作没有特殊意义的普通注释**。这意味着，在三斜杠指令之前，只能有单行或多行注释的存在，当然也可以有其它的三斜杠指令，而不能有其它的语句或者声明。

## 一、`/// <reference path="..." />`

这是最常用的指令了，用来声明文件之间的依赖关系。

### 1. 预处理输入文件

编译器将所有的三斜杠指令通过预处理传递输入文件的方式来解析，在此过程中，其它的文件会被添加到编译中。这个过程会从一系列根文件，即通过命令行或者`tsconfig.json`中指定的文件，按照指定的顺序开始开始。在文件被添加到处理列表之前，会**按三斜杠指令在文件中出现的顺序**，遵循**深度优先**的的方式来进行解析。如果三斜杠指令使用了**相对路径，则是相对于包含文件的路径**。

### 2. 错误使用

以下做法会导致错误：

- 使用三斜杠指令来引入不存在的文件 (我们一般不会故意这么做，因此往往是路径不对)；
- 使用三斜杠指令来引入自身（自己引用自己，无限循环）。

### 3. 使用 `--noResolve` 标志

如果我们在命令行或者`tsconfig.json`中启用了`noResolve`，则三斜杠指令不会被解析，此时它们和普通的注释无异，不会产生任何特殊作用。因此，如果发现三斜杠指令不报错也不生效，可以试着检查`tsconfig.json`中的相应配置。

## 二、`/// <reference types="..." />`

与`/// <reference path="..." />`指令相似，`/// <reference types="..." />`用来声明对包的依赖。TS 对这些包名的解析也和对使用`import`语句的解析差不多，因此三斜杠指令也可以视为**声明包**的导入的一种简单方法。例如，当我们在文件开头使用了`/// <reference types="node" />`时，`node`包和声明文件就会被包含到编译中。该指令往往在手动编写`.d.ts`文件时才需要使用。而在编译过程中，编译器会自动为我们添加`/// <reference types="..." />`，当且仅当生成文件使用了来自引用包的声明时，才会在该文件中加入`/// <reference types="..." />`。

## 三、`/// <reference lib="..." />`

该指令让文件显示包含现有的内置库，基本上，依然是给声明文件的作者使用的。内置`lib`文件的引用方式与在`tsconfig.json`中的`lib`配置项一致 (例如应该写`lib="es2015"`，而不是`lib="lib.es2015.d.ts"`)。例如，在某个文件中使用指令`/// <reference lib="es2017.string" />`，等效于在命令行添加`--lib es2017.string`标志。

```typescript
/// <reference lib="es2017.string" />
"foo".padStart(4);
```

## 四、`/// <reference no-default-lib="true"/>`

这个指令会把文件标记为默认库，并高速编译器在编译时不包含默认库。在`lib.d.ts`文件及其不同的变体的顶部能看到这个指令。

## 五、`/// <amd-module />`

这个指令可以把`amd`模块的名称传递给编译器：

```typescript
// other.ts
///<amd-module name="NamedModule"/>
export class C {}
```

在编译中会把模块名称分配给`amd`的`define`函数来参与调用：

```typescript
// ModuleA.js
define("ModuleA", ["require", "exports"], function (require, exports) {
  var C = (function () {
    function C() {}
    return C;
  })();
  exports.C = C;
});
```

事实上，处理`/// <reference path="..." />`，其它的三斜杠指令大多数人平时都用不上，学有余力之时，简单了解一下有这些东西的存在吧。下一篇，真的要开始 **声明文件** 了 。
