var exerciseDB = require('../../../data/exercises');
var planDB = require('../../../data/plans');
var storage = require('../../../utils/storage.js');

Page({
  data: {
    activeCategory: 'all',
    categories: [],
    exercises: [],
    keyword: '',
    activePlan: null,
    allPlans: [],
    showPlanPicker: false,
    navBarHeight: 64
  },

  onLoad: function () {
    var app = getApp();
    if (app && app.globalData) {
      this.setData({ navBarHeight: app.globalData.navBarHeight || 64 });
    }
    var catMap = {};
    exerciseDB.categories.forEach(function (c) { catMap[c.id] = c.emoji; });
    this._catMap = catMap;
    this.setData({
      categories: [{ id: 'all', name: '全部', emoji: '🏠' }]
        .concat(exerciseDB.categories)
        .concat([{ id: 'custom', name: '自定义', emoji: '✨' }])
    });
    this._filter('all');
  },

  onShow: function () {
    this._refreshPlan();
  },

  _refreshPlan: function () {
    var custom = storage.getCustomPlans().map(function (p) {
      return Object.assign({}, p, { custom: true });
    });
    var defaults = planDB.plans.map(function (p) {
      return Object.assign({}, p, { custom: false });
    });
    var all = defaults.concat(custom);
    var activeId = wx.getStorageSync('active_plan');
    var active = null;
    if (activeId) {
      active = all.find(function (p) { return p.id === activeId; }) || null;
    }
    this.setData({ allPlans: all, activePlan: active });
  },

  onSelectCategory: function (e) {
    var id = e.currentTarget.dataset.id;
    this.setData({ activeCategory: id, keyword: '' });
    this._filter(id);
  },

  onSearch: function (e) {
    var kw = (e.detail.value || '').trim().toLowerCase();
    this.setData({ keyword: kw });
    this._filter(this.data.activeCategory, kw);
  },

  _filter: function (catId, keyword) {
    var custom = storage.getCustomExercises();
    var all = exerciseDB.exercises.concat(custom);
    var catMap = this._catMap;
    var list;
    if (catId === 'all') list = all;
    else if (catId === 'custom') list = custom;
    else list = all.filter(function (x) { return x.category === catId; });

    if (keyword) {
      list = list.filter(function (x) {
        return (x.name || '').toLowerCase().indexOf(keyword) >= 0 ||
               (x.name_en || '').toLowerCase().indexOf(keyword) >= 0 ||
               (x.primary_muscle || '').toLowerCase().indexOf(keyword) >= 0 ||
               (x.equipment || '').toLowerCase().indexOf(keyword) >= 0;
      });
    }

    this.setData({
      exercises: list.map(function (x) {
        return Object.assign({}, x, { emoji: catMap[x.category] || '🎯' });
      })
    });
  },

  onTapExercise: function (e) {
    // 从 dataset 读取 id（最稳）
    var id = e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id;
    if (!id && e.detail) id = e.detail.id || (e.detail.exercise && e.detail.exercise.id);
    if (!id) {
      wx.showToast({ title: '动作 ID 缺失', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pkg/train/workout/workout?id=' + id });
  },

  // ===== 计划选择器 =====
  onShowPlanPicker: function () {
    this.setData({ showPlanPicker: true });
  },
  onSwitchPlan: function () {
    this.setData({ showPlanPicker: true });
  },
  onClosePlanPicker: function () {
    this.setData({ showPlanPicker: false });
  },
  onSelectPlan: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.setStorageSync('active_plan', id);
    this.setData({ showPlanPicker: false });
    this._refreshPlan();
    wx.showToast({ title: '计划已切换', icon: 'success' });
  },
  onGoCustomPlan: function () {
    this.setData({ showPlanPicker: false });
    wx.navigateTo({ url: '/pkg/train/custom-plan/custom-plan?add=1' });
  },
  onStartPlan: function () {
    var plan = this.data.activePlan;
    if (!plan) return;
    var dow = new Date().getDay();
    var day = (plan.days || []).find(function (d) { return d.dayOfWeek === dow; });
    if (!day || !day.exercises || day.exercises.length === 0) {
      // 今天不是训练日，找第一个有动作的天
      var firstDay = (plan.days || []).find(function (d) { return d.exercises && d.exercises.length > 0; });
      if (!firstDay) {
        wx.showToast({ title: '计划没有动作', icon: 'none' });
        return;
      }
      day = firstDay;
    }
    // 加载完整动作数据
    var allEx = exerciseDB.exercises.concat(storage.getCustomExercises());
    // 智能 emoji 映射：根据动作类别 + 关键字匹配不同图标
    var emojiMap = {
      chest: ['💪', '🏋️', '💥'],
      back: ['🦾', '🎯', '⚡'],
      shoulders: ['🏋️', '🛡️', '⚔️'],
      arms: ['💪', '🔨', '⚡'],
      legs: ['🦵', '🏃', '⚡'],
      core: ['🔥', '⚡', '💥'],
      cardio: ['🏃', '🔥', '⚡']
    };
    var pickEmoji = function (ex) {
      var base = emojiMap[ex.category] || ['🎯'];
      // 根据动作名 hash 挑一个，确保同动作固定
      var hash = 0;
      var id = ex.id || ex.name || '';
      for (var i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0x7fffffff;
      return base[hash % base.length];
    };
    var exercises = day.exercises.map(function (id) {
      var ex = allEx.find(function (x) { return x.id === id; });
      if (!ex) return null;
      return {
        id: ex.id,
        name: ex.name,
        emoji: pickEmoji(ex),
        image: exerciseDB.getImageUrl(ex.id),
        category: ex.category,
        primaryMuscle: ex.primary_muscle || '',
        equipment: ex.equipment || '',
        defaultSets: ex.default_sets || 4,
        defaultReps: ex.default_reps || 10,
        type: ex.type || 'reps'
      };
    }).filter(Boolean);
    if (exercises.length === 0) {
      wx.showToast({ title: '找不到可用动作', icon: 'none' });
      return;
    }
    // 启动 session
    var app = getApp();
    app.startSession({
      planName: plan.name,
      planId: plan.id,
      exercises: exercises,
      currentIndex: 0
    });
    var firstId = exercises[0].id;
    var ids = exercises.map(function (x) { return x.id; }).join(',');
    wx.navigateTo({
      url: '/pkg/train/workout/workout?id=' + firstId + '&plan=1&sequence=' + encodeURIComponent(ids)
    });
  },

  noop: function () {}
});
