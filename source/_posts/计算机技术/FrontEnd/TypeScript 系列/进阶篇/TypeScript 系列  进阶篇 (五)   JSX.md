---
title: TypeScript 系列 进阶篇 (四) JSX
date: "2022-03-11 15:27"
updated: "2022-03-11 15:27"
tags:
  - 前端
  - TypeScript
keywords:
  - 前端
  - TypeScript
  - TS
  - JSX
  - TSX
categories:
  - 前端
  - TypeScript
abbrlink: baaa9f72
---

`JSX` ，作为一种可嵌入的类 `XML`语法，玩过`react`的同学想必不会陌生。`TypeScript`支持嵌入和类型检查，并且可以直接将`JSX`编译为`JavaScript`。本文就`TypeScript`中的 `JSX`，即`TSX`的用法进行简要介绍。主要资料来源于官方文档，加入了少许自己的理解。

## 一、基础用法

在 TS 中使用`JSX`之前，需要做两个准备：

- 将相关文件的拓展名更改为 `.tsx`；
- 启用`jsx`选项。

TS 附带了三种 `jsx`模式：

- `preserve`：将`JSX`保留为输出的一部分，且输出文件的拓展名为`.jsx`；
- `react`：由`React.createElement`来处理，使用前不需要经过`JSX`转换，输出文件的拓展名为`.js`；
- `react-native`：将`JSX`保留为输出的一部分，输出文件的拓展名为`.js`。

此外，一般还有 `react-jsx`、`react-jsxdev`等模式，此处不作介绍。我们可以在命令行或配置文件里来启用选择模式，例如，在`tsconfig.json`里做如下配置：

```typescript
{
  "compilerOptions": {
    "target": "esnext",
    "module": "esnext",
    "strict": true,
    "jsx": "react",
  }
}
```

## 二、使用 <mark>as</mark> 操作符 与 类型检查

在前面的文章，我们介绍过类型断言的两种写法，一种是尖括号，另一种是使用 `as` 操作符。

```typescript
// 尖括号
const cc = <Person>people1;
// 使用 as
const yy = people2 as Person;
```

由于尖括号的写法类似`xml`标签，在`JSX`中可能引起混淆，因此，TS 不允许在`JSX`中使用尖括号的写法，我们在进行类型断言时应使用`as`操作符。

此外，我们需要区分一个元素标签，到底是一个内置的元素标签，如`<div>`、`<span>`等，还是一个基于值的标签(自定义的标签组件)。一般来说，内置标签的首字母应该小写，而基于值得标签首字母应该大写。而内置元素与基于值的元素也很有区别：

- 内置元素会作为字符串，由`React.createElement("div")`来处理，而基于值的元素不是；
- 内置元素的属性是已知的，而基于值的属性是我们自定义的。

## 三、内置元素 与 基于值的元素

### 1. 内置元素

内置元素会在特殊接口 `JSX.IntrinsicElements`上查找。默认情况下，如果没有指定这个接口，则不会对内置元素进行类型检查。**但如果这个接口存在，则内置元素会作为该接口上的属性进行类型检查。**

```typescript
declare namespace JSX {
  interface IntrinsicElements {
    foo: any;
  }
}
<foo />; // ok
<bar />; // 错误
```

当然，也可以用索引签名，使所有的字符串都能通过类型检查：

```typescript
declare namespace JSX {
  interface IntrinsicElements {
    [x: string]: any;
  }
}
<foo />; // ok
<bar />; // ok
```

### 2. 基于值的元素

基于值的元素，只需根据作用域内的标识符进行查找。

```typescript
import MyComponent from "./myComponent";
<MyComponent />; // ok
```

基于值的元素有两种方式来定义：**函数组件** `Function Component(FC)` 和 **类组件** `Class Component`。

