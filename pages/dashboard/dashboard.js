var storage = require('../../utils/storage.js');
var caloriesUtil = require('../../utils/calories.js');
var exerciseDB = require('../../data/exercises');

Page({
  data: {
    loading: true,
    // 顶部问候
    greeting: '早上好',
    userName: 'FitKeep',
    hasUnread: true,
    // 连续坚持
    streakDays: 0,
    // 4 个核心指标
    burn: 0, burnGoal: 800, burnPct: 0,
    duration: 0, durationGoal: 60, durationPct: 0,
    steps: 8420, stepsGoal: 10000, stepsPct: 84,
    water: 1.6, waterGoal: 2.5, waterPct: 64,
    // 本周训练消耗
    weekBurnData: [],
    // 底部占位
    bottomOffset: 200
  },

  onLoad: function () {
    this._setGreeting();
    var that = this;
    setTimeout(function () {
      that._refreshAll();
      that.setData({ loading: false });
    }, 250);
  },

  onShow: function () {
    if (!this.data.loading) this._refreshAll();
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  _setGreeting: function () {
    var h = new Date().getHours();
    var greeting = '晚上好';
    if (h < 6) greeting = '夜深了';
    else if (h < 11) greeting = '早上好';
    else if (h < 14) greeting = '中午好';
    else if (h < 18) greeting = '下午好';
    var profile = storage.getUserProfile() || {};
    var name = profile.nickName || profile.name || 'FitKeep';
    this.setData({
      greeting: greeting + '，继续加油',
      userName: name
    });
  },

  _refreshAll: function () {
    this._refreshCoreMetrics();
    this._refreshWeekBurn();
    this._refreshStreak();
  },

  // 核心 4 指标
  _refreshCoreMetrics: function () {
    var all = storage.getAll();
    var today = new Date();
    var y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
    var todayList = all.filter(function (r) {
      var t = new Date(r.createdAt);
      return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
    });

    // 运动消耗
    var allEx = exerciseDB.exercises.concat(storage.getCustomExercises());
    var exerciseBurn = Math.round(caloriesUtil.calcDayCalories(todayList, allEx));
    var profile = storage.getUserProfile() || {};
    var weight = profile.weight || storage.getLatestWeight() || 70;
    var bmr = (10 * weight + 6.25 * (profile.height || 170) - 5 * (profile.age || 25) + 5);
    var hoursPassed = today.getHours() + today.getMinutes() / 60;
    var bmrBurn = Math.round(bmr * 1.3 * (hoursPassed / 24));
    var burn = exerciseBurn + bmrBurn;
    var burnGoal = 800;

    // 活动时长（分钟）：今天所有训练 duration 总和
    var duration = Math.round(todayList.reduce(function (s, r) {
      return s + ((r.duration || 0) / 60);
    }, 0));
    var durationGoal = 60;

    // 步数/饮水（暂无数据源，使用占位，后续接硬件）
    var stepsData = wx.getStorageSync('daily_steps') || { steps: 0, goal: 10000 };
    var waterData = wx.getStorageSync('daily_water') || { liters: 0, goal: 2.5 };

    this.setData({
      burn: burn,
      burnGoal: burnGoal,
      burnPct: Math.min(100, Math.round(burn / burnGoal * 100)),
      duration: duration,
      durationGoal: durationGoal,
      durationPct: Math.min(100, Math.round(duration / durationGoal * 100)),
      steps: stepsData.steps || 0,
      stepsGoal: stepsData.goal || 10000,
      stepsPct: Math.min(100, Math.round((stepsData.steps || 0) / (stepsData.goal || 10000) * 100)),
      water: waterData.liters || 0,
      waterGoal: waterData.goal || 2.5,
      waterPct: Math.min(100, Math.round((waterData.liters || 0) / (waterData.goal || 2.5) * 100))
    });
  },

  // 本周训练消耗（周一到周日）
  _refreshWeekBurn: function () {
    var all = storage.getAll();
    var now = new Date();
    var dow = now.getDay(); // 0=周日
    var diffToMonday = dow === 0 ? -6 : 1 - dow;
    var monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    var allEx = exerciseDB.exercises.concat(storage.getCustomExercises());
    var dayMap = {};
    for (var i = 0; i < 7; i++) {
      var d = new Date(monday);
      d.setDate(monday.getDate() + i);
      var key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
      dayMap[key] = 0;
    }

    all.forEach(function (r) {
      var t = new Date(r.createdAt);
      if (t.getTime() >= monday.getTime()) {
        var key = t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate();
        if (key in dayMap) {
          var cal = caloriesUtil.calcCalories(r, allEx.find(function (x) { return x.id === r.exerciseId; }) || {}).kcal || 0;
          dayMap[key] += cal;
        }
      }
    });

    var labels = ['一', '二', '三', '四', '五', '六', '日'];
    var data = [];
    var keys = Object.keys(dayMap).sort();
    keys.forEach(function (k, i) {
      data.push({ label: labels[i], value: Math.round(dayMap[k]) });
    });

    this.setData({ weekBurnData: data });
  },

  // 连续打卡天数
  _refreshStreak: function () {
    var all = storage.getAll();
    var set = {};
    all.forEach(function (r) {
      var t = new Date(r.createdAt);
      var key = t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate();
      set[key] = true;
    });

    var streak = 0;
    var cur = new Date();
    cur.setHours(0, 0, 0, 0);
    while (true) {
      var k = cur.getFullYear() + '-' + (cur.getMonth() + 1) + '-' + cur.getDate();
      if (set[k]) {
        streak++;
        cur.setDate(cur.getDate() - 1);
      } else {
        break;
      }
    }
    this.setData({ streakDays: streak });
  },

  // 事件
  onGoNotify: function () {
    wx.showToast({ title: '暂无新消息', icon: 'none' });
  },

  onGoMine: function () {
    wx.navigateTo({ url: '/pages/mine/mine' });
  },

  onGoSchedule: function () {
    wx.switchTab({ url: '/pages/schedule/schedule' });
  },

  onGoDiet: function () {
    wx.switchTab({ url: '/pages/diet/diet' });
  },

  onGoWeight: function () {
    wx.switchTab({ url: '/pages/weight/weight' });
  },

  onGoRecord: function () {
    wx.switchTab({ url: '/pages/record/record' });
  },

  onAddWater: function () {
    var data = wx.getStorageSync('daily_water') || { liters: 0, goal: 2.5 };
    var today = new Date();
    var todayStr = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    if (data.date !== todayStr) {
      data = { liters: 0, goal: 2.5, date: todayStr };
    }
    data.liters = Math.min(data.goal, +(data.liters + 0.25).toFixed(2));
    wx.setStorageSync('daily_water', data);
    this._refreshCoreMetrics();
    wx.showToast({ title: '+250ml', icon: 'none' });
  }
});
