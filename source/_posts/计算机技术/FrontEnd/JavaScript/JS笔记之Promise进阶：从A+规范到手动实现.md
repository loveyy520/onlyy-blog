---
title: JS笔记之Promise进阶：从A+规范到手动实现
date: "2022-02-26 19:58"
updated: "2022-02-26 19:58"
tags:
  - 前 端
  - JavaScript
keywords:
  - 前端
  - JavaScript
  - JS
  - Promise
categories:
  - 前端
abbrlink: 20cb1782
---

## 一、Promise A+ 规范

### （一）相关概念

1. **promise**：一个具有**then 方法**的对象/函数，其行为遵循 Promise A+ 规范；

2. **thenable**：具有**then 方法**的对象/函数;

3. **value**：promise 实例的状态为兑现/成功时的值，即<mark> **resolve** </mark> 的参数，可为任意类型；

4. **reason**：promise 实例的状态为拒绝/失败时的值，即<mark> **reject** </mark>的值，表示拒绝/失败的原因；

5. **exception**：异常值

### （二）A+ 规范

1. **states**

Promise 实例的状态，共有三种: pending，fulfilled，rejected。

(1) **pending**：

- 初始状态，可以改变，在 resolve / reject 执行之前都是这个状态。
- 在 resolve 执行后从 pending 状态改变为 fufilled；
- 在 reject 执行后从 pending 状态改变为 rejected；

(2) **fulfilled**：

- 是一种最终状态，不可再发生改变；
- 当处于 pending 状态的 promise 在经过<mark>resolve</mark>之后，其状态会变为 fulfilled；
- 必须有一个 value 值，一般为 resolve 传入的参数，若 resolve 没有传参，则 value 值为 undefined；

(3)**rejected**：

- 也是一种最终状态，不可再发生改变；
- 当处于 pending 状态的 promis 经过<mark>reject</mark>后，其状态会变为 rejected；
- 必须有一个 reason 值，一般为 reject 传入的参数，若未传参数，则 reason 值为 undefined；

需要注意的是，**promise 的状态只能从 pending 状态转变为 fulfilled 或者 rejected**，不可逆转，也不会在 fulfilled 和 rejected 之间转变。因此，一旦 promise 的状态已经是 fulfilled 或者 rejected，即使之后又经过了 resolve 或 reject，promise 的状态也不会再发生变化。

2. **then**方法

根据 A+ 规范，promise 应该提供一个 then 方法，接收两个参数，用于访问最终状态的结果。

```js
const promise = new Promise((resolve, reject) => {
  // ...
});
promise.then(onFulfilled, onRejected);
```

- **then 方法的参数**：<mark>**onFulfilled**</mark>应该是一个**function**，如果不是，则 onFulfilled 应该**被忽略**，而使用内部默认的 function 来替代它。<mark>**onRejected**</mark>同理。
- **onFulfilled**：**在 promise 的状态变为 fulfilled 后**，应该调用 onFulfilled，此时，onFulfilled 的参数是 value；而在 promise 状态变为 fulfilled 之前，则不应该调用此函数。此外，promise 的状态只会发生一次变化，相对应的，**一个 onFulfilled 也只能调用一次**。
- **onRejected**：**在 promise 的状态变为 rejected 后**，应该调用 onRejected，此时，onRejected 的参数是 reason；而在 promise 状态变为 rejected 之前，则不应该调用此函数。此外，promise 的状态只会发生一次变化，相对应的，**一个 onRejected 也只能调用一次**。
- onFulfilled 和 onRejected 的执行环境是在<mark>**微任务**</mark>里。可使用<mark>**queueMicrotask( )**</mark>来将其加入微任务队列，不使用 setTimeout 的原因是：setTimeout 为宏任务，不符合 A+ 规范。
- **then 方法可以多次调用**。在 promise 的状态变为 fulfilled 后，其所有的 onFulfilled 回调按照 then 的顺序执行；在 promise 的状态变为 rejected 后，其所有的 onRejected 回调按照 then 的顺序执行；

  ```js
  const promise = new Promise((resolve, reject) => {
    // ...
  });
  // 可多次调用then方法，其中回调函数按照then的顺序
  promise.then(onFulfilled, onRejected);
  promise.then(onFulfilled, onRejected);
  promise.then(onFulfilled, onRejected);
  promise.then(onFulfilled, onRejected);
  ```

