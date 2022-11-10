---
title: js温故(二)：symbol
date: "2022-06-19 03:24"
updated: "2022-06-19 03:24"
tags:
  - 前 端
  - JavaScript
keywords:
  - 前端
  - JavaScript
  - JS
categories:
  - 前端
abbrlink: 227b619f
---

自`ES6`中`symbol`问世以来，个人在项目中并没有太多机会使用到，小公司业务项目没有给`symbol`太多的登场机会。因此之前也只稍微知晓了概念，没有详细了解。如今重温`js`，自然要重新认识一下这独一无二的`symbol`。如你所知，`symbol`是原始值(基本数据类型)，其每个实例是独一无二且不可变的，一般作为对象属性使用，确保对象属性独一无二，避免属性冲突。

[toc]

## 1. 基本用法

符号只能通过函数来创建实例。最基本的就是**`Symbol()`**函数：可以使用`Symbol()`函数来创建一个符号实例。有以下几点需要注意：

- `Symbol()`函数**不与`new`操作符搭配**，即`new Symbol()`是不合法的。这是为了防止创建`Symbol`包装对象；

- `Symbol()`函数可以传入字符串作为键（也可以不传），此时**传入的字符串键只起到描述的作用，并不影响`symbol`实例的值**。因此，传入相同的字符串键的`symbol`实例，其值也不相等而且相互之间也没啥关联。

  ```js
  let symbol1 = Symbol("a");
  let symbol2 = Symbol("a");

  // false
  symbol1 === symbol2;
  ```

## 2. 全局符号注册表

如果运行时不同部分的代码需要共享和重用符号实例，则可以用一个字符串作为键，使用 **`Symbol.for()`** 方法在全局符号注册表中创建并注册符号。与`Symbol()`函数不同，此时，**传入的字符串键会影响符号实例的值**，一个字符串对应一个独一无二的符号实例。在全局符号注册表中使用同一个字符串键来注册的符号实例之间完全等价，即是同一个符号实例，从而实现共享和重用。

```js
const symbol3 = Symbol.for("a");
const symbol4 = Symbol.for("a");

// true
symbol3 === symbol4;
```

如果全局符号表中定义的符号没有传入字符串键，则相当于传入了`undefined`作为键。因此，所有没有传入字符串键的全局符号完全等价，是同一个符号实例。而由于全局注册表中的符号必须用字符串键来创建，因此传入的任何值都会被转换为字符串，`undefined`也会被转换为字符串`“undefined”`。如下栗子中的所有`symbol`实例的描述都是`Symbol(undefined)`。

```js
const symbol5 = Symbol.for();
const symbol6 = Symbol.for();
const symbol7 = Symbol.for(undefined);
const symbol8 = Symbol.for("undefined");

// true
symbol5 === symbol6;
// true
symbol6 === symbol7;
// true
symbol7 === symbol8;
```

通过**全局注册表来实现符号共享与重用的原理**是，当第一次用某个字符串键在全局注册表中创建`symbol`实例时，见到到注册表中没有该字符串键对应的符号实例，则使用该字符串键创建一个符号实例，并在注册表中保存；当后续试图使用同样的字符串键来在注册表中创建符号实例时，检测到注册表中已经有了对应的符号实例，因此直接返回该符号实例，而不是重新创建，从而实现符号实例的共享与重用。这个过程完全可以用对象或者字典来模拟：

```js
// 全局作用域中创建一个空的注册表
const symbol_regedit = {};

// 用与注册符号实例的函数
Symbol.custom_for = (str) => {
  // 如果接收的参数不是字符串，则转换为字符串
  if (typeof str !== "string") {
    str = String(str);
  }
  // 注册表中已经存在该键对应的符号实例，则直接返回该实例
  if (symbol_regedit.hasOwnProperty(str)) {
    return symbol_regedit[str];
  }
  // 不存在则创建并注册
  // 创建symbol实例
  const symbol = Symbol(str);
  // 添加到注册表中
  symbol_regedit[str] = symbol;
  // 返回实例
  return symbol;
};
```

使用**`Symbol.keyFor()`**我们也可以**通过符号实例来查询注册表中对应的字符串键**，该方法接收一个符号实例，返回其对应的字符串。

```js
const symbol9 = Symbol.for("symbol 9 号");
const key = Symbol.keyFor(symbol9); // 'symbol 9 号'
```

