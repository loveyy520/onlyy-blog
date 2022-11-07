---
title: TypeScript系列 进阶篇 (五) Namespaces
date: "2022-03-14 17:11"
updated: "2022-03-14 17:11"
tags:
  - 前端
  - TypeScript
keywords:
  - 前端
  - TypeScript
  - TS
  - Namespace
categories:
  - 前端
  - TypeScript
abbrlink: 8b0527c7
---

在`TypeScript 1.5`之前的版本，有着内部模块`Internal modules`(使用`module { }`的形式来声明) 和外部模块`External modules`的概念。而从 1.5 版本开始，这两个概念的命名发生了变化。原本的`Internal modules`更改为`Namespaces`(命名空间)，声明方式也相应替换为了`namespace { }`，而`External modules`则更改为我们现在熟知的模块`Modules`。使用命名空间，可以自主定义对外可见/不可见的类型或值，能够极大地避免全局命名冲突的问题。我们使用`export`关键字来对外暴露相应的类型 / 值。

## 一、以官方提供的 `Validators`为例体验`Namespaces`

```typescript
namespace Validation {
  // 通过export暴露的类型/值，可在namespaace外部访问
  // 暴露一个interface，其包含一个方法签名
  export interface StringValidator {
    isAcceptable(s: string): boolean;
  }
  // 没有使用export来导出，只能在namespace内部访问
  const lettersRegexp = /^[A-Za-z]+$/;
  const numberRegexp = /^[0-9]+$/;
  // 暴露两个class
  export class LettersOnlyValidator implements StringValidator {
    isAcceptable(s: string) {
      return lettersRegexp.test(s);
    }
  }
  export class ZipCodeValidator implements StringValidator {
    isAcceptable(s: string) {
      return s.length === 5 && numberRegexp.test(s);
    }
  }
}
// 测试用例
let strings = ["Hello", "98052", "101"];
// 字符串索引签名，初始化变量
let validators: { [s: string]: Validation.StringValidator } = {};
// 添加两个属性，分别是一个validator实例
validators["ZIP code"] = new Validation.ZipCodeValidator();
validators["Letters only"] = new Validation.LettersOnlyValidator();

// 开始测试
for (let s of strings) {
  for (let name in validators) {
    console.log(
      `"${s}" - ${
        validators[name].isAcceptable(s) ? "matches" : "does not match"
      } ${name}`
    );
  }
}
```

一开始不理解为什么要使用命名空间，使用一个简简单单的`object`不好吗？直到读完官方给的示例，发现在`namespace`里面自由定义类型或值，不导出的内容就成了私有的内容，这种感受可钛上头了。

## 二、多文件命名空间

