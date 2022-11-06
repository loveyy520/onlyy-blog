---
title: TypeScript系列  基础篇(五)  Classes 类
date: 2022-03-05 01:07
updated: 2022-03-05 01:07
keywords:
  - 前端
  - TypeScript
  - TS
  - Class
tags:
  - TypeScript
  - 前端
archive: TypeScript
swiper_index: 50
---

# TypeScript 系列 基础篇(五) Classes 类

**类** 在 `JavaScript` 中出现于 `ES2015` 版本，`TS`对 类 进行了全面支持，还加入了一些其它语法来增强类的表达能力，本文将详细聊一聊`TS`中的类的知识，你知道的和不知道的，这里都有。

## 一、类的成员

### 1. 属性字段 (`Fields`)

字段声明会为类添加创建一个**公共**的**可写**的**实例属性**。我们可以为字段添加类型注释，如果不添加，就会是 `any` 类型，当然这是我们不希望发生的。

```typescript
class Person {
  name: string;
  age: number;
  gender; // gender为 any 类型
}
```

字段声明时可以赋初值，其类型会被 TS 自动推论，在实例化时会自动执行值的初始化。

```typescript
class Person {
  name = "cc"; // name为string类型
  age = 18; // age 为 string 类型
  gender: 1 | 2 = 2; // 如果不注释类型，则gender会被推论为number
}

const cc = new Person();
cc.name; // 'cc'
cc.age; // 18
```

如果开启了严格属性初始化检查： **`strictPropertyInitialization`**，则**没有赋初值**的字段**必须在构造函数中初始化**，不能在其它的方法中初始化，TS 不会去检测其它方法内的初始化。

```typescript
class Person {
  name = "cc"; // name为string类型
  age: number;
  constructor() {
    this.age = 18;
  }
}
```

事实上，开启该检测是为了防止属性值为空带来的意外错误。我们可以使用**非空断言**来明确该属性不会为空，这样也不会报错。

```typescript
class Person {
  name!: number; // 非空断言
}
```

### 2. _`readonly`_ 只读属性

添加了 **`readonly`** 修饰符的属性，将**不允许在构造函数以外的地方中进行重新赋值**。

```typescript
class Person {
  readonly name: string = "cc"; // 只读属性
  constructor() {
    this.name = "yy"; // 可以构造函数中赋值，因为构造函数相当于初始化
  }
  setName() {
    this.name = "hi"; // 报错，只读属性不允许重新赋值
  }
}
// 也不可在类以外进行赋值
const cc = new Person();
cc.name = "cc"; // 报错，只读属性不允许重新赋值
```

### 3. `constructor` 构造函数

构造函数接收实例化时传入的参数，可以提供参数默认值。在构造函数中进行类实例的初始化操作，可以分配属性值、调用类的方法等。

```typescript
class Person {
  name: string;
  constructor(name = "cc") {
    this.name = name;
  }
}
```