同样的，在模拟了`Symbol.for()`的基础上，我们也可以模拟`Symbol.keyFor()`方法：

```js
Symbol.custom_keyFor = (symbol) => {
  // 入参安全检测
  if (typeof symbol !== "symbol") {
    const type = typeof symbol;
    throw new Error("TypeError: Expect a symbol，but got a " + type);
  }
  // 查找对应的字符串键并返回
  const strKey = Object.keys(symbol_regedit).find(
    (key) => symbol_regedit[key] === symbol
  );
  return strKey;
};
```

可见，符号实例仍是唯一的，所谓全局注册表，不过是一个对象/字典实例而已。

## 3. 使用符号作为属性

我们指知道，使用符号作为属性，能避免属性重名引起的冲突。凡是可以使用字符串或数值作为属性的地方，也都可以使用符号来作为属性，包括了 **对象字面量属性** ，**`Object.defineProperty()`** 以及 **`Object.defineProperties`** 定义的属性。

当符号用在对象字面量属性中时，只能使用计算属性语法，即中括号语法 `obj[symbol]`。

```js
let s1 = Symbol("s");
let s2 = Symbol("s");

let obj1 = {
  [s1]: "symbol property 1",
};

// 这样也ok
let obj2 = {};
obj2[s2] = "symbol property 2";
```

而在**`Object.defineProperty()`** 以及 **`Object.defineProperties`** 中使用符号时， 不使用计算属性语法。

```js
// s1不使用计算属性语法
Object.defineProperty(obj1, s1, { value: "symbol property 1 呀" });
// s2使用计算属性语法，因为出现在对象字面量属性中
Object.defineProperties(obj2, {
  [s2]: "symbol property 2 呀",
});
```

我们通常用`Object.getOwnPropertyNames()`来获取对象的常规属性数组；类似的，使用`Object.getOwnPropertySymbols()`可以获取对象的符号属性数组；使用`Reflect.ownKeys()`可以得到两种类型的属性数组；此外，`Object.getOwnPropertyDescriptors()`可以得到包含常规和符号属性描述符的对象。

```js
const s1 = Symbol("s1");
const s2 = Symbol("s2");
const obj = {
  [s1]: "symbol 1",
  [s2]: "symbol 2",
  name: "张三",
  age: 18,
};

// 1. Object.getOwnPropertyNames()
Object.getOwnPropertyNames(obj); // ['name', 'age']

// 2. Object.getOwnPropertySymbols()
Object.getOwnPropertySymbols(obj); // [ Symbol(s1), Symbol(s2) ]

// 3. Reflect.ownKeys()，常规属性始终先出现
Reflect.ownKeys(obj); // [ 'name', 'age', Symbol(s1), Symbol(s2) ]

// 4. Object.getOwnPropertyDescriptors()
Object.getOwnPropertyDescriptors(obj);
/*这里符号属性没有以计算属性语法出现，是因为这是控制台打印的值，而不是我们声明符号属性对象。
{
	name: {...},
	age: {...},
	Symbol(s1): {...},
	Symbol(s2): {...}
}
*/
```

## 4. 常用内置符号

`ES6`引入了一批常用的内置符号，供开发者访问、重写等。通过重新定义内置符号，可以改变原生结构的行为。例如，`for-of`循环会在相关对象上使用`Symbol.iterator`属性，如果我们在自定义对象上重新定义`Symbol.iterator`属性，就可以改变`for-of`在遍历该对象时的行为。**内置符号只是全局函数`Symbol`的字符串属性而已，各自指向一个符号实例。所有的内置符号属性都是不可改写、不可枚举、不可配置的。**符号在`ES`规范中的名称，一般是由前缀`@@`加上字符串属性，如`@@iterator`指`Symbol.iterator`。

### （1）`Symbol.asyncIterator`

这个符号表示实现异步迭代器`for-await-of`的函数。异步循环时，会调用以`Symbol.asyncIterator`为键的函数，并期望这个函数返回一个实现迭代器`API`的对象。很多时候，返回的对象是实现该`API`的异步生成器。

