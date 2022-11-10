---
title: TypeScript系列  进阶篇(八)  TS模块进阶
date: "2022-03-28 18:02"
updated: "2022-03-28 18:02"
tags:
  - 前 端
  - TypeScript
keywords:
  - 前端
  - TypeScript
  - TS
  - Namespace
categories:
  - 前端
abbrlink: 2ebbd151
---

模块有自己的作用域，除非进行某种形式的导出，否则，其中的变量，函数，类等都是对外不可见的。相应的，如果要在模块外使用其导出的成员，则需要进行相应的导入。模块的相互导入需要使用 **模块加载器** ，模块加载器在执行模块之前，会先定位并执行该模块的依赖项。`JS`中主要使用`Node.js`的`CommonJs`模块加载器和`Web`应用程序中的`AMD`模块的`RequireJs`加载器。TS 延用了`ES2015`模块化方案，任何包含了顶层的`import`或`export`语句的文件，便是一个模块；相反，没有在顶层包含这些语句的则是脚本，其内容在全局作用域中可见。

[toc]

## 一、导出

### 1. 导出一个声明

任何声明 (变量、函数、类、类型等) 都可以使用`export`关键字来导出。

```typescript
export let a = 1;
export const b = { a: 2 };
export function cc() {}
export class CC {}
export type A = string | number;
export interface Z {
  name: string;
}
// 导出命名空间
export namespace N {
  let a = 2;
  export const b = { a: "namespace" };
}
// 导出枚举
export enum E {
  a,
  b,
  c,
}
```

### 2. 导出语句

注意导出语句和导出一个声明的区别。导出声明是某个值、类型或命名空间在声明的时候被导出，导出语句是在其声明之后才导出。导出语句中可以使用`as`进行重命名，以方便使用。

```typescript
interface Person {
  name: string;
  age: number;
}
const cc: Person = {
  name: "cc",
  age: 18,
};
export { cc };
export { Person as P };
```

### 3. 重导出

一个模块可以在其它的模块文件中进行重导出。模块常常会对其它的模块进行拓展，并暴露部分其它模块的特性。重导出并不用在本地导入其它模块，也不用引入局部变量。

```typescript
// moduleA.ts
export class A {
  name: "cc";
}
export const age = 18;

// 以同目录下的moduleB.ts为例：
export { A } from "./moduleA"; // 在moduleB中重导出moduleA中的A
export * from "./moduleA"; // 在moduleB中重导出moduleA中所有的成员
export * as B from "./moduleA"; // 在moduleB中重导出moduleA的所有成员，并重命名为N

// 演示app.ts对应的导入方式
// 可以从moduleA中导入
import { A } from "./moduleA";
// 可以从moduleB中导入，且分别对应以上重导出方式
import { A } from "./moduleB"; // 只能导入A，因为只重导出了A
import { A, age } from "./moduleB"; // 可以从moduleB中导入moduleA的所有成员，因为导出了*
import { N } from "./moduleB"; // 重导出时，重命名为N，因此只能导入N，通过N.A和N.age来访问
```

也可以通过以上语法来在一个模块中重导出多个其它模块，从某种意义上来说，就是把多个模块的内容整合到这个模块中。

```typescript
// moduleC.ts
export { A } from "./moduleA";
export * as B from "./moduleB";
export * from "./moduleD";
export { D as C } from "./moduleD";
```

### 4. 默认导出

每个模块都可以选择性地导出一个默认项，可以是值、类型或者命名空间，当然，每个模块也只能有一个默认导出项。默认导出项会被`default`关键字标记，相应的，使用一种不同的导入形式。

```typescript
// Module.ts
export default 123;

// app.ts
import number from "Module";
number; // 123
```

**函数和类可以在声明时直接导出为默认项**。

```typescript
// Func.ts
export default function getName() {
  // ...
}

// Class.ts
export default class Person {
  name: "cc";
}

// 相应地，在app.ts中导入
// 导入时名字可以随意取
import getName from "Func";
import P from "Class";
getName();
const cc = new P();
```

也可以不通过名字而直接导出值：

