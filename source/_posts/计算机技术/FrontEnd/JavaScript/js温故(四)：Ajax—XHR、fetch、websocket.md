---
title: js温故(四)：Ajax—XHR、fetch、websocket
date: "2022-07-05 01:24"
updated: "2022-07-05 01:24"
tags:
  - 前 端
  - JavaScript
keywords:
  - 前端
  - JavaScript
  - JS
  - fetch
  - websocket
categories:
  - 前端
  - JavaScript
abbrlink: 90f04b7f
---

## 一、`XMLHttpRequest` 对象

所有现代浏览器都支持通过`XMLHttpRequest`构造函数来原生支持`XHR`对象：`const xhr = new XMLHttpRequest()`。

### 1. 使用`XHR`

使用`XHR`第一步便是调用`open()`方法，其接收三个参数：请求的类型(如`get`)，`url`，以及一个布尔值表示请求是否为异步。例如，`xhr.open('get', 'www.baidu.com', false)` 表示将要向`www.baidu.com`发送一个同步的`get`请求。有两点需要注意：

- 这里得第二个参数`url`一般是相对于当前页面的，不过也可以使用绝对`URL`；
- 调用`open()`方法只是进行初始化，并不会立即发送请求，而是为发送请求做准备，真正开始发送请求还需要调用`send()`方法。

`send()`方法接收一个参数，表示作为请求体发送的数据。`xhr.send({username: 'cc', pwd: 'lovecake'})`。如果不需要请求体，则必须传入`null`：`xhr.send(null)`。调用`send()`方法后，请求就会发送到服务器。由于在`open()`方法里将这个请求设置为同步的，因此在调用`send()`方法后，后续的`js`代码会暂停执行，等到服务器响应后方才恢复执行。当收到相应后，`xhr`对象的一些属性会被填充上响应数据：

- `responseText`：作为相应体返回的文本；
- `responseXML`：如果响应的内容类型是`text/xml`或`application/xml`，则此属性为包含响应数据的`XML DOM`文档；
- `status`：响应的`HTTP`状态；
- `statusText`：响应的`HTTP`状态描述。

当收到响应后，首先应该检查状态码`status`来判断响应是否成功返回。一般来说，**状态码为`2xx`**则表示成功。此外，**状态码为`304`**，表示服务器资源未修改，直接用缓存中的资源，这也意味着响应有效。其它状态码则表示请求失败。

```javascript
const xhr = new XMLHttpRequest();
let url = "www.baidu.com";
xhr.open("get", url, false);
xhr.send(null);

// 检查status
if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304) {
  // 请求成功
  console.log("request success!!");
} else {
  // 请求失败
  console.log("request failed：" + xhr.status);
}
```

尽管`statusText`中也包含状态描述信息，但是它在跨浏览器时并不可靠，因此还是应该用`status`来检查。对于不同的响应类型，**`responseText`始终保存响应体的内容，而`responseXML`只在相应类型为`XML`数据时为有效数据，否则其值为`null`。**

由于设置为同步请求，会阻塞之后的`js`代码，因此，最好使用异步请求。

```javascript
const xhr = new XMLHttpRequest();
let url = "www.baidu.com";

// 第三个参数设置为true，即异步请求
xhr.open("get", url, true);
xhr.send(null);
```

异步请求需要用到`xhr`的`readyState`属性，该属性表示当前请求处于哪个阶段，其可能的值如下：

- 0 ：未初始化，即尚未调用`open()`方法；
- 1 ：已打开。即调用了`open()`方法，但还未调用`send()`；
- 2 ：已发送。已经调用`send()`方法，但还未接收到响应；
- 3 ：接收中，即已接受到部分响应；
- 4 ：完成，即已接收到所有数据，可以使用。

可以看到，我们最需要的就是`readyState`的值为 4。`readyState`的值每次变化时，都会触发`readystatechange`事件，因此，只需要监听`xhr`对象的`readystatechange`事件，该事件没有`event`对象，因此我们判断`readyState`值为 4 时，即请求完成，可进行后续操作。 为保证跨浏览器兼容，**对`readystatechange`事件的监听应在`open()`方法调用之前进行。** 对于不想继续的请求，可以**使用`abort()`方法取消，并断开对`xhr`对象的引用**。由于内存问题，**不推荐复用`xhr`对象**，最好每个请求都重新创建一个。

```javascript
const xhr = new XMLHttpRequest();
let url = "www.baidu.com";
// 监听readystatechange事件，应在open()方法调用之前
// 不推荐使用this来指代xhr对象，在某些浏览器中在这里使用this可能会导致错误
xhr.onreadystatechange = () => {
  // 请求完成
  if (xhr.readyState === 4) {
    // 检查status
    if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304) {
      // 请求成功
      console.log("request success!!");
      // 执行其它操作
      // ...
    } else {
      // 请求失败
      console.log("request failed：" + xhr.status);
      // 处理失败
      // ...
    }
  }
};
xhr.open("get", url, true);
xhr.send(null);

// 由于某些原因可能想取消该请求
xhr.abort();
xhr = null;
```