- **函数组件**

  组件如其名，是由`JS`函数来定义的，函数的第一个参数为接收的属性对象 `props`。TS 强制函数的返回值必须满足`JSX.Element`的约束。

  ```typescript
  // 定义props的形状
  interface FooProp {
    name: string;
    X: number;
    Y: number;
  }
  declare function AnotherComponent(prop: { name: string });
  // 函数组件可以是普通的函数
  function ComponentFoo(prop: FooProp) {
    return <AnotherComponent name={prop.name} />;
  }
  // 也可以是箭头函数表达式
  const Button = (prop: { value: string }, context: { color: string }) => (
    <button />
  );
  ```

  可以看到，函数组件就是一个`JS`函数，因此，**函数重载**也完全适用。

  ```typescript
  interface ClickableProps {
    children: JSX.Element[] | JSX.Element;
  }

  interface HomeProps extends ClickableProps {
    home: JSX.Element;
  }

  interface SideProps extends ClickableProps {
    side: JSX.Element | string;
  }

  function MainButton(prop: HomeProps): JSX.Element;
  function MainButton(prop: SideProps): JSX.Element;
  function MainButton(prop: ClickableProps): JSX.Element {
    // ...
  }
  ```

  在以前，函数组件被认为是 无状态组件，即`Stateless Function Components (SFC)`。但是在 react 最近的版本中，使用 hooks 可以使函数组件具有像类组件一样的状态。因此，**类型`SFC`及其别名`StatelessComponent`被弃用了**。

- **类组件**

  类组件的类型可以定义，不过在此之前，或许我们得先了解两个术语：元素类 类型，和元素实例 类型。

  - 元素类 类型

    以`<Expr>`为例，元素类的类型为 `Expr`，如果该组件是使用`ES6`的`class`定义出来的，则类的类型为其构造函数和静态成员；如果该组件是由工厂函数定义出来的，则类的类型为该函数。

  - 元素实例 类型

    一旦类的类型确立好之后，元素实例类型便由类类型的**构造签名**或**调用签名**的返回值的联合类型来决定。同样的，在`ES6`的`class`的情况下，元素实例类型就是`class`的实例的类型；如果是工厂函数的情况下，则元素实例的类型是函数返回值的类型。

    ```typescript
    class MyComponent {
      render() {}
    }
    // 对于class，使用构造签名
    const myComponent = new MyComponent();
    // 则元素类类型为 MyComponent
    // 元素实例类型为 { render: () => void }
    function MyFactoryFunction() {
      return {
        render: () => {},
      };
    }

    // 对于工厂函数，使用调用签名
    const myComponent = MyFactoryFunction();
    // 元素类类型为 MyFactoryFunction
    // 元素实例类型为 { render: () => void }
    ```

    元素实例类型 必须符合`JSX.ElementClass`的约束，否则会报错。默认情况下 `JSX.ElementClass`为 `{}`，但是可以自由扩充其属性/方法来限制相应组件的类型。

    ```typescript
    declare namespace JSX {
      interface ElementClass {
        // 扩充一个 render 字段
        render: any;
      }
    }
    class MyComponent {
      render() {}
    }
    function MyFactoryFunction() {
      return { render: () => {} };
    }
    <MyComponent />; // ok
    <MyFactoryFunction />; // ok
    // 以下两个，不符合JSX.ElementClass的约束，用作类组件会报错
    class NotAValidComponent {}
    function NotAValidFactoryFunction() {
      return {};
    }
    <NotAValidComponent />; // 报错
    <NotAValidFactoryFunction />; // 报错
    ```

## 四、属性类型检查

想要进行属性类型检查，首先得定义属性类型。这在内置元素和基于值的元素之间稍许不同。

内置元素是`JSX.IntrinsicElements`上的属性，该属性对应的类型，就是相应内置元素的属性类型。

```typescript
declare namespace JSX {
  interface IntrinsicElements {
    foo: { bar?: boolean };
  }
}
// 元素foo的属性类型为 '{bar?: boolean}'
<foo bar />;
```