- then 方法的返回值

  **then 方法的返回值应该是一个船新的 promise**。

  ```js
  const promise1 = new Promise((resolve, reject) => {
    // ...
  });
  // then方法返回一个新的promise，与
  const promise2 = promise.then(onFulfilled, onRejected);
  // promise2 同样可以调用then方法
  promise2.then(callback1, callback2);
  ```

  - 根据 onFilfilled 或者 onRejected 执行的结果，假设为 a，调用<mark>**resolvePromise( )**</mark>来解析 promise；
  - 当 onFulfilled 或 onRejected 执行时报错了，则 promise2 就需要被 reject ；
  - 若 promise1 的 then 方法中，onFulfilled 不是一个 function，则会调用内部的默认函数，使 promise2 以 promise1 的 value 来触发 fulfilled 。
  - 若 promise1 的 then 方法中，onRejected 不是一个 function，则会调用内部的默认函数，使 promise2 以 promise1 的 reason 来触发 rejected。

- **resolvePromise( )**

  ```js
  resolvePromise(promise2, a, resolve, reject);
  ```

  接下来进行条件判断：

  - **promise2 === a**，reject Type error；
  - **如果 a 是一个 promise**：

    - a 的状态是 pending，则 promise2 也会处于 pending 状态直至 a 的状态改变；
    - a 的状态是 fulfilled，则 promise2 也以相同的 value 触发 fulfilled；
    - a 的状态是 rejected，则 promise2 以相同的 reason 触发 rejected；

  - **如果 a 是一个 object 或 function**：

    尝试取 a 的 then 方法看是否出错：let then = a.then，若出错则把错误 reject 出去。取到 then 之后，判断 then 的类型，如果 then 是一个函数则通过 call 调用 then：then.call(a)，否则 resolve(a)；

  - **如果 a 是其他类型**，则 resolve (a)；

## 二、如何实现一个 Promise

### 1.定义状态类型

```js
const PENDING = "pending",
  FULFILLED = "fulfilled",
  REJECTED = "rejected";
```

### 2.初始化 class

定义**初始状态**，**value**以及**reason**。

```js
class MyPromise {
  constructor() {
    this.status = PENDING;
    this.value = null;
    this.reason = null;
  }
}
```

### 3.resolve 和 reject

- 更改 status，从 pending 变为 fulfilled 或 rejected；
- 更新 value 或 reason 值；

  ```js
  class MyPromise {
    constructor() {
      // ... 初始化
    }
    resolve(value) {
      if (this.status === PENDING) {
        this.value = value;
        this.status = FULFILLED;
      }
    }
    reject(reason) {
      if (this.status === PENDING) {
        this.reason = reason;
        this.status = REJECTED;
      }
    }
  }
  ```

### 4.构造函数入参

```js
new MyPromise((resolve, reject) => {});
```

- 入参为一个函数 <mark>**resolver**</mark>，resolver 接收两个参数：resolve 和 reject；
- **执行 new Promise 时，就会同步执行这个函数，发生任何的错误就会被 reject 出去。**

```js
class MyPromise {
  constructor(resolver) {
    this.status = PENDING;
    this.value = null;
    this.reason = null;
    if (typeof resolver === "function") {
      // resolver是函数则执行resolver
      // 错误捕获
      try {
        resolver(this.resolve.bind(this), this.reject.bind(this));
      } catch (e) {
        this.reject(e);
      }
    } else {
      // resolver不是函数则抛出错误
      throw new Error(`Promise resolver ${resolver} is not a function`);
    }
  }
  resolve(value) {
    // ...
  }
  reject(reason) {
    // ...
  }
}
```

### 5.then 方法

- 入参：**onFulfilled**，**onRejected**
- 返回值：新的 promise
- 需要配判断入参是否为函数，如果不是则调用默认函数传递 value 和 reason

先来看看下面这个写法。

