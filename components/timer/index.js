// 通用计时器组件
// 模式: countup（正计时，无上限） / countdown（倒计时，到 0 自动停止并触发 finish）
const { formatDuration } = require('../../utils/format.js');

Component({
  properties: {
    mode: {
      type: String,
      value: 'countup'
    },
    initialSeconds: {
      type: Number,
      value: 0
    },
    autoStart: {
      type: Boolean,
      value: false
    }
  },
  data: {
    seconds: 0,
    running: false,
    display: '00:00'
  },
  lifetimes: {
    attached() {
      const init = this.data.mode === 'countdown' ? this.properties.initialSeconds : 0;
      this.setData({ seconds: init, display: formatDuration(init) });
      if (this.properties.autoStart) this.start();
    },
    detached() {
      this._clear();
    }
  },
  methods: {
    start() {
      if (this.data.running) return;
      this.setData({ running: true });
      this._runInterval();
    },
    // 从指定秒数开始计时（用于 Session 跨页累计时长）
    startFrom(seconds) {
      if (this.data.running) this._clear();
      const init = Math.max(0, Math.floor(seconds || 0));
      this.setData({ seconds: init, display: formatDuration(init), running: true });
      this._runInterval();
    },
    _runInterval() {
      this._timer = setInterval(() => {
        let next = this.data.seconds;
        if (this.data.mode === 'countdown') {
          next = next - 1;
          if (next <= 0) {
            next = 0;
            this.setData({ seconds: 0, display: formatDuration(0) });
            this.pause();
            this.triggerEvent('finish');
            return;
          }
        } else {
          next = next + 1;
        }
        this.setData({ seconds: next, display: formatDuration(next) });
        this.triggerEvent('tick', { seconds: next });
      }, 1000);
    },
    pause() {
      this._clear();
      this.setData({ running: false });
    },
    reset() {
      this._clear();
      const init = this.data.mode === 'countdown' ? this.properties.initialSeconds : 0;
      this.setData({ seconds: init, running: false, display: formatDuration(init) });
    },
    toggle() {
      this.data.running ? this.pause() : this.start();
    },
    _clear() {
      if (this._timer) {
        clearInterval(this._timer);
        this._timer = null;
      }
    },
    onTapToggle() {
      this.toggle();
    }
  }
});