在之前的文章[TypeScript 系列 进阶篇：(三) 声明合并](https://juejin.cn/post/7073383136213598222)中，我介绍过关于`namespace`声明合并的相关内容，`namespace`的声明合并使多文件命名空间成为可能。我们知道，随着项目体积的增大，文件数量越来越多，`namespace`的内容也会越来越大，将所有内容写在一个`namespace`文件中，显然不太明智，因此，随之产生了命名空间的跨文件问题。TS 支持将同一个`namespace`拆分到多个文件中，而能够保持犹如在同一个文件中定义时的相同的用法。当然，这需要在文件的开头使用 **三斜杠指令** `/// <reference path="xxx" />`来指定路径，告诉编译器文件之间的依赖关系，注意 **三斜杠指令应位于文件的开头**，关于三斜杠指令的细节，如果有时间我会另出一篇来介绍，本文只关注`namespace`的内容。下面继续以官方的示例来演示，将上面的`validator`的栗子拆分到多个文件中。

- 首先，**拆分 Base 部分**，在`validation.ts`中定义基础命名空间`Validation`：

```typescript
// validation.ts
namespace Validation {
  export interface StringValidator {
    isAcceptable(X: string): boolean;
  }
}
```

- **拆分仅限字母的校验器部分**：在`lettersOnlyValidator.ts`中，在**文件开头**使用三斜杠指令引入`validation.ts`并随后进行声明合并：

```typescript
// 使用三斜杠指令来引入Validation.ts
/// <reference path="Validation.ts" />

// // 扩充Validation.ts
namespace Validation {
  // 私有成员，仅在当前namaspace中可见，
  // 外部甚至是其它同名的namespace中都不可见
  const lettersRegexp = /^[A-Za-z]+$/;
  // 导出共享成员
  export class LettersOnlyValidator implements StringValidator {
    isAcceptable(s: string) {
      return lettersRegexp.test(s);
    }
  }
}
```

- **继续扩充**：在`ZipCodeValidator.ts`中，在文件开头通过 **三斜杠指令** 来引入`Validation.ts`：

```typescript
// ZipCodeValidator.ts
/// <reference path="Validation.ts" />
namespace Validation {
  const numberRegexp = /^[0-9]+$/;
  export class ZipCodeValidator implements StringValidator {
    isAcceptable(s: string) {
      return s.length === 5 && numberRegexp.test(s);
    }
  }
}
```

现在我们的命名空间`Validation`已经合并好了，但是需要注意，当我们在其它文件中使用相应的导出成员时，依然要使用 **三斜杠指令** 来引入相关的`namespace`文件，如在测试文件`test.ts`中：

```typescript
// test.ts
// 使用三斜杠指令来引入相关的namespace文件
/// <reference path="Validation.ts" />
/// <reference path="LettersOnlyValidator.ts" />
/// <reference path="ZipCodeValidator.ts" />

// 以下用法和在最开始没有拆分使相同
// 测试用例
let strings = ["Hello", "98052", "101"];
// 变量声明，索引签名
let validators: { [s: string]: Validation.StringValidator } = {};
// 添加validator实例
validators["ZIP code"] = new Validation.ZipCodeValidator();
validators["Letters only"] = new Validation.LettersOnlyValidator();

// 开始测试
for (let s of strings) {
  for (let name in validators) {
    console.log(
      `"${s}" - ${
        validators[name].isAcceptable(s) ? "matches" : "does not match"
      } ${name}`
    );
  }
}
```

可见，我们把一个混乱的`namespace`按功能点拆分到不同的文件中，但是除了需要使用三斜杠指令来引入之外，依然保持使用方法不变，后期维护的话就方便多啦！

当然，现在涉及到了多个文件，因此，我们需要确保所有被编译的代码都被加载。这里主要有两种方式：

- 单文件输出：

  通过配置`outputFile`项来使指定的文件（包含其依赖文件）被编译输出为单个`js`文件。

  ```shell
  npx tsc --outFile sample.js test.ts
  ```

  如上，该命令会将`test.ts`文件以及其通过三斜杠指令引入的三个文件，按引入顺序来编译输出在一个`sample.js`文件中，如此一来当`test.ts`加载时，便可确保所有被编译的代码都被加载。我们也可以手动列举相应要编译输出的文件，但是显然会更麻烦：

  ```typescript
  npx tsc --outFile sample.js Validation.ts LettersOnlyValidator.ts ZipCodeValidator.ts Test.ts
  ```

  事实上，在现代羡慕中，我们多半使用`vue`或`react`等框架，在这些项目的配置文件中，往往都已经帮我们配置好了输出为单个`js`文件。

- 多文件输出：

  多文件输出为默认选项。使每个被编译的文件都单独输出一个相应的`js`文件。这时，我们就需要在相应的`html`文件中，**按照顺序**使用`<script src="..."></script>`来引入相应的`js`文件。

  ```html
  <script src="Validation.js" type="text/javascript" /></script>
  <script src="LettersOnlyValidator.js" type="text/javascript" /></script>
  <script src="ZipCodeValidator.js" type="text/javascript" /></script>
  <script src="Test.js" type="text/javascript" /></script>
  ```

## 三、别名

可能你也注意到，我们在外部访问命名空间内暴露的成员时，需要带上命名空间本身的名字，尽管现代编辑器很只能，但我们仍然希望有更简单的写法。好在，TS 给我们提供了一种语法，`import newName = X.y.z`来为命名空间暴露的成员起一个别名。**注意，这不要和模块的导入语法`import q = require(X)`相混淆，这俩不是同一个东西。命名空间的`import newName = X.y.x`只是单纯地给命名空间的成员起一个别名而已**。

```typescript
// 官方示例的第一个嵌套namespace
namespace Shapes {
  const age = 18;
  export const getAge = () => age;
  export namespace Polygons {
    export class Triangle {}
    export class Square {}
  }
}
// 可以给一般成员起别名
import age = Shapes.getAge;
// 也可以给嵌套的namespace起别名
import polygons = Shapes.Polygons;
let sq = new polygons.Square(); // 和 'new Shapes.Polygons.Square()' 一样
```

## 四、环境命名空间 `Ambient Namespaces`

这部分内容先挖个坑，因为涉及到 **环境** **`ambient`**，我们通常吧那些没有定义实现的声明，叫做 **`ambient`**，这些声明往往出现在 `.d.ts`拓展名的文件中 (决定了，下一期就讲这个)。我们知道，有些库并不是用`TS`写的，而是用的`JS`，因此，我们需要声明这些库暴露的`API`。而大多数`JS`库所暴露的都是一个顶级的`object`，所以很适合使用`namespace`来表示。下面以 `D3`这个库为例演示在环境命名空间中定义第三方库的形状：

```typescript
// 注意 '环境' 的声明都需要添加declare关键字
// 声明没有定义实现的接口
declare namespace D3 {
  export interface Selectors {
    select: {
      (selector: string): Selection;
      (element: EventTarget): Selection;
    };
  }
  export interface Event {
    x: number;
    y: number;
  }
  export interface Base extends Selectors {
    event: Event;
  }
}
// 声明没有分配的值
declare var d3: D3.Base;
```

环境命名空间看得云里雾里？没关系，下一篇，风里雨里，**声明文件** 里等你！