```typescript
export default "cc";
```

## 二、导入

### 1. 导入单个 从模块导出的成员

十分简单：

```typescript
import { N } from "./moduleB";
```

可以使用`as`来重命名：

```typescript
export { D as C } from "./moduleD";
```

### 2. 导入整个模块，并存储到一个变量中，并通过该变量来访问

使用`import * as m from "Module"`语法，来导入整个`Module`，并存储到变量`m`中，之后可通过`m`来访问模块内容。

```typescript
import * as m from "Module";
// 访问Module中导出的setName函数
m.setName("cc");
```

### 3. 导入副作用模块

副作用模块，往往会设置一些全局变量，无需导出，即可供其它模块使用。一般不会用到其导出成员，因此导出空对象`export { }`即可。副作用模块中的代码，在导入的地方执行。一般来说，**不推荐使用副作用模块**。

```typescript
import "side-effect-module";
```

### 4. 导入类型

在 TS 3.8 版本以前，只能通过`import`来导入类型。但是在此之后，可以通过`import type`来明确导入类型。

```typescript
import { PropType } from "Types";
import type { PersonType, FoodType } from "Interfaces";
```

也可以和值或者命名空间混合导入。

```typescript
import { names, type Names } from "moduleName";
```

### 5. `export = xxx`和`import xx = require()`

`CommonJs`和`AMD`都有一个`exports`对象，其包含了一个模块的所有导出项，也支持使用一个自定义的单个对象来替换导出对象。默认导出旨在替代此行为。然而不幸的是，`CommonJs`和`AMD`两者在这方面不兼容。TS 支持**使用`export = `**来兼容二者，该语法从模块中导出一个单个对象，可以是类，函数，命名空间，枚举，接口等。相应地，**需要使用`import xx = require()`来导入**。

```typescript
// Person.ts
class Person {
  name: "cc";
}
export = Person;

// app.ts
const cc = new Person();
cc.name; // "cc"
```

## 三、模块代码生成

在编译时，TS 编译器会根据确定的模块的种类来生成`ES6`，`CommonJs`，`SystemJs`，`AMD`，`UMD`等对应的模块代码。如下通过官方的示例，演示 TS 模块中导入和导出被编译成各种模块化方案时对应的代码。如果想进一步了解 `define`, `require` 和 `register`等函数，可以去查阅各个模块化方案的文档。

**`simpleModule.ts`**

```typescript
import m = require("mod");
export let t = m.something + 1;
```

**`AMD / RequireJS SimpleModule.js`**

```typescript
define(["require", "exports", "./mod"], function (require, exports, mod_1) {
  exports.t = mod_1.something + 1;
});
```

**`CommonJS / Node SimpleModule.js`**

```typescript
var mod_1 = require("./mod");
exports.t = mod_1.something + 1;
```

**`UMD SimpleModule.js`**

```typescript
(function (factory) {
  if (typeof module === "object" && typeof module.exports === "object") {
    var v = factory(require, exports);
    if (v !== undefined) module.exports = v;
  } else if (typeof define === "function" && define.amd) {
    define(["require", "exports", "./mod"], factory);
  }
})(function (require, exports) {
  var mod_1 = require("./mod");
  exports.t = mod_1.something + 1;
});
```

**`System SimpleModule.js`**

```typescript
System.register(["./mod"], function (exports_1) {
  var mod_1;
  var t;
  return {
    setters: [
      function (mod_1_1) {
        mod_1 = mod_1_1;
      },
    ],
    execute: function () {
      exports_1("t", (t = mod_1.something + 1));
    },
  };
});
```

**`Native ECMAScript 2015 modules SimpleModule.js`**

```typescript
import { something } from "./mod";
export var t = something + 1;
```

## 四、可选的模块加载 与 高级模块加载场景

有的情况下，我们只想在特定条件下加载某些模块，即 **动态模块加载** ，这也是一个不错的性能优化。我们可以使用`typeof`操作符来维护类型安全，在类型上下文中，`typeof`会得到一个值的类型，在这种情况下，得到的便是模块的类型。

