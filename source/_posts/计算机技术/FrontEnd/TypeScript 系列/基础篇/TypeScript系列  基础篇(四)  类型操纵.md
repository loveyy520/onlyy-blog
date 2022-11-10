---
title: TypeScript系列基础篇(四) 类型操纵
date: "2022-03-03 20:39"
updated: "2022-03-03 20:39"
keywords:
  - 前端
  - TypeScript
  - TS
  - 类型
tags:
  - TypeScript
  - 前 端
categories:
  - 前端
archive: TypeScript
abbrlink: 2d027281
---

# TypeScript 系列基础篇(四) 类型操纵

定义一个类型，我们通常使用**`interface`**和 **`type`**关键字来进行规定，有时候也会直接使用字面量类型，这些过程足以应付大部分场景。但是有些时候，我们希望掌握**从已经存在的值或者类型中提取或派生出新的类型**的技巧，这就是我们今天要来了解的**`Type Manipulation` 类型操纵**。相信我，掌握这些技巧后，你也能被各种类型玩出百般花样。

## 一、使用 **_`keyof`_** 操作符

使用 **`keyof`** 操作符，可以获取一个 **对象类型** 的属性名 (字符串或者数值)，并将其组合成一个联合类型。注意得到的是一个类型，因此**应使用`type`关键字**，而不能使用`var`, `let`, `const`等声明值变量的关键字。

- 一般情况下，`keyof`操作会得到字面量联合类型；

```typescript
// Person类型有三个属性，属性名分别为"name","age",100
interface Person {
  name: string;
  age: number;
  100: string[];
}

// 对Person类型使用keyof操作符，可以将其属性名组合成一个字面量联合类型
type NewType = keyof Person; // NewType为 "name" | "age" | 100
```

- 如果被操作的对象类型有着`string`类型或者`number`类型的**索引签名**，那么`keyof`操作会得到`string`或者`number`类型，而不是字面量类型。

  - `number`类型的索引签名，`keyof`会得到 `number` 类型；
  - `string`类型的索引签名，`keyof`会得到 `string | number` 类型；

```typescript
// 索引签名规定索引必须为number类型，属性值是string类型
interface Person {
  [x: number]: string;
}
// Type1为number类型
type Type1 = keyof Person;

// 但是如果是string类型的索引签名
interface People {
  [x: string]: string;
}
// Type2为 string | number
type Type2 = keyof People;
```

由于`JavaScript`中对象的 `key` 会被强制转换成 `string` 类型。因此，我们即使用数值型的`key`，最后也等同于转化之后的字符串 `key` ，**即 `obj[0]` 和 `obj["0"]` 完全一样**。因此，**`string`类型的索引签名，对象实例可以由 `number` 类型的`key`，因为会被强制转化为`string`。所以`keyof`操作得到的是 `string | number`类型**。

## 二、使用 _`typeof`_ 操作符

在`JavaScript`中，**`typeof`**操作符常用于基本数据类型的判断。而`TS`在类型上下文中也加入了 **`typeof`** 操作符，用于获取一个变量或属性的类型。不同于我们平常的用法，当`typeof`出现在类型上下文中时，得到的类型也可以是一个对象类型。

```typescript
let a = 100;
const obj = {
  name: "cc",
  age: 18,
};
type T = typeof a; // T为number
type K = typeof obj.name; // K为string

type U = typeof obj; // U为 {name: string, age: number}
```

**`typeof`**用在这些简单类型的值上，不得不说有点累赘。但是对于复杂类型的值，用`typeof`就可以很方便地表达多种类型。例如，可以用`TS`提供的泛型类型**`ReturnType`**来获取一个**函数类型**的**返回值的类型**(指定`ReturnType`的类型参数为某个函数类型，得到该函数类型的返回值的类型)。

```typescript
// 泛型函数类型表达式，设置泛型类型参数默认值
type Fn<T = number> = (x: T) => T;
// 不指定类型参数，则泛型T为number
type Type1 = ReturnType<Fn>; // Type1为number
// 指定泛型类型参数T为string
type Type2 = ReturnType<Fn<string>>; // Type2为string
```

注意 **`ReturnType`** 接收的泛型类型参数应该是一个类型，而不是一个值。在类型上下文中可以使用`typeof`关键字将通过**表示值的变量或属性**来表达一个类型。

```typescript
// fn是"值"
function fn(a: number) {
  return a + 1;
}
// 错误，ReturnType的泛型类型参数应该是一个类型，而不是一个值
type Type1 = ReturnType<fn>;
// 使用typeof 关键字表达fn的类型, ok
type Type2 = returnType<typeof fn>; // Type2为number
```

