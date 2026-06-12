const storage = require('../../utils/storage.js');
const caloriesUtil = require('../../utils/calories.js');
const { formatTime, humanDuration } = require('../../utils/format.js');
const exerciseDB = require('../../data/exercises');

Page({
  data: {
    records: [],       // 扁平记录（新→旧）
    totalDuration: 0,  // 累计分钟
    totalCalories: 0,  // 累计 kcal
    totalCount: 0,     // 累计次数
    totalDistance: 0   // km（占位）
  },

  onShow: function () {
    this._refresh();
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 }); // 运动记录是第 5 个 Tab
    }
  },

  _refresh: function () {
    var all = storage.getAll();
    var allEx = exerciseDB.exercises.concat(storage.getCustomExercises());
    var now = new Date();
    var todayStr = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
    var yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    var yesterdayStr = yesterday.getFullYear() + '-' + (yesterday.getMonth() + 1) + '-' + yesterday.getDate();

    var totalDuration = 0;
    var totalCalories = 0;

    var records = all.map(function (r) {
      var t = new Date(r.createdAt);
      var tStr = t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate();
      var dayPrefix = '今天';
      if (tStr === yesterdayStr) dayPrefix = '昨天';
      else if (tStr !== todayStr) dayPrefix = (t.getMonth() + 1) + '/' + t.getDate();

      var ex = allEx.find(function (x) { return x.id === r.exerciseId; });
      var cal = caloriesUtil.calcCalories(r, ex || {}).kcal || 0;
      var dur = r.duration || 0; // 秒
      totalDuration += dur;
      totalCalories += cal;

      // 类型：有氧/力量/拉伸
      var type = 'strength';
      var typeLabel = '力量';
      if (r.type === 'time') {
        type = 'cardio';
        typeLabel = '有氧';
      }
      if (ex && ex.category && (ex.category === 'cardio' || ex.category === '有氧')) {
        type = 'cardio';
        typeLabel = '有氧';
      }

      // 元信息
      var meta = humanDuration(dur);
      if (r.sets) meta += ' · ' + r.sets + ' 组';
      if (r.setLogs && r.setLogs.length) meta += ' · ' + r.setLogs.length + ' 组';

      return {
        id: r.id,
        name: r.exerciseName || (ex ? ex.name : '训练'),
        timeLabel: dayPrefix + ' ' + formatTime(r.createdAt),
        calories: Math.round(cal),
        type: type,
        typeLabel: typeLabel,
        meta: meta
      };
    }).sort(function (a, b) {
      return 0; // 保持 all 的顺序（storage.getAll 已经是新→旧）
    });

    this.setData({
      records: records,
      totalDuration: Math.round(totalDuration / 60),
      totalCalories: Math.round(totalCalories),
      totalCount: records.length,
      totalDistance: 0
    });
  },

  onDelete: function (e) {
    var that = this;
    var id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除记录',
      content: '确定删除这条训练记录？',
      confirmColor: '#FF7A2E',
      success: function (res) {
        if (res.confirm) {
          storage.remove(id);
          that._refresh();
        }
      }
    });
  },

  onAddRecord: function () {
    wx.navigateTo({ url: '/pkg/train/train/train' });
  },

  onGoNotify: function () {
    wx.showToast({ title: '暂无新消息', icon: 'none' });
  }
});