```js
class MyPromise {
  constructor(resolver) {
    // ... 初始化、执行resolver
  }
  resolve(value) {
    // ...
  }
  reject(reason) {
    // ...
  }
  then(onFulfilled, onRejected) {
    const realOnFulfilled = isFunction(onFulfilled)
      ? onFulfilled
      : (vaule) => value;

    const realOnRejected = isFunction(onRejected)
      ? onRejected
      : (reason) => {
          throw reason;
        };
    const promise2 = new MyPromise((resolve, reject) => {
      switch (this.status) {
        case FULFILLED:
          realOnFulfilled();
          break;
        case REJECTED:
          realOnRejected();
          break;
      }
    });
    return promise2;
  }
  isFunction(func) {
    return typeof func === "function";
  }
}
```

这个写法存在问题，只能处理同步操作，一旦有异步执行 resolve 或 reject，则调用 then 方法时，status 仍为 pending。另外，then 方法可以执行多次，因此，需要两个队列来存储**realOnFulfilled** 和 **realOnrejected**，一旦 status 状态为 pending，则将 realOnFulfilled 和 realOnRejected 添加进队列里，以便后续 status 值发生变化时依次调用。因此做如下改进：

- 增加两个队列<mark>**FULFILLED_CALLBACK_LIST**</mark>和<mark>**REJECTED_CALLBACK_LIST**</mark>分别在 pending 状态时存放 realOnFulfilled 和 realOnRejected；
- 在合适的时机调用队列里的回调函数，有两种方案：

  - 在 resolve 和 reject 里，当 status 变为 fulfilled 或 rejected 时调用相应队列里的函数；
  - **通过存取器 setter 来监听 status**，一旦 status 发生变化，则一次调用相应队列里的处理程序。

  这里我选择了后者，能让代码结构更清晰。如果在 resolve 和 reject 里调用，会增加代码的复杂性和混乱程度。

- 此外，根据 A+ 规范，当 realOnFulfilled 或 realOnRejected 为微任务环境，执行出错时，需要将错误 reject 出去，触发 promise2 的 rejected。且根据其执行得到的结果 a 的不同，会在<mark>**resolvePromise**</mark>中有不同的操作。因此使用<mark>**queueMicrotask( )**</mark>将其放入微任务队列，并封装到<mark>**fulfilledMicroTask**</mark>和<mark>**rejectedMicroTask**</mark>中进行错误捕获。

```js
class MyPromise {
  // 添加队列
  FULFILLED_CALLBACK_LIST = [];
  REJECTED_CALLBACK_LIST = [];

  // 因为使用了存取器，增加一个私有变量_status来储存真正的status的值
  _status = PENDING;

  constructor(resolver) {
    // ... 初始化、执行resolver
  }

  // 通过存取器setter来监听status
  // 需要一个私有变量_status来储存真正的status的值，否则在getter中会死循环
  set status(newStatus) {
    this._status = newStatus;
    switch (newStatus) {
      case FULFILLED:
        this.FULFILLED_CALLBACK_LIST.forEach((callback) =>
          callback(this.value)
        );
        break;
      case REJECTED:
        this.REJECTED_CALLBACK_LIST.forEach((callback) =>
          callback(this.reason)
        );
        break;
    }
  }
  get status() {
    return this._status;
  }

  resolve(value) {
    // ...
  }
  reject(reason) {
    // ...
  }
  then(onFulfilled, onRejected) {
    const realOnFulfilled = this.isFunction(onFulfilled)
      ? onFulfilled
      : (vaule) => value;

    const realOnRejected = this.isFunction(onRejected)
      ? onRejected
      : (reason) => {
          throw reason;
        };
    const promise2 = new MyPromise((resolve, reject) => {
      // 捕获realOnFulfilled执行过程中的错误并reject出去
      const fulfilledMicroTask = () => {
        queueMicrotask(() => {
          try {
            const a = realOnFulfilled(this.value);
            this.resolvePromise(promise2, a, resolve, reject);
          } catch (e) {
            reject(e);
          }
        });
      };
      // 捕获realOnRejected执行过程中的错误并reject出去
      const rejectedMicroTask = () => {
        queueMicrotask(() => {
          try {
            const a = realOnRejected(this.reason);
            this.resolvePromise(promise2, a, resolve, reject);
          } catch (e) {
            reject(e);
          }
        });
      };

      switch (this.status) {
        // 成功时调用realOnFulfilled
        case FULFILLED:
          fulfilledMicroTask();
          break;
        // 拒绝时调用realOnRejected
        case REJECTED:
          rejectedMicroTask();
          break;
        // 等待时将其放入队列
        case PENDING:
          this.FULFILLED_CALLBACK_LIST.push(fulfilledMicroTask);
          this.REJECTED_CALLBACK_LIST.push(rejectedMicroTask);
      }
    });
    return promise2;
  }

  resolvePromise(promise2, a, resolve, reject) {
    // 根据a的值进行不同的操作
  }

  isFunction(func) {
    return typeof func === "function";
  }
}
```