### 2. `HTTP`头部

每个`HTTP`请求和响应都携带有一些头部信息。`XHR`对象通过一些方法暴露请求和响应相关的头部字段。

默认情况下，`XHR`请求会发送一些头部字段：

- `Accept`：浏览器能够处理的内容类型；
- `Accept-Charset`：浏览器能够显示的字符集；
- `Accept-Encoding`：浏览器能够处理的压缩编码类型；
- `Accept-Language`：浏览器使用的语言；
- `Connection`：浏览器与服务器的连接类型；
- `Cookie`：页面中设置的 Cookie；
- `Host`：发送请求的页面所在的域；
- `Referer`：发送请求的页面的`URL`（这个字段本应是`Referrer`，但是在`HTTP`规范中就拼错了，因此将错就错）；
- `User-Agent`：浏览器的用户代理字符串。

如果需要发送额外的头部字段，可以使用`setRequestHeader()`方法，这个方法应该在`open()`方法之后、`send()`方法之前调用。

```javascript
// 创建xhr对象
const xhr = new XMLHttpRequest();
// 监听readystatechange事件
xhr.onreadystatechange = () => {
  // 请求完成
  if (xhr.readyState === 4) {
    // 检查status
    if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304) {
      // 请求成功
      console.log("request success!!");
      // ...
    } else {
      // 请求失败
      console.log("request failed：" + xhr.status);
    }
  }
};

// 初始化请求
xhr.open("get", "www.baidu.com", true);

// 添加额外的头部字段，最好区别于默认头部字段
xhr.setRequestHeader("custom-header-field", "custom-value");

// 发送请求
xhr.send(null);
```

要读取相应头的信息，可以使用`getResponseHeader()`方法，另外，也可以使用`getAllResponseHeaders()`方法来获取所有的响应头，其值为包含所有响应头部的字符串。

```javascript
const myHeader = xhr.getResponseHeader("my-header"),
  allHeaders = xhr.getAllResponseHeaders();
// getAllResponseHeaders()一般返回如下多行字符串
console.log(allHeaders);
/*
Date: Sun, 14 Nov 2004 18:04:03 GMT
Server: Apache/1.3.29 (Unix)
Vary: Accept
X-Powered-By: PHP/4.3.8
Connection: close
Content-Type: text/html; charset=iso-8859-1
*/
```

### 3. `GET`请求

`GET`请求的查询参数一般都拼接在`URL`后面。对于`XHR`而言，拼接的参数应该经过`encodeURLComponent()`方法来正确编码并添加到`URL`后面，然后传给`open()`方法。如下函数可以将查询字符串参数添加到`URL`后面。

```javascript
function appendURLParams(url, name, value) {
  const symbol = url.indexOf("?") !== -1 ? "?" : "&",
    addedContent = `${encodeURLComponent(name)}=${encodeURLComponent(value)}`;
  return url + symbol + addedContent;
}
```

### 4. `POST`请求

`POST`请求在请求体中携带数据。`XHR`最初主要设计用来发送`XML`数据的，也可以发送字符串。对于服务器而言， `POST`请求与表单提交是不一样的。可以将请求头中的`Content-Type`设置为与表单提交一致，即`application/x-www-formurlencoded`，并且创建对应格式的字符串，来模拟表单提交。

### 5. `XMLHTTPRequest` Level 2

`XMLHTTPRequest` Level 2 进一步发展了`XHR`。

#### (1) `FormData` 类型

`XMLHTTPRequest` Level 2 中新增了`FormData`类型，以便对表单数据进行序列化，或创建与表单类似格式的数据然后通过`XHR`发送。

```javascript
const fd = new FormData();
// 添加数据
fd.append("uname", "cc");
```

使用`append()`方法来添加数据（键可以重复），`delete()`方法来删除所有对应键的数据，`set()`来设置不重复的键，`get()`方法来获取该键的第一条数据，`getAll()`方法得到包含该键对应的所有数据的数组。

#### (2) 超时

给`XHR`对象的`timeout`属性设置一个时间（毫秒），如果超过该时间还未收到响应，则`XHR`对象会触发`timeout`事件，并调用`ontimeout`处理程序。触发`timeout`事件后，`readyState`的值也会变成 4，但是此时访问`xhr.status`会出错。因此，**检查`status`的语句应该放在`try/catch`语句中，当捕获到错误则说明请求超时**。

