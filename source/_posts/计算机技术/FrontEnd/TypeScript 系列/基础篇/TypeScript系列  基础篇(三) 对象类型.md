---
title: TypeScript 系列基础篇(三) 对象类型
date: "2022-03-02 17:37"
updated: "2022-03-02 17:37"
keywords:
  - 前端
  - TypeScript
  - TS
  - 对象
tags:
  - TypeScript
  - 前 端
categories:
  - 前端
  - TypeScript
archive: TypeScript
abbrlink: 364db865
---

# TypeScript 系列基础篇(三) 对象类型

对象是我们组织数据的基本方式。除了常规的对象类型外，TS 还提供了**只读数组**、**元组**、**属性修饰符**、**索引签名**等知识体系。在前面的章节中，我们已经了解到了对象的基本使用。可以用**字面量**、**`interface`**、**`type alias`**来规定一个普通的对象类型。现在是时候了解一下常用的对象属性修饰符、类型拓展、索引签名和内置的特殊对象类型了。 还没有对象吗？那就赶紧`new`一个吧！

## 一、<mark>属性修饰符</mark>

利用属性修饰符，我们可以增强对象的属性的约束。

### 1. `?` 可选属性

可选属性我们在之前就已经有所了解。定义对象类型时，在属性名后面加上英文问号 "`?`" ，表示该属性可选。此后，该类型的对象里可以有这个属性，也可以没有。因此，该属性除了我们给它约束了的类型之外，还可能是`undefined`，从而引发某些问题。在之前的文章中提到过，这可以通过**真值校验**来进行类型缩减，或者给函数的形参设置默认值，从而解决。

```ts
// 其中gender为可选属性
interface Person {
  name: string;
  age: number;
  gender?: 1 | 2;
}
// 可以有全部属性
const cc: Person = {
  name: "cc",
  age: 18,
  gender: 2,
};

// 可以缺失可选属性
const yy: Person = {
  name: "yy",
  age: 18,
};
```

### 2. `readonly` 只读属性

在对象的某个或某些属性前加上关键字 **`readonly`**，可以设置该属性为只读属性。**对象的只读属性在`TS`里一般不允许被重新赋值**。只读属性不意味着完全不能修改。如果只读属性是一个对象类型，那我们可以修改它里面的成员。

```ts
// id为只读属性，不允许重新赋值
interface Person {
  name: string;
  age: number;
  readonly idInfo: {
    id: string;
    addr: string;
  };
}
// 可以有全部属性
const cc: Person = {
  name: "cc",
  age: 18,
  idInfo: {
    id: "42xxxx199x04xxxx1X",
    addr: "Wuhan",
  },
};

// 下面这句会报错，因为cc的id信息被设置为只读属性，不可以被重新哦
cc.idInfo = { id: "xiao cai ji", addr: "beijing" };
// 这样修改就可以啦
cc.idInfo.addr = "beijing";
```

然而事实上，在`TS`里我们依然有方法可以让只读属性被重新赋值。由于`TS`的类型检查机制，在检查两个对象类型是否兼容时，只针对类型，而不会去检测属性是否有 `readonly` 。例如，下面这两个对象类型是完全相互兼容的。

```ts
// id为只读属性，不允许重新赋值
interface Person {
  readonly name: string;
  readonly age: number;
  readonly idInfo: {
    id: string;
    addr: string;
  };
}
// 没有readonly属性，所有成员都可以被赋值
interface People {
  name: string;
  age: number;
  idInfo: {
    id: string;
    addr: string;
  };
}

// 注意Person的属性是只读的
let person: Person = {
  name: "gg",
  age: 15,
  idInfo: {
    id: "qaq",
    addr: "zzZ",
  },
};
// 声明一个People类型的对象person，它的属性不是只读的
let people: People;

// 类型兼容，具有只读属性的person可以被赋值给people
// 此时people是People类型，其属性可以修改；person是Person类型，其属性只读
// 熟悉JS引用类型的同学们都知道，people和person是同一个对象
people = person;

// 修改people的属性，我们发现person也会被相应修改，因为他们实际是同一个对象
people.name = "pp";
people.age = 20;
```

从这个栗子中可以看到，我们可以通过一个**不具有相应只读属性，且属性类型能够兼容**的对象，来重写另一个对象的只读属性。因此，在**使用只读属性时，一定要注意这种情况**，以免引起超出意料的困扰。

## 二、<mark>索引签名</mark>