接下来实现<mark>**resolvePromise**</mark>来解析 a 的结果。

```js
// class MyPromise
// ...
resolvePromise(promise2, a, resolve, reject){
  if(promise2 === a){
    return reject(new TypeError('The promise and the return value are the same'));
  }
  if(a instanceof MyPromise){
    queueMicroTask(()=>{
      a.then(
        (res) => {
          this.resolvePromise(promise2, res, resolve, reject);
        },
        reject
      )
    })
  }else if(typeof a === 'object' || typeof a === 'function'){
    if(a === null){
      return resolve(a);
    }
    let then = null;
    try {
      then = a.then;
    } catch(e) {
      return reject(e)
    }
    if(this.isFunction(then)){
      // 保证函数只能调用一次
      let hasCalled = false;
      try {
        then.call(
          x,
          (res) => {
            if(hasCalled) return;
            hasCalled = true;
            this.resolvePromise(promise2, res, resolve, reject)
          }, (e) => {
            if(hasCalled) return;
            hasCalled = true;
            reject(e)
          }
        )
      } catch(e) {
        if(hasCalled){
          return
        }
        reject(e)
      }
    }else{
      resolve(a)
    }
  }else{
    resolve(a)
  }
}

// ...
```

### 6. catch 方法

- catch 实质上就是调用了 then 方法，给第一个参数传入 null，返回一个新的 promise，即 promise2；
- 在 catch 方法未执行完之前，promise2 的 status 将一直是 pending；
- catch 方法执行过程中如果报错，将触发 promise2 的 status 变为 rejected；
- 若 catch 方法执行完毕且没有报错，将触发 promise2 的 status 变为 fulfilled；
- 详见 resolvePromise 方法。

```js
// class MyPromise
// ...

catch(onRejected){
  return this.then(null, onRejected)
}

// ...
```

### 7. Promise.resolve()

静态方法，用提供的参数创建一个 rosolve 过的 promise。

```js
class MyPromise {
  // ...

  static resolve(value) {
    // 只需要resolve，不需要reject
    return new MyPromise((resolve) => {
      resolve(value);
    });
  }

  // ...
}
```

### 8. Promise.reject()

与 Promise.resolve 同理。

```js
class MyPromise {
  // ...

  static reject(reason) {
    return new MyPromise((resolve, reject) => {
      reject(reason);
    });
  }

  // ...
}
```

至此，Promise 的核心功能都已基本实现。还剩下 Promise.all，Promise.race 等静态方法，有空再研究。以上代码整合如下，如有不足或错误之处，还望不吝指出，感激不尽！