```javascript
// 创建xhr对象
const xhr = new XMLHttpRequest();
// 监听readystatechange事件
xhr.onreadystatechange = () => {
  try {
    // 请求完成
    if (xhr.readyState === 4) {
      // 检查status
      if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304) {
        // 请求成功
        console.log("request success!!");
        // ...
      } else {
        // 请求失败
        console.log("request failed：" + xhr.status);
      }
    }
  } catch (e) {
    // 超时，一般由ontimeout来处理
  }
};

// 初始化请求
xhr.open("get", "www.baidu.com", true);

// 超时处理
xhr.timeout = 2000; // 设置超时时间2秒钟
xhr.ontimeout = () => {
  console.log("request timeout!!");
  // 其它处理
  // ...
};

// 添加额外的头部字段，最好区别于默认头部字段
xhr.setRequestHeader("custom-header-field", "custom-value");

// 发送请求
xhr.send(null);
```

#### (3) `overrideMimeType()`方法

`overrideMimeType()`方法用于重写`XHR`响应的`MIME`类型。响应返回的`MIME`类型决定了`XHR`对象如何处理响应。例如，如果服务器实际上发送了`XML`数据，但是响应头设置的`MIME`类型是`text/plain`，则`XHR`对象不会将其当作`XML`类型来处理，导致`xhr.responseXML`的值为`null`。此时调用`overrideMimeType()`方法可以强制将响应当成`XML`来处理当然，这个方法应该在调用`send()`方法之前调用。

```javascript
const xhr = new XMLHttpRequest();
xhr.open("get", "www.baidu.com", true);

// 将响应头的MIME类型设置为XML
xhr.overrideMimeType("text/xml");
xhr.send(null);
```

## 二、进度事件 `progress`

进度事件一开始只针对于`XHR`，后来也推广到了其它类似`API`。一般来说，有如下 6 个进度相关的事件：

- `loadstart`：在接收到第一个响应字节时触发；
- `progress`：在接收响应期间反复出发；
- `error`：在请求出错时触发；
- `abort`：在请求终止连接时触发；
- `load`：在成功接收完响应时触发；
- `loadend`：在通信完成时，且在`error`、`abort`、`load`之后触发。

这些事件都比较容易理解，主要说明一下`load`和`progress`：

### 1. `load`事件

`onload`事件处理程序相当于之前的`readyState`的值为 4，简化了操作。它接收一个`event`对象，其`target`为对应的`xhr`对象，但是不是所有浏览器都实现了这个事件的`event`对象，因此，考虑到兼容性，还是应该像之前一样使用`xhr`，而不是`event.target`。当然，只要接收到完响应，就会触发`load`事件，这不受状态码`status`的影响。因此，我们仍然需要检查`status`。

### 2. `progress`事件

在浏览器接收数据期间，`progress`事件会反复触发。每次触发，`onprogress`事件处理程序都会接收一个`event`对象，它的`target`属性是`xhr`对象，且拥有额外的三个属性：`lengthComputable`、`position`、`totalSize` 。其中，`lengthComputable`是一个布尔值，表示进度信息是否可用；`position`表示当前接收到的字节数；`totalSize`表示总字节数。用这些信息就可以展示进度条了。另外，**`onprogress`事件处理程序应该在`open()`事件之前添加**。

```javascript
let xhr = new XMLHttpRequest();
xhr.onload = function (event) {
  if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304) {
    console.log(xhr.responseText);
  } else {
    console.log("Request failed: " + xhr.status);
  }
};
// 监控进度
xhr.onprogress = function (event) {
  let divProgress = document.getElementById("progress");
  if (event.lengthComputable) {
    divProgress.innerHTML =
      "请求完成: " +
      ((event.position / event.totalSize) * 100).toFixed(2) +
      "%";
  }
};
xhr.open("get", "www.baidu.com", true);
xhr.send(null);
```

## 三、 跨域资源共享

由于`XHR`受跨域安全策略限制，默认情况下，`XHR`只能访问与发起请求的页面同在一个域内的资源。跨域资源共享(`CORS`)定义了浏览器与服务器如何进行跨源通信。`CORS`背后的基本思路是使用自定义的`HTTP`头部，允许浏览器与服务器相互了解，来确定请求应该成功或失败。

对于`GET`、`POST`这些简单的请求，没有请求头，且请求体为`text/plain`类型，这样的请求在发送时会额外有一个头部，叫做`Origin`，它包含发送请求的页面的源（协议、域名、端口），从而让服务器确定是否为其提供响应。如果服务器决定响应，就会发送 `Access-Control-Allow-Origin`头部，包含相同的源（协议、域名、端口），或者为`*`，表示资源是公开的。

如果没有这个头部，或者有但是源不匹配，则表示不会响应浏览器请求。无论请求还是响应，都没有`Cookie`信息。跨域`XHR`对象允许访问`status`和`responseText`，也允许同步请求，但是处于安全考虑也做了一些限制：

