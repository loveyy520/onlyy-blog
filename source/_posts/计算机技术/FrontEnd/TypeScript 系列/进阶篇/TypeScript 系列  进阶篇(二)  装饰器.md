---
title: TypeScript 系列  进阶篇(二)  装饰器
date: "2022-03-07 16:03"
updated: "2022-03-07 16:03"
tags:
  - 前 端
  - TypeScript
keywords:
  - 前端
  - TypeScript
  - TS
  - 装饰器
categories:
  - 前端
abbrlink: 75816c7c
---

装饰器可以为类提供附加功能。在`JS`中，装饰器仍是第 2 阶段的提案，而在`TS`中，可作为一项实验性功能来使用，增强类的功能。

## 〇、启用装饰器

由于装饰器是一项实验性功能，因此需要在**命令行 或 `tsconfig.json`**配置文件中启用。

### 1. 命令行启用

在执行编译命令时 加入 **`--experimentalDecorators`**：

```powershell
npx tsc --target ES5 --experimentalDecorators
```

### 2. 在`tsconfig.json`中启用

只需要修改配置文件即可：

```json
{
  "compilerOptions": {
    "target": "ES5",
    "experimentalDecorators": true
  }
}
```

## 一、装饰器

装饰器是一个函数，可以被附加到类的声明、方法、存取器、属性甚至是参数上，从而提供附加功能。装饰器的形式为 **`@ func*`**，其中 `func` 是一个函数。例如，我们给出一个 `@sealed` 装饰器，则应该有相应的 `sealed` 函数：

```ts
function sealed(target) {
  // ...
}
```

## 二、装饰器工厂函数

装饰器工厂是一个函数，其返回值是一个装饰器。我们可以调用装饰器工厂函数，来得到装饰器，即形式为：**`@ decoratorFactory( )`**，注意与直接写装饰器的形式的区别。**装饰器形式无法手动传入参数，但是装饰器工厂函数可以！** 因此，如果是需要传参的装饰器，我们应该使用装饰器工厂，让其返回一个装饰器。

装饰器工厂返回值的类型为装饰器的类型，`TS`已内置提供：

- 类装饰器类型：`ClassDecorator`；
- 方法装饰器类型：`MethodDecorator`；
- 属性装饰器：`PropertyDecorator`；
- 存取器装饰器：未提供；
- 参数装饰器：`ParameterDecorator`；

```ts
// 类装饰器工厂函数
function food(): ClassDecorator {
  // ...
  // 返回一个类装饰器
  return function (target) {
    // ...
  };
}
```

## 三、装饰器的组合

多个装饰器可以组合使用，可以写在单行，也可以写在多行。例如，用 `@f` 和 `@g` 来装饰 `x`：

```ts
// 单行
@f @g x

// 多行
@f
@g
x
```

组合使用的装饰器，和数学中的函数嵌套一样。如上面的栗子在数学中表达为 `f( g(x) )`。因此，装饰器的执行顺序是由内而外的，即内层装饰器函数先执行，再将得到的结果传给外层装饰器调用。但是如果我们用的是装饰器工厂，则**工厂函数会自上而下先执行，之后装饰器函数则下而上执行**。

```ts
function first() {
  console.log("first(): factory evaluated");
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    console.log("first(): called");
  };
}

function second() {
  console.log("second(): factory evaluated");
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    console.log("second(): called");
  };
}

class ExampleClass {
  @first()
  @second()
  method() {}
}

// 会先执行first工厂函数、second工厂函数，
// 再执行second工厂返回的装饰器、first工厂返回的装饰器函数
// 因此，打印顺序为：
// 'first(): factory evaluated'
// 'second(): factory evaluated'
// 'second(): called'
// 'first(): called'
```

## 四、装饰器的执行顺序

- **参数装饰器**，然后依次是**方法装饰器**，**存取器装饰器**，或**属性装饰器**应用到每个实例成员;
- **参数装饰器**，然后依次是**方法装饰器**，**存取器装饰器**，或**属性装饰器**应用到每个静态成员;
- **参数装饰器**应用到构造函数;
- **类装饰器**应用到类;

## 五、类装饰器