```js
// 定义三种状态
const PENDING = "pending",
  FULFILLED = "fulfilled",
  REJECTED = "rejected";

class MyPromise {
  // 添加队列
  FULFILLED_CALLBACK_LIST = [];
  REJECTED_CALLBACK_LIST = [];

  // 因为使用了存取器，增加一个私有变量_status来储存真正的status的值
  _status = PENDING;

  constructor(resolver) {
    this.status = PENDING;
    this.value = null;
    this.reason = null;
    if (typeof resolver === "function") {
      // resolver是函数则执行resolver
      // 错误捕获
      try {
        resolver(this.resolve.bind(this), this.reject.bind(this));
      } catch (e) {
        this.reject(e);
      }
    } else {
      // resolver不是函数则抛出错误
      throw new Error(`Promise resolver ${resolver} is not a function`);
    }
  }

  // 通过存取器setter来监听status
  // 需要一个私有变量_status来储存真正的status的值，否则在getter中会死循环
  set status(newStatus) {
    this._status = newStatus;
    switch (newStatus) {
      case FULFILLED:
        this.FULFILLED_CALLBACK_LIST.forEach((callback) =>
          callback(this.value)
        );
        break;
      case REJECTED:
        this.REJECTED_CALLBACK_LIST.forEach((callback) =>
          callback(this.reason)
        );
        break;
    }
  }
  get status() {
    return this._status;
  }

  resolve(value) {
    if (this.status === PENDING) {
      this.value = value;
      this.status = FULFILLED;
    }
  }
  reject(reason) {
    if (this.status === PENDING) {
      this.reason = reason;
      this.status = REJECTED;
    }
  }

  then(onFulfilled, onRejected) {
    const realOnFulfilled = this.isFunction(onFulfilled)
      ? onFulfilled
      : (vaule) => value;

    const realOnRejected = this.isFunction(onRejected)
      ? onRejected
      : (reason) => {
          throw reason;
        };
    const promise2 = new MyPromise((resolve, reject) => {
      // 捕获realOnFulfilled执行过程中的错误并reject出去
      const fulfilledMicroTask = () => {
        queueMicrotask(() => {
          try {
            const a = realOnFulfilled(this.value);
            this.resolvePromise(promise2, a, resolve, reject);
          } catch (e) {
            reject(e);
          }
        });
      };
      // 捕获realOnRejected执行过程中的错误并reject出去
      const rejectedMicroTask = () => {
        queueMicrotask(() => {
          try {
            const a = realOnRejected(this.reason);
            this.resolvePromise(promise2, a, resolve, reject);
          } catch (e) {
            reject(e);
          }
        });
      };

      switch (this.status) {
        // 成功时调用realOnFulfilled
        case FULFILLED:
          fulfilledMicroTask();
          break;
        // 拒绝时调用realOnRejected
        case REJECTED:
          rejectedMicroTask();
          break;
        // 等待时将其放入队列
        case PENDING:
          this.FULFILLED_CALLBACK_LIST.unshift(fulfilledMicroTask);
          this.REJECTED_CALLBACK_LIST.unshift(rejectedMicroTask);
      }
    });
    return promise2;
  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }

  resolvePromise(promise2, a, resolve, reject) {
    if (promise2 === a) {
      return reject(
        new TypeError("The promise and the return value are the same")
      );
    }
    if (a instanceof MyPromise) {
      queueMicroTask(() => {
        a.then((res) => {
          this.resolvePromise(promise2, res, resolve, reject);
        }, reject);
      });
    } else if (typeof a === "object" || typeof a === "function") {
      if (a === null) {
        return resolve(a);
      }
      let then = null;
      try {
        then = a.then;
      } catch (e) {
        return reject(e);
      }
      if (this.isFunction(then)) {
        // 保证函数只能调用一次
        let hasCalled = false;
        try {
          then.call(
            x,
            (res) => {
              if (hasCalled) return;
              hasCalled = true;
              this.resolvePromise(promise2, res, resolve, reject);
            },
            (e) => {
              if (hasCalled) return;
              hasCalled = true;
              reject(e);
            }
          );
        } catch (e) {
          if (hasCalled) {
            return;
          }
          reject(e);
        }
      } else {
        resolve(a);
      }
    } else {
      resolve(a);
    }
  }

  isFunction(func) {
    return typeof func === "function";
  }

  // 静态方法Promise.resolve()
  static resolve(value) {
    // 只需要resolve，不需要reject
    return new MyPromise((resolve) => {
      resolve(value);
    });
  }

  // 静态方法Promise.reject()
  static reject(reason) {
    return new MyPromise((resolve, reject) => {
      reject(reason);
    });
  }
}
```