**`CommonJs`的动态模块加载**：

```typescript
declare function require(moduleName: string): any;
import { ZipCodeValidator as Zip } from "./ZipCodeValidator";
if (needZipValidation) {
  let ZipCodeValidator: typeof Zip = require("./ZipCodeValidator");
  let validator = new ZipCodeValidator();
  if (validator.isAcceptable("...")) {
    /* ... */
  }
}
```

**`AMD`动态模块加载**：

```typescript
declare function require(
  moduleNames: string[],
  onLoad: (...args: any[]) => void
): void;
import * as Zip from "./ZipCodeValidator";
if (needZipValidation) {
  require(["./ZipCodeValidator"], (ZipCodeValidator: typeof Zip) => {
    let validator = new ZipCodeValidator.ZipCodeValidator();
    if (validator.isAcceptable("...")) {
      /* ... */
    }
  });
}
```

**`SystemJs`动态模块加载**：

```typescript
declare const System: any;
import { ZipCodeValidator as Zip } from "./ZipCodeValidator";
if (needZipValidation) {
  System.import("./ZipCodeValidator").then((ZipCodeValidator: typeof Zip) => {
    var x = new ZipCodeValidator();
    if (x.isAcceptable("...")) {
      /* ... */
    }
  });
}
```

## 五、在其它`JS`库中使用模块

有些不是用 TS 来写的库，我们需要声明它们暴露出来的`API`来描述库的形状。未定义实现的声明称为环境`ambient`，通常写在`.d.ts`文件中。

### 1. 环境模块

在`Node.js`中，许多任务都是通过各个模块来完成的，我们可以使用顶层的到处声明在各自的`.d.ts`文件中定义每个模块，不够，更方便的是将它们都写在一个更大的`.d.ts`文件里。因此，我们可以使用环境命名空间的构造，但是使用`module`关键字以及带引号的模块名，这些模块名用于后续的导入。

**简化的`node.d.ts`**

```typescript
declare module "url" {
  export interface Url {
    protocol?: string;
    hostname?: string;
    pathname?: string;
  }
  export function parse(
    urlStr: string,
    parseQueryString?,
    slashesDenoteHost?
  ): Url;
}
declare module "path" {
  export function normalize(p: string): string;
  export function join(...paths: any[]): string;
  export var sep: string;
}
```

随后便可以使用三斜杠指令`/// <reference path="node.d.ts"/>`来引入，并使用`import url = require("url");`或`import * as URL from "url"`来加载相应模块。

```typescript
/// <reference path="node.d.ts"/>
import * as URL from "url";
let myUrl = URL.parse("https://www.typescriptlang.org");
```

### 2. 环境模块速记

当我们不想在使用新的模块之前花时间去写模块声明时，可以使用速记声明（不推荐），此时，从该模块导入的成员的类型都是`any`。

```typescript
// decalarations.d.ts
declare module "hot-new-module";

// app.ts
import { A } from "hot-new-module"; // A 的类型为 any
```

### 3. 通配符`*`模块声明

`SystemJs`和`AMD`等，允许导入非`JavaScript`的内容。这些内容通常会使用前缀或后缀来表示相关的语义。因此，使用通配符模块声明救你很方便地涵盖这些情况。

```typescript
declare module "*!text" {
  const content: string;
  export default content;
}
// Some do it the other way around.
declare module "json!*" {
  const value: any;
  export default value;
}
```

上面的栗子中使用了`*!`，其中`*`为通配符，表示任意字符内容，`!`在此处用来分隔语义。之后，我们可以导入任何匹配`*!text`或`json!*`的内容。

```typescript
import fileContent from "./xyz.txt!text";
import data from "json!http://example.com/data.json";
console.log(data, fileContent);
```

### 4. `UMD`模块

有些库在设计时兼顾了多种模块加载器，或作为全局变量以在没有模块加载器时使用。这些就是我们熟知的`UMD`模块。这些库既可以通过某种形式的导入来使用，也可以直接通过其暴露的全局变量来使用。