```js
// 声明一个类
class MyClass {
  constructor(length, initIndex) {
    // 初始化长度和初始索引
    this[length] = length;
    this[index] = initIndex;
  }
  // 声明一个以[Symbol.iterator]为键的实例方法，这里是一个异步生成器
  // 当对类的实例使用 for await of 循环时，会调用这个方法得到返回的对象
  // 从技术上讲，此函数返回的对象应该通过next()方法陆续返回Promise实例。可以使用next()隐式返回
  // 也可以通过异步生成器函数返回
  async *[Symbol.iterator]() {
    while (this[index] < this[length]) {
      yield new Promise((resolve) => {
        // 将当前索引作为值传递出去，也可以写复杂点，此处不作例举
        resolve(this[index]++);
      });
    }
  }
}

// 在异步函数中对 MyClass 实例使用 for await of 循环，则会依次得到以上的index
async function getIndex() {
  const instance = new MyClass(5, 0);
  for await (const index of instance) {
    console.log(index);
  }
}
// 调用函数
getIndex();
// 依次打印: 0 1 2 3 4
```

### （2）`Symbol.hasInstance`

该符号属性表示一个方法，用以判断 构造函数/类 是否认可一个对象是其实例，这个方法定义在`Function`的原型即`Function.prototype`上。在使用 `instanceof`操作符时，会调用该函数。

```js
const arr = [1, 2, 3];
console.log(arr instanceof Array); // true

// 修改Array的[Symbol.hasInstance]方法，则再次使用instanceof会优先调用Array本身的方法，
// 而不是Function的原型上的方法
Object.defineProperty(Array, Symbol.hasInstance, {
  // 例如，将其值改为返回false的函数，则Array不再认可任何值为其实例
  value: () => false,
});

console.log(arr instanceof Array); // false
```

### （3）`Symbol.isConcatSpreadable`

根据`ES`规范，这个符号作为一个属性，表示一个布尔值，定义在具体的对象上，用以根据**对象的类型**决定对象是否应该用`Array.prototype.concat`来打平其数组元素：若该值为`true`，则会将类数组对象的数组元素打平之后再进行数组拼接操作；否则将类数组对象作为一个整体与数组进行拼接。

数组对象默认会打平到已有的数组中；类数组对象由该值决定是否打平到已有数组中；其它不是类数组对象的对象，该值会被忽略。

```js
// 类数组对象
let likeArr = {
  0: "name",
  1: "age",
  2: "gender",
  length: 3,
};
let arr1 = [1, 2, 3];
let arr2 = [1, 2, 3];
// 当类数组对象likeArr的[Symbol.isConcatSpreadable]属性不为true时：
console.log(likeArr[Symbol.isConcatSpreadable]); // undefined
arr1.concat(likeArr); // [1, 2, 3, {0: 'name', ...}]
// 定义该属性为true：
likeArr[Symbol.isConcatSpreadable] = true;
arr2.concat(likeArr); // [1, 2, 3, 'name', 'age', 'gender']
```

### （4）`Symbol.iterater`

该符号作为一个属性，表示一个方法，供`for-of`语句使用，返回对象默认的迭代器。简而言之，该符号属性表示实现迭代器`API`的函数。

`for-of`语句循环时，会调用以`Symbol.iterater`为键的函数，并默认该函数会返回一个实现迭代器`API`的对象。很多时候，返回的对象是实现该`API`的`Generator`。技术上来说，返回的对象应该调用其`next()`方法陆续返回值。可以显示地调用`next()`方法返回，也可以通过生成器函数返回。

在执行`for-of`循环时，会沿着原型链查找以`Symbol.iterator`为键的方法。下面的示例改写了`Array`的原型上的`Symbol.iterator`方法，仅供理解与娱乐。

```js
// 默认情况下的for-of循环
const arr = ["猜", "猜", "我", "是", "谁"];
for (let item of arr) {
  console.log(item);
}
// 依次打印： 猜 猜 我 是 谁

// 方法改写
Object.defineProperty(Array.prototype, Symbol.iterator, {
  // 改写生成器函数
  value: function* () {
    const container = ["你", "是", "大", "帅", "比"];
    while (container.length) {
      yield container.shift();
    }
  },
});
// for-of循环行为被改写
for (let item of arr) {
  console.log(item);
}
// 依次打印：你 是 大 帅 比
```

### （5）`Symbol.match`

表示一个方法，用正则表达式去匹配字符串，由`String.prototype.match()`方法使用。正则表达式的原型上默认有这个方法的定义。可以改写该方法以改变默认对正则表达式求值的行为。

### （6）`Symbol.replace`