只能在声明一个类之前，来声明类装饰器，不能子声明文件或其它任何环境的上下文中声明。**类装饰器会被应用于类的构造函数上，以该构造函数作为唯一的参数，用于观察、修改或替换类的定义**。如果类装饰器有返回值 (必须是一个函数)，则该**返回值会替换类的构造函数**。需要注意，如果我们要用装饰器返回的函数来替换类的构造函数，那么**应该在手动该函数中调整原型指向**，因为类装饰器的运行时逻辑不会自动来做这些。

搬运一个官方的栗子，通过`seal`装饰器来阻止构造函数和原型被修改，装饰器不会影响到类的继承，我们依然可以给其创建子类。

```ts
@sealed
class BugReport {
  type = "report";
  title: string;

  constructor(t: string) {
    this.title = t;
  }
}

// 装饰器，通过Object.seal方法封闭构造函数和原型，使之无法新增或被删除
function sealed(constructor: Function) {
  Object.seal(constructor);
  Object.seal(constructor.prototype);
}
```

下面的栗子演示了通过类装饰器的返回值来重载类。由于类装饰器不会改变`TS`中的类型，因此即使类被重载了，却依然保留着之前的类型。因此，`TS`并不知道重载后的新属性的存在(实际上是存在的)。

```ts
function reportableClassDecorator<T extends { new (...args: any[]): {} }>(
  constructor: T
) {
  return class extends constructor {
    reportingURL = "http://www...";
  };
}

@reportableClassDecorator
class BugReport {
  type = "report";
  title: string;

  constructor(t: string) {
    this.title = t;
  }
}

const bug = new BugReport("Needs dark mode");
console.log(bug.title); // 打印 "Needs dark mode"
console.log(bug.type); // 打印 "report"

// 敲黑板：TS不知道reportingUrl属性的存在，因此检查机制会报错，
// 但是实际上它是存在的
console.log(bug.reportingURL);
```

## 六、方法装饰器

方法装饰器的声明，位于方法之前，<mark>**作用于方法的属性描述符上**</mark>，**来观察、修改或替换方法的定义**。方法装饰器也不能用于声明文件、函数重载或其它上下文环境中。如果**方法装饰器有返回值，则该返回值会被用作方法的属性描述符**。注意，若**`target`设置为低于 `ES5` 的版本，则属性描述符为 `undefined` ，且方法装饰器的返回值也会被忽略**。

```ts
// 装饰器工厂
function enumerable(val: boolean = true) {
  // 返回一个装饰器，PropertyDescriptor是属性描述符的类型
  // 该装饰器用于根据传入的值修改方法的enumerable属性
  return function (
    target: Function,
    key: string,
    descriptor: PropertyDescriptor
  ) {
    descriptor.enumerable = val;
  };
}

// 用于装饰某个方法
class Person {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  // 将sayHello方法设置为不可遍历(仍然按可以调用，但是无法被遍历出来)
  @enumerable(false)
  sayHello() {
    console.log(`Hello, I am ${this.name}`);
  }
}
```

## 七、存取器装饰器

和方法装饰器一样，存取器装饰器声明于 存取器的声明 之前，作用于存取器的属性描述符，用以观测、修改或替换存取器的定义。存取器装饰器不能用在声明文件或其它上下文环境中。`TS`不允许同时装饰同一个成员的 `get` 和 `set` ，只能按照书写的顺序装饰最先出现的那一个，因为`get`和`set`结合起来，属于同一个属性描述符。

存取器装饰器带有三个参数

- 如果被装饰的是静态成员，则第一个参数为类的构造函数；如果被装饰的是实例成员，则第一个参数是实例成员的原型 `prototype` ；
- 该成员的名字；
- 该成员的属性描述符。

同样的，如果存取器装饰器有返回值，则该返回值被用作该成员的属性描述符；如果`target`设置的版本低于`ES5`，则返回值会被忽略，成员的属性描述符也为`undefined`。

```ts
class Person {
  // 属性
  constructor(public name: string, private _age: number) {}
  @configurale(false)
  get age() {
    return this._age;
  }
}

function configurable(val: boolean) {
  return function (target: Person, key: string, desc: PropertyDescriptor) {
    desc.configurable = val;
  };
}
```

## 八、属性装饰器