- 不允许使用`setRequestHeader()`来设置自定义头部；
- 不能接收与发送`cookie`;
- `getAllResponseHeaders()`始终返回空字符串；

### 1. 预检请求

`CORS`通过预检请求的服务器验证机制，允许使用自定义头部、除`GET`、`POST`以外的方法、以及不同请求体的内容类型。在发送这些里面的某种高级选项的请求时，会先向服务器发送一个预检请求，该请求使用`OPTIONS`方法发送并包含如下头部：

- `Origin`：与简单请求相同，为发送请求的页面的源；
- `Access-Control-Request-Method`：请求希望使用的方法；
- `Access-Control-Request-Headers`：用逗号分隔的请求头部列表(可选)。

例如，假设一个`POST`请求的预检请求的头部如下：

```
Origin: http://www.baidu.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: custom-header
```

在该请求发送后，服务器判断是否允许这种类型的请求，并在响应中包含如下头部，来与浏览器沟通这些信息：

- `Access-Control-Allow-Origin`：与简单请求相同，允许访问的源，或者`*`表示资源公开；
- `Access-Control-Allow-Methods`：允许访问的方法，以逗号分隔的列表；
- `Access-Control-Allow-Headers`：服务器允许的头部，以逗号分隔的列表；
- `Access-Control-Max-Age`：缓存预检请求的秒数。预检请求响应后，其结果会按照这个秒数被缓存一段时间，期间再次发送这种类型的请求无需再发送预检请求。

### 2. 凭据请求

默认情况下，跨源请求不提供凭据（`cookie`、`HTTP`认证、客户端`SSL`证书等）。可以将`withCredentials`设置为`true`来表明请求会发送凭据。如果服务器允许带凭据的请求，则可以在响应头中包含如下`HTTP`头部：

```
Access-Control-Allow-Credentials: true
```

如果发送了凭据请求，但是服务器的响应中没有这个头部，则浏览器不会把响应的内容交给`JavaScript`。当然，服务器也可以在预检请求的响应中包含这个头部，来表明这个源允许发送凭据请求。

## 四、 替代性跨源技术

### 1. 图片探测

图片探测是与服务器之间简单、跨域、单向的通信，只能通过设置`src`属性来发送`GET`请求，且无法获取服务器返回的数据。通过动态创建图片，监听它们的`onload`和`onerror`事件处理程序来得知何时收到响应。数据可以通过查询字符串来发送，响应可以随意设置，毕竟浏览器无法得到任何数据，只能通过`onload`和`onerror`来获悉什么时候接收到响应。

### 2. `JSONP`

`JSONP`看起来和`JSON`一样，但是它被包含在函数里。`JSONP`格式包含 **回调** 和 **数据** 两部分。回调是在页面接收到响应之后应该调用的函数，回调函数的名称通常是通过请求来动态指定的。而数据就是作为参数传给回调函数的`JSON`数据。`JSONP`服务通常支持用查询字符串来指定回调函数的名称。

`<script>`标签不受跨源安全策略的限制，因此通过动态生成`<script>`标签并指定其`src`属性来调用`JSONP`。

```javascript
function handleResponse(response) {
  console.log(response);
}
let script = document.createElement("script");
// 通过查询字符串来指定回调函数名称
script.src = "http://www.baidu.com?callback=handleResponse";
document.body.insertBefore(script, document.body.firstChild);
```

## 五、 `Fetch API`

`Fetch API`可以执行所有`XMLHttpRequest`的任务，且更便于使用，接口也更现代化，能够在工作者线程中使用。`Fetch API`必须是异步的。

### 1. 基本使用

`fetch()`方法暴露在全局作用域中，包括主页面线程、模块和工作者线程。

#### (1) 分派请求

`fetch()`方法只有一个必需的参数，即获取资源的`URL`，可以是相对路径或绝对路径。返回一个期约(`Promise` 实例)。

```javascript
let response = fetch("www.baidu.com");
console.log(response); // Promise <pending>
```

当请求完成且资源可用时，该期约会解决为一个`Response`对象，该对象是`API`的封装，可以通过它的某些方法来获取相应的资源。

#### (2) 读取响应

最快的读取响应的方法是读取纯文本内容，这需要调用`Response`对象的`text()`方法，该方法返回一个期约，解决为取得的资源的内容。

```javascript
fetch("test.txt")
  .then((resp) => resp.text())
  .then((data) => console.log(data));
```

#### (3) 处理 状态码 和 失败请求

可以检查`Response`对象的`status`和`statusText`来确定相应状态。成功获取响应的请求一般会得到值为 200 的状态码；请求不存在的资源一般会得到值为 404 的状态码；服务器错误一般是值为 500 的状态码；可以显示地定义`fetch()`遇到重定向时的行为，但是默认行为是跟随重定向，此时响应对象的`redirected`属性会被设置为`true`，而状态码仍然是 200。

