const doc = document,
  body = doc.body;

// 雨滴数量/回收数量
const maxRainCount = 20,
  maxRecycledCount = 20;

// 注册下雨的页面
const rainingPages = ["/onlyy-blog/", "/onlyy-blog/relax/music/"];

window.addEventListener("DOMContentLoaded", () => {
  console.log("要下雨了", location.pathname);
  if (rainingPages.includes(location.pathname)) {
    window.rain = new Rain();
  }
});

class Rain {
  constructor(opts) {
    if (Rain.__instance) return Rain.__instance;
    this.init(opts);
    this.run();
  }
  // 初始化
  init(opts) {
    opts = opts || Rain.defaultConfig;
    const {
      withVoice = false,
      volume,
      generateDuration,
      dropDuration,
      initialSpeed,
      audioSrc,
      bgSrc,
    } = opts;
    // 下落的雨滴
    this.rains = [];
    // 回收的雨滴
    this.recycledRains = [];
    this.maxRainCount = maxRainCount;
    this.maxRecycledCount = maxRecycledCount;
    this.dropTimer = this.rainTimer = null;
    this.volume = volume || Rain.defaultConfig.volume;
    this.bgSrc = bgSrc || Rain.defaultConfig.bgSrc;
    this.generateDuration =
      generateDuration || Rain.defaultConfig.generateDuration;
    this.dropDuration = dropDuration || Rain.defaultConfig.dropDuration;
    this.initialSpeed = initialSpeed || Rain.defaultConfig.initialSpeed;
    this.boxSize = {};
    this.box = this.initContainer();
    this.getSize(this.box, this.boxSize);
    // 视窗大小变化时，重新设置boxSize
    window.onresize = () => this.getSize(this.box, this.boxSize);
    withVoice && (this.audio = this.createAudio(audioSrc));
    Rain.__instance = this;
  }
  // 初始化容器
  initContainer() {
    let container = doc.getElementById("rain-box");
    if (container) return container;
    container = doc.createElement("div");
    container.id = "rain-box";

    let cssText =
      "position: fixed;width: 100vw;height: 100vh;pointer-events: none; left:0; top:0; z-index:-1;";
    this.bgSrc &&
      (cssText += `background: url(${this.bgSrc}) center/cover no-repeat;`);
    container.style.cssText = cssText;
    body.appendChild(container);
    return container;
  }
  // 获取容器size
  getSize(box, boxSize) {
    boxSize.height = box.clientHeight;
    boxSize.width = box.clientWidth;
  }
  // 生成随机数
  random(n, float = 1) {
    return (Math.random() * n).toFixed(float);
  }
  // 初始化雨滴数值
  initRainState = (rain) => {
    // 初速度
    rain.dataset.speed = this.initialSpeed;
    // 随机透明度
    rain.style.opacity = this.random(1);
    // 初始位置
    rain.style.top = 0;
    rain.style.left = this.random(this.boxSize.width) + "px";
  };
  // 收集雨滴
  collectRain() {
    let rain;
    // 使用回收的rain
    if (this.recycledRains.length) {
      rain = this.recycledRains.shift();
    } else {
      // 创建新的rain
      rain = doc.createElement("div");
      rain.style.cssText =
        "position: absolute;width: 2px;height: 50px;background-image: linear-gradient(rgba(255, 255, 255, 0.3),rgba(255, 255, 255, 0.6));";

      // 添加到容器中
      this.box.appendChild(rain);
    }
    this.initRainState(rain);
    this.rains.push(rain);
  }
  // 销毁雨滴
  pruneRain(rain) {
    this.rains.splice(this.rains.indexOf(rain), 1);
    this.box.removeChild(rain);
    rain = null;
  }
  // 回收雨滴
  recycleRain(rain) {
    this.recycledRains.push(rain);
    this.rains.splice(this.rains.indexOf(rain), 1);
  }
  // 创建背景音效播放器
  createAudio = (src) => {
    if (this.audio) return this.audio;
    const audio = doc.createElement("audio");
    audio.autoplay = false;
    audio.style.display = "none";
    audio.volume = this.volume;
    audio.loop = "loop";
    src && (audio.src = src);
    this.box.appendChild(audio);
    window.onclick = () => audio.play();
    return audio;
  };
  // 运行
  run() {
    this.generateRain();
    this.fallDown();
  }
  // 定时生成雨滴
  generateRain() {
    this.rainTimer = setInterval(() => {
      if (this.rains.length <= this.maxRainCount) {
        this.collectRain();
      }
    }, this.generateDuration);
  }
  // 雨滴定时下落
  fallDown() {
    this.dropTimer = setInterval(() => {
      this.rains.forEach((rain) => {
        // 获取雨滴的速度和高度
        const speed = parseInt(rain.dataset.speed),
          top = parseInt(rain.style.top);
        // 当 雨滴落在青青草地， 雨滴销毁
        if (top >= this.boxSize.height) {
          return this.recycledRains.length > this.maxRecycledCount
            ? this.pruneRain(rain)
            : this.recycleRain(rain);
        }
        // 高度调整
        rain.style.top = top + (speed * this.dropDuration) / 10 + "px";
        // 模拟重力使速度增加
        rain.dataset.speed = speed + 1;
      });
    }, this.dropDuration);
  }
  // 暂停背景音效
  mute() {
    this.audio.pause();
  }
  // 播放背景音效
  play() {
    this.audio.play();
  }
  // 更新实例
  update(opts) {
    opts = opts || {
      volume: 0.3,
      generateDuration: 30,
      dropDuration: 20,
      initialSpeed: 3,
      audioSrc: "./rain.mp3",
      bgSrc: "./bg.png",
    };
    this.init(opts);
  }
  // 卸载
  unmount() {
    // 移除元素
    body.removeChild(this.box);
    // 断开引用
    this.box = null;
    this.audio = null;
    this.rains = this.recycledRains = [];
    // 清理定时器
    clearInterval(this.dropTimer);
    clearInterval(this.rainTimer);
    // 重置单一实例为空
    Rain.__instance = null;
  }

  static {
    this.__instance = null;
    this.defaultConfig = {
      volume: 0.3,
      generateDuration: 30,
      dropDuration: 20,
      initialSpeed: 3,
      audioSrc: "./rain.mp3",
      bgSrc: "./bg.png",
    };
  }
}
