Component({
  properties: {
    // 数据: [{ label: '周一', value: 300 }]
    data: { type: Array, value: [] },
    // 画布宽/高（rpx）
    width: { type: Number, value: 680 },
    height: { type: Number, value: 360 },
    // 柱子颜色
    barColor: { type: String, value: '#80FF00' },
    // 背景色
    bgColor: { type: String, value: 'rgba(255,255,255,0.04)' },
    // Y 轴刻度（自动计算若为空）
    yTicks: { type: Array, value: [] },
    // 是否显示数值在柱子上方
    showValue: { type: Boolean, value: false },
    // 是否圆角柱顶
    roundTop: { type: Boolean, value: true }
  },

  observers: {
    'data, width, height, barColor': function () {
      // 节流：300ms 内只绘制一次，避免滚动时抖动
      var that = this;
      if (this._drawTimer) clearTimeout(this._drawTimer);
      this._drawTimer = setTimeout(function () {
        that._smartDraw();
      }, 300);
    }
  },

  lifetimes: {
    attached: function () {
      var that = this;
      setTimeout(function () {
        that._smartDraw();
      }, 50);
    }
  },

  methods: {
    _smartDraw: function () {
      var hash = JSON.stringify({
        d: this.data.data,
        w: this.data.width,
        h: this.data.height,
        c: this.data.barColor
      });
      if (this._lastHash === hash) return;
      this._lastHash = hash;
      this._draw();
    },

    _draw: function () {
      var that = this;
      var data = this.data.data || [];
      if (!data.length) return;

      wx.createSelectorQuery().in(this)
        .select('.bar-chart__canvas')
        .fields({ node: true, size: true })
        .exec(function (res) {
          if (!res || !res[0] || !res[0].node) return;
          var canvas = res[0].node;
          var ctx = canvas.getContext('2d');
          var dpr = wx.getWindowInfo().pixelRatio || 2;
          var sysInfo = wx.getWindowInfo();
          var pxW = that.data.width * sysInfo.windowWidth / 750;
          var pxH = that.data.height * sysInfo.windowWidth / 750;

          canvas.width = pxW * dpr;
          canvas.height = pxH * dpr;
          ctx.scale(dpr, dpr);
          ctx.clearRect(0, 0, pxW, pxH);

          // 布局参数
          var padding = { top: 30, right: 10, bottom: 34, left: 36 };
          var chartW = pxW - padding.left - padding.right;
          var chartH = pxH - padding.top - padding.bottom;

          // 最大值（确保不小于 yTicks 的最大值）
          var yTicks = that.data.yTicks && that.data.yTicks.length > 0
            ? that.data.yTicks.slice()
            : null;
          var max = 0;
          data.forEach(function (d) { if (d.value > max) max = d.value; });
          if (yTicks) {
            yTicks.forEach(function (t) { if (t > max) max = t; });
          }
          max = Math.ceil(max / 100) * 100;
          if (max === 0) max = 100;

          // Y 轴刻度（默认 3 档）
          if (!yTicks) yTicks = [0, Math.round(max / 2), max];

          // 画 Y 轴刻度（左侧）
          ctx.font = '11px -apple-system';
          ctx.fillStyle = '#5A5C66';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          yTicks.forEach(function (tick) {
            var y = padding.top + chartH - (tick / max) * chartH;
            ctx.fillText('' + tick, padding.left - 8, y);
            // 淡灰水平线
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartW, y);
            ctx.stroke();
          });

          // 柱子（柱子更粗，间隙更小）
          var n = data.length;
          var gap = chartW * 0.06 / (n + 1);
          var barW = (chartW - gap * (n + 1)) / n;

          data.forEach(function (d, i) {
            var x = padding.left + gap * (i + 1) + barW * i;
            var h = (d.value / max) * chartH;
            var y = padding.top + chartH - h;

            // 柱身
            ctx.fillStyle = d.color || that.data.barColor;
            if (that.data.roundTop && h > 8) {
              var r = Math.min(6, barW / 2);
              ctx.beginPath();
              ctx.moveTo(x, y + h);
              ctx.lineTo(x, y + r);
              ctx.arcTo(x, y, x + r, y, r);
              ctx.arcTo(x + barW, y, x + barW, y + r, r);
              ctx.lineTo(x + barW, y + h);
              ctx.closePath();
              ctx.fill();
            } else {
              ctx.fillRect(x, y, barW, h);
            }

            // X 轴标签
            ctx.fillStyle = '#5A5C66';
            ctx.font = '10px -apple-system';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(d.label || '', x + barW / 2, padding.top + chartH + 8);

            // 数值
            if (that.data.showValue) {
              ctx.fillStyle = '#FFFFFF';
              ctx.font = 'bold 11px -apple-system';
              ctx.textBaseline = 'bottom';
              ctx.fillText('' + d.value, x + barW / 2, y - 4);
            }
          });
        });
    }
  }
});