还记得我们在[Typescript 系列：(二)函数篇](https://juejin.cn/post/7070172611849748517)里讲的函数重载吗？构造函数自然也可以重载。注意构造函数的**重载签名**和**实现签名**是没有返回值类型的。

```typescript
class Person {
  name: string;
  // 两套重载签名
  constructor(name: number);
  constructor(name: string, age: number);
  // 实现签名
  constructor(name: number | string, age?: number) {
    // ...
  }
}
```

### 4. 调用 _`super( )`_

我们知道，类可以通过 **`extends`** 关键字来继承一个基类。此时，我们在构造函数中使用 **`this`** 关键字**之前**需要先调用 **`super( )`** ，相当于调用了父类的构造函数。

```typescript
class Person {
  name: string;
}

// 错误，没有在构造函数中先调用super()，就使用了this
class User1 extends Person {
  constructor(name: string) {
    this.name = name;
  }
}

// 正确
class User2 extends Person {
  constructor(name: string) {
    super();
  }
}
```

### 5. `methods` 方法

类里面的函数叫做方法。**声明一个方法不要用 `function` 关键字**。

```typescript
class Person {
  name: string;
  constructor(name = "cc") {
    this.name = name;
  }
  // setName方法
  setName(name: string): void {
    this.name = name;
  }
}
```

### 6. 存取器 `setters/getters`

和 `JS` 里没什么差别。

```typescript
class Person {
  _name: string;
  constructor(name = "cc") {
    this._name = name;
  }
  // setter
  set name(name: string): void {
    this._name = name;
  }
  get name(): string {
    return this._name;
  }
}
```

对于存取器，`TS`有几个特别的推论：

- 如果有 `get` 而没有 `set`，则该属性会被推论为 `readonly` 只读属性；
- 如果 `setter` 没有明确参数的类型，则会推论为 `getter` 的返回值的类型；
- `getter` 和 `setter` 的可见性保持一致。

### 7. 索引签名

类 也可以使用索引签名，和在对象类型里使用差不多。

```typescript
class Person {
  [x: string]: string | number | ((s?: string) => string | number);

  name = 1;
  getName() {
    return this.name;
  }
}
```

## 二、类的继承

### 1. `implement` 语句

使用 **`implements`** 语句检查类是否符合某接口规范。实现某个接口，则类中需要含有该接口的所有属性和方法才能通过检测。

```typescript
interface Person {
  name: string;
  setName: (x: string) => void;
}

// People类 实现 Person 接口
class People implements Person {
  name: string = "cc";
  setName(name: string) {
    this.name = name;
  }
}
```

可以同时实现多个接口：

```typescript
interface Person {
  name: string;
  setName: (x: string) => void;
}

interface Manager {
  id: string;
}

// People类 实现 Person 接口
class People implements Person, Manager {
  name: string = "cc";
  id: string = "001";
  setName(name: string) {
    this.name = name;
  }
}
```

注意 **implements** 语句只是检测类是否符合接口规范。

### 2. `extends` 语句

- 通过 `extends` 语句可以让类继承一个基类，获得它所有的属性和方法，还能定义自己的属性和方法。

```typescript
class Person {
  name: string = "cc";
}

class Manager extends Person {}

let cc = new Manager();
cc.name; // 'cc'
```

- 重写父类方法，可以通过 `super.xx( )` 来调用父类的方法。子类的方法需要能兼容父类的方法，包括参数数量、类型，以及返回值。

```typescript
class Person {
  name: string = "cc";
  setName(name: string) {
    this.name = name;
  }
}

class Manager extends Person {
  setName(name: string | number) {
    if (typeof name === "number") {
      this.name = String(name + 100);
    } else {
      super.setName();
    }
  }
}

let cc = new Manager();
cc.setName(99);
cc.name; // '199'
```

- 字段类型声明

在父类的构造函数执行完之后，才会开始子类的初始化，期间可能改写来自父类的属性或方法。当 子类的某个属性 是 父类相应属性 的子类型时，这个过程就会浪费性能。可以通过 **_`declare`_** 关键字来声明字段类型，使其不受运行时效果的影响。

```typescript
interface Animal {
  name: string;
}

interface Dog extends Animal {
  bark: () => void;
}

class AnimalHouse {
  resident: Animal;
  constructor(animal: Animal) {
    this.resident = animal;
  }
}

class DogHouse extends AnimalHouse {
  // 通过declare关键字，使resident属性的类型固定为Dog
  declare resident: Dog;
  constructor(dog: Dog) {
    // 不要忘记调用super()
    super();
  }
}
```

- 初始化顺序

父类字段初始化 --> 父类构造函数执行 --> 子类字段初始化 --> 子类构造函数执行

### 3. 继承内置类型

继承内置类型，如`Array`、`Error`等，当在构造函数中调用`super( )`之后，`this`的原型指向会错误地指向`super`的调用者，即`Array`、`Error`等内置类型。`ES6`使用 **`new.target`** 来调整原型链，但是在 `ES5` 中却保证不了 `new.target` 的值。因此，我们在调用`super()`之后，要手动调整原型链，让`this`的原型指向我们新的类。 **`Object.setPrototypeOf( )`** 便是要用的方法 (不支持该方法的可以退一步使用`Object.prototype.__proto__` )。

```typescript
class MsgError1 extends Error {
  naame = 123;
  constructor(m: string) {
    super(m);
  }
  sayHello() {
    return "hello " + this.message;
  }
}

//
let m1 = new MsgError1("cc");
// 由于原型链错误，sayHello方法在MsgError的原型上，
// 而m1的原型指向Error，索引没有sayHello方法
m1.sayHello(); // 报错

class MsgError2 extends Error {
  naame = 123;
  constructor(m: string) {
    super(m);
    Object.setPrototypeOf(this, MsgError2.prototype);
  }
  sayHello() {
    return "hello " + this.message;
  }
}

let m2 = new MsgError2("cc");
m2.sayHello(); // 正确
```

需要注意，这种问题会一直传递下去，也就是说，**以 `MsgError2` 为基类所创造的子类，也需要再次手动调整原型的指向**。此外，不支持`IE10`及更低的版本。

## 三、成员的可见性 `Member Visibility`

在 TS 中，实现了 `public`，`protected`，`private`等修饰符来实现成员的可见性。

### 1. `public`

**`public`** 修饰符用来定义公开成员，这也是默认的成员可见性，当没有写可见性修饰符时，就默认是 `public` 。被声明为`public`的成员，可在任何地方访问。太简单了就不给栗子了。

## 2. `protected`

被 **`protected`** 修饰的成员只能在类或者其子类中访问，无法通过实例来访问。

```typescript
class Person {
  protected name: string;
  constructor(name: string) {
    // 类中可以
    this.name = name;
  }
  getName() {
    return this.name;
  }
}

const cc = new Person("cc");
cc.name; // TS会报错，实例无法访问protected成员
```

在子类中，如果我们通过字段重新声明了基类中的 `protected` 成员，则会将其在子类中变为 `public` 成员，除非重新加上 `protected` 修饰符：

```typescript
class Person {
  protected name: string;
  protected age: number;
}

class Manager extends Person {
  // 不加 protected 修饰符， 则name变为public，通过实例来访问
  name: string;
  // 而这个则依然是protected成员
  protected age: number;
  constructor(name: string, age: number) {
    super();
    this.name = name;
    this.age = age;
  }
}

const cc = new Manager("cc", 18);
cc.name; // 'cc'
// 报错，实例无法调用 protected
cc.age;
```

### 3. `private`

被 **`private`** 修饰的成员只能在类中访问，无法通过实例来访问，也无法在其子类中访问。

```typescript
class Person {
  private name: string;
}

class Manager extends Person {
  // 错误，private成员不能在子类中访问
  name: string;
  constructor(name: string, age: number) {
    super();
    // 同样错误，private成员不能在子类中访问
    this.name = name;
  }
}

const cc = new Person("cc", 18);
cc.name; // 也错误，private成员不能通过实例来访问
```

但是在`TS`中支持在类中通过同类的其它实例获取该实例上的`private`成员：

```typescript
class Person {
  private name: string;
  constructor(name: string) {
    this.name = name;
  }
  hasSameName(other: Person) {
    // 可以访问其它同类实例的 private 成员name
    return this.name === other.name;
  }
}

const cc = new Person("cc");
const yy = new Person("yy");
cc.hasSameName(yy); // 不报错，得到false
```

需要注意，成员可见性仅在 `TS` 的类型检查时有效。一旦代码被编译为 `JS` 代码，则在`JS`中，可以通过类实例查看原本在`TS`是 `pretected` 或 `private` 的成员。另外 `JS` 的私有修饰符 "`#`" 可以实现在编译后依然是私有成员。因此，如果要实现通过私有化来保护成员，应使用闭包、`WeakMap`或私有字段 "`#`" 等手段。

## 四、静态成员 `static`

首先我们要明确一点，类本身也是一个对象。我们通过**_`static`_**修饰符可以将某个成员变成静态成员。**静态成员与类的实例无关，而是被挂到类对象本身，可以与实例成员重名，且静态方法中的 `this` 指向类对象本身，我们通过类对象本身来访问类成员**。

```typescript
class Person {
  // 这是实例成员
  _name: string;
  constructor(name: string) {
    // 给实例成员name赋值
    this._name = name;
  }
  // 静态属性 name
  static _name: string = "person";
  // 静态方法 其中的this指向类Person
  static setName(name: string) {
    this._name = name;
    console.log(this); // class Person { // ... }
  }
}

const cc = new Person("cc");
// 访问实例成员_name
cc._name; // 'cc'
// 访问静态成员_name
Person._name; // 'person'
```

也许你会好奇我为什么用 `_name` 而不是` name`，事实上不是我不使用，而是不能使用。稍后你会得到答案。

静态成员也可以使用 `public`、`protected`、`private`等修饰符。类似的，**`protected` 静态属性 只能由类或子类中的静态成员访问；`private`静态成员只能由 类 中的静态成员访问**。

```typescript
class Person {
  protected static _name = "person";
}

Person._name; // 报错，不能访问protected成员
```

静态成员可以被子类继承：

```typescript
class Person {
  static _name = "person";
  static setName(name: string) {
    this._name = name;
  }
}

class Manager extends Person {}

Manager._name; // 'person'
Manager.setName("cc");
Manager._name; // 'cc'
```

特殊的静态名字：**`name`** ，由于存在内置静态属性 **`Function.name`**，因此我们在给静态属性命名时，不能使用`name`，否则会发生冲突。

```typescript
class Person {
  // 错误，静态属性name与内置静态属性 Function.name 冲突
  static name = "person";
}
```

## 五、静态域

我将类中的 `static blocks` 称为静态域，通过 **_`static { }`_**声明一块区域，在该区域编写的语句能够自动执行，且能访问私有属性 如 "`#name`"。因此，可以在静态域中书写静态成员做初始化逻辑。这里想不出什么好的栗子，就搬运了官网的：

```typescript
class Foo {
  static #count = 0;

  get count()
    return Foo.#count;
  }
  static {
    try {
      const lastInstances = loadLastInstances();
      Foo.#count += lastInstances.length;
    }
    catch {}
  }
}
```

## 六、泛型类

在执行`new`操作时，泛型类的类型参数也会由传入的参数来进行推论。

```typescript
class Person<T> {
  name: T;
  constructor(name: T) {
    this.name = name;
  }
  setName(name: T) {
    this.name = name;
  }
}

const cc = new Person("cc"); // T被推论
```

泛型类可以像泛型接口一样进行泛型约束以及指定类型参数的默认值。大家都能明白的吧，就不给栗子了。

静态成员无法享用泛型：

```typescript
class Person<T> {
  // 错误，静态成员不可引用类型参数
  static _name: T;
}
```

这是因为每个静态成员都只有一个，而实例成员在每个实例上都存在一个。假若静态成员能享用泛型，那么我们`new`一个实例`a`，传入类型`string`，此时静态属性`_name`类型为`string`；我们`new` 一个实例`b`，传入类型`number`，那么此时静态属性\_`name`的类型是啥呢？`string`亦或`number` ? 显然都不合理。所以静态成员无法使用类型参数。

## 七、运行时的 `this`

`Ts`中的`this`指向和 `JS` 保持一致，因此有时候我们需要防止成员丢失`this`上下文。

### 1. 使用箭头函数

```typescript
class Person {
  name: string;
  setName = (name: string) => {
    this.name = name;
  };
}
```

但是这也需要权衡利弊：

- 这样做能保证`setName`方法的`this`永远正确地指向实例本身；
- 使用中这种方式定义的方法不会挂载原型上，而是会被添加到每一个实例上，因此会占用更多的内存；
- 同样，其子类无法通过`super`,`setName`来调用父类的`setName`方法，因为无法在原型链上找到；

### 2. 使用 `this` 参数

如同在`TS`的函数中将`this`作为参数，为其指定类型一样，在类的方法中也可以如此这般。

```typescript
class Person {
  name: string;
  // 为this指定类型为 Person，则只有Person实例才可以调用该方法
  setName(this: Person, name: string) {
    this.name = name;
  }
}
```

这种方式很好地弥补了箭头函数的不足，唯一的缺点就是习惯了 `JS` 思维的同学可能会试图通过其它对象来调用该方法，显然这样是不会成功的。

## 八、 _把 `this` 作为 类型_

**首先要说，这玩意儿非常有用**。在`TS`的类中，`this` 可以作为一种特殊的类型，由当前的类进行动态推论。

```typescript
class Person {
  name: string;
  // 把 this 作为形参person的类型
  setName(person: this) {
    this.name = person.name;
    return this;
  }
}

const a = new Person();
const b = a.setName(a); // b的类型为当前的类 Person
```

这里得`setName`返回了`this`，这个`this`是表示实例值，其类型被推论为 `this`，这个`this`表示类型。`this` 类型就会在`setName`调用时被动态推论为当前的类。这样的好处是在子类中可以也自动推论为子类。例如我们在`Person`类的实例中调用`setName`，返回值的类型就是`Person`；如果在`Person`的子类`Manager`的实例中调用`setName`，返回值的类型则是`Person`的子类`Manage`r：

```typescript
class Person {
  name: string;
  // 把 this 作为形参person的类型
  setName(person: this) {
    this.name = person.name;
    return this;
  }
}

class Manager extends Person {}

const y = new Person();
const yy = y.setName(y); // aa的类型为Person

const c = new Manager();
const cc = c.setName(c); // cc的类型为Manager
```

**基于 `this` 类型的 类型守卫**：和在函数中一样，我们可以在类或接口的方法的返回值的类型的位置使用**_`this is Type`_**来进行类型缩减。写个最简单的栗子吧，实在是懒癌犯了 `qwq`。

```typescript
class Person {
  name? = 'cc'
}

class Manager extends Person {
  // 类型守卫的 this 为类型
  isPerson()this is Person {
    // return 语句的 this 指代类实例
    return this instanceof Person
  }

  // 可以利用 基于 this 类型的类型守卫 来进行类型缩减
  hasName()this is {name: string} {
    return this.name !== undefined
  }
}

const cc = new Person()
// 利用类型守卫来进行类型缩减
if(cc.hasName()){
  // ...
}
```

## 九、参数属性

参数属性是`TS`提供的一个非常方便的语法。在构造函数的参数前加上 `public`、`protected`、`private`或者`readonly`等修饰符，就可以把普通参数变为参数属性。参数属性既是构造函数的参数，又会作为实例属性自动被添加到实例上，且在传参时自动进行赋值，无需在函数体内进行赋值操作。

```typescript
class Person {
  constructor(
    public name: string,
    protected age: number,
    private gender: 1 | 2
  ) {
    // 不需要在这里再进行赋值
  }
  setAge(age: number) {
    this.age = age;
  }
  getAge() {
    return this.age;
  }
}
const cc = new Person("cc", 18, 2);
cc.name; // 'cc'
cc.setAge(20);
cc.getAge(); // 20
cc.gender; // 报错，private属性不能通过实例
```

## 十、类表达式

类似函数表达式，没啥说的，直接上栗子：

```typescript
const Person = class {
  name: string = "cc";
};

const cc = new Person();
cc.name; // 'cc'  cc的类型是Person
```

## 十一、_abstract_ 抽象类及其成员

含有抽象成员的类为抽象类。抽象类和抽象成员都需要在前面加上 **`abstract`** 修饰符。抽象类不能使用 `new` 进行实例化，而是用来作为**基类**，声明一些抽象方法或抽象属性，其子类需要实现所有这些方法或属性。

```typescript
abstract class Person {
  abstract name: string;
  abstract setName(x: string): void;
}

// 子类必须包含父类的全部
class Manager extends Person {
  name: string = "manager";
  setName(name: string) {
    this.name = name;
  }
}
```

## 十二、类成员之间的关系

和其它类型一样，类之间也是通过结构来进行比较的，当拥有相同的成员，则可以相互替换；当一个类`A`中含有另一个类`B`的所有成员，尽管没有显示地通过 `extends` 继承，类 `A` 依然会被认为是类 `B` 的子类。

```typescript
class Person {
  name: string;
}

class Manager {
  name: string;
  age: number;
}
// 不会报错
const person: Person = new Manager();
```

这看起来很直观简单，不过少数情况下会看起来有些 `emmm`，怪怪的。拿个官方栗子来：

```typescript
class Empty {}

function fn(x: Empty) {
  // 啥也不做
}

// 以下这几个都没问题，也就是说，它们都是空类 Empty 的子类
// bigint和symbol不是
fn(window);
fn({});
fn(fn);
fn(0);
fn(undefined);
```

关于类的知识就分享到这里啦，下一篇 分享 `TS` 中的 **_模块_** 的内容，不见不散！