注意，**`typeof`关键字在类型上下文中，永远只能用于变量名和属性名后面**。在平常用于判断类型时，则不受此限制。**类型上下文**：接收一个类型作为参数或者声明、表达、生成一个类型的上下文，如`interface`、`type`等关键字以及泛型参数的上下文。

## 三、索引访问类型

在**对象实例**中，我们可以通过索引来访问某个属性值。同样的，在**对象类型**中，我们也可以通过索引访问某个属性的类型，此时的索引应该是一个类型，而不是一个值，用方括号的形式接收该索引。索引可以是联合类型、字面量类型、类型别名、乃至`keyof`操作符表达的类型

```typescript
// 定义一个对象类型
interface Person {
  name: string;
  age: number;
}

// 通过方括号索引获得某个属性的类型，索引为字面量类型"name"
type Name = Person["name"]; // name
// 错误，不可以用 . 的方式访问
type Age = Person.age;

// 索引为字面量联合类型 "name" | "age"
type NameOrAge1 = Person["name" | "age"]; // string | number

// 索引为类型别名
type M = "name" | "age";
type NameOrAge2 = Person[M]; // string | number

// 索引为用keyof表达的类型
type NameOrAge3 = Person[keyof Person]; // string | number
```

无法访问对象类型中没有的属性。

```typescript
// 定义一个对象类型
interface Person {
  name: string;
  age: number;
}
// 错误，Person类型中没有gender属性/方法
type T = Person["gender"];
```

前面说到，接收的索引应该是一个类型。所以，当我们的对象类型具有索引签名时，则也可以接收**`string`**、**`number`**。另外，在数组类型中，也可以用`number`作为索引来访问。

```typescript
interface Person {
  [x: number]: string[];
  [x: string]: string[];
}

// 使用number作为索引
type A = Person[number]; // string[]
// 使用string作为索引
type B = Person[string]; // string[]

const arr = [1, 2, "cc"];
type C = typeof arr[number]; // number | string
```

## 四、条件类型

类似我们常用的三元表达式，**条件类型表达式**：**_`Type1 extends Type2 ? TrueType : FalseType`_**；当`Type2`是`Type1`的子类型时，表达式得到`TrueType`，否则得到`FalseType`。这看起来好像没啥用，然而，

- **条件类型表达式的强劲之处在于用于泛型**。

```typescript
type MyType<T> = T extends { info: unknown } ? T["info"] : never;

let a: MyType<{ name: string; info: number }>; // a为number类型的值
let b: MyType<Array<string>>; // b为never类型的值
```

对条件类型的泛型类型参数使用`extends`关键字可以约束其类型：

- **在条件类型中进行推论**

在条件类型表达式的中使用 **_`infer`_**关键字推论泛型类型参数或函数类型的返回值的类型，并用一个形式类型指代，这个形式类型可用于条件类型表达式中指代推论得出的实际类型。

```typescript
// 在条件类型表达式的Array泛型中使用infer关键字，
// 推论Array成员的类型为Item类型
type MyType<Type> = Type extends Array<infer Item> ? Item : Type;

let a: MyType<string[]>; // a为string类型的变量
```

- **分布式条件类型**

当我们为泛型指定的类型参数为联合类型时，条件类型的作用会分布于联合类型的每一个单独的子类型上。

```typescript
type GetArrType<T> = T extends any ? T[] : never;

// T[]的作用会分布到strig和number上，形成string[] | number[]
type StrOrNumArr = GetArrType<string | number>; // string[] | number[]
```

## 五、映射类型

### 1. 基本使用

映射类型是一种泛型，往往**建立在索引签名之上**，即以索引签名的形式，利用指定的泛型类型参数`T`的所有属性类型的联合(一般使用 `keyof` 关键字来遍历出`T`的所有属性类型)，作为新的对象类型的索引签名，并为其指定新的返回值类型。好吧，这太绕了。说白了，就是**给对象类型 A 的所有属性/方法指定新的返回值的类型，从而得到一个新的对象类型**。**关键字 `in` 后面是一个与类型参数`T`有关的联合类型**。还是有些绕？那就来看一个栗子吧：

```typescript
type OptionsFlags<Type> = {
  // 索引签名的形式，这里的Property时类型参数，可以随便命名,T、K啥的都可以
  [Property in keyof Type]: boolean;
};

// 我们尝试定义一个对象类型
interface Person {
  name: string;
  age: number;
  gender: 1 | 2;
}

// 将Person类型传递给OptionsFlag，得到新的类型
type NewType = OptionsFlags<Person>;
/*
NewType为 {
  name: boolean,
  age: boolean,
  gender: boolean
}
*/
```