哪怕请求看起来失败了（如`status`值为 500），期约也会被解决，我们需要判断状态码来确定请求是否成功。而当请求超时时，期约才会执行拒绝程序。此外，无网络连接、违反`CORS`、`HTTPS`错配等也会导致期约被拒绝。

通过`Response`对象的`url`属性可以检查发起请求的完整`URL`。

```javascript
fetch("/test").then((resp) => console.log(resp.url));

// https://www.baidu.com/test
```

#### (4) 自定义选项

只使用`URL`参数时，`fetch()`默认为`GET`请求，且只使用最低限度的请求头。如果徐奥进一步配置，比如使用`POST`方法、自定义请求头等操作时，就需要传入可选的第二个参数：`init`对象。下面列举一些常用的配置：

- `body`：请求体的内容，必须是`Blob`，`BufferSource`、`FormData`、`URLSearchParams`、`ReadableStream`或`String`的实例；

- `cache`：用于控制浏览器与`HTTP`缓存的交互。如需跟踪缓存的重定向，则请求的`redirect`属性应为`follow`，且不能违反`CORS`。`cache`的值应为以下之一：

  - `Default`：默认值。命中有效的缓存，则`fetch()`返回该缓存，不发送请求；命中无效的缓存，则发送条件式请求，若响应已经改变，则更新缓存的值，且`fetch()`返回新的缓存值；若没有命中缓存，则发送请求并缓存响应，然后`fetch()`返回响应。
  - `no-store`：浏览器不检查缓存，直接发送请求；不缓存响应，直接`fetch()`返回；
  - `reload`：浏览器不检查缓存，直接发起请求；之后缓存响应并`fetch()`返回响应；
  - `no-cache`：未命中缓存则发送请求，并缓存响应，然后`fetch()`返回响应；否则发送条件式请求，若响应已经改变，则更新缓存值然后`fetch()`返回缓存的值；
  - `force-cache`：未命中缓存则发起请求，缓存响应并`fetch()`返回响应；否则，无论命中有效缓存还是无效缓存，都直接返回缓存的值，不发起请求；
  - `only-if-cached`：只有请求模式为`same-origin`时使用缓存；无论命中有效缓存还是无效缓存时，都返回缓存的值，不发送请求；没有命中缓存则返回状态码为 504 (网关超时) 的响应。

<!---->

- `credentials`：用于指定在外派请求时如何包含`cookie`，和`XMLHttpRequest`的`withCredentials`标签类似。值为以下字符串之一：

  - `omit`：不发送`cookie`；
  - `same-origin`：默认值。只在同源请求时发送`cookie`；
  - `include`：无论同源还是跨源请求，都发送`cookie`。

<!---->

- `headers`：用于指定请求头部，必须是`Headers`实例或包含字符串格式的键值对对象。默认为空的`Headers`实例，但是这不意味着不发送请求头，浏览器仍然会跟随请求发送一些头部信息，但是这些请求头对`JavaScript`不可见，但浏览器的网络检查器可以检查到。

<!---->

- `keepalive`：指示浏览器是否允许在页面卸载后请求仍然存在，适合向服务器发送报告事件与分析。值为布尔值，默认为`false`。

- `method`：指定请求的方法，值为以下字符串之一：

  - `GET`，默认值；
  - `POST`;
  - `PUT`;
  - `PATCH`;
  - `DELETE`;
  - `HEAD`;
  - `OPTIONS`;
  - `CONNECT`;
  - `TARCE`。

<!---->

- `mode`：指定请求模式，决定来自跨源请求的响应是否有效。必须是以下字符串之一：

  - `cors`：通过构造函数手动创建`Request`实例时默认值为此，允许遵守`CORS`跨源请求；
  - `no-cors`：其它情况默认值为此，允许不需要发送预检请求的跨源请求，如`HEAD`、`GET`和只带有满足`CORS`请求头部的`POST`请求；响应类型是`opaque`，意思是能读取响应内容；
  - `same-origin`：只允许同源请求；
  - `navigate`：用于支持`HTML`导航，一般用不到。

<!---->

- `redirect`：用于指定如何处理重定向响应。

  - `follow`：默认值，跟踪重定向请求，以最终非重定向的`URL`的响应作为最终响应；
  - `error`：遇到重定向时抛出错误；
  - `manual`：不跟踪重定向，但是返回`opaqueredirect`类型的响应，并暴露期望重定向的`URL`。允许以手动方式跟踪重定向。

<!---->

- `referrer`：用于指定`HTTP`的`Referer`头部的内容，值为以下字符串之一：

  - `no-referrer`：以`no-referrer`作为值；
  - `client/about:client`：以当前`URL`或`no-referrer`作为值；
  - `<URL>`：以伪造的`URL`作为值。伪造`URL`的源必须与执行脚本的源匹配。

