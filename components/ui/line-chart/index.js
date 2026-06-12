Component({
  properties: {
    // 数据：单线 { labels: [], values: [] } 或多线 { labels, series: [{ values, color }] }
    labels: { type: Array, value: [] },
    values: { type: Array, value: [] },
    series: { type: Array, value: [] },
    // 画布尺寸（rpx）
    width: { type: Number, value: 680 },
    height: { type: Number, value: 360 },
    // 主题色（单线时使用）
    lineColor: { type: String, value: '#80FF00' },
    // 是否填充面积
    fillArea: { type: Boolean, value: true },
    // Y 轴刻度（空则自动）
    yTicks: { type: Array, value: [] },
    // 线宽
    lineWidth: { type: Number, value: 3 },
    // 是否显示数据点
    showDot: { type: Boolean, value: true }
  },

  observers: {
    'labels, values, series, width, height': function () {
      // 节流：300ms 内只绘制一次，避免滚动时频繁重绘导致抖动
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
      setTimeout(function () { that._smartDraw(); }, 50);
    }
  },

  methods: {
    // 数据哈希比对：值没变不重绘
    _smartDraw: function () {
      var hash = JSON.stringify({
        l: this.data.labels,
        v: this.data.values,
        s: this.data.series,
        w: this.data.width,
        h: this.data.height
      });
      if (this._lastHash === hash) return;
      this._lastHash = hash;
      this._draw();
    },

    _draw: function () {
      var that = this;
      var labels = this.data.labels || [];
      if (!labels.length) return;

      // 构造 series（兼容单线）
      var series = this.data.series;
      if ((!series || !series.length) && this.data.values.length) {
        series = [{ values: this.data.values, color: this.data.lineColor }];
      }
      if (!series || !series.length) return;

      wx.createSelectorQuery().in(this)
        .select('.line-chart__canvas')
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

          var padding = { top: 30, right: 16, bottom: 34, left: 40 };
          var chartW = pxW - padding.left - padding.right;
          var chartH = pxH - padding.top - padding.bottom;

          // 计算 max / min
          var max = -Infinity, min = Infinity;
          series.forEach(function (s) {
            s.values.forEach(function (v) {
              if (v > max) max = v;
              if (v < min) min = v;
            });
          });

          // Y 轴刻度（优先用传入的，并用其最小/最大值锁定范围）
          var yTicks = that.data.yTicks && that.data.yTicks.length > 0
            ? that.data.yTicks.slice()
            : null;
          var manualRange = false;
          if (yTicks) {
            var tMin = Math.min.apply(null, yTicks);
            var tMax = Math.max.apply(null, yTicks);
            min = tMin;
            max = tMax;
            manualRange = true;
          } else {
            // 留 10% padding
            var range0 = max - min || 1;
            max = max + range0 * 0.1;
            min = min - range0 * 0.1;
            yTicks = [min + (max - min) * 0, min + (max - min) * 0.5, max];
          }
          var range = max - min || 1;

          // Y 轴刻度 + 水平线
          ctx.font = '11px -apple-system';
          ctx.fillStyle = '#5A5C66';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          yTicks.forEach(function (tick) {
            var y = padding.top + chartH - ((tick - min) / range) * chartH;
            // 保留 1 位小数（如果是整数则不显示小数）
            var label = (tick % 1 === 0) ? ('' + tick) : tick.toFixed(1);
            ctx.fillText(label, padding.left - 8, y);
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartW, y);
            ctx.stroke();
          });

          // X 轴标签
          var n = labels.length;
          ctx.fillStyle = '#5A5C66';
          ctx.font = '10px -apple-system';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          labels.forEach(function (lb, i) {
            var x = padding.left + (i / Math.max(1, n - 1)) * chartW;
            ctx.fillText(lb, x, padding.top + chartH + 8);
          });

          // 画每条线
          series.forEach(function (s, si) {
            var color = s.color || that.data.lineColor;
            var vals = s.values;
            var points = vals.map(function (v, i) {
              return {
                x: padding.left + (i / Math.max(1, n - 1)) * chartW,
                y: padding.top + chartH - ((v - min) / range) * chartH
              };
            });

            // 面积填充（深渐变：顶部 55% 不透明度 → 底部 0%）
            if (that.data.fillArea) {
              var grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
              grad.addColorStop(0, color + '88');
              grad.addColorStop(0.6, color + '33');
              grad.addColorStop(1, color + '00');
              ctx.fillStyle = grad;
              ctx.beginPath();
              ctx.moveTo(points[0].x, padding.top + chartH);
              points.forEach(function (p) { ctx.lineTo(p.x, p.y); });
              ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
              ctx.closePath();
              ctx.fill();
            }

            // 线
            ctx.strokeStyle = color;
            ctx.lineWidth = that.data.lineWidth;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.beginPath();
            points.forEach(function (p, i) {
              if (i === 0) ctx.moveTo(p.x, p.y);
              else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();

            // 数据点
            if (that.data.showDot) {
              points.forEach(function (p) {
                ctx.fillStyle = '#1A1B20';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.stroke();
              });
            }
          });
        });
    }
  }
});
