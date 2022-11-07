---
title: Typescript系列 基础篇 (六) 模块化入门篇
date: "2022-03-05 14:22"
updated: "2022-03-05 14:22"
keywords:
  - 前端
  - TypeScript
  - TS
  - 类型
tags:
  - TypeScript
  - 前端
categories:
  - 前端
  - TypeScript
archive: TypeScript
swiper_index: 55
abbrlink: 7d186aad
---

# Typescript 系列 基础篇 (六) 模块化入门篇

`TS`模块化是建立在`JS`模块化的基础上，与`JS`中的写法有许多的不同之处。`TS`极大地支持了主流的`ESM`和`CommomJs`，也对其他的模块化方案有所兼容。

## 一、`ES` 模块化语法

### 1. _`export`_ 导出

`TS`支持`ES`模块化方案，写法和`JS`中一致。

```typescript
// ModuleA.ts
export var a = 1;
export const b = function () {
  // ...
};
export let c = () => {
  // ...
};
// 设置默认导出项，仅TS中可导出interface、type等
export default interface Person {
  name: string;
  age: number;
}
```

### 2. _`import`_ 导入

- 使用`import`加载其它模块，和`JS`中一致，可以使用 **`as`** 重命名。

```typescript
// main.ts
import { a, b, c as RenamedC } from "./ModuleA";
import Person from "./ModuleA";
```

- 可以混合导入，但是默认项必须写在前面。

```typescript
// main.ts
import Person, { a, b, c as RenamedC } from "./ModuleA";
```

- 可以使用 **`import *`** 来导入所有内容，并用 **`as`** 重命名。

```typescript
// main.ts
import * as M from "./ModuleA";
```

- 可以使用 `import + 文件名` 来导入一个文件，这种情况下，被导入的文件中的代码会被执行，可能会对当前作用域中的变量产生影响。

```typescript
// main.ts
import "./ModuleA";
```

- `TS`特有的语法

  - `JS`中没有`interface`、`type`等概念，没有相应的关键字。因此，`interface`和`type`语句是`TS`特有的导出语法。

    ```typescript
    // ModuleB.ts
    export type Cat = { breed: string; yearOfBirth: number };

    export interface Dog {
      breeds: string[];
      yearOfBirth: number;
    }

    export const c = 1;
    ```

    导入时正常导入就行了。

  - **_`import type`_** 语法

    该语法只能用来导入类型。

    ```typescript
    // 不能导入变量c
    import type { Cat, Dog } from "./ModuleB";
    ```

  - `inline type imports`

    `TS 4.5` 版本允许混合导入类型和变量。**把 `type` 关键字写在导入的类型前面**，不写`type`的则为变量。

    ```typescript
    // 不能导入变量c
    import { type Cat, type Dog, c } from "./ModuleB";
    ```

- 具有 `CommonJs` 表现的 `ES` 语法

  使用 **`export = { // ... }`** 来导出的模块，既可以用`CommonJs`语法导入，也可以用`ESM`的兼容语法 `import a = require('./xxx')` 语法导入。

  ```typescript
  // ModuleX.ts
  export = {
    name: "x",
  };

  // app.ts
  const a = require("./ModuleX"); // 不推荐
  import b = require("./ModuleX"); // 推荐写法
  ```

## 二、`CommonJs` 模块化语法

**通过 全局变量 `module` 上的 `exports` 属性来设置导出的内容**。

```typescript
// MathModule.ts
module.exports = {
  pi: 3.14,
  squareTwo: 1.41,
  phi: 1.61,
};
```

对应的，使用 **`require`** 来导入。

```typescript
// main.ts
const math = require("./MathModule");
// 或者也可以解构
const { pi, squareTwo } = require("./MathModule");
```

`TS`系列基础篇就写到这儿了，累了，`TS`进阶篇再见。另外，想进一步了解`TS`模块化的知识，可以参考我的**`TS`进阶系列**：[深入理解 TS 模块](https://juejin.cn/post/7080089003113840670)。
