---
title: JS笔记：函数式编程
date: "2022-04-09 22:24"
updated: "2022-04-09 22:24"
tags:
  - 前 端
  - JavaScript
keywords:
  - 前端
  - JavaScript
  - JS
  - 函数式编程
categories:
  - 前端
  - JavaScript
abbrlink: 7fdf3fd8
---

## 一、函数式编程的出现

- 发展史：命令（脚本）式 -> 面向对象 -> 函数式编程

### 1. 从实际问题开始

```javascript
// 1.数组在 `url` 中展示形式
location.search => '?name[]=progressive$%coding&name[]=objective$%coding&name[]=functional$%coding'
// 2.参数提取拼接成数组
['progressive$%coding', 'objective$%coding', 'functional$%coding']
// 3. 手写方法，转换成数组对象
// [{name: 'Progressive Coding'}, {name: 'Objective Coding'}, {name: 'Functional Coding'}]
const _array = ['progressive$%coding', 'objective$%coding', 'functional$%coding']
const _objArr = []

const nameParser(array, objArr){
  array.forEach(item=>{
    let names = item.split('$%')
    let newName = []

    names.forEach(name=>{
      let nameItem = name[0].toUpperCase() + name.slice(1)

      newName.push(nameItem)
    })
    objArr.push({
      name: newName.join(' ')
    })
  })
  return objArr
}

console.log(nameParser(_array, _objArr))
```

### 2. 存在的问题：

- 过程中存在逻辑包裹 -> 看完整段代码，才能明白逻辑

<!---->

- 存在临时变量，且首尾封闭 -> 迭代难度高

### 3. 解决方案：函数式编程

- 需求分析：数组 => 数组对象 => [ 字符串 => 对象 ]，即 `nameParser => [objHelper : string => object]`
- 模块功能明确：`objHelper` => `formatName` + `assembleObj`
- 功能拆分： `objHelper` = `[(split + captialize + join) + assembleObj]`
- 代码实现：

```javascript
const _array = [
  "progressive$%coding",
  "objective$%coding",
  "functional$%coding",
];

// 原子操作
const assembleObj = (key, x) => {
  const obj = {};
  obj[key] = x;
  return obj;
};
const capitalize = (name) => name[0].toUpperCase() + name.slice(1);

// 组装描述，组装合并函数为compose，下文中提到
const formatName = 组装合并(join(" "), map(capitalize), split("$%"));
const objHelper = 组装合并(assembleObj("name"), formatName);
const nameParser = map(objHelper);

// 使用
nameParser(_array);
```

### 4. 拓展：数组的遍历方法的比较

**本质作用：**

- `forEach`注重逻辑处理；
- `map`用于生成处理后的数组；
- `filter`用于生成过滤后的数组；
- `sort`用于生成排序后的数组；

## 二、函数式编程的原理与特点

### 1. 函数式编程的原理

- 加法结合律 | 因式分解 | 完全平方公式

### 2. 理论思想

#### a. 函数是一等公民

- 函数是逻辑功能的落脚点

<!---->

- (实现 + 拼接) 函数

#### b. 声明式编程

函数式编程通过声明式编程来实现。声明需求 => 语义化。

#### c. 惰性执行 - 无缝连接、性能节约

```javascript
// 惰性函数
const program = (name) => {
  const nameList = ["progressive", "objective", "functional"];
  if (nameList.indexOf(name) !== -1) {
    return (program = () => {
      console.log(name);
    });
  }
};

program("progressive")();
console.log("lazy");
program();

// 依次打印 'progressive' 'lazy' 'progressive'
```

#### 3. 无状态与无副作用

- 无状态 - 幂等
- 无副作用 - 不对外部数据做操作，只对传入的参数做处理，必要时需要深拷贝

## 三、实际开发

### 1. 纯函数的改造

纯函数：无状态、无副作用的函数。

### 2. 流水线组装 — 加工 & 组装

- **加工 - 柯里化**：传入一 个参数，返回一个函数接收剩下的参数

```javascript
const sum = (x, y) => x + y;
sum(1, 2);
// 函数柯里化
const add = (x) => {
  return (y) => {
    return x + y;
  };
};
add(1)(2);
// 体系 = 加工 + 组装， 单个加工输入输出应单值化 -> 需求
```

- **函数组装**

  ```javascript
  const compose = (f, g) => f(g(x));

  const sum1 = (x) => x + 1;
  const sum2 = (x) => x + 2;
  compose(sum1, sum2);
  ```

<!---->

- **编程思想比较**：

```javascript
// 命令式
trim(reverse(toUpperCase(map(arr))));
// 面向对象
arr.map().toUpperCase().reverse().trim();
// 函数式: 从右往左执行
const result = compose(trim, reverse, toUpperCase, map);
```

## 四、BOX 与 函子

```javascript
// 一封信
class Mail {
  constructor(content) {
    this.content = content;
  }
  map(fn) {
    return new Mail(fn(this.content));
  }
}

// 1.拆开信
let mail1 = new Mail("love");
// 2.阅读信
let mail2 = mail1.map((mail) => read(mail));
// 3.烧掉信
let mail3 = mail1.map((mail) => burn(mail));
// 4.老师检查，没有发现
mail3.map((mail) => check(mail));

// 链式
new Mail("love").read().burn().check();
```
