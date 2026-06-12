// 首页：热量缺口仪表盘（减肥核心场景）
var exerciseDB = require('../../data/exercises');
var planDB = require('../../data/plans');
var storage = require('../../utils/storage.js');
var caloriesUtil = require('../../utils/calories.js');
var formatUtil = require('../../utils/format.js');

Page({
  data: {
    greeting: '',
    dateLabel: '',
    weekDay: '',
    // 热量缺口（核心）
    intake: 0,          // 今日摄入 kcal
    burned: 0,          // 今日消耗 kcal（运动 + BMR）
    exerciseBurn: 0,    // 运动消耗
    bmrBurn: 0,         // 基础代谢消耗（按时段）
    gap: 0,             // 缺口 = burned - intake（正值=已赤字）
    intakeGoal: 1900,   // 摄入目标
    gapPercent: 0,      // 缺口进度 %
    // 体重
    currentWeight: 0,
    startWeight: 0,
    weightDelta: 0,
    // 本周打卡
    weekCheckins: 0,
    weekDays: 7,
    weekCheckinDays: [],     // [{dow, label, done, count}] 周一=0 … 周日=6
    // 今日训练预览
    todayPlan: null,
    todayExercises: [],
    todayExerciseCount: 0,
    todayDurationLabel: '0 分钟',
    isTrainingDay: false,
    // UI
    activePlan: null,
    loading: true          // 骨架屏加载态
  },

  onLoad: function () {
    this._setGreeting();
    // 模拟加载态（数据同步计算，但保留 300ms 骨架屏）
    var that = this;
    setTimeout(function () {
      that._refreshAll();
      that.setData({ loading: false });
    }, 300);
  },

  onShow: function () {
    if (!this.data.loading) {
      this._refreshAll();
    }
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
    var now = new Date();
    var weekMap = ['日', '一', '二', '三', '四', '五', '六'];
    this.setData({
      greeting: greeting,
      dateLabel: (now.getMonth() + 1) + '月' + now.getDate() + '日',
      weekDay: '周' + weekMap[now.getDay()]
    });
  },

  _refreshAll: function () {
    this._setGreeting();
    this._refreshCalories();
    this._refreshWeight();
    this._refreshWeekCheckins();
    this._refreshTodayPlan();
  },

  _refreshCalories: function () {
    // 摄入
    var intake = storage.getDayIntake().kcal;
    var intakeGoal = storage.getIntakeGoal();

    // 运动消耗（今日训练记录）
    var all = storage.getAll();
    var today = new Date();
    var y = today.getFullYear();
    var m = today.getMonth();
    var d = today.getDate();
    var todayList = all.filter(function (r) {
      var t = new Date(r.createdAt);
      return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
    });
    var allEx = exerciseDB.exercises.concat(storage.getCustomExercises());
    var exerciseBurn = caloriesUtil.calcDayCalories(todayList, allEx);

    // BMR 消耗（按今天已过时间比例）
    var profile = storage.getUserProfile() || {};
    var bmr = caloriesUtil.calcBMR({
      weight: profile.weight || caloriesUtil.getWeight(),
      height: profile.height || 170,
      age: profile.age || 28,
      gender: profile.gender || 'male'
    });
    var now = new Date();
    var hoursPassed = now.getHours() + now.getMinutes() / 60;
    // 轻度活动系数 1.3（非运动时段）
    var bmrBurn = Math.round(bmr * 1.3 * (hoursPassed / 24));

    var burned = exerciseBurn + bmrBurn;
    var gap = burned - intake;
    // 缺口目标：默认 500kcal（科学减脂速率）
    var gapGoal = 500;
    var gapPercent = gap > 0 ? Math.min(100, Math.round(gap / gapGoal * 100)) : 0;

    // 预计算圆环/文案（避免 wxml 里写复杂三元表达式）
    var gapRingPercent = gapPercent;   // 0~100 环形进度
    var gapNumClass = gap > 0 ? 'gap-ring__num--green' : 'gap-ring__num--red';
    var gapNumText;
    if (gap > 0) gapNumText = '-' + gap;
    else if (gap < 0) gapNumText = '+' + (-gap);
    else gapNumText = '0';
    var gapLabel = gap > 0 ? '已赤字' : (gap < 0 ? '已超量' : '待达成');

    this.setData({
      intake: intake,
      burned: burned,
      exerciseBurn: exerciseBurn,
      bmrBurn: bmrBurn,
      gap: gap,
      intakeGoal: intakeGoal,
      gapPercent: gapPercent,
      gapRingPercent: gapRingPercent,
      gapNumClass: gapNumClass,
      gapNumText: gapNumText,
      gapLabel: gapLabel,
      todayExerciseCount: todayList.length,
      todayDurationLabel: formatUtil.humanDuration(
        todayList.reduce(function (s, r) { return s + (r.duration || 0); }, 0)
      )
    });
  },

  _refreshWeight: function () {
    var current = storage.getLatestWeight();
    var start = storage.getStartWeight();
    var delta = current > 0 && start > 0 ? (current - start) : 0;
    // 保留 1 位小数
    delta = Math.round(delta * 10) / 10;
    this.setData({
      currentWeight: current,
      startWeight: start,
      weightDelta: delta
    });
  },

  _refreshWeekCheckins: function () {
    // 本周（周一开始）每天的打卡状态
    var all = storage.getAll();
    var now = new Date();
    var day = now.getDay();
    var diffToMonday = day === 0 ? -6 : 1 - day;
    var monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    var set = {};
    all.forEach(function (r) {
      var t = new Date(r.createdAt);
      if (t.getTime() >= monday.getTime()) {
        var key = t.getDay();   // 0=周日 1=周一 … 6=周六
        set[key] = (set[key] || 0) + 1;
      }
    });
    var labels = ['一', '二', '三', '四', '五', '六', '日'];
    var todayDow = now.getDay();   // 0=周日
    var todayMonOffset = todayDow === 0 ? 6 : todayDow - 1; // 周一=0 … 周日=6
    var days = labels.map(function (l, i) {
      var dow = i === 6 ? 0 : i + 1; // 标签索引 → Date.getDay
      return {
        dow: dow,
        label: l,
        done: !!set[dow],
        count: set[dow] || 0,
        isToday: i === todayMonOffset
      };
    });
    var count = days.filter(function (d) { return d.done; }).length;
    this.setData({ weekCheckins: count, weekDays: 7, weekCheckinDays: days });
  },

  // 点击打卡圆点 → 显示当天训练详情
  onTapCheckin: function (e) {
    var dow = Number(e.currentTarget.dataset.dow);
    var dayInfo = (this.data.weekCheckinDays || []).find(function (d) { return d.dow === dow; });
    if (!dayInfo) return;
    var labels = { 0: '周日', 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六' };
    if (!dayInfo.done) {
      wx.showToast({ title: labels[dow] + ' 未训练', icon: 'none', duration: 1200 });
      return;
    }
    wx.showToast({
      title: labels[dow] + ' · ' + dayInfo.count + ' 条训练记录',
      icon: 'none',
      duration: 1500
    });
  },

  _refreshTodayPlan: function () {
    var activePlanId = wx.getStorageSync('active_plan');
    if (!activePlanId) {
      this.setData({ activePlan: null, todayPlan: null, todayExercises: [], isTrainingDay: false });
      return;
    }
    var plan = planDB.plans.find(function (p) { return p.id === activePlanId; });
    var custom = false;
    if (!plan) {
      plan = storage.getCustomPlans().find(function (p) { return p.id === activePlanId; });
      custom = true;
    }
    if (!plan) {
      this.setData({ activePlan: null, todayPlan: null, todayExercises: [], isTrainingDay: false });
      return;
    }
    var dow = new Date().getDay();
    var todayPlan = null;
    if (custom) {
      todayPlan = (plan.days || []).find(function (d) { return d.dayOfWeek === dow; });
    } else {
      todayPlan = planDB.getTodayPlan(plan.id);
    }
    var exercises = [];
    if (todayPlan && todayPlan.exercises) {
      var catMap = {};
      exerciseDB.categories.forEach(function (c) { catMap[c.id] = c.emoji; });
      exercises = todayPlan.exercises.map(function (eid) {
        var ex = exerciseDB.exercises.find(function (x) { return x.id === eid; })
          || storage.getCustomExercises().find(function (x) { return x.id === eid; });
        return ex ? Object.assign({}, ex, { emoji: catMap[ex.category] || '🎯' }) : null;
      }).filter(Boolean);
    }
    this.setData({
      activePlan: Object.assign({}, plan, { custom: custom }),
      todayPlan: todayPlan,
      todayExercises: exercises,
      isTrainingDay: exercises.length > 0
    });
  },

  // ===== 快捷入口 =====
  onGoDiet: function () {
    wx.navigateTo({ url: '/pages/diet/diet' });
  },
  onGoWeight: function () {
    wx.navigateTo({ url: '/pages/weight/weight' });
  },
  onGoAIChat: function () {
    wx.navigateTo({ url: '/pkg/train/ai-chat/ai-chat' });
  },
  onGoProfile: function () {
    wx.switchTab({ url: '/pages/mine/mine' });
  },
  onGoSchedule: function () {
    wx.switchTab({ url: '/pages/schedule/schedule' });
  },
  onGoTrainTab: function () {
    // 跳到自由训练（动作库）页
    wx.navigateTo({ url: '/pkg/train/train/train' });
  },
  onGoCustomPlan: function () {
    wx.navigateTo({ url: '/pkg/train/custom-plan/custom-plan' });
  },
  onGoCustomExercise: function () {
    wx.navigateTo({ url: '/pkg/train/custom-exercise/custom-exercise' });
  },
  onStartTodayPlan: function () {
    var exs = this.data.todayExercises;
    if (!exs || exs.length === 0) {
      wx.switchTab({ url: '/pages/home/home' });
      return;
    }
    var firstId = exs[0].id;
    var ids = exs.map(function (x) { return x.id; }).join(',');
    wx.navigateTo({
      url: '/pkg/train/workout/workout?id=' + firstId + '&plan=1&sequence=' + encodeURIComponent(ids)
    });
  },
  onTapTodayExercise: function (e) {
    var id = e.currentTarget.dataset.id;
    var exs = this.data.todayExercises;
    var ids = exs.map(function (x) { return x.id; }).join(',');
    wx.navigateTo({
      url: '/pkg/train/workout/workout?id=' + id + '&plan=1&sequence=' + encodeURIComponent(ids)
    });
  },
  onEditIntakeGoal: function () {
    var that = this;
    wx.showActionSheet({
      itemList: ['1500 kcal（快速减脂）', '1700 kcal（稳步减脂）', '1900 kcal（温和减脂）', '2100 kcal（维持体重）', '2300 kcal（增肌）'],
      success: function (res) {
        var goals = [1500, 1700, 1900, 2100, 2300];
        storage.setIntakeGoal(goals[res.tapIndex]);
        that._refreshCalories();
        wx.showToast({ title: '目标已更新', icon: 'success' });
      }
    });
  },

  // ===== 分享 =====
  onShareAppMessage: function () {
    var gap = this.data.gap;
    return {
      title: gap > 0
        ? '今日热量缺口 ' + gap + ' kcal，一起科学减脂！'
        : 'FitKeep · 科学管理热量，轻松健康减脂',
      path: '/pages/home/home',
      imageUrl: ''
    };
  },

  onShareTimeline: function () {
    return {
      title: 'FitKeep · 科学管理热量，轻松健康减脂',
      query: '',
      imageUrl: ''
    };
  },

  noop: function () {}
});
