var storage = require('../../utils/storage.js');

Page({
  data: {
    currentWeight: 0,
    currentWaist: 0,
    startWeight: 0,
    weightDelta: 0,
    weightDeltaClass: 'flat',
    weightDeltaText: '持平',
    // 新增指标（暂无数据源，占位）
    bodyFat: 0,
    bodyFatDelta: 0,
    muscleMass: 0,
    muscleDelta: 0,
    bmi: 0,
    bmiDelta: 0,
    // 围度
    chest: 0,
    hip: 0,
    thigh: 0,
    // 录入表单
    inputWeight: '',
    inputWaist: '',
    inputDate: '',
    // 体重趋势图（近 6 个月）
    chartData: [],
    chartLabels: [],   // ['01月', '02月', ...]
    chartValues: [],   // 每月平均体重
    // 体脂率 vs 肌肉量（双线）
    bodyCompLabels: [],
    bodyCompSeries: []
  },

  onLoad: function () {
    var d = new Date();
    var mm = d.getMonth() + 1;
    var dd = d.getDate();
    var dateStr = d.getFullYear() + '-' + (mm < 10 ? '0' + mm : mm) + '-' + (dd < 10 ? '0' + dd : dd);
    this.setData({ inputDate: dateStr });
  },

  onReady: function () {
    var that = this;
    setTimeout(function () {
      that._refreshStats();
      that._refreshChart();
    }, 200);
  },

  onShow: function () {
    if (this._firstShow) {
      this._refreshStats();
      this._refreshChart();
    } else {
      this._firstShow = true;
    }
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 }); // 身体数据是第 4 个 Tab
    }
  },

  _refreshStats: function () {
    var current = storage.getLatestWeight();
    var start = storage.getStartWeight();
    var delta = current > 0 && start > 0 ? (current - start) : 0;
    delta = Math.round(delta * 10) / 10;

    var deltaClass = delta < 0 ? 'down' : (delta > 0 ? 'up' : 'flat');
    var deltaText = delta === 0 ? '持平' : (delta > 0 ? '+' + delta : '' + delta);

    var logs = storage.getWeightLogs();
    var latestWaist = 0;
    for (var i = 0; i < logs.length; i++) {
      if (logs[i].waist > 0) { latestWaist = logs[i].waist; break; }
    }

    // 计算 BMI（需要身高）
    var profile = storage.getUserProfile() || {};
    var height = profile.height || 0; // cm
    var bmi = 0;
    if (height > 0 && current > 0) {
      var h = height / 100;
      bmi = Math.round(current / (h * h) * 10) / 10;
    }

    this.setData({
      currentWeight: current,
      currentWaist: latestWaist,
      startWeight: start,
      weightDelta: delta,
      weightDeltaClass: deltaClass,
      weightDeltaText: deltaText,
      bmi: bmi
    });
  },

  _refreshChart: function () {
    var logs = storage.getWeightLogs();
    var now = new Date();

    // 构造近 6 个月的月份列表（从 6 个月前到现在）
    var months = [];
    for (var i = 5; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1) + '月',
        key: d.getFullYear() + '-' + (d.getMonth() + 1)
      });
    }

    // 按月聚合（取每月平均值）
    var monthMap = {};
    months.forEach(function (m) { monthMap[m.key] = { sum: 0, count: 0 }; });
    logs.forEach(function (l) {
      if (l.weight <= 0) return;
      var ld = new Date(l.createdAt);
      var key = ld.getFullYear() + '-' + (ld.getMonth() + 1);
      if (monthMap[key]) {
        monthMap[key].sum += l.weight;
        monthMap[key].count += 1;
      }
    });

    var chartLabels = months.map(function (m) { return m.label; });
    var chartValues = months.map(function (m) {
      var s = monthMap[m.key];
      return s.count > 0 ? Math.round(s.sum / s.count * 10) / 10 : 0;
    });

    // 过滤为有数据的点（用于 line-chart）
    var filteredLabels = [];
    var filteredValues = [];
    chartLabels.forEach(function (lb, i) {
      if (chartValues[i] > 0) {
        filteredLabels.push(lb);
        filteredValues.push(chartValues[i]);
      }
    });

    // 生成 体脂率 vs 肌肉量 的双线 mock 数据
    // （待接入真实数据时替换为 storage.getBodyCompLogs()）
    var bf = [20, 19.5, 19, 18.8, 18.5, 18];
    var mm = [60, 60.5, 61, 61.2, 61.8, 62];
    var bodyCompLabels = chartLabels.slice();
    var bodyCompSeries = [
      { values: mm, color: '#2196F3' }, // 肌肉（蓝）
      { values: bf, color: '#FF7A2E' }  // 体脂（橙）
    ];

    this.setData({
      chartData: filteredValues.length > 0 ? filteredValues : [],
      chartLabels: filteredLabels,
      chartValues: filteredValues,
      bodyCompLabels: bodyCompLabels,
      bodyCompSeries: bodyCompSeries
    });
  },

  // 事件
  onInputWeight: function (e) {
    this.setData({ inputWeight: e.detail.value });
  },
  onInputWaist: function (e) {
    this.setData({ inputWaist: e.detail.value });
  },
  onPickDate: function (e) {
    this.setData({ inputDate: e.detail.value });
  },

  onSetRange: function (e) {
    // 废弃：保留兼容
  },

  onSubmit: function () {
    this.onSave();
  },

  onSave: function () {
    var w = Number(this.data.inputWeight);
    var waist = Number(this.data.inputWaist);
    if (!w || w <= 0 || w > 300) {
      wx.showToast({ title: '体重数据不合法', icon: 'none' });
      return;
    }
    storage.addWeightLog({
      weight: w,
      waist: waist || 0,
      date: this.data.inputDate,
      note: ''
    });
    wx.showToast({ title: '已保存', icon: 'success' });
    this.setData({ inputWeight: '', inputWaist: '' });
    this._refreshStats();
    this._refreshChart();
  },

  onSetStartWeight: function () {
    var that = this;
    wx.showModal({
      title: '设置初始体重',
      editable: true,
      placeholderText: '如 80 kg',
      success: function (res) {
        if (res.confirm && res.content) {
          var v = Number(res.content);
          if (v > 0 && v < 300) {
            storage.setStartWeight(v);
            that._refreshStats();
            wx.showToast({ title: '已设置', icon: 'success' });
          }
        }
      }
    });
  },

  onGoNotify: function () {
    wx.showToast({ title: '暂无新消息', icon: 'none' });
  },

  noop: function () {}
});
