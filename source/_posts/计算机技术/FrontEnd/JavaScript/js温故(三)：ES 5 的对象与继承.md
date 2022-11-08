---
title: js温故(三)：ES5 的对象与继承
date: "2022-07-01 14:22"
updated: "2022-07-01 14:22"
tags:
  - 前 端
  - JavaScript
keywords:
  - 前端
  - JavaScript
  - JS
categories:
  - 前端
  - JavaScript
abbrlink: ee9e9f63
---

`ES6`新增了`class`来替代之前的构造函数，并且通过`extends`关键字可以轻易实现继承。不过`ES`的概念中，暂时还没有`class`这一类型，不管从哪方面来看，`class`都是对之前的继承方案的封装，其本质上是函数(`Function`的实例) 。了解一下`ES6`之前的各种继承方案，有助于加深对`class`继承的理解。

## 一、创建对象

### 1. 工厂模式

当需要创建多个对象实例，且他们的属性高度重复时，无论是通过对象字面量来创建，还是使用`new Object`来创建，都非常麻烦。采用工厂模式，可以很方便地批量创建多个具有相同属性的对象实例，为此，需要定义一个工厂函数：

```js
// 定义一个工厂函数，用于创建对象
function createPerson(name, age, gender, ...rest) {
  // 创建一个空对象person
  const person = {};
  // 将参数上的属性添加到person上(增强对象)
  person.name = name;
  person.age = age;
  person.gender = gender;
  // ...
  // 返回该对象person
  return person;
}

// 工厂函数定义好了

// 然后可以使用该函数来批量生产对象
const cc = createPerson("cc", 18, "男");
// 没有传入gender参数，则对应yy.gender的值为undefined
const yy = createPerson("yy", 18);

// 没有对象标识，instanceof操作符只能检测出来cc和yy是Object
```

可见，工厂函数就是一个普通函数，创建空对象、增强对象、返回对象 三步走，它可以解决批量创建相似对象的问题，但是创建出来的对象没有标识，我们难以区分他们是什么类型。

### 2. 构造函数模式

构造函数模式在工厂模式的基础上加以改进。无需显示地创建空对象，且把属性赋值给`this`，也不需要显示`return`，使用`new`操作符来创建实例对象。

```js
// 定义构造函数，函数名首字母大写，以区分于普通函数
function Person(name, age, gender, ...rest) {
  // 没有也不需要显示创建对象

  // 属性赋值给this
  this.name = name;
  this.age = age;
  this.gender = gender;
  this.playGame = (gameName) => console.log(`${gameName} start!!`);
  // ...
  // 没有也不需要return
}

// 使用new操作符来创建对象
const cc = new Person("cc", 18, "男");
// 没有传入gender参数，对应yy.gender为undefined
const yy = new Person("yy", 18);

// 实例对象的constructor属性，指向构造函数Person
// 事实上这个属性存在于原型上
console.log(cc.constructor === Person); // true
// // 有对象标识，instanceof操作符可以检测出cc和yy是Person类型
console.log(cc instanceof Person); // true
console.log(yy instanceof Person); // true
```

构造函数模式不仅代码上看更加简洁（不需要显示创建对象以及`return`），而且通过`new`操作符来创建的实例对象，具有对象标识，可以轻松地使用`instanceof`操作符来检测它们是否属于某一类型。

此外，构造函数也是函数，除了与`new`操作符搭配使用以外，也可以当作普通函数来直接调用。此时，如果没有使用`call/apply`等方式来改变`this`指向，则`this`会指向`Global`对象，在浏览器中即`window`对象。

```js
// 不改变this指向，则this指向window，即把相应的属性都添加到window上
Person("ww", 20);
// window.name, window.age
console.log(name, age); // 'ww' 20

// 使用call改变this指向
const boy = {};
Person.call(boy, "cc", 18);
console.log(boy); // {name: 'cc', age: 18, gender: undefined, playGame: f}
```

对象函数模式的问题，在于其定义的方法会在每个实例上都创建一边。如上栗子中，`cc`和`yy`都有`playGame()`方法，但是他们的方法并不是引用的同一个，而是各自单独的实例，即`cc.playGame === yy.playGame`会得到`false`。这显然会造成不必要的浪费。我们可以把函数定义转移到构造函数外部，来解决这个问题。

```js
// 定义构造函数，函数名首字母大写，以区分于普通函数
function Person(name, age, gender, ...rest) {
  // 属性赋值给this
  this.name = name;
  this.age = age;
  this.gender = gender;

  // 引用定义在构造函数外部的同一个方法playGame
  this.playGame = playGame;
}

function playGame(gameName) {
  console.log(`${gameName} start!!`);
}

const cc = new Person("cc"),
  yy = new Person("yy");
// 此时各个实例的playGame方法就都是同一个
cc.playGame === yy.playGame; // true
```