属性装饰器声明于属性的声明之前，不能用在声明文件或其它上下文环境中。属性装饰器函数只有两个参数：

- 如果是装饰静态属性，则第一个参数为构造函数；如果装饰实例属性，则第一个参数为实例的原型；
- 属性名；

属性装饰器不支持属性描述符作为参数，其返回值也会被忽略，因为属性是在实例成员身上，而不是在原型身上，目前的机制无法通过修改原型而影响到实例身上的属性。

下面的栗子中使用了`reflect-metadata API`，如果对该`API`没有了解，建议先阅读第十节**`Metadata`**。

```ts
class Greeter {
  // 属性装饰器：提供一个格式化模板，该装饰器函数中声明了元数据，
  // 真正的格式化是在greet中进行的
  @format("Hello, %s")
  greeting: string;
  // 初始化
  constructor(message: string) {
    this.greeting = message;
  }
  greet() {
    // getFormat中获取 metadata 数据
    let formatString = getFormat(this, "greeting");
    return formatString.replace("%s", this.greeting);
  }
}

// 需要先安装依赖 npm i reflect-metadata --save
import "reflect-metadata";
// 元数据的key，使用Symbol避免key的冲突
const formatMetadataKey = Symbol("format");
// 装饰器工厂，将参数为元数据的值，后续获取
function format(formatString: string) {
  // 这里return的返回值事实上会被忽略，
  // 但是通过Reflect.matadata声明的元数据依然存在，
  // 可后续通过Reflect.getMetadata方法获取
  return Reflect.metadata(formatMetadataKey, formatString);
}
// 获取声明的元数据的值，该函数在greet方法中调用，事实上就是获取format传入的
function getFormat(target: any, propertyKey: string) {
  return Reflect.getMetadata(formatMetadataKey, target, propertyKey);
}
```

## 九、参数装饰器

形参装饰器位于形参之前，可用于构造函数或方法中，不可用在声明文件、函数/方法重载以及其它上下文环境中。接收三个参数：

- 如果是装饰静态方法，则第一个参数为构造函数；如果装饰实例方法，则第一个参数是实例的原型；
- 方法名；
- 函数的参数列表中该参数的索引顺序。

参数装饰器仅能用来监测在方法中声明了的参数。下面的栗子同样用到了`reflect-metadata`API，并且使用参数装饰器 `@required`来标记必需的参数，使用方法装饰器`@validate`来进行校验。

```ts
class BugReport {
  type = "report";
  title: string;

  constructor(t: string) {
    this.title = t;
  }
  // 方法装饰器和参数装饰器，还记得执行顺序吗？
  @validate
  print(@required verbose: boolean) {
    if (verbose) {
      return `type: ${this.type}\ntitle: ${this.title}`;
    } else {
      return this.title;
    }
  }
}

// 用到了 reflect-metadata ，需要先引入
import "reflect-metadata";
// 使用Symbol来防止key冲突
const requiredMetadataKey = Symbol("required");

// 参数装饰器函数，接收三个参数
function required(
  target: Object,
  propertyKey: string | symbol,
  parameterIndex: number
) {
  // 获取或者初始化已存在的必需参数数组
  let existingRequiredParameters: number[] =
    Reflect.getOwnMetadata(requiredMetadataKey, target, propertyKey) || [];
  // 将该参数在 函数参数列表中的索引值 添加进 必须参数数组 中
  existingRequiredParameters.push(parameterIndex);
  // 将该必需参数数组设置为自定义的元数据，可在下一次装饰器执行时获取，
  // 或在validate装饰器中校验时获取
  Reflect.defineMetadata(
    requiredMetadataKey,
    existingRequiredParameters,
    target,
    propertyKey
  );
}

// 方法装饰器：校验必需参数
function validate(
  target: any,
  propertyName: string,
  descriptor: TypedPropertyDescriptor<Function>
) {
  // 获取原始方法，并进行非空断言，留着在重写的方法中调用
  let method = descriptor.value!;
  // 重写方法
  descriptor.value = function () {
    // 获取在参数装饰器@required加入的必需参数
    let requiredParameters: number[] = Reflect.getOwnMetadata(
      requiredMetadataKey,
      target,
      propertyName
    );
    // 当存在必需参数时（有参数被@required装饰）
    if (requiredParameters) {
      for (let parameterIndex of requiredParameters) {
        // 如果参数的索引值超出了实参列表长度范围，或者实参列表中该索引对应的参数为undefined
        // 则会抛出错误，从而达到校验的效果
        if (
          parameterIndex >= arguments.length ||
          arguments[parameterIndex] === undefined
        ) {
          throw new Error("Missing required argument.");
        }
      }
    }
    // 调整this指向，类方法中的this指向实例对象
    return method.apply(this, arguments);
  };
}
```