如下使用了`export as namespace mathLib`(该语法可参考 [揭秘`.d.ts`与`declare`](https://juejin.cn/post/7078219615033098271#heading-26)) 来暴露一个全局变量`mathLib`，**在脚本中（注意，不是模块中）通过该变量可以访问模块成员**。

```typescript
// mathLib.d.ts
// 导出一个函数成员
export function isPrime(x: number): boolean;
// 定义一个全局变量mathLib
export as namespace mathLib;

// app1.ts
import { isPrime } from "math-lib";
isPrime(3);

// app2.ts
// 不导入，直接通过全局变量mathLib来使用
mathLib.isPrime(3);
```

## 六、结构化模块指南

### 1. 导出的内容尽可能地靠近顶层

在组织自己的模块的结构时，应考虑到用户体验。过多的嵌套会使得模块结构笨重。例如，导出命名空间就会使得模块有多层级的嵌套。导出一个含有静态方法的类也是如此，除非能明显地增强类的表现力，否则，我们应该考虑简单地导出一个辅助函数。

- 如果仅仅导出单个的`class`或者`function`时，使用默认导出`export default

- 如果导出多个成员，应尽量将它们放在顶层来导出

```typescript
export class SomeType {
  /* ... */
}
export function someFunc() {
  /* ... */
}
```

- 导入少量成员时，应显示地列出导入的名称

```typescript
import { SomeType, someFunc } from "./MyThings";
let x = new SomeType();
let y = someFunc();
```

- 导入大量成员时，最好使用命名空间导入模式`import * as Name from "Module"`

```typescript
// largeModule.ts
export class Dog { ... }
export class Cat { ... }
export class Tree { ... }
export class Flower { ... }

// app.ts
import * as LM from "largeModule"
const Wangcai = new LM.Dog()
const Kitty = new LM.Cat()
const rose = new Tree()
```

### 2. 使用 重导出 来进行模块拓展

有时候我们需要在模块上拓展功能。同名命名空间可以合并，但是模块不会。因此，通常的做法是，不修改模块原有的内容，而是重新导出一个具有新的功能的实体，可以使用`as`来重命名为原模块名。

那么，这里再次借用一下官网的栗子（原本是自己写了个示例的，结果看来官网的之后，感觉自己写的太烂了），一个`Caculator.ts`的计算器模块，导出一个`Caculator`类以及一个`test`辅助函数。

```typescript
export class Calculator {
  private current = 0;
  private memory = 0;
  private operator: string;
  // 读取一个输入字符串中的数字
  protected processDigit(digit: string, currentValue: number) {
    if (digit >= "0" && digit <= "9") {
      return currentValue * 10 + (digit.charCodeAt(0) - "0".charCodeAt(0));
    }
  }
  // 读取输入字符串中的一个操作符
  protected processOperator(operator: string) {
    if (["+", "-", "*", "/"].indexOf(operator) >= 0) {
      return operator;
    }
  }
  // 计算操作
  protected evaluateOperator(
    operator: string,
    left: number,
    right: number
  ): number {
    switch (this.operator) {
      case "+":
        return left + right;
      case "-":
        return left - right;
      case "*":
        return left * right;
      case "/":
        return left / right;
    }
  }
  // 计算
  private evaluate() {
    if (this.operator) {
      this.memory = this.evaluateOperator(
        this.operator,
        this.memory,
        this.current
      );
    } else {
      this.memory = this.current;
    }
    this.current = 0;
  }
  // 处理输入字符串中的单个字符
  public handleChar(char: string) {
    // = 号，则计算
    if (char === "=") {
      this.evaluate();
      return;
    } else {
      // 否则，先当作数字字符处理
      let value = this.processDigit(char, this.current);
      if (value !== undefined) {
        this.current = value;
        return;
      } else {
        // 不是数字字符，当作运算符处理
        let value = this.processOperator(char);
        if (value !== undefined) {
          this.evaluate();
          this.operator = value;
          return;
        }
      }
    }
    // 也不是运算符，抛出错误
    throw new Error(`Unsupported input: '${char}'`);
  }
  // 获取计算结果
  public getResult() {
    return this.memory;
  }
}
// 辅助函数用于测试
export function test(c: Calculator, input: string) {
  for (let i = 0; i < input.length; i++) {
    c.handleChar(input[i]);
  }
  console.log(`result of '${input}' is '${c.getResult()}'`);
}
```

再来看一下这个`Caculator`的使用示例：

```typescript
import { Calculator, test } from "./Calculator";
let c = new Calculator();
test(c, "1+2*33/11="); // 控制台打印 9
```

可以看到，`Caculator`已经可以使用了。现在，在`ProgrammerCalculator.ts`对它进行拓展，使其支持十进制以外的其它进制：

```typescript
// ProgrammerCalculator.ts

// 先导入 Caculator
import { Calculator } from "./Calculator";
// 通过extends关键字来实现继承
class ProgrammerCalculator extends Calculator {
  // 进制数字
  static digits = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
  ];
  // public case 为参数属性
  constructor(public base: number) {
    super();
    const maxBase = ProgrammerCalculator.digits.length;
    if (base <= 0 || base > maxBase) {
      throw new Error(`base has to be within 0 to ${maxBase} inclusive.`);
    }
  }
  // 重写父类处理数字字符的方法
  protected processDigit(digit: string, currentValue: number) {
    if (ProgrammerCalculator.digits.indexOf(digit) >= 0) {
      return (
        currentValue * this.base + ProgrammerCalculator.digits.indexOf(digit)
      );
    }
  }
}
// 导出继承后的新的实体类，并重命名为 Caculator
export { ProgrammerCalculator as Calculator };
// 并且 重导出 原来Caculator模块中的辅助函数
export { test } from "./Calculator";
```

接下来测试一下拓展后的`Caculator`：

```typescript
import { Calculator, test } from "./ProgrammerCalculator";
// 二进制
let c = new Calculator(2);
test(c, "001+010="); // 控制台打印 3
```

### 3. 不要在模块中使用命名空间

模块有自己的作用域，只有导出的成员才具有对外可见性。我们应该尽量避免在模块中使用命名空间，尤其不要踩以下两条红线：

- 模块唯一的顶层导出是命名空间：` export namespace Foo { ... }`（应该移除`Foo`，并将其所有成员都上移一层）；
- 多个文件导出同名的命名空间：`export namespace Foo { ... }`，(这些命名空间`Foo`之间不会合并) 。

## 七、模块解析

学了这么久的模块，也许大家也像我一样，会好奇编译器是如何解析模块的。

### (一) 模块的 相对导入 VS 非相对导入

在我们导入模块时，根据模块路径的书写形式，分为 **相对导入** 和 **非相对导入** 。相对导入，顾名思义，就是使用相对路径来导入模块，包含`./`，`../`等表示相对路径的字符，如

- `import { getName } from "./Person"`;
- `import Person from "./Person"`;
- `import "./mod"`;

非相对导入，便是不包含`./`，`../`等表示路径的字符，如：

- `import { getName } from "Person"`；
- `import Person from "Person"`;
- `import "mod"`;

**相对导入是相对于当前文件来解析，且不能解析为环境模块声明**。我们自己的模块，应该使用相对导入。**非相对导入基于`baseUrl`或者路径映射来解析，可以解析为环境模块声明**。导入外部依赖时，应使用非相对导入。

### (二) 模块解析策略：`Classic` vs `Node`

模块解析策略有两种：`Classic`和`Node`。可以在`tsconfig.json`中设置`moduleResolution`字段来明确使用哪种策略，默认使用`Node`策略；或者在命令行指定`--module commonjs`，即为`Node`策略，如果`module`设置为其它的（如`amd`，`es2015`，`system`，`umd`等，则为`Classic`策略）。其中`node`策略最为常用，也最为推荐使用。

#### 1. `Classic`策略

现今阶段，`Node`策略是主流，而`Classic`策略主要是为了向后兼容而存在的。下面来看看`Classic`策略是如何解析 **相对导入** 和 **绝对导入** 的。

- **相对导入**

  相对导入是根据导入文件 (不是被导入文件) 来解析的。例如，在文件`/root/src/folder/app.ts`中进行导入：`import { getName } from "./Person"`，TS 就会依次查找如下文件作为模块`Person`的位置：

  - `/root/src/folder/Person.ts`;
  - `/root/src/folder/Person.d.ts`;

- **非相对导入**

  而对于非相对导入，编译器则会从包含该导入文件的目录开始，在目录树中进行查找。例如，在文件`/root/src/folder/app.ts`中进行导入：`import { getName } from "Person"`，TS 就会依次查找如下文件来作为模块`Person`的位置：

  - `/root/src/folder/Person.ts`;
  - `/root/src/folder/Person.d.ts`;
  - `/root/src/Person.ts`;
  - `/root/src/Person.d.ts`;
  - `/root/Person.ts`;
  - `/root/Person.d.ts`;
  - `/Person.ts`;
  - `/Person.d.ts`;

如果列举出的任何一个文件存在，则编译器能继续正常编译，否则，将会报错提示找不到相关模块。

#### 2. `Node`策略

`Node`策略是在运行时模仿`Node.js`的模块解析机制，因此叫做`Node`策略。一般来说，在`Node.js`中导入模块表现为调用`require`函数。给`require`函数传入 **相对路径** 或 **非相对路径** ，决定了导入是 **相对导入** 还是 **非相对导入** 。因此，在了解`Node`策略之前，我们先来看看**`Node.js`是如何进行模块解析**的，之后再来了解 TS 中的`Node`策略又是如何解析的。

- **相对路径解析**

  相对路径尤为简单。例如在文件`/root/src/app.js`中导入：`const p = require("./Person")`，则`Node.js`会查找如下文件来作为模块`Person`：

  1. 检查`/root/src/Person.js`是否存在，不存在则进行下一步查找；

  2. 查找`/root/src/Person`目录下是否有`package.json`，如果有，则查看`package.json`中的`main`字段对应的模块，在本例中，如果在`/root/src/Person/package.json`文件中含有`{ "main": "lib/mainModule.js" }`，则`Node.js`会将`Person`指向`/root/src/Person/lib/mainModule.js`；否则，进行第 3 步；
  3. 查找`/root/src/Person`目录下是否有`index.js`，如果存在`/root/src/Person/index.js`，则该文件会隐式地被当作`main`字段对应的模块。

- **非相对路径解析**

  非相对路径则完全不同。对于非相对路径导入，`Node.js`会在名为`node_modules`的特殊文件夹下进行查找。该文件夹可以与导入文件处于同一目录级下，也可以存在于更高的目录链中。例如，在文件`/root/src/app.js`中导入：`const p = require("Person")`，则`Node.js`会查找如下文件来作为模块`Person`：

  1. `/root/src/node_modules/Person.js`;
  2. `/root/src/node_modules/Person/package.json`中`main`字段对应的文件，`{"main": "/xx/xxx.js"}`，此时，`node.js`会将`Person`模块指向`/root/src/node_modules/Person/xx/xxx.js`;
  3. `/root/src/node_modules/Person/index.js`;
  4. `/root/node_modules/Person.js`，**（此步骤更换了查找目录）**；
  5. `/root/node_modules/Person/package.json`中`main`字段对应的文件，`{"main": "/xx/xxx.js"}`，此时，`node.js`会将`Person`模块指向`/root/node_modules/Person/xx/xxx.js`;
  6. `/root/node_modules/Person/index.js`;
  7. `/node_modules/Person.js`，**（此步骤更换了查找目录）**；
  8. `/node_modules/Person/package.json`中`main`字段对应的文件，`{"main": "/xx/xxx.js"}`，此时，`node.js`会将`Person`模块指向`/node_modules/Person/xx/xxx.js`;
  9. `/node_modules/Person/index.js`;

以上便是`Node.js`进行模块解析的简化步骤。下面来看看模仿了`Node.js`的 TS 的`Node`策略是如何解析模块的。`Node`策略会模仿`Node.js`的逻辑，来在编译时定位`TS`模块的位置。注意,**`TS`使用`Node`策略进行模块解析时，支持的文件拓展名有`.ts`，`.tsx`，`.d.ts`**。此外，**`TS`在`package.json`中使用`types`或`typings`字段**来替代`Node.js`中的`package.json`里的`main`字段，来指定模块文件的位置。

- **相对导入**

  还是以在`/root/src/app.ts`中导入：`import Person from "./Person"`为例，`TS`会依次尝试查找以下文件作为`Person`模块：

  1. `/root/src/Person.ts`;
  2. `/root/src/Person.tsx`;
  3. `/root/src/Person.d.ts`;
  4. 查看`/root/src/Person/package.json`中的`types`属性对应的模块文件;
  5. `/root/src/Person/index.ts`;
  6. `/root/src/Person/index.tsx`;
  7. `/root/src/Person/index.d.ts`;

注意顺序，依照`Node.js`的逻辑，是先查找`Person.js`，然后是`Person/package.json`，最后才是`Person/index.js`。

- **非相对导入**

  相似的，非相对导入会遵循`Node.js`的导入逻辑，若是在`/root/src/app.ts`中进行非相对导入：`import { getName } from "person"`，则编译器会依次查找如下文件作为`person`模块：

  - `/root/src/node_modules/person.ts`;
  - `/root/src/node_modules/person.tsx`;
  - `/root/src/node_modules/person.d.ts`;
  - `/root/src/node_modules/person/package.json`中的`types`字段对应的文件;
  - `/root/src/node_modules/@types/person.d.ts`; **注意是`@types`目录下**；
  - `/root/src/node_modules/person/index.ts`;
  - `/root/src/node_modules/person/index.d.ts`;
  - `/root/node_modules/person.ts`;
  - `/root/node_modules/person.tsx`;
  - `/root/node_modules/person.d.ts`;
  - `/root/node_modules/person/package.json`中的`types`字段对应的文件;
  - `/root/src/node_modules/@types/person.d.ts`; **注意是`@types`目录下**；
  - `/root/node_modules/person/index.ts`;
  - `/root/node_modules/person/index.d.ts`;
  - `/node_modules/person.ts`;
  - `/node_modules/person.tsx`;
  - `/node_modules/person.d.ts`;
  - `/node_modules/person/package.json`中的`types`字段对应的文件;
  - `/root/src/node_modules/@types/person.d.ts`; **注意是`@types`目录下**；
  - `/node_modules/person/index.ts`;
  - `/node_modules/person/index.d.ts`;

被这里列举出的数量吓到了吗？事实上它们是很有规律的哦！而且，上面只列举出来`node_modules/@types/xxx.d.ts`，但其实，这些还不是全部。编译器不仅仅查找`node_modules/@types`文件夹下`xxx.d.ts`文件，如果找不到该文件，依然会查找`node_modules/@types/person/package.json`中`types`字段对应的声明文件，以及`node_modules/@types/person/index.d.ts`。

### (三) 附加模块解析标志

项目源布局有时并不与输出布局相匹配。最终输出结果往往由许多的打包步骤生成，例如将`.ts`代码编译为`.js`代码、将不同的源位置的依赖拷贝到相同的单一输出位置。因此，往往会导致模块在运行时具有与定义它们的文件中的不同的名字，且在编译时模块的路径也很可能与它们的源路径不匹配。

好在，`TS`有一系列的附加标志，来告知编译器发生在源上的转换以及最终的输出结果。当然，编译器不会执行这些转换，只是利用这些信息来作为指导，从而将模块解析为其源文件。

#### 1. `baseUrl`

设置`baseUrl`从而告知编译器在哪里找到模块。所有非相对导入的模块，都被认为和`baseUrl`有关。`baseUrl`的值可以通过命令行来指定。当然，更常见更方便的是在`tsconfig.json`中设置。如果在`tsconfig.json`中设置的`baseUrl`的值是一个相对路径，则该相对路径是相对于`tsconfig.json`的位置。注意，**相对导入** 的模块，是不受`baseUrl`的影响的。

#### 2. `paths` 路径映射

有些时候，模块并不直接位于`baseUrl`下。此时可以使用`paths`属性来设置这些模块的路径映射。如下以`jquery`为例：

```json
{
  "compilerOptions": {
    "baseUrl": ".", // 当存在paths属性时，必须明确baseUrl
    "paths": {
      "jquery": ["node_modules/jquery/dist/jquery"] // paths时相对于baseUrl的
    }
  }
}
```

`paths`属性映射的实际路径是相对于`baseUrl`的，即实际路径会随着`baseUrl`改变。在上面的栗子中，`baseUrl`设置为当前目录`.`，则`jquery`的路径为`./node_modules/jquery/dist/jquery`。注意到**`paths`中每一项的值都可以是数组**，因此可以结合通配符`*`配置多个路径映射。

```json
{
  "compilerOptions": {
    "baseUrl": ".", // 当存在paths属性时，必须明确baseUrl
    "paths": {
      "*": ["*", "customModules/*"]
    }
  }
}
```

这里给`*`配置了两个路径，高速编译器可以在不同的路径下查找模块：

- 路径`*`表示使用原路径，不作任何改变，即在`/baseUrl`下查找模块；
- 路径`customModules/*`表示在`customModules`前缀的目录下，即`/baseUrl/customModules`下查找模块。

#### 3. `rootDirs` 虚拟目录

有的时候，在编译时会将来自多个项目源的组合在一起，生成一个单一的输出目录。可以将此看作一组目录源生成了一个虚拟目录。使用`rootDirs`来指定一组目录，在运行时将其放在单一的虚拟目录下，从而使得编译器可以解析这个虚拟目录中的模块，就像它们真的被合并到一个目录中一样。例如，对于以下目录结构：

— `src`

    — `views`

    	— `view1.ts` (文件内导入了模块：`import "./template1"`)

    	— `view2.ts`

— `generated`

    — `templates`

    	— `views`

    		— `template1.ts` (文件内导入了模块：`import "./view2"`)

在以上目录结构中，可以看到`view1.ts`和`template1.ts`分别以相对导入的方式，导入了和自己同一目录下的`template1.ts`和`view2.ts`，然而，与它们同级的目录下并没有相应的文件。此时，要使得这种路径相对关系成立，则需要配置`rootDirs`。

```json
{
  "compilerOptions": {
    "rootDirs": ["src/views", "generated/templates/views"]
  }
}
```

通过以上配置，则多个目录`src/views`和`generated/templates/views`会在运行时结合到同一虚拟目录下，从而其相互导入时需要使用同级目录相对路径`./`。每当编译器看到`rootDirs`里的某个子文件夹中有相对模块导入，便会在`rootDirs`下所有的子文件夹中逐个查找被导入的模块。此外，`rootDirs`中可以包含任意数量的任意目录名称，无论该目录是否存在。

#### 4. `traceResolution` 跟踪模块解析

前面说到，编译器在解析模块时，可以访问到当前文件夹以外的文件。这就导致我们很难判断为什么某个模块未能解析或者未能正确解析。于是，就该`traceResolution`出场啦。启用`traceResolution`会使编译器能够跟踪解析过程。在`tsconfig.json`中配置`{"compilerOptions": {"traceResolution": true}}`即可启用。之后在运行编译石控制台会打印出一系列的编译过程。

#### 5. 使用 `noResolve`

一般不会使用这个标志。一旦启用，则必须明确需要解析的模块，例如在命令行指定：

```shell
npx tsc app.ts moduleA.ts --noResolve
```

则编译器会解析 `moduleA`，但如果`app.ts`中还导入了其它模块，如`import Person from "modulePerson"`，则由于没有在命令行明确指定`modulePerson.ts`，而引发错误。

关于`TS`的模块，就分享到这里啦，至此我的`TS`进阶系列也进入尾声了，预计再写最终篇 **编译原理** ，之后就开始学习其它的知识啦。学习的时光总是辣么短暂，那么，如果有机会的话，下一篇再见吧。