如此这般，虽然可以解决实例对象共享方法的问题，但是由于方法定义在构造函数外部，导致全局可调用该函数，而且一旦共享的方法多了，就需要在外部定义很多函数，不方便管理与维护。

### 3. 原型模式

关于原型在此不过多赘述，每个函数都会创建一个`prototype`属性，即函数的原型对象，包含其实例对象所共享的方法和属性。因此，在构造函数中把值赋给原型对象，则可以让其实例对象共享这些值/方法。这里主要有两种方式，一种是给已有的原型对象添加新的属性和方法：

```js
// 给已有的原型添加新的属性/方法
function Person() {
  // ptototype为Person.prototype的引用
  const prototype = Person.prototype;
  // 往Person.prototype上添加属性和方法
  prototype.name = "cc";
  prototype.age = 18;
  prototype.playGame = (game) => console.log(`${game} start!!`);
}

const cc = new Person(),
  yy = new Person();
// cc和yy本身是空对象，但是可以访问原型上的属性和方法
console.log(cc.name); // cc
console.log(yy.name); // yy
```

另一种是把需要添加的属性/方法集中在一个对象中，然后赋给原型对象。这会导致构造函数的原型被重写，与之前已有的原型不再有关联，也得手动让`constructor`属性重新指向构造函数本身。

```js
// 重写原型
function Person() {
  // 将要添加的属性集中到一个对象上
  const prototype = {
    name: "cc",
    age: 18,
    playGame(game) {
      console.log(`${game} start!!`);
    },
    // 注意重新调整constructor指向
    constructor: Person,
  };

  // 赋给Person.prototype
  Person.prototype = prototype;
}
```

由于重写原型会使构造函数的原型指向一个新的对象，这会导致在执行重写原型的操作前后实例化的对象具有不同的原型，这点尤为值得注意。

```js
function Person() {
  // 什么都不做
}
// 给原型添加属性
Person.prototype.name = "cc";
Person.prototype.playGame = (game) => console.log(`${game} start!!`);

// 此时尚未重写原型
const cc = new Person(); // 不传参时可以省略括号

// 重写Person的原型
Person.prototype = {
  name: "yy",
  playGame(game) {
    console.log("You are not allowed to play game !!");
  },
  constructor: Person,
};

const yy = new Person();

console.log(cc.name); // cc
console.log(yy.name); // yy

cc.playGame("Don't Starve Together"); // Don't Starve Together start!!
yy.playGame("Don't Starve Together"); // You are not allowed to play game !!
```

原型模式弱化了向构造函数传参来自定义属性值的能力，且通过原型共享的引用类型也会在各个实例之间相互影响，因此，原型模式基本不会单独应用。往往是将构造函数模式和原型模式进行结合。

## 二、继承

### 1. 原型链继承

原型链的概念在此不做赘述。将一个构造函数 A 的原型，重写为另一个构造函数 B 的一个实例对象，由于该实例对象可以访问构造函数 B 的原型上的属性和方法，当成为构造函数 A 的原型时，则构造函数 A 的实例对象也可以访问构造函数 B 的原型上的属性/方法。

```js
function B() {
  this.age = 18;
  B.prototype.name = "b";
  b.prototype.playGame = function (game) {
    console.log(`${game} start!!`);
  };
}

// A通过原型链继承构造函数B
function A() {
  // prototype上有个age属性，值为18，也会被继承下去
  const prototype = new B();
  A.prototype = prototype;
}

// 此时A的实例对象也可以访问B的原型上的属性/方法
const a = new A();
a.name; // 'b'
a.playGame("Don't Starve Together"); // Don't Starve Together start!!

// 原先构造函数B的实例属性age也会变成A的原型属性
a.age; // 18
```

通过原型链继承，弱化了向构造函数传参的能力，且父类构造函数的实例属性/方法也会成为子类构造函数的原型属性/方法，这在某些时候会导致问题。

### 2. 经典继承：盗用构造函数

通过原型链继承，父类的实例属性/方法会变成子类的原型属性/方法，且难以通过向构造函数传参来自定义属性值，这显然不是我们想要的。通过`call`/`apply`在子类构造函数中来盗用父类构造函数，可以让父类构造函数的实例属性/方法在子类中也同样赋值操作一遍，子类即可获得父类的实例属性/方法，但是并没有继承父类的原型属性/方法。

```js
function B(name, age) {
  this.name = name;
  this.age = age;
  B.prototype.playGame = function (game) {
    console.log(`${game} start!!`);
  };
}

// 在构造函数A中盗用构造函数B
// 使用了call来改变this指向
function A(name, age) {
  B.call(this, name, age);
}

const a = new A("a", 5);
const b = new B("b", 10);
a.name; // 'a'
a.age; // 5
b.name; // 'b'
b.age; // 10

b.playGame("Don't Starve Together"); // Don't Starve Together start!!

// 没有继承构造函数B的原型方法
// 报错：a.playGame is not a function
a.playGame("Don't Starve Together");
```