### 2. 常见的`Fetch`请求模式

与`XMLHttpRequest`类似，`Fetch`既能够接收数据，也能够发送数据。

#### (1) 发送`JSON`数据

```javascript
let data = JSON.stringify({
  uname: "cc",
  age: 18,
});
// 初始化请求头
let jsonHeaders = new Headers({
  "Content-Type": "application/json",
});
fetch("/send-json-data", {
  method: "POST",
  header: jsonHeaders,
  body: data,
});
```

#### (2) 在请求体中发送参数

请求体可以是`String`实例，这意味着它可以是任意字符串，可以用来发送请求参数。

```javascript
let params = "uname=cc&age=18";
let paramHeaders = new Headers({
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
});
fetch("/send-params", {
  method: "POST",
  header: paramHeaders,
  body: params,
});
```

#### (3) 发送文件

请求体可以是`FormData`实例，因此`fetch()`可以序列化并发送文件字段中的文件。

```javascript
// 初始化一个FormData实例
let formdata = new FormData();
// 选择单文件输入器(假设已经选择了文件)
let fileInput = document.querySelector('input[type="file"]');
// 给formdata添加一个文件
formdata.append("file1", fileInput.files[0]);

// 发送文件
fetch("/send-file", {
  method: "POST",
  body: formdata,
});
```

当然，也可以给`FormData`实例添加多个文件，然后通过`fetch()`发送多个文件。

```javascript
// 初始化一个FormData实例
let formdata = new FormData();
// 选择多文件输入器(假设已经选择了文件)
let fileInput = document.querySelector('input[type="file"][multiple]');

// 给formdata添加多个文件
for (let i = 0; i < fileInput.files.length; i++) {
  formdata.append(`file${i + 1}`, fileInput.files[i]);
}

// 发送文件
fetch("send-files", {
  method: "POST",
  body: formdata,
});
```

#### (4) 加载`Blob`文件

`Fetch API`可以提供`Blob`类型的响应，而`Blob`类型又兼容多种浏览器`API`。以图片为例，可以将图片文件加载到内存，然后将其添加到`HTML`元素上。我们可以使用`Response`对象上的`blob()`方法，该方法返回一个期约，解决为一个`Blob`实例。将这个`Blob`实例传给`URL.createObjectUrl()`方法，可以生成添加给图片元素`src`属性的值：

```javascript
const img = document.createElement("img");

fetch("/cc.jpg")
  .then((resp) => resp.blob())
  .then((blob) => {
    img.src = URL.createObjectUrl(blob);
    document.body.appenChild(img);
  });
```

#### (5) 发送跨源请求

发送跨源请求，响应头需要包含`CORS`头部才能保证浏览器收到响应。若没有这些头部，则跨源请求会失败并抛出错误。如果不需要访问响应，也可以发送`no-cors`请求，此时响应的类型为`opaque`，意思是无法读取响应，这种请求适合作为探测请求。

#### (6) 中断请求

`Fetch API`可以通过 `AbortController/AbortSignal` 对来中断请求。调用`AbortController.abort()`方法会中断所有网络传输，尤其适合传输大型负载的情况 (如长视频) 。中断的`fetch()`请求会导致包含错误的拒绝。

```javascript
const abortController = new AbortController();

fetch("/cc-play-game.mp4", { signal: abortController.signal }).catch(() => {
  console.log("请求已中断！");
});
// 50毫秒后中断请求
setTimeout(abortController.abort, 50);
// 请求已中断！
```

### 3. `Headers`对象

`Headers`是所有请求和响应的头部的容器。每个外派的`Request`请求和入站的`Response`对象都有一个`Headers`实例，可以通过`Request.prototype.header`和`Response.prototype.header`来访问。这两个属性都可以修改，此外，也可以通过`new Headers()`来创建一个`Headers`实例。

#### (1) `Headers` 与 `Map`

这两者极其相似，都有`get()`，`set()`，`delete()`，`has()`等方法。都可以使用一个可迭代对象来初始化。

```javascript
let seed = [["name", "cc"]];

let header = new Headers(seed);
let map = new Map(seed);

console.log(header.get("name")); // cc
console.log(map.get("name")); // cc
```

都有相同的`keys()`，`values()`，`entries()` 迭代器接口。

#### (2) `Headers`独有的特性

`Headers`在初始化时，也可以使用键值对的形式，而`Map`不可以。`Headers`实例的一个字段，可以通过`append()`方法添加多个值，后续的值会以逗号分隔，拼接在原来的值后面。

```javascript
// 以键值对形式初始化
const header = new Headers({
  name: "cc",
});
console.log(header.get("name")); // cc

// 给同一个字段追加值
header.append("name", "yy");
console.log(header.get("name")); // cc,yy
```

#### (3) 头部护卫