基于值的元素，其属性类型取决于 先前定义好的 元素实例类型上的 某个属性 的类型。至于是使用哪个属性，则由`JSX.ElementAttributesProperty`来决定。声明`JSX.ElementAttributesProperty`的时候只能有单个属性，即用来作为属性类型检查的那个元素实例属性。在 TS 2.8 中，如果没有提供`JSX.ElementAttributesProperty`，则类元素的构造签名或者函数组件的调用签名的第一个参数会被用作替代。

```typescript
declare namespace JSX {
  interface ElementAttributesProperty {
    props; // 明确使用哪个属性名用于属性类型检查
  }
}
class MyComponent {
  // 明确元素实例类型上有这个属性
  props: {
    foo?: string;
  };
}
// 元素属性类型是 '{foo?: string}'
<MyComponent foo="bar" />;
```

元素属性类型用于`JSX`中的属性检查，支持可选和必需属性。

```typescript
declare namespace JSX {
  interface IntrinsicElements {
    // 一个必需属性 requireProp 和 一个可选属性 optionalProp
    foo: { requiredProp: string; optionalProp?: number };
  }
}
<foo requiredProp="bar" />; // ok
<foo requiredProp="bar" optionalProp={0} />; // ok
<foo />; // 错误，缺少必需属性 requireProp
<foo requiredProp={0} />; // 错误，必需属性requireProp应该是一个字符串
<foo requiredProp="bar" unknownProp />; // 错误，不存在属性 unknownProp
<foo requiredProp="bar" some-unknown-prop />; // ok，因为some-unknown-prop不是有效的标识符
```

此外，`JSX.IntrinsicAttributes`可用来定义一些提供给`JSX`框架使用的额外属性，如 `React`中的`key`。进一步说，泛型类型`JSX.IntrinsicClassAttributes<T>`可用于为类组件指定相同类型的额外属性。在这种类型中，泛型参数对应于实例类型。一般而言，所有的额外属性应该都是可选的。

## 五、子元素类型检查

在`TS 2.3`版本中，引入了子元素的类型检查。子元素是元素属性类型中的一个特殊属性，`TS`使用`JSX.ElementChildrenAttribute`来决定子元素使用哪个属性名，同样的，`JSX.ElementChildrenAttribute`的声明也应该只具有单个属性。我们同样可以像其它属性一样，明确子元素的类型。

```typescript
interface PropsType {
  // 子元素为 JSX.Element 类型
  children: JSX.Element
  name: string
}
class Component extends React.Component<PropsType, {}> {
  render() {
    return (
      <h2>
        // 子元素插槽
        {this.props.children}
      </h2>
    )
  }
}
// OK, h1标签即为children
<Component name="foo">
  <h1>Hello World</h1>
</Component>
// 错误，h1和h2标签，相当于一个 JSX.Element的数组，即Array<JSX.Element>，而children是JSX.Element类型
<Component name="bar">
  <h1>Hello World</h1>
  <h2>Hello World</h2>
</Component>
// 错误: h1标签和字符串World，相当于Array<JSX.Element | string>，不符合children的JSX.Element类型
<Component name="baz">
  <h1>Hello</h1>
  World
</Component>
```

## 六、<mark>JSX</mark> 的结果类型 与 嵌入表达式

`JSX`表达式的结果类型默认为`any`，我们可以通过`JSX.Element`接口来自定义结果类型，但是无法通过这个接口来检索有关元素、属性和子元素的类型信息，因为这是个黑盒子。

在`JSX`中，我们可以使用花括号`{}`来在标签之间嵌入表达式。

```typescript
const a = (
  <div>
    // 可以嵌入表达式，但是这个表达式本身有误
    {["foo", "bar"].map((i) => (
      <span>{i / 2}</span>
    ))}
  </div>
);
```

这个栗子会导致错误，因为`i`的取值为`"foo"`或者`"bar"`，是字符串，不能用来除以一个数字 `2`。如果要在`React`中使用`JSX`，则需要使用 `React`中的类型，这些类型定义了一些适用于`React`的`JSX`命名空间，有关内容不在此处介绍。