盗用构造函数的方式无法继承原型上的内容，这一点可以通过原型链继承来弥补。因此将二者组合，便可以实现一个完整的继承。

### 3. 组合继承

组合继承是将原型链继承和盗用构造函数继承结合起来。

```js
// 定义父类构造函数Person
function Person(name) {
  this.name = name;
  this.age = 20;
  Person.prototype.playGame = function (game) {
    console.log(`${game} start!!`);
  };
}

// 定义子类构造函数Student
function Student(name, age, school) {
  // 盗用Person构造函数，来继承name，age属性
  Person.call(this, name, age);
  // 添加自己的school属性
  this.school = school;
}

// 原型链继承
const prototype = new Person();
prototype.constructor = Student;
Student.prototype = prototype;

const cc = new Student("cc", 18, "cc-school");
// 访问Student的实例属性
// 这里访问到的属性是属于cc本身的实例属性
cc.name; // 'cc'
cc.age; // 18
cc.school; // 'cc-school'

// 而playGame()方法继承自原型链
cc.playGame("Don't Starve Together"); // Don't Starve Together start!!

// 事实上，Student的原型上也会有原型属性 name 和 age，这是在原型链继承时，
// 从Person的一个实例对象用作Student的原型时得到的，根据实例化时是否传参，其值可能是undefined

// 原型上有该属性，但是其值为undefined
cc.__proto__.name; // undefined
// 原型上有该属性，且其值为20
cc.__proto__.age; // 20

// 由于cc本身的 name 和 age 属性遮盖了其原型上的 name 和 age 属性，
// 因此通过cc访问到的 name 和 age 是其本身的属性
cc.name; // 'cc'
cc.age; // 18
```

上面的栗子中，可以看到，在继承的实现过程中，父类构造函数调用了两次：一次是盗用父类构造函数，通过`call`调用，另一次是原型链继承时，通过`new`操作符调用。父类构造函数的实例属性/方法，既通过盗用构造函数继承为子类的实例属性/方法，又通过原型链继承成为子类的原型属性/方法。这在实现了完整的继承的同时，也造成了不必要的浪费。

### 4. 寄生式继承

组合继承的缺陷主要来自其中的原型链继承，会把父类的实例属性/对象也变为子类的原型属性/对象，而我们只希望在原型链中继承父类的原型链，而不希望父类的实例属性/方法也成为子类的原型链的一部分。寄生式继承为解决这个问题提供了思路。

寄生式继承主要分三步：创建对象、增强对象、返回对象。主要用于无需创建构造函数，而是基于一个对象`obj`，创建另一个增强版的对象`obj2`，来实现对`obj`的继承。

```js
function create(obj) {
  // 以传入的参数 obj 作为原型创建一个新对象
  const newObj = Object.create(obj);
  // 增强该对象
  newObj.name = "new-obj";
  // 返回该对象
  return newObj;
}

const person = {
  name: "person",
  age: 18,
  playGame(game) {
    console.log(`${game} start!!`);
  },
};

const p2 = create(person);
p2.name; // 'new-obj'
p2.age; // 18
p2.playGame("Don't Starve Together"); // Don't Starve Together start!!
```

这里使用了`Object.create()`方法，在只传一个对象作为参数时，这个方法会返回一个以该对象为原型的空对象。

```js
function obj_create(obj) {
  function Fun() {}
  Fun.prototype = obj;
  return new F();
}
```

这样就能避免组合继承中通过原型链继承带来的问题，且父类构造函数不再需要调用两次。

### 5. 最佳模式：寄生式组合继承

将寄生式继承的思路引入到组合继承中，成为`ES5`引用类型的**最佳继承模式**。

```js
// 封装一个函数通过寄生式继承思想，来继承原型属性/方法
function newPrototype(SuperType, SubType){
  // 以父类的原型作为原型，创建一个干干净净的空对象prototype
  const prototype = Object.create(SuperType.prototype)
  // 更改constructor属性，当然，这里最好使用Object.definedProperty，并使其不可被修改
  prototype.constructor = SubType
  SubType.prototype = prototype
}

// 定义父类
function Person(name, age){
  this.name = name
  this.age = age
  Person.prototype.playGame = (game) => console.log(`${game} start!!`)
}

// 定义子类
function Student(name, age, school){
  // 继承实例属性/方法
  Person.call(this, name, age)
  // 添加自己的实例属性/方法
  this.school = school
}
// 继承原型属性/方法
newPrototype(Person, Student)

const cc = new Student('cc', 18, 'cc-school')
cc.name	// 'cc'
cc.age	// 18
cc.school	// 'cc-school'

cc..playGame("Don't Starve Together")	// Don't Starve Together start!!
```

`ES5`及其之前的对象创建与继承基本都回顾了一遍，有空再整理下`ES6`的`class`及其与构造函数的对比。