头部护卫根据`Request`对象的来源不同而不同，它能保护相关头部字段不被修改，违反护卫限制则会抛出`TypeError`。护卫只能是以下几种之一：

- `none`：在通过构造函数创建`Headers`实例时激活，不会限制字段的修改；
- `request`：在通过构造函数初始化`Headers`实例，且`mode`值不为`no-cors`时激活，不允许修改禁止修改的请求头部；
- `request-no-cors`：在通过构造函数初始化`Headers`实例，且`mode`值为`no-cors`时激活，不允许修改非简单头部；
- `response`：在通过构造函数初始化`Response`对象时激活，不允许修改禁止修改的响应头部；
- `immutable`：在通过`error()`或`redirect()`静态方法初始化`Response`对象时激活，不允许修改任何头部。

### 4. `Request`对象

#### (1) 创建`Request`对象

可以通过构造函数来创建，需要传入一个`input`参数，一般是`URL`。

```javascript
const req = new Request("https://www.baidu.com");
```

也接收第二个参数，一个`init`对象。与`fetch()`接收的参数一样，不在赘述。

#### (2) 克隆`Request`对象

- 使用构造函数来克隆；
- 使用`clone()`方法来克隆。

将一个`Request`实例传给构造函数，可以得到该请求对象的一个副本。如果同时传入了`init`对象，则`init`对象的值会覆盖原来的同名字段。使用这种方法克隆请求对象之后，源请求对象会被标记为 **已使用** ，即其`bodyUsed`属性会变为`true`。如果源对象与新对象不同源，则新对象的`referrer`属性会被清除。此外，如果源对象的`mode`属性为`navigate`，则新对象的`mode`属性会被转换为`same-origin`。

第二中克隆方式是使用`clone()`方法，这个方法会得到一模一样的实例。且不会把任何请求的请求体标记为**已使用**。

需要注意的是，不论使用哪种方式，只有`bodyUsed`为`false`的请求对象才可以被克隆，否则会抛出`TypeError`。

```javascript
let req1 = new Request("https://www.baidu.com");
let req11 = req1.clone(req1);
new Request(req1);
// 没有错误

req1.text(); // 使用req1，会将其bodyUsed标记为true

req1.clone(); // TypeError

new Request(req1); // TypeError
```

#### (3) 在`fetch()`中使用`Request`对象

**给`fetch()`传入`Request`实例，相当于在`fetch()`内部使用`Request`构造函数克隆了一份传入的`Request`实例**。同样的，给`fetch()`对象传入的第二个参数`init`的值会覆盖`Request`实例上的同名字段；请求体被标记为已使用的`Request`实例传给`fetch()`也会抛出`TypeError`；被`fetch()`使用过的请求对象，其请求体会被标记为已使用，无法再次传给`fetch()`使用，当然，没有请求体的`Request`实例不受此限制，因此，如要复用`Request`实例，则每次传给`fetch()`的应该是使用`clone()`方法克隆出来的实例副本。

### 5. `Response`对象

#### (1) 创建`Response`对象

可以通过构造函数创建`Response`对象，且无需任何参数。此时创建的实例各属性均为默认值，因为它并不代表实际的`HTTP`响应。

#### (2) 克隆 `Response`对象

主要使用`clone()`方法，创建一个一模一样的实例副本，且不会将`bodyUsed`属性标记为`true`。

### 6. `Request`、`Response`、`Body`混入

`Request`和`Response`对象都使用了`Fetch API`的`Body`混入，这个混入为两种类型提供了只读的`body`属性 (实现为`ReadableStream`) 、`bodyUsed` (标记 body 流是否已读)，以及一组方法，用于读取`body`流的内容并转换为某种类型的`JavaScript`对象类型。

`Body`混入提供了 5 种方法，用于读取流内容并转换为对应的`JavaScript`对象类型。

#### (1) `Body.text()`

返回一个期约，解决为`utf-8`格式的字符串。如下例演示了在`Response`对象上使用`text()`。

```javascript
fetch("/cc-intro.com")
  .then((resp) => resp.text())
  .then((txt) => console.log(txt));

// <!doctype html><html lang="en">
//   <head>
//     <meta charset="utf-8">
// ...
```

#### (2) `Body.json()`

返回一个期约，解决为`JSON`。

```javascript
fetch("/cc-intro.json")
  .then((resp) => resp.json())
  .then((json) => console.log(json));

// {name: "cc", age: 18}
```

#### (3) `Body.formdata()`

返回一个期约，解决为`FormData`实例。

```javascript
fetch('https://cc.com/form-data')
  .then((response) => response.formData())
  .then((formData) => console.log(formData.get('name'));

// cc
```

#### (4) `Body.arrayBuffer()`

返回期约，解决为`ArrayBuffer`实例。

#### (5) `Body.blob()`

返回期约，解决为`Blob`实例。

#### (6) 一次性流