表示一个正则表达式方法，替换一个字符串中匹配的子串，由`String.prototype.replace()`使用。正则表达式的原型上默认有该方法的定义。默认情况下，传入一个非正则表达式的值，会将该值转化为正则表达式。可以通过改写以`Symbol.replace`为键的方法来改变默认行为，使该方法可以直接使用参数，而不必先将参数转化为正则表达式。

```js
class FooReplacer {
  static [Symbol.replace](target, replacement) {
    return target.split("foo").join(replacement);
  }
}

console.log("barfoobaz".replace(FooReplacer, "qux"));
// "barquxbaz"
```

### （7）`Symbol.search`

表示一个正则表达式方法，返回字符串中匹配正则表达式的索引。由`String.prototype.search()`方法使用。当然，也可以重写该方法，以改变默认行为。

### （8）`Symbol.species`

表示 i 一个函数，作为创建派生对象构造函数。在**内置类型中最为常用**，用于对内置类型实例方法的返回值暴露实例化派生对象的方法。用`Symbol.species`定义静态的获取器方法(getter)，可覆盖创建实例的**原型定义**。

```js
// 继承Array
class NotArray extends Array {
  static get [Symbol.species]() {
    return Array;
  }
}

let notarr = new NotArray();
// 由于继承关系,notarr既属于NotArray又属于Array
console.log(notarr instanceof NotArray); // true
console.log(notarr instanceof Array); // true

notarr = notarr.concat(2);
console.log(notarr instanceof NotArray); // false
console.log(notarr instanceof Array); // true
```

### （9）`Symbol.split`

表示一个正则表达式方法，该方法在匹配正则表达式的索引位置拆分字符串，由`String.prototype.split()`方法使用。正则表达式的原型上默认有这个方法的定义。给这个方法传入的非正则表达式的值，会先被转换为正则表达式。通过重新定义`Symbol.split()`方法，可以改变该行为。

### （10）`Symbol.toPromitive`

该符号属性表示一个方法，将对象转换为对应的原始值，由`ToPrimitive`抽象操作使用。许多内置操作都会尝试将对象转换为原始值。可以通过提供给该函数的参数来控制返回的原始值。

```js
class Bar {
  constructor() {
    this[Symbol.toPrimitive] = function (hint) {
      switch (hint) {
        case "number":
          return 3;
        case "string":
          return "string bar";
        case "default":
        default:
          return "default bar";
      }
    };
  }
}

let bar = new Bar();
console.log(3 + bar); // "3default bar"
console.log(3 - bar); // 0
console.log(String(bar)); // "string bar"
```

### （11）`Symbol.toStringTag`

根据`ES`规范，该符号属性表示一个字符串，用于创建对象的默认字符串描述。由内置方法`Object.prototype.toString()`使用。

通过`toString()`方法获取对象标识时，会检索由`Symbol.toStringTag`指定的实例标识符，默认为`Object`，`JS`内置类型都已经指定了该值，但自定义类实例还需要明确定义，否则该属性为`undefined`，`toString()`方法得到默认的`Object`。

```js
// 内置类型已指定
const set = new Set();
console.log(set.toString()); // [Oject Set]
console.log(set[Symbol.toStringTag]); // Set

// 自定义类实例，不指定该符号属性
class MyClass {
  num = 18;
}
const myclass = new MyClass();
console.log(myclass.toString()); // [Object Object]
console.log(myclass[Symbol.toStringTag]); // undefined

// 自定义实例，指定该符号属性
class UrClass {
  num = ((16)[Symbol.toStringTag] = "UrClass");
}

const urclass = new UrClass();
console.log(urclass.toString()); // [Object UrClass]
console.log(urclass[Symbol.toStringTag]); // UrClass
```

### （12）`Symbol.unscopables`

该符号作为一个属性，表示一个对象，对象所有的以及继承而来的属性，都会从关联对象的`with`环境中排除。给具体的对象设置该符号属性，并将对应的键映射为`true`，则会阻止对象的该属性出现在`with`环境绑定中。

```js
let obj = { name: "cc", age: 18 };
with (obj) {
  console.log(name, age);
  // 'cc' 18
}

// 设置该符号属性并将'name'映射为true，则对象obj的name属性不会在with环境绑定中出现
obj[Symbol.unscopables] = {
  name: true,
};

with (obj) {
  console.log(age);
  // 18
  console.log(name);
  // 报错：ReferenceError
}
```

实际上我们并不推荐使用`with`，因此，该符号属性`Symbol.unScopables`也不推荐使用。
