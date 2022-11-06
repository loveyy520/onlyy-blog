---
layout: post
title: TS系列基础篇(一) TS类型指南
date: 2022-03-01 09:40
updated: 2022-03-01 09:40
keywords:
  - 前端
  - TypeScript
  - TS
  - 类型
tags:
  - TypeScript
  - 前端
archive: TypeScript
swiper_index: 10
---

# TS 系列基础篇(一) TS 类型指南

这段时间以来，TS 的发展可谓是如日中天，本想偷个懒去看看别人写的分享贴来学习，找了近十篇之后，发现要么是比较浅显，要么有些偏差，没有找到很满意的。于是决定去看[官方文档](https://www.typescriptlang.org/docs/handbook/declaration-files/consumption.html#consuming)。学习了一段时间后，准备写一个系列，从基础类型，对象，函数，模块等 TS 知识，到在`vue`、`react`中的应用，供有需要的同学们参考。其中，我套用了不少官方文档的示例，觉得我的学习经验不好或不正确的朋友，欢迎批评指正。

`TS`是`JS`的超集。在学 TS 之前，最好有一定的`JS`基础。本篇只介绍`typescript`的安装和各种基础类型。需要了解其它内容的同学可以看其它篇章或查阅官方文档。

[toc]

## (一)、安装与编译

想要使用`TS`，得先会安装。Typescript 需要`node`环境，确保你已经安装了`node`。如果还没有安装`node`，可以去[`Node.js`官网]([`Node.js`](https://nodejs.org/zh-cn/)下载，傻瓜式安装。

打开项目目录进行初始化：

```powershell
npm init -y
```

官方推荐了`npm`，`yarn`，`pnpm`三种工具，任选其一即可（`npm`工具为`node`自带的包管理工具，可自由使用；`yarn`或`pnpm`工具需要提前安装）。

```powershell
# with npm
npm install typescript --save-dev
# with yarn
yarn add typescript --dev
# with pnpm
pnpm add typescript -D
```

在安装 ts 时，编译工具`tsc`也会被自动安装。待安装完成，在项目根目录下新建一个`app.ts`。

```ts
// app.ts
const str = "app";
console.log(str.charAt(0));
```

即可通过以下任一方式运行`tsc`，编译成功后会在和`app.ts`同级目录下多出一个`app.js`文件。

```powershell
# 当前目录下的app.ts文件编译为app.js
# npm
npx tsc app.ts
# yarn
yarn tsc app.ts
# pnpm
pnpm tsc app.ts
```

`app.js`：

```js
const str = "app";
console.log(str.charAt(0));
```

这个`js`文件和`app.ts`看起来没有差别，这是因为我们没有在`app.ts`里没有进行类型约束。与类型的相关内容会在后面谈到。现在我们来让`app.ts`出一点“错误”，将`str`换成数组，编辑器会把错误代码用红色波浪线标出，如果此时在命令行运行`yarn tsc app.ts`，控制台便会报错。

```ts
// app.ts
const str = ["a", "p", "p"];
console.log(str.charAt(0)); // charAt会被
```

尽管如此，报错了的代码依旧会被编译成`js`文件。我们可以在`tsc`命令后加上编译的相关配置指令来进行控制。比如，加上**`--noEmitOnError`**之后，一旦报错便不会生成`js`文件。

```powershell
tsc --noEmitOnError hello.ts
```

但是 ts 的编译配置项非常多，如果每次都通过在命令行加入指令来进行相关控制，无疑非常繁琐。因此我们可以在**`tsconfig.json`**里编写相关配置，这样我们执行`tsc`命令时，编译器会默认从当前目录逐步向上层目录查找并读取`tsconfig.json`里的配置项。

## (二)、配置文件：`tsconfig.json`

在运行`tsc`命令时，我们可以在后面添加指令来指定相关配置。但是我们会更倾向于在`tsconfig.json`里对相关指令进行配置，以减少重复、繁琐的操作。在`Vue`、`React`等框架搭建的项目里，一般都已生成初步配置好了的`tsconfig.json`文件。本篇只进行解基础内容的分享，有关配置的章节将在后续推出。

## (三)、类型基础

这里介绍部分 TS 基础类型，关于类型的进阶将在后续篇章中单独介绍。注意不要将基础类型和 js 基本数据类型混为一谈。基础类型可以理解为 ts 内置的各种类型，而非我们人为定义出的类型。TS 有多种基础类型，这些类型可以用来进行组合，从而得到我们需要的人为定义的类型。TS 在声明变量时，在变量名后加上冒号<mark>: </mark>和类型名来进行变量的类型注释。如果不添加类型注释，则 TS 会根据变量的初始值进行<mark>**类型推论**</mark>，自动推断出该变量属于什么类型。如果也没有初始值，则会被推断为**any**类型。

### 1. 原有的基本数据类型

- **`string`**：字符串类型，注意`String`在`js`里已经有特殊意义了，而小写的`string`才是`Typescript`用来表示字符串的类型名称，即在注释变量类型为字符串时，使用小写的`string`，而不是大写的`String`，注意不要混淆了两者；`number`和`boolean`同理。
- **`number`**：数字类型；
- **`boolean`**：布尔类型；

  ```ts
  // 声明变量类型，可以不赋初值，后续给num赋的值必须是number类型
  let num: number;
  let str: string = "typescript";
  // 类型推断：TS会自动推断出bool的类型为boolean
  let bool = true;
  ```

### 2. `Array`

`Array`是数组类型，属于对象类型的一种。由于数组内会有数组成员，因此，在声明数组变量的时候，还要给数组成员添加类型注释，一般有两种常见方式：**`Type[]`**、**`Array<Type>`**。后者涉及**泛型**概念，将在后续介绍。其中，`Type`指代数组成员的类型，可以是基础类型，也可以是人为定义的类型 (关于数组的变形，元组类型，将在对象类型的章节介绍)。例如，要声明一个存放字符串的数组变量：

```ts
let arr1: string[];
// 也可以像下面
let arr2: Array<string>;
```

### 3. `object`

对象类型是我们平时更为常见的类型。在本篇只给出一些简单定义，后续篇章中会进行单独介绍。一个对象类型的变量可以通过键值对来存储多个数据。定义一个对象类型，可以简单地列出它的各个属性及属性的类型：

```ts
// 定义一个包含name, age, gender属性的变量obj
let obj: { name: string; age: number; gender: "gg" | "mm" };
```

之后给 obj 赋值时**必须有且只能有**`name`，`age`，`gender`三个属性，且属性值应为相应的类型。

```ts
// 会报错,多了一个beauty属性,因此类型不合
obj = { name: "yy", age: 22, gender: "mm", beauty: 100 };
// 报错，缺少了gender属性
obj = { name: "yy", age: 22 };
// 正确赋值
obj = { name: "yy", age: 22, gender: "mm" };
```

如果想要让某个属性变为可选项，则可以在定义对象类型时在属性名后使用问号"?"：

```ts
// 将gender定义为可选项
let obj: { name: string; age: number; gender?: "gg" | "mm" };

// 正确
obj = { name: "yy", age: 22, gender: "mm" };
// 也正确，因为gender是可选的
obj = { name: "yy", age: 22 };
```

在某个属性被定义为可选项之后，一旦给该对象赋值时，没有传入该属性，它的取值便会成为`undefined` (注意**这与一开始边定义`gender: 'gg' | 'mm' | undefined`不同**。)

使用可选项有些地方需要注意，如**在函数的形参中**存在可选项，此时由于`gender`属性可能为`undefined`，我们在使用时需要在该属性后面加上英文感叹号"`!`"进行**非空断言**，明确它不是`undefined`。

```ts
function fn(obj: { name: string; age: number; gender?: "gg" | "mm" }) {
  // 使用!进行非空断言
  obj.gender!.replace("", "");
}
```

### 4. `Union Types` 联合类型

`Union Types`是指使用 "`|`"符号来把多个类型联合成一个类型，一个联合类型的变量，其值可以是联合类型的任何一个子类型。

```ts
// 定义a为联合类型，则a可以是string类型也可以是number类型
let a: string | number;
// a可以是string
a = "union types";
// a也可以是number
a = 100;
```

在**函数的形参中**使用联合类型时有一些注意事项，如在上面的例子中，`a` 的类型是`string | number`，此时`a`无法调用字符串方法，因为`a`有可能是一个`number`；同理，也不能直接调用数字类型的方法。当然，也不能直接赋值给`string`类型的变量或者`number`类型的变量。

```ts
let a: string | number;
// a可以是string
a = "union types";

let b: string;
let c: number;
// 当开启了严格空值检查时，以下两次赋值都不合法
b = a;
c = a;
```

当然，如果每个子类型都具有共同的方法，则可以调用该共同的方法。例如：数组和字符串都具有`slice`方法，则联合类型`string | number[]` 的变量可以调用`slice`方法。

```ts
function func(obj: string | number[]) {
  // 可以直接调用slice方法
  const a = obj.slice();
}
```

### 5. `Type Alias` 类型别名

使用**`type`**关键字给你的类型起一个别名，以后就可以使用别名来指代这个类型。

```ts
type Point = {
  x: number;
  y: number;
};

type ID = number | string;

// 使用类型别名Point
let p: Point = {
  x: 123,
  y: 222,
};
```

### 6. Interfaces

通过关键字**`interface`**，来定义一个接口，实际是一个对象类型，用于规定一个对象的形状。

```ts
interface Point {
  x: number;
  y: number;
}

function printCoord(pt: Point) {
  console.log("The coordinate's x value is " + pt.x);
  console.log("The coordinate's y value is " + pt.y);
}

printCoord({ x: 100, y: 100 });
```

简单说说**`interface`与类型别名的区别**：

- `interface` 可以通过 **`extends`**关键字来**继承**另一个`interface`，而`type`通过 `&`符号来连接不同的对象属性；

```ts
interface Animal {
  name: string;
}

// 继承Animal接口
interface Dog extends Animal {
  skull: number;
}

// 继承了Animal接口的属性name
const dog: Dog = {
  skull: 10,
  name: "wangcai",
};

// 类型别名通过&符号来拓展属性
type Dog2 = Animal & {
  skull: number;
};
```

- `interface`可以进行拓展，`Type`不可以

```ts
interface Animal {
  name: string;
}

interface Dog extends Animal {
  skull: number;
}

// 拓展interface的内容
interface Dog {
  age: number;
}

// 此时Dog类型包含name,skull,age三个
const dog: Dog = {
  name: "wangcai",
  skull: 12,
  age: 2,
};

// 声明一个Dog2类型
type Dog2 = {
  skull: number;
};

// 会报错，Dog2重复了
type Dog2 = {
  name: string;
};
```

- `interface`定义对象的形状，`type`不仅可以用于对象，也可以用于其它类型

```ts
type TypeA = {
  name: string;
};

type TypeB = string | number;

type TypeC = TypeA | TypeB;
```

### 7. `Intersection Types` 交叉类型

用 `&` 符号来连接多个类型，属于交叉类型 `A & B` 的变量，既满足`A`的约束，又满足`B`的约束。

```ts
type TypeA = string | number;
type TypeB = Array<boolean> | number;
// TypeC既满足TypeA又满足TypeB，因此TypeC是number
type TypeC = TypeA & TypeB;
// a是number类型
let a: TypeC = 3;
// b是TypeA类型，它的值是个string，因此不能赋值给a
let b: TypeA = "123";
a = b; // 报错
```

也可以用来拓展对象类型的属性：

```ts
type A = {
  name: string;
};

type B = {
  age: number;
  gender: "男" | "女";
};
// 类型C是既满足A又满足B，即C既包含A的所有属性，又包含B的所有属性，
// 从而实现属性拓展
type C = A & B;

let c: C = {
  name: "cc",
  age: 18,
  gender: "男",
};
```

注意 **`&` 和 | 的区别**："`&`"可以合并多个对象类型的属性，使得到的新的对象类型包含其它所有类型的全部属性；"`&`"可以获得多个类型之间的公共子类型；"`|`"可以联合多个类型，得到的新类型的值，只需满足其中一种子类型即可。

### 8. `Literal Types` 字面量类型

通过字面量来定义类型，字面量的值可以是任意一个类型的值，可以将多个不同类型的字面量进行组合，此时得到的变量上的方法无法进行合法调用，因为变量可能为其它不含该方法的类型（与联合类型同理）。因此需要进行类型精简或类型断言。注意在变量声明时进行类型注释了的才能被字面量类型约束，如果没有类型注释，则会按照类型推论的结果来判定类型。

```ts
// 定义gender只能取值为 '男' 或 '女' 中的一种
let gender: "男" | "女" = "男";
// gender2经类型推论string类型
let gender2 = "男";
// 多种类型字面量的组合
let x: "未知数" | 1 | { y: 1 };
// 严格类型检查时不能合法调用
x.split("知") <
  // 进行类型断言后可合法
  string >
  x.split("知");
```

### 9. `null` 和 `undefined` 与 非空断言

两个空值类型，和在`js`里的区别一致。开启/关闭严格空值检查会影响到空值类型的行为。当我们知道一个变量不会为空时，可以在该变量后使用英文感叹号 "`!`" ，进行临时**非空断言 （`Non-null Assertion`）**。这点在函数中尤为重要。

```ts
type MyType = string | number | undefined;
let value: MyType = "I love China";
// 对value进行非空断言
value!.split(" ");
```

### 10. `Enums` 枚举类型

枚举类型是一组被有意义地命名了的常量的集合。与其它类型本质上不同的是，其它的类型都只是类型，而枚举类型却是可以使用的值。**通过`enum`关键字声明某个变量为枚举类型的值**，使用枚举类型，可以让我们不去关注变量实际的值，而使用更有意义的名字来代表实际的值。例如，在表示性别时，我们可以简单地用数字 1 和 2 来表示 男 和 女。那么在实际使用中，我们需要知道到底是 1 代表男还是 1 代表女。当数据从前端传到后端，后端的小伙伴又需要去了解哪个数字代表哪个性别。这对我们来说就不太友好。所以，我们可以使用枚举类型来定义一组表示性别的常量，之后使用时，只需取常量的名字即可。

```ts
enum Gender {
  male: 1,
  female: 2,
  secret: 3
}
```

枚举类型包括数字型枚举、字符串型枚举、异构枚举等等。此处只简要了解一下枚举类型的的存在，后续会写一篇枚举类型的深入。

### 11. `any`

`any`可以指代任何类型，可以被赋值给任意类型的变量。

```ts
// 给变量anyscript一个any类型，其值为数字123
let anyscript: any = 123;
// 给变量typescript一个string类型
let typescript: string = "typescript";

// 赋值操作后，typescript变成了123，其类型发生了改变
typescript = anyscript;

// 而编译器会认为typescript变量为string类型，且允许我们调用string类型的方法
typescript.split("c");
// 而事实上此时变量typescript的值已经变为了数字123，调用string的方法就会
```

这个看起来很便捷的`any`类型，在这种时候就会引发问题，造成类型污染。因此，我们应该避免使用`any`，以免走进`Anyscript`的误区。

### 12. `unknown`与类型断言

`unknown`用来表示未知类型，和`any`相似，它的值可以是任何类型。不同的是，如果一个变量是`unknown`类型，那么它在被明确为某个确切的类型之前，不能调用任何方法，也不能被赋值给其它变量。你可以使用<mark>**类型断言**</mark>来**临时**人为明确一个 unknown 变量的确切类型。毕竟**你永远比`Typescript`知道的多**！类型断言一般有两种方式：使用 `a as Type` 或者 在需要进行类型断言的变量前使用尖括号：`<Type>a`，来明确变量`a`为`Type`类型。注意类型断言是临时的，因此它不会改变原来`unknown`变量的类型。

```ts
// 声明一个unknown变量a，一个字符串变量b
let a: unknown = "I am unknown type";
let b: string;

// 这里会报错，因为a为unknown类型，而且并没有明确它的具体类型，
// 不能被赋值给字符串变量b，哪怕a本身实际的值为字符串
b = a;

// 使用类型断言来明确a的具体类型为字符串string，
// 之后便可以赋值给字符串b

// 使用as进行类型断言，可以用括号将其整体包裹起来，以进行对断言之后的变量a的操作
b = a as string;
b = (a as string) + "!";

// 也可以使用<Type>a的形式进行类型断言
b = <string>a;

// 之后 a 的类型依然是unknown
```

也许你会觉得使用`unknown`类型有些繁琐。但相比起`any`类型容易引发的错误，`unknown`类型的使用足够安全。因此，如果有需要使用不明确的类型时，应该首选`unknown`而不是`any`。毕竟谁也不愿意，一杯茶，一个圈，一个`BUG`改一天(甚至还在排查错误原因)。

### 13. `never` 和 `void`

`void`用于表示函数返回空值；`never`用于表示不该使用的值或者函数不应该有返回值，在我们平常的工作中`never`的应用场景较少。

### 14.不常用的类型

**`Bigint`和`Symbol`**是`ES6`之后加入的基本数据类型，目前在日常工作中的使用并不多见。`TS`中的这两种类型和`JS`中一致。

- **`bigint`**

  ```ts
  // 使用BigInt函数来创建一个bigint类型的变量
  const oneHundred: bigint = BigInt(100);

  // 使用字面量语法 数字 + n 来创建bigint类型的变量
  const anotherHundred: bigint = 100n;
  ```

- **`Symbol`**

  `Symbol`是`ES6`之后新增的一种基本数据类型，每个`Symbol`类型的变量，其值都是唯一的，即使传入相同的参数，返回的结果也永远不会相等。一般使用`Symbol`函数来创建。

  ```ts
  // 使用Symbol函数创建Symbol类型的变量/常量
  const first1 = Symbol("1");
  const first2 = Symbol("1");

  first1 === first2; // 永远是false
  ```

类型基础的内容就介绍到这里啦，下一篇将着重介绍在函数中使用各种类型时需要注意的问题，例如如何进行类型精确。如果文章描述有不妥之处，恳请不吝指出，我们下一篇再见！
