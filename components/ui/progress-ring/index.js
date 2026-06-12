Component({
  properties: {
    // 当前值
    value: { type: Number, value: 0 },
    // 目标值（用于计算百分比）
    goal: { type: Number, value: 100 },
    // 单位（显示在数值下方）
    unit: { type: String, value: '' },
    // 主题色
    color: { type: String, value: '#80FF00' },
    // 背景色
    bgColor: { type: String, value: 'rgba(255,255,255,0.08)' },
    // 环宽（rpx）
    strokeWidth: { type: Number, value: 16 },
    // 画布尺寸（rpx）
    size: { type: Number, value: 280 },
    // 是否圆弧端点
    roundCap: { type: Boolean, value: true },
    // 底部标签（如"已摄入"）
    label: { type: String, value: '' }
  },

  data: {
    percent: 0
  },

  observers: {
    'value, goal': function (v, g) {
      var pct = g > 0 ? Math.min(1, Math.max(0, v / g)) : 0;
      this.setData({ percent: pct });
      this._draw();
    },
    'color, bgColor, strokeWidth, size': function () {
      this._draw();
    }
  },

  lifetimes: {
    attached: function () {
      var that = this;
      // 等节点挂载后再绘制
      setTimeout(function () {
        that._draw();
      }, 50);
    }
  },

  methods: {
    _draw: function () {
      var that = this;
      if (!this.data) return;
      var id = '#ring-' + this.data._instanceId;
      if (!this._canvasId) this._canvasId = 'ring-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      var canvasId = this._canvasId;

      wx.createSelectorQuery().in(this)
        .select('.progress-ring__canvas')
        .fields({ node: true, size: true })
        .exec(function (res) {
          if (!res || !res[0] || !res[0].node) return;
          var canvas = res[0].node;
          var ctx = canvas.getContext('2d');
          var dpr = wx.getWindowInfo().pixelRatio || 2;
          var size = that.data.size / 2; // rpx to px (750 base)
          // 使用 rpx 转 px
          var sysInfo = wx.getWindowInfo();
          var pxSize = that.data.size * sysInfo.windowWidth / 750;

          canvas.width = pxSize * dpr;
          canvas.height = pxSize * dpr;
          ctx.scale(dpr, dpr);

          var cx = pxSize / 2;
          var cy = pxSize / 2;
          var strokeW = that.data.strokeWidth * sysInfo.windowWidth / 750;
          var radius = (pxSize - strokeW) / 2 - 2;

          // 清空
          ctx.clearRect(0, 0, pxSize, pxSize);

          // 背景圆
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.strokeStyle = that.data.bgColor;
          ctx.lineWidth = strokeW;
          ctx.lineCap = 'round';
          ctx.stroke();

          // 进度弧
          var pct = that.data.percent;
          if (pct > 0) {
            var start = -Math.PI / 2;
            var end = start + Math.PI * 2 * pct;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, start, end);
            ctx.strokeStyle = that.data.color;
            ctx.lineWidth = strokeW;
            ctx.lineCap = that.data.roundCap ? 'round' : 'butt';
            ctx.stroke();
          }
        });
    }
  }
});
