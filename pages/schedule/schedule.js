var storage = require('../../utils/storage.js');
var calories = require('../../utils/calories.js');
var exerciseDB = require('../../data/exercises.js');
var planDB = require('../../data/plans.js');
var formatUtil = require('../../utils/format.js');

var WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
var REST_KEY = 'rest_days';

Page({
  data: {
    weekLabel: '',           // 如「10月」
    days: [],                // 7 天数据
    selectedIdx: -1,
    todayCalories: 0,
    calorieGoal: 400,
    calPercent: 0,
    activePlanName: '',
    canPrevWeek: true,
    weekPlanCount: 0,
    weekDoneCount: 0,
    weekMinutes: 0
  },

  _weekAnchor: null,         // 当前周锚点（周一的 Date）
  _allEx: [],

  onLoad: function () {
    this.setData({
      calorieGoal: Number(wx.getStorageSync('calorie_goal')) || 400
    });
    var now = new Date();
    this._weekAnchor = this._getMonday(now);
    this._allEx = exerciseDB.exercises.concat(storage.getCustomExercises());
  },

  onShow: function () {
    this._refreshAll();
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 }); // 训练日程是第 2 个 Tab
    }
  },

  _getMonday: function (d) {
    var date = new Date(d);
    date.setHours(0, 0, 0, 0);
    var day = date.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  },

  _dateKey: function (d) {
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  },

  _sameDay: function (a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
  },

  _refreshAll: function () {
    this._buildDays();
    this._refreshTodayCalories();
  },

  _buildDays: function () {
    var monday = this._weekAnchor;
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    // 周标签
    var weekLabel = (monday.getMonth() + 1) + '月';

    // 休息日 set
    var restArr = wx.getStorageSync(REST_KEY);
    var restSet = {};
    if (Array.isArray(restArr)) {
      restArr.forEach(function (k) { restSet[k] = true; });
    }

    // 当前激活计划
    var activePlanId = wx.getStorageSync('active_plan');
    var activePlan = null;
    var activePlanName = '';
    if (activePlanId) {
      activePlan = planDB.plans.find(function (p) { return p.id === activePlanId; })
        || storage.getCustomPlans().find(function (p) { return p.id === activePlanId; });
      if (activePlan) activePlanName = activePlan.name;
    }

    var allRecords = storage.getAll();
    var days = [];
    var selectedIdx = -1;

    for (var i = 0; i < 7; i++) {
      var d = new Date(monday);
      d.setDate(monday.getDate() + i);
      var key = this._dateKey(d);
      var isToday = this._sameDay(d, today);
      var isRest = !!restSet[key];

      // 该日的训练计划
      var planDay = null;
      if (activePlan && !isRest) {
        planDay = (activePlan.days || []).find(function (x) { return x.dayOfWeek === d.getDay(); });
      }

      // 该日的训练记录
      var dayRecords = allRecords.filter(function (r) {
        var t = new Date(r.createdAt);
        return this._sameDay(t, d);
      }.bind(this));

      var dayCalObj = this._calcDayCaloriesDetail(dayRecords);
      var totalDuration = dayRecords.reduce(function (s, r) { return s + (r.duration || 0); }, 0);

      // 计划里的动作详情
      var planExercises = [];
      if (planDay) {
        planExercises = (planDay.exercises || []).map(function (eid) {
          var x = this._allEx.find(function (ex) { return ex.id === eid; });
          return x || null;
        }.bind(this)).filter(Boolean);
      }

      // 状态：rest（休息） / done（已完成训练） / plan（有安排但未练） / empty（无安排）
      var status = 'empty';
      if (isRest) status = 'rest';
      else if (dayRecords.length > 0) status = 'done';
      else if (planDay) status = 'plan';

      if (isToday) selectedIdx = i;

      days.push({
        key: key,
        dow: WEEK_LABELS[d.getDay()],
        date: d.getDate(),
        month: d.getMonth() + 1,
        isToday: isToday,
        isRest: isRest,
        status: status,
        expanded: this.data.days[i] ? this.data.days[i].expanded : false,
        planLabel: planDay ? planDay.label : '',
        planMuscle: planDay ? planDay.muscle : '',
        planExercises: planExercises,
        records: dayRecords.map(function (r) {
          var ex = this._allEx.find(function (x) { return x.id === r.exerciseId; });
          var calObj = calories.calcCalories(r, ex);
          var methodLabel = calObj.method === 'work' ? '做功法' : calObj.method === 'met' ? 'MET法' : '估算法';
          return {
            id: r.id,
            exerciseId: r.exerciseId,
            name: r.exerciseName || (ex ? ex.name : '未知'),
            sets: r.sets || 0,
            repsPerSet: r.repsPerSet || (r.type === 'time' ? r.secondsPerSet : r.repsPerSet),
            secondsPerSet: r.secondsPerSet,
            type: r.type,
            durationLabel: formatUtil.humanDuration(r.duration || 0),
            calories: calObj.kcal,
            method: calObj.method,
            methodLabel: methodLabel,
            breakdown: calObj.breakdown || {}
          };
        }.bind(this)),
        calories: dayCalObj.total,
        primaryMethod: dayCalObj.primaryMethod,
        durationLabel: formatUtil.humanDuration(totalDuration),
        totalDurationSec: totalDuration
      });
    }

    if (selectedIdx < 0) selectedIdx = 0;

    // 本周统计
    var planCount = 0, doneCount = 0, totalSec = 0;
    days.forEach(function (d) {
      if (d.status === 'plan' || d.status === 'done') planCount++;
      if (d.status === 'done') {
        doneCount++;
        totalSec += d.totalDurationSec || 0;
      }
    });

    this.setData({
      days: days,
      selectedIdx: selectedIdx,
      weekLabel: weekLabel,
      activePlanName: activePlanName,
      canPrevWeek: this._weekAnchor.getTime() > this._getMonday(new Date()).getTime() - 30 * 86400 * 1000,
      weekPlanCount: planCount,
      weekDoneCount: doneCount,
      weekMinutes: Math.round(totalSec / 60)
    });
  },

  _calcDayCaloriesDetail: function (records) {
    var exMap = {};
    (this._allEx || []).forEach(function (x) { exMap[x.id] = x; });
    var total = 0;
    var methods = { work: 0, met: 0, estimate: 0 };
    (records || []).forEach(function (r) {
      var result = calories.calcCalories(r, exMap[r.exerciseId]);
      total += result.kcal;
      if (result.method) methods[result.method] = (methods[result.method] || 0) + 1;
    });
    var primary = 'estimate';
    if (methods.work > 0) primary = 'work';
    else if (methods.met > 0) primary = 'met';
    var primaryLabel = primary === 'work' ? '做功法' : primary === 'met' ? 'MET法' : '估算法';
    return { total: total, primaryMethod: primary, primaryLabel: primaryLabel, methods: methods };
  },

  _refreshTodayCalories: function () {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var all = storage.getAll();
    var todayRecords = all.filter(function (r) {
      var t = new Date(r.createdAt);
      return this._sameDay(t, today);
    }.bind(this));
    var cal = calories.calcDayCalories(todayRecords, this._allEx);
    var goal = this.data.calorieGoal || 400;
    this.setData({
      todayCalories: cal,
      calPercent: Math.min(100, Math.round(cal / goal * 100))
    });
  },

  // ===== 交互 =====
  onPrevWeek: function () {
    var d = new Date(this._weekAnchor);
    d.setDate(d.getDate() - 7);
    this._weekAnchor = d;
    this._buildDays();
  },

  onNextWeek: function () {
    var d = new Date(this._weekAnchor);
    d.setDate(d.getDate() + 7);
    this._weekAnchor = d;
    this._buildDays();
    if (wx.vibrateShort) {
      try { wx.vibrateShort({ type: 'light' }); } catch (err) {}
    }
  },

  // 回到本周
  onGoToToday: function () {
    this._weekAnchor = new Date();
    this._buildDays();
    // 高亮今日
    var days = this.data.days || [];
    var todayIdx = days.findIndex(function (d) { return d.isToday; });
    if (todayIdx >= 0) {
      this.setData({ selectedIdx: todayIdx });
    }
    if (wx.vibrateShort) {
      try { wx.vibrateShort({ type: 'medium' }); } catch (err) {}
    }
  },

  onSelectDay: function (e) {
    var idx = e.currentTarget.dataset.idx;
    this.setData({ selectedIdx: idx });
    if (wx.vibrateShort) {
      try { wx.vibrateShort({ type: 'light' }); } catch (err) {}
    }
  },

  // 展开/收起日项
  onToggleExpand: function (e) {
    var idx = e.currentTarget.dataset.idx;
    var cur = this.data.days[idx].expanded;
    var path = 'days[' + idx + '].expanded';
    var patch = {};
    patch[path] = !cur;
    this.setData(patch);
    if (wx.vibrateShort) {
      try { wx.vibrateShort({ type: 'light' }); } catch (err) {}
    }
  },

  onGoNotify: function () {
    wx.showToast({ title: '暂无新消息', icon: 'none' });
  },

  // 标记/取消休息日
  onToggleRest: function (e) {
    var idx = e.currentTarget.dataset.idx;
    var day = this.data.days[idx];
    if (!day) return;
    var restArr = wx.getStorageSync(REST_KEY) || [];
    var i = restArr.indexOf(day.key);
    if (i >= 0) {
      restArr.splice(i, 1);
      wx.showToast({ title: '已取消休息', icon: 'none' });
    } else {
      restArr.push(day.key);
      wx.showToast({ title: '已标记休息', icon: 'success' });
    }
    wx.setStorageSync(REST_KEY, restArr);
    if (wx.vibrateShort) {
      try { wx.vibrateShort({ type: 'medium' }); } catch (err) {}
    }
    this._buildDays();
  },

  // 点击开始训练
  onStartTraining: function (e) {
    var idx = e.currentTarget.dataset.idx;
    var day = this.data.days[idx];
    if (!day || !day.planExercises || day.planExercises.length === 0) {
      wx.switchTab({ url: '/pages/home/home' });
      return;
    }
    var firstId = day.planExercises[0].id;
    var ids = day.planExercises.map(function (x) { return x.id; }).join(',');
    wx.navigateTo({
      url: '/pkg/train/workout/workout?id=' + firstId + '&plan=1&sequence=' + encodeURIComponent(ids)
    });
  },

  // 点击已完成记录查看详情（跳到记录页）
  onTapRecord: function () {
    wx.switchTab({ url: '/pages/record/record' });
  },

  // 去训练页
  onGoTrain: function () {
    wx.switchTab({ url: '/pages/home/home' });
  },

  // 去创建/管理计划
  onGoCreatePlan: function () {
    wx.navigateTo({ url: '/pkg/train/custom-plan/custom-plan' });
  },

  // 调整目标
  onEditGoal: function () {
    var that = this;
    wx.showActionSheet({
      itemList: ['200 千卡', '400 千卡', '600 千卡', '800 千卡', '1000 千卡'],
      success: function (res) {
        var goals = [200, 400, 600, 800, 1000];
        var goal = goals[res.tapIndex];
        wx.setStorageSync('calorie_goal', goal);
        that.setData({ calorieGoal: goal });
        that._refreshTodayCalories();
      }
    });
  },

  noop: function () {}
});
