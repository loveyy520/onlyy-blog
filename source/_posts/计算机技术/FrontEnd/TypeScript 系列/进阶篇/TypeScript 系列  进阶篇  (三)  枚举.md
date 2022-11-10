---
title: TypeScript 系列  进阶篇  (三)  枚举
date: "2022-03-10 21:42"
updated: "2022-03-10 21:42"
tags:
  - 前 端
  - TypeScript
keywords:
  - 前端
  - TypeScript
  - TS
  - 类型
categories:
  - 前端
abbrlink: f79f4b48
---

枚举通过关键字 `enum` 来声明，会同时得到一个类型和一个同名的值，该值为一组命名了的常量。`TS`提供了基于数字和基于字符串的枚举，当然，这本该是基础篇的内容...

## 一、数字枚举

我们使用关键字 `enum` 来声明一个枚举。当我们不给初值时，就会自动初始化，值依次从 `0` 开始递增。

```typescript
enum Direction {
  Up,
  Down,
  Left,
  Right,
}

/*
Direction.Up = 0
Direction.Down = 1
Direction.Left = 2
Direction.Right = 3
*/
```

如果我们初始化了某属性的数值，紧随其后的其它属性的数值则会根据 步长为`1` 的递增/递减 自动推算。

```typescript
enum Direction {
  Up = 1,
  Down,
  Left,
  Right,
}

/*
Direction.Up = 1
Direction.Down = 2
Direction.Left = 3
Direction.Right = 4
*/
```

枚举的使用也很简单。我们知道，声明枚举既得到值，也得到一个同名的类型。我们只需要通过属性来访问枚举内部的值，也能通过枚举的名字来作为类型使用。

```typescript
enum UserResponse {
  No = 0,
  Yes = 1,
}

function respond(
  recipient: string,
  /*作为类型使用*/ message: UserResponse
): void {
  // ...
}

// 作为值使用
respond("Princess Caroline", UserResponse.Yes);
```

此外，枚举成员也能混用计算属性和数字 (当然，还有字符串)，但需要注意：

- 枚举的第一个成员，如果没有初始化值，则被自动赋予数值 **`0`** ；
- 枚举的其它成员，如果紧随一个数值成员之后，则他们的值会依次递增 **`1`** ；
- 枚举的其它成员，如果不是紧随数值成员之后，则需要初始化其值(数值、字符串或计算属性)；

## 二、字符串枚举

字符串枚举的成员，必须用 string 类型的字面量，或者其它枚举的成员来进行值的初始化。字符串枚举没有自增行为，因此，在我们为其初始化一个有意义的 string 类型的字面量之后，在调试中将会比数子枚举更加友好。

```typescript
enum Direction {
  Up = "UP",
  Down = "DOWN",
  Left = "LEFT",
  // 报错，Right必须有一个初始化的值
  Right,
}
```

## 三、异构枚举

将数字和字符串混合使用，即为异构枚举。但是，与这个听起来好像很高端的名字不一样，使用异构枚举往往没有声明对我们写代码没有什么帮助，建议避免这种写法。

```typescript
enum BooleanLikeHeterogeneousEnum {
  No = 0,
  Yes = "YES",
}
```

## 四、计算属性成员和常量成员

我们使用常量枚举表达式来初始化枚举的成员。符合以下条件的都是常量枚举表达式：

1. 字面量枚举表达式；
2. 对已经定义好的枚举成员的引用(可以是自身的成员，也可以是其它枚举的成员)；
3. 带括号的常量枚举表达式；
4. 使用 + 、- 、~ 等一元运算符来操作的常量表达式；
5. `+`, `-`, `*`, `/`, `%`, `<<`, `>>`, `>>>`, `&`, `|`, `^` 等二元运算符来操作的常量表达式

如果常量枚举表达式发生运行时错误，则其值会变为`NaN`或者 `Infinity` 。其它的所有情况下，枚举成员都被认为是计算属性成员。

```typescript
enum FileAccess {
  // 常量成员
  None,
  Read = 1 << 1,
  Write = 1 << 2,
  ReadWrite = Read | Write,
  // 计算属性成员
  G = "123".length,
}
```