这下我们就能明白了，文字说再多都是虚的，还得是代码。通过映射类型的方式得到新的类型，新类型继承了所有原来的属性(包括方法)，并指定了新的返回值 (当然可以使用条件类型表达式)。

### 2.映射修饰符

既然已经了解了映射类型的基本使用，现在来看看有哪些类型修饰符，它们又分别是用来做什么的。在上一篇文章[今天来聊聊 TS 中的那些对象类型----TypeScript 系列：(三) 对象类型](https://juejin.cn/post/7070434381013188615)中，我们了解了对象属性的属性修饰符 `?` 和 `readonly`，事实上，映射修饰符也是这两小只。

- **`readonly` 修饰符**

  我们知道，通过映射类型，我们可以继承原有对象类型的所有属性，并它们指定新的返回值的类型。那么，我们如何为新的对象类型的属性添加为只读属性呢？或者如果原有的类型中存在只读属性，如何在新的类型中移除只读限制呢？很简单，在签名的` [ ]` 之前使用 **`+readonly`** 、**`-readonly`** 号即可，+ 号也可以省略。

```typescript
// Person类型中有只读
interface Person {
  name: string;
  age: number;
  readonly id: string;
}
// 定义一个映射类型MapperA
type MapperA<T> = {
  [P in keyof T]: string[];
};

// 给Mapper传入Person类型
type PeopleA = MapperA<Person>;
/*
PersonA为 {
  name: string[],
  age: string[],
  readonly id: string[]
}
*/

// 使用 - 移除新类型id的readonly限制
type MapperB<T> = {
  -readonly [K in keyof T]: string[];
};
type PeopleB = MapperB<Person>;
/*
PeopleB为 {
  name: string[],
  age: string[],
  id: string[]
}
*/

// 使用 + 给新的对象类型的所有属性添加只读限制
type MapperC<T> = {
  +readonly [K in keyof T]: string[];
};
type PeopleC = MapperC<Person>;

// + 号通常省略
type PeopleCC = MapperC<Person>;
/*
PeopleC、PeopleCC都为  {
  readonly name: string[];
  readonly age: string[];
  readonly id: string[];
}
*/
```

- **`?` 可选修饰符**

同样，在映射类型产生新类型时，可选修饰符也会保留。我们可以**在签名的 `[ ]` 后用 `-?`来移除可选性**。

```typescript
type NewType<T> = {
  [P in keyof T]-?: string;
};
```

### 3. `key`的重映射

**使用 `as` 可以在新的对象类型中对原有的 `key` 进行重映射**。直接`show code`吧，来一道官方栗子：

```typescript
type Getters<Type> = {
  // 这句代码可以分为三个部分
  [Property in keyof Type as `get${Capitalize<
    string & Property
  >}`]: () => Type[Property];
};

interface Person {
  name: string;
  age: number;
  gender: 1 | 2;
  100: string;
}

type GetPerson = Getters<Person>;
/*
GetPerson为 {
  getName: () => string;
  getAge: () => number;
  getGender: () => 1 | 2;
}
*/
```

在上面的栗子中，我们把那句代码分为三个部分, "`as`" 之前的`A`部分, "`as`" ~ "`:`" 之间的`B`部分，"`:`"之后的`C`部分。`A` 和 `C`两部分结合起来，就是我们之前了解到的映射类型。所以，难点在于理解 `B` 部分的内容。这里涉及到了**模板字面量类型**，类似与模板字符串，(下一节有详细介绍)。**`Capitalize`**是`TS`提供的首字母大写的泛型类型。类型参数`Property`指代`keyof`每一次遍历到的类型`Type`的`key`，使用 `as` 将 新的对象类型中对应的 `key` 重命名为 模板字面量类型 `get + Property`类型(即原来的对象类型的对应的`key`)中属于`string`类型的`key` (即排除`number`索引) 首字母大写的 。

还可以利用`TS`提供**`Exclude<P, B>`的泛型类型**来排除 B 类型。

```typescript
// 新类型中移除了"kind"属性
type RemoveKindField<Type> = {
  [Property in keyof Type as Exclude<Property, "kind">]: Type[Property];
};
```

还记得一开始我们说的**关键字 `in` 后面是一个与类型参数`T`有关的联合类型**吗？事实上，这个联合类型不是仅仅只能用简单类型的联合，而可以是一切类型的联合，只需要通过 `as` 来把 `key` 重新映射为`string`或`number`或两者的字面量类型即可。

```typescript
type EventConfig<Events extends { kind: string }> = {
  [E in Events as E["kind"]]: (event: E) => void;
};
```

上面是一个官网的栗子。`Events`是一个具`kind`属性的对象类型的联合类型，`E `代表这个联合类型中的每一个具有`kind`属性的对象类型，也是新对象的`key`，通过` as` 关键字将 `E` 重映射为索引访问类型 `E["kind"]`，也就是`string`类型。因此，最后得到的是一个 `key` 为`string`类型的方法签名(函数的调用签名)。

(不得不说，各种类型操纵方法结合起来，是真能玩出花来。虽然明白比尔写的是啥，但我这脑瓜子实在是设计不出来这么优雅的类型。)

## 六、模板字面量类型

这是本文要分享的最后一种类型操纵方式了，毕竟没把泛型加进来讲，因为我之前的文章里介绍过了。

- 利用字符串模板的形式，可以得到模板字面量类型。注意类型是用`type`来定义。

```typescript
type Name = "cc"; // 类型，不是值，不要使用let、var、const等
type TemplateType = `I am ${Name}`; // 'I am cc'类型，不是值
```

- 如果模板用的类型是联合类型，则会分别对联合类型的每一个类型进行处理

```typescript
type Name = "cc" | "yy";
type TemplateType = `love${Name}`; // 'lovecc' | 'loveyy'
```

- 如果模板本身也是联合类型，则会分别对模板的每一个类型和使用的类型进行处理

```typescript
type Name = "cc" | "yy";
type Gender = 1 | 2;
type TemplateType = `love${Name | Gender}`;
/*
则TemplateType为 lovecc | loveyy | love1 | love2
*/
```

- 如果有多个模板，则是将每个模板的情况和其它模板的情况进行组合

```typescript
type Name = "cc" | "yy";
type Gender = 1 | 2;
type Age = 18 | 20;
type TemplateType = `${Age}love${Name | Gender}`;
/*
则TemplateType为
18lovecc | 18loveyy | 18love1 | 18love2
 | 20lovecc | 20loveyy | 20love1 | 20love2
*/
```

- 用在函数签名中，才能体会到模版字面量类型有多强大

```typescript
type PropEventSource<Type> = {
  // 调用签名，通过模板字面量类型指定了第一个参数的类型
  on(
    eventName: `${string & keyof Type}Changed`,
    callback: (newValue: any) => void
  ): void;
};
```

- 模板字面量类型的推论

把`on( )`设计为泛型函数，使`TS`自己进行类型推论。不说了，都是泪。直接上官方示例代码吧。一层一层的泛型，不思考的话实在不容易看懂。

```typescript
type PropEventSource<Type> = {
  on<Key extends string & keyof Type>(
    eventName: `${Key}Changed`,
    callback: (newValue: Type[Key]) => void
  ): void;
};
```

## 七、内置的字符串操纵类型

### 1. `Uppercase <StringType>`

产生一个**将泛型类型（必须是字符串类型、字符串型的字面量类型）所有字母转化为大写**的新类型。不改变原来的类型。如果是`string`类型而不是字面量类型，则生成的类型依然是`string`，不要求其值的首字母大写（一下几个内置方法都是如此）。

```typescript
type Name = "cc" | "yy";
type UpperName = Uppercase<Name>; // 'CC' | 'YY'
```

### 2. `Lowercase <StringType>`

产生一个**将泛型类型（必须是字符串类型、字符串型的字面量类型）所有字母转化为小写**的新类型。不改变原来的类型。

```typescript
type Name = "CC" | "YY";
type UpperName = Uppercase<Name>; // 'cc' | 'yy'
```

### 3. `Capitalize <StringType>`

产生一个**将泛型类型（必须是字符串类型、字符串型的字面量类型）首字母转化为大写**的新类型。不改变原来的类型。

```typescript
type Name = "cc" | "yy";
type UpperName = Uppercase<Name>; // 'Cc' | 'Yy'
```

### 4. `Uncapitalize <StringType>`

产生一个**将泛型类型（必须是字符串类型、字符串型的字面量类型）首字母转化为小写**的新类型。不改变原来的类型。

```typescript
type Name = "CC" | "YY";
type UpperName = Uppercase<Name>; // 'cC' | 'yY'
```

好了，本篇就到此为止了，各种类型已经把我玩出花来了。下一篇，我们将一起学习 **`class`** ，不见不散！