在上一篇文章[TS 中的函数签名，函数重载，泛型函数，你都了解多少？Typescript 系列：(二)函数篇 ](https://juejin.cn/post/7070172611849748517)中，我们了解了函数签名。和这里的**索引签名**多多少少有些相像。

我们在使用**`interface`**或者**`type alias`**定义某个对象类型时，以往的做法是列举出所有的属性名并规定它们的值的类型。但是有时候，我们不知道对象里会有哪些属性，无法逐个列出。此时，我们可以使用<mark>**索引签名**</mark>，来**规定属性名的类型**和对应属性值的类型。

```ts
// 通过索引签名，我们可以定义一个伪数组的
// 规定了属性名必须是number
interface StringArray {
  [index: number]: string;
}
// 注意和真数组区分开来
let strArr1: StringArray = {
  0: "100分",
  5: "95分",
};
// 报错，因为属性名grades不是number类型，不符合StringArray类型的约束
let strArr2: StringArray = {
  grades: "100分",
};
```

当我们使用`number`类型作为属性名时，`JS`在把他放进对象之前**会先将其转化为`string`类型**。索引签名可以和指定属性名,以及属性修饰符混合使用，此时，对象中必须包含列举出的属性(可选属性除外)，而且可拓展符合索引签名的约束的属性。

```ts
interface Person {
  [x: string]: string;
  100: string;
  50?: string;
}

let cc: Person = {
  100: "满意100",
  6: "我是由索引签名拓展的属性",
};

let yy: Person = {
  0: "QAQ",
  100: "555~",
  50: "0.0",
};
```

索引签名可以不止一套，但是**各个索引签名的返回值应该互相兼容**。

```ts
interface Person {
  [x: string]: string;
  [y: number]: string;
}
```

可以**在索引签名的签名加上`readonly`关键字，使被签名的属性变为只读属性。**

```ts
interface Person {
  readonly [x: number]: string | number;
}

let cc: Person = {
  2: "cc",
  5: 18,
  10: "boi",
};
```

## 三、<mark>类型拓展</mark>

我们可以从已有的对象类型的配置中，生成一个全新的类型，使其不仅含有原来类型的所有属性，还能拥有自己独有的属性。这样可以方便地实现类型复用，避免过多地重复敲代码，提高我们的工作效率。在定义新类型时，**使用 `interface` 和 `type` 关键字，实现类型拓展的方式会有差别**。

### 1. 类型继承

使用**`interface`**关键字声明的对象类型，可以通过**`extends`**关键字来继承其它的对象类型，从而**直接获得父类型的所有属性配置、属性签名，而不必重复列举一遍**。**可以同时继承多个对象类型**。

```ts
type A = {
  name: string;
};

interface B {
  age: number;
}

// C类型继承A类型，包含name属性，不添加其它属性
interface C extends A {}

// CC类型继承A，B类型，包含name, age, 以及自己列举的gender属性
interface CC extends A, B {
  gender: 1 | 2;
}
```

### 2. 类型交叉

通过**`type`**关键字给一个对象类型起**别名**时，使用 `&` 符号来连接多个类型，从而产生一个新类型，新的类型包含所有其它对象类型的属性，即类型交叉。

```ts
type A = {
  name: string;
};

interface B {
  age: number;
}
// 类型CC包含name和age属性
type CC = A & B;
```

值得一提的是，如果 `&` 连接的是简单联合类型，则产生的新类型是 `&` 符号两边类型的公有类型。

```ts
type A = string | number;
type B = string[] | number;
// C是A和B共有的类型，number类型
type C = A & B;
```

这一点 和 `&`在对象类型之间的使用看起来完全不同，起初我也有些疑惑。但是我们可以从本质上来思考，就不再有疑惑了。在关键字 type 定义的类型别名中，使用 `&` 符号连接已有的类型可以产生一个新的类型，这个**新类型需要同时满足 `&` 符号两边的类型的约束**。

因此，在**对象类型的栗子**中，新类型`CC`既需要满足`A`类型的约束 (因此`CC`必须有`A`的所有属性)，又必须满足类型 B 的约束 (因此必须含有类型 B 的所有属性)，即`CC`具有`A`和`B`的所有属性。

而在**简单联合类型**的栗子中，新类型`C`既要满足 A 的类型约束 (要么`C`是`number`, 要么是`string`)，又要满足类型`B`的约束 (要么`C`是字符串数组`string[]`，要么是`number`)，因此最终得到的`C`是`number`。

## 四、<mark>泛型对象</mark>

**泛型**：使用尖括号`<>`来声明类型参数 (可以有多个)来表示暂时未知的类型，在实际声明变量时传入相应的类型 (或者由`TS`自动推论) 来替换相应出现该类型参数的地方，从而将抽象的、未知的类型替换为具体的、已知的类型。一个类型参数指代一种类型，例如`<T,K,U,...>`分别指代一种暂时未知的类型。将泛型用于定义对象类型，便得到了**泛型对象**。

```ts
// 类型T代表一种暂时未知的类型
interface PersonInfo<T> {
  info: T;
}
// 传入类型变量string，这时候string就会在相应的地方替换原来的T
let p1: PersonInfo<string> = {
  info: "cc",
};

let p2: PersonInfo<number> = {
  info: 18,
};

let p3: PersonInfo<"男" | "女"> = {
  info: "男",
};
```

泛型对象常用于泛型函数，可参考[TS 中的函数签名，函数重载，泛型函数，你都了解多少？Typescript 系列：(二)函数篇](https://juejin.cn/post/7070172611849748517)。

**泛型同样可在类型别名中使用**。而类型别名除了定义对象类型之外，还能用泛型来定义各种其它类型。因此，我们可以**使用泛型嵌套来定义更为复杂的类型结构** (孩子已经哭了，难怪都说，玩会了泛型，`TS`就学完了一半)。本文主要介绍对象类型，关于泛型，以后再专门介绍。如下是官网的一个栗子。

```ts
type OrNull<Type> = Type | null;

type OneOrMany<Type> = Type | Type[];

type OneOrManyOrNull<Type> = OrNull<OneOrMany<Type>>;

type OneOrManyOrNullStrings = OneOrManyOrNull<string>;
```

## 五、数组类型

我们知道，数组是一种特殊的对象类型。上面简单了解了下泛型，那么我们现在就能知道，原来所谓数值数组、字符串数组等 (`number[]`，`string[]` )是泛型数组`Array<number>`，`Array<string>`的简写。现代`JS`也提供了其它新类型的泛型结构，如`Map<T, K>`，`Set<T>`，`Promise<T>`等，类型参数的数量都取决于各类型的自身行为表现。

### 1. `ReadonlyArray` 只读数组

只读数组是`TS`提供的一种特殊的数组，它的任何成员都不能被修改。

- 无法进行新增、删除、替换等操作，`push`、`pop`等修改自身的方法都无法使用。
- 可以使用不修改自身的数组方法。例如使用`slice`方法，返回一个普通的数组
- 代表一种类型，无法当作构造函数使用，不能使用`new`操作符。
- 在声明一个只读数组类型的变量时需指定类型参数，只读数组里只能存放该类型的值。
- 只读数组类型的变量本身可以接收普通数组的赋值。
- 普通数组不能接收只读数组的赋值

```ts
// 指定类型参数number，即该只读数组里只
let a: ReadonlyArray<number> = [123];
// 错误
a.pop();
// 可以使用slice方法
let cc = a.slice(0);

// 该变量可以用普通重新赋值
a = [1, 2, 3, 4];

// 错误
let val = new ReadonlyArray();

let aa: Array<number> = [456];
// 错误
aa = a;
```

### 2. `Tuple Types` 元组

<mark>**元组**</mark>类型是另一种特殊的数组类型，**一般来说**它可以存储不同类型的成员，**限定了数组的长度及每个成员的类型**。(**普通数组也可以通过指定联合类型的类型参数，从而存放不同类型的成员)**。元组的成员是可以被修改，可以调用一系列的数组方法。

```ts
type UserInfo = [string, number, 1 | 2];
```

这里得`UserInfo`便是一个元组类型，规定了元组里**有且仅有**三个成员，索引为`0`的成员是`string`类型，索引为`1`的成员是`number`类型，索引为`2`的成员 是字面量联合类型 `1 | 2` 。

- 元组类型可以被解构。

```ts
function introduceUser(info: UserInfo): string {
  const [name, age, gender] = info;
  return `我是${name}，今年${age}岁啦`;
}
```

- **元组也可以指定可选成员**：

```ts
// 第三个成员可选
type UserInfo = [string, number, (1 | 2)?];
```

- 元组中可使用剩余参数，来**指定某个或某些索引位置的成员的类型和其它成员的类型**。此时，元组没有长度限制。

```ts
type FamilyMember = string[];
// 指定索引0处的类型为string，索引1处的类型为number，剩余类型为FamilyMember
type UserInfo1 = [string, number, ...FamilyMember[]];
// 同理
type UserInfo2 = [string, number, ...FamilyMember[], boolean];
type UserInfo3 = [...FamilyMember[], string, number];
```

- **`readonly`** 只读元组类型

  我们可以用类似 数组类型的简写方式 来声明一个只读元组：**`readonly [string, number]`**，使元组的成员变为只读成员，不可修改。**`readonly`关键字只能用于字面量数组或字面量元组类型之前，不可用于类型别名之前**。

  ```ts
  // ok
  let cc: readonly [string, number] = ["cc", 18];
  // 报错
  let yy: readonly UserInfo3 = [["dd"], "1", 1];
  // 用于字面量元组之前，ok
  let yy: readonly [...FamilyMember[], string, number] = [["dd"], "1", 1];

  // 报错，只读属性不可修改
  cc[0] = "yy";
  ```

  此外，如果我们对数组使用<mark>**常量断言**</mark>：**`as const`**，该数组的类型也会变为只读元组。

  ```ts
  let yy = ["yy", 18] as const;

  // 报错，只读属性不可修改
  yy[0] = "cc";
  ```

- `ReadonlyArray`、`tuple`、`readonly tuple` 的主要区别。

  - `ReadonlyArray` 只读数组：不可修改数组成员，不可增删改，不会为每个数组成员单独指定类型，可以被重新赋值；
  - `tuple` 元组：一般指定了长度和各个成员的类型，使用剩余参数法来声明元组类型时则没有限制长度；元组可以修改成员的值；可以被重新赋值；
  - `readonly tuple`：一般指定了长度和各个成员的类型，使用剩余参数法来声明元组类型时则没有限制长度，不可修改成员的值，不可被重新赋值；

关于对象类型就先分享到这里啦。如果觉得我的文章有不妥之处，欢迎在评论区留言指正。下一期聊聊**泛型**，不见不散。
