---
title: JS 温故(一)：script 标签
date: "2022-05-29 14:15"
updated: "2022-03-23 14:15"
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
abbrlink: 7a292634
---

一个月前，更新了`TS`系列。本来要继续其它内容，奈何公司项目开始了，忙到现在，总算能缓一缓。也准备趁机开始源码系列。但是在此之前，我想先温习一下`JS`系列，查漏补缺，内容主要基于`《JS高级程序设计》`

### 1. `script`标签的 8 个属性

- **`async`:** 立即下载，但不阻止其它页面动作，如下载资源或等待其它脚本加载；仅对外部脚本文件有效（即`src`指定路径的文件），保证脚本在页面的`load`事件之前执行，但**不保证脚本执行的顺序**。
- **`charset`：** 使用`src`属性指定的字符集，这个属性基本不会用到。
- **`crossorigin`：** 配置相关请求的`CORS`设置。默认不使用`CORS`。
- **`defer`：** 使脚本延迟到页面内容解析之后再执行，**`html5`规范要求脚本按照出现的顺序依次执行**，只对外部文件有效，但`IE7`及更早版本对行内脚本也有效。
- **`intergrity`：** 允许验证子资源的完整性，一般情况下不会用到。
- **`language`：** 已废弃。
- **`type`：** 设置为`type="module"`才能允许其中的代码被当成`ES6`模块，从而允许使用`import`，`export`等关键字。
- **`src`：** 表示包含指定的要执行的外部文件，此时该`script`标签内不应该再有行内代码，即使有也不会被浏览器执行。

### 2. `script`标签的位置

以往，所有的`script`标签都放在`<head>`里，这意味着要等所有的`js`代码都下载、解析、解释完成后，才会开始页面渲染，因此尽可能把脚本放在`<body>`元素的页面内容之后，可在视觉上加快页面渲染。如果不考虑某些浏览器的古董版本，则添加`defer`属性也会有同样的效果。

### 3. 动态加载脚本

通过手动创建`<script>`标签并指定`src`属性来动态加载脚本，此时创建的`<script>`标签默认开启了`async`属性。

```javascript
let script = document.createElement("script");
script.src = "gibberish.js";
document.head.appendChild(script);
```

某些旧版本浏览器不支持`async`属性，因此如果要统一脚本行为，可将`async`属性指定为`false`，使其具有同步加载行为。

```javascript
let script = document.createElement("script");
script.async = false;
script.src = "gibberish.js";
document.head.appendChild(script);
```

### 4.`<noscript>`标签

当 **浏览器不支持`js`脚本** 或 **浏览器对脚本的支持被关闭**，则包含在`noscript`标签中的内容才会被渲染出来。