## 十、`Metadata` 元数据

上面的部分栗子使用了 **`reflect-metadata`** 库，它作为垫片给实验性的 `metadata` (元数据) `API` 打补丁，基本都是用作装饰器或在装饰器函数中使用。`Metadata`是`ES7`的提案，这些拓展目前还没成为 `ECMAScript` 的标准，但如果装饰器正式成为 `ECMAScript` 的标准，那么这个库也会被提议采用。

### 1. 安装

使用它需要先进行安装：

```powershell
npm i reflect-metadata --save
```

并且在编译时命令行或者`tsconfig.json`中启用：

- 命令行：

```powershell
npx tsc --target ES5 --experimentalDecorators --emitDecoratorMetadata
```

- `tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES5",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### 2. `Reflect.metadata( )`

该方法通常作为装饰器用于在**类**或者**类方法**中通过`key`, `value`的形式声明元数据，后续可使用 **`Reflect.getMetadata( )`** 方法来获取元数据。

```ts
// 引入
import "reflect-metadata";

@Reflect.metadata("inPerson", "someData1")
class Person {
  @Reflect.metadata("inMethod", "someData2")
  public sayHello(): string {
    console.log("hello!");
  }
}

// 获取声明的类元数据
console.log(Reflect.getMetadata("inClass", Test)); // 'someData1'

// 获取声明的类方法元数据
console.log(Reflect.getMetadata("inMethod", new Person(), "sayHello"));
// 'someData2'
```

### 3. `Reflect.getMetadata( )`

用于获取内置的或者人为声明的元数据。如获取类型信息：

```ts
// 引入
import "reflect-metadata";
// 装饰器工厂
function TypeMeta<T>(): PropertyDecorator {
  return function (target: T, key: string) {
    const type = Reflect.getMetadata("design:type", target, key);
    console.log(`${key} 的 type 为：${type}`);
    // ...
  };
}

// 打印 name 的 type 为：number
class Person {
  @TypeMeta()
  name: number;
}
```

此外，通过`Reflect.getMetadata("design:paramtypes", target, key)` 和 `Reflect.getMetadata("design:returntype", target, key)`可以分别获取函数的参数类型和返回值的类型。

### 4. `Reflect.defineMetadata( )`

此方法通常用在装饰器中自定义`metadataKey`，后续可通过`Reflect.getMetadata()`来获取。

```ts
// 引入
import "reflect-metadata";
// 类装饰器工厂
function classDecoratorFactory(): ClassDecorator {
  // 类装饰器接收一个target参数，通过ClassDecorator可自动推论出target的类型
  return (target) => {
    // 在类上定义元数据，key 为 `classMetaDataKey`，value 为 `value1`
    Reflect.defineMetadata("classMetaDataKey", "value1", target);
  };
}
// 方法装饰器工厂
function methodDecoratorFactory(): MethodDecorator {
  // 方法装饰器接收三个参数，通过MethodDecorator可自动推论参数的类型
  return (target, key, descriptor) => {
    // 在类的原型属性 'myMethod' 上定义元数据，key 为 `methodMetaDataKey`，value 为 `value2`
    Reflect.defineMetadata("methodMetaDataKey", "value2", target, key);
  };
}

@classDecoratorFactory()
class myClass {
  @methodDecoratorFactory()
  myMethod() {}
}

Reflect.getMetadata("classMetaData", myClass); // 'value1'
Reflect.getMetadata("methodMetaData", new myClass(), "myMethod"); // 'value2'
```

装饰器的基本使用就到此为止了，需要深化的话，还得是在项目中实战。下一篇，em，下一篇不晓得写点啥，最近公司的项目也即将开始，后面没有太多时间归纳。嗐，下一篇再见吧！