## 五、<mark>联合枚举</mark> 和 枚举成员的类型

**字面量枚举成员**：

- 任何的字符串字面量，如`"cc"`，`"age`"等；
- 任何的数值字面量，如 `1` ，`99` 等；
- 任何一元运算符操作的数值字面量，如 `-100` 等。

当一个枚举的所有成员都是字面量枚举成员时，**则<mark>枚举成员</mark>也会成为一个类型**。

```typescript
enum ShapeKind {
  Circle,
  Square,
}

interface Circle {
  // 枚举成员ShapeKind.Circle也用作类型
  kind: ShapeKind.Circle;
  radius: number;
}

interface Square {
  // 枚举成员ShapeKind.Square也用作类型
  kind: ShapeKind.Square;
  sideLength: number;
}

let c: Circle = {
  // 错误，Circle类型中，kind字段只能是ShapeKind.Circle类型
  kind: ShapeKind.Square,
  radius: 100,
};
```

当一个枚举的所有成员都是字面量枚举成员时，**则该枚举本身作为类型，等价于所有枚举成员的联合**。

```typescript
enum E {
  Foo,
  Bar,
}

function f(x: E) {
  if (x !== E.Foo || x !== E.Bar) {
    // 这个条件永远是true
  }
}
```

## 六、运行时 与 编译时 的 枚举

### 1. 运行时的枚举是一个真实的对象。

### 2. 编译时的枚举有如下特性：

- **<mark>反向映射</mark>**

  在典型的对象中，我们通常使用属性名来获取值，这是从 key 到 value 的正向映射。然而在枚举中，我们也可以通过值来获取属性名，这便是反向映射。**<mark>只有数字枚举才会有反向映射</mark>**。

  ```typescript
  enum E {
    age = 18,
  }

  const a = E.age; // 18
  const keyOfcc = E[a]; // "age"，反向映射
  ```

- **<mark>常量枚举</mark>**

  常量枚举的成员只能使用常量枚举表达式，且它们在编译期间会被完全删除。如下：

  ```typescript
  const enum Direction {
    Up,
    Down,
    Left,
    Right,
  }

  let directions = [
    Direction.Up,
    Direction.Down,
    Direction.Left,
    Direction.Right,
  ];
  ```

  在编译之后，生成的代码中，该枚举会被删除，替换为相应的常量，生成如下代码：

  ```
  "use strict";
  let directions = [
      0 /* Up */,
      1 /* Down */,
      2 /* Left */,
      3 /* Right */,
  ];
  ```

- **<mark>常量枚举陷阱</mark>**

  陷阱就不提了，涉及到一些我目前的这些文章中没提到的概念。不够官方文档提供了两条解决办法。

  1. 完全不使用常量枚举。这可以解决陷阱问题，但是完全禁止了常量枚举的使用，对我们的项目并不友好；

  2. 不发布环境常量枚举，据说 TS 项目内部就是这么做的。

## 七、环境枚举

环境枚举用于描述一个已经存在的枚举的形状。与常规枚举不同的是，环境枚举的所有没有初始化的成员会被 TS 认为是计算属性成员。

```typescript
declare enum Enum {
  A = 1,
  B,
  C = 2,
}
```

## 八、枚举 vs 对象

本来还在开开心心学枚举，直到看到官网上这么一句话：在现代`TypeScript`中，我们或许不太需要枚举类型，因为可以通过对一个对象使用常量断言 `as const`来替代枚举。甚至用对象的方式可能会更好，因为更贴近`JS`语言习惯。？？？所以我花了大半天时间在官方文档上看枚举是为了啥？？？不管怎么样，还是把栗子搬过来：

```typescript
const enum EDirection {
  Up,
  Down,
  Left,
  Right,
}

const ODirection = {
  Up: 0,
  Down: 1,
  Left: 2,
  Right: 3,
} as const;

EDirection.Up; // 0
ODirection.Up; // 0
```

行吧，枚举咱就学到这里了，下一期我们来学习 `namespace`，也许吧。下一篇再见！