`Body`混入是建立在`ReadableStream`的基础之上的，因此主体流只能使用一次，这意味着以上五种方法只能选择其中的一种调用一次，再次调用以上任何方法则会报错。

#### (7) 使用`ReadableStream`主体

由于对流的理解尚为浅薄，此处暂时就不班门弄斧来介绍相关要点了。

## 六、 `Beacon API`

在页面关闭(`unload`)事件触发时，分析工具应停止收集信息，并将收集到的信息发送给服务器。异步`XMLHttpRequest`或`fetch()`都不太适合这个任务，因为浏览器会将`unload`事件处理程序中的网络请求取消，毕竟对浏览器而言，没有任何理由需要在页面关闭后还继续发送请求。虽然同步`XMLHttpRequest`可以完成这个任务，但是会造成用户关闭浏览器的延迟，影响用户体验。(实际上，设置`fetch()`中的`init`参数对象的`keepalive`为`true`，也可以允许在页面关闭后维持请求的生命周期。)

为此，`W3C`引入了`Beacon API`来解决这个问题。这个`API`给`navigator`对象增加了一个`sendBeacon()`方法，发送一个`POST`请求。此处不作详细介绍。

## 七、 `Web Socket`

`Web Socket`（套接字）的目标是通过一个长时连接实现与服务器全双工、双向的通信。使用自定义协议：`ws://`、`wss://`，前者是非安全连接，后者是安全连接，而不再使用`http://`、`https://`。使用自定义协议，允许客户端和服务器之间发送非常少的数据，不会给`HTTP`造成任何负担。

### 1. `API`

要创建一个新的`Web Socket`，就要提供一个**绝对`URL`链接**来实例化一个`WebSocket`对象。浏览器同源策略不适用于`Web Socket`，因此传入的`URL`可以是打开到任意站点的链接。而是否与特定源的页面通信，就完全取决于服务器了。

```javascript
const ws = new WebSocket("ws://baidu.com");
```

浏览器在初始化`Web Socket`后会立即简历连接。与`XHR`类似，`Web Socket`也有一个`readyState`属性表示连接状态，但是其取值与`XHR`不一样。

- `WebSocket.OPENING(0)`：正在连接；
- `WebSocket.OPEN`(1)：连接已经建立；
- `WebSocket.CLOSING(2)`：正在关闭连接；
- `WebSocket.CLOSE(3)`：连接已关闭。

`WebSocket`对象没有`readystatechange`事件，不过有与各个状态的其它事件。`readyState`的值从 0 开始。

任何时候都可以调用`close()`方法来关闭连接：`ws.close()`。调用关闭方法之后，`readyState`的值立即变为 2，并在关闭完成之后变为 3。

### 2. 发送 与 接收数据

要向服务器发送数据，可以使用`send()`方法，传入一个字符串、`ArrayBuffer` 或者 `Blob` 。

```javascript
const ws = new WebSocket("wss://www.baidu.com");

let strData = "I am cc",
  arrayBuffer = int8Array.from(["f", "o", "o"]),
  blobData = new Blob(["c", "c", 18]);

// 发送字符串数据
ws.send(strData);
// 发送ArrayBuffer数据
ws.send(arrayBuffer);
// 发送Blob数据
ws.send(blobData);
```

当服务器向客户端发送消息时，`WebSocket`对象会触发`message`事件，可以在`onmessage`事件处理程序中进行处理。该事件与其它消息协议类似，接收一个`event`事件对象，且可以通过`event.data`来访问到有效载荷：

```javascript
ws.onmessage = (event) => {
  console.log(event.data);
  // 其它处理
  // ...
};
```

与`send()`方法相似，接收到的`event.data`也可能是`ArrayBuffer`或`Blob`。这由`WebSocket`对象的`binaryType`决定，该属性可能是`blob`或`arraybuffer`。

### 3. 其它事件

在`WebSocket`的连接生命周期中，有可能会触发其它三个事件：

- `open`：在成功建立连接时触发；
- `error`：在发生错误时触发，触发后连接无法存续；
- `close`：在成功关闭连接时触发。

`WebSocket`事件不支持`DOM LEVEL 2`事件监听（即`addEventListener()`方式），因此需要使用`DOM LEVEL 0`风格的事件处理程序来监听：

```javascript
const ws = new WebSocket("wss://www.baidu.com");

ws.onopen = () => console.log("连接成功！");

ws.onclose = (e) => conssole.log("连接已断开！");

ws.onerror = () => console.log("连接发生错误！！");
```

这三个事件中，只有`close`事件的`event`对象上有额外信息。该对象上有 3 个额外属性：

- `wasClean`：布尔值，表示连接是否干净地关闭；
- `code`：来自服务器的数值状态码；
- `reason`：字符串，包含服务器发来的消息。

可以将这些信息显示给用户，或者记录到日志里。
