var storage = require('../../utils/storage.js');
var cloud = require('../../utils/cloud.js');

var MEAL_TYPES = {
  breakfast: { label: '早餐', icon: '🌅', time: '07:00-09:00' },
  lunch: { label: '午餐', icon: '☀', time: '12:00-13:30' },
  dinner: { label: '晚餐', icon: '🌙', time: '18:00-19:30' },
  snack: { label: '加餐', icon: '🍎', time: '随时' }
};

Page({
  data: {
    intake: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    intakeGoal: 1900,
    proteinGoal: 165,
    carbsGoal: 240,
    fatGoal: 70,
    proteinPct: 0,
    carbsPct: 0,
    fatPct: 0,
    percent: 0,
    mealGroups: [],     // [{type, label, icon, time, kcal, items}]
    aiText: '',
    aiAnalyzing: false,
    aiSelectedType: 'breakfast',
    todayKey: ''
  },

  onLoad: function () {
    this.setData({ intakeGoal: storage.getIntakeGoal() });
  },

  onShow: function () {
    this._refresh();
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 }); // 饮食计划是第 3 个 Tab
    }
  },

  _todayKey: function () {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  },

  _refresh: function () {
    var key = this._todayKey();
    var intake = storage.getDayIntake(key);
    var goal = this.data.intakeGoal;
    var percent = goal > 0 ? Math.min(100, Math.round(intake.kcal / goal * 100)) : 0;

    // 按类型分组
    var groups = [];
    ['breakfast', 'lunch', 'dinner', 'snack'].forEach(function (type) {
      var cfg = MEAL_TYPES[type];
      var items = (intake.meals || []).filter(function (m) { return m.type === type; });
      var kcal = items.reduce(function (s, m) { return s + (Number(m.kcal) || 0); }, 0);
      groups.push({
        type: type,
        label: cfg.label,
        icon: cfg.icon,
        time: cfg.time,
        kcal: kcal,
        items: items
      });
    });

    this.setData({
      intake: intake.kcal,
      protein: intake.protein || 0,
      carbs: intake.carbs || 0,
      fat: intake.fat || 0,
      proteinPct: Math.min(100, Math.round((intake.protein || 0) / this.data.proteinGoal * 100)),
      carbsPct: Math.min(100, Math.round((intake.carbs || 0) / this.data.carbsGoal * 100)),
      fatPct: Math.min(100, Math.round((intake.fat || 0) / this.data.fatGoal * 100)),
      percent: percent,
      mealGroups: groups,
      todayKey: key
    });
  },

  onInputAI: function (e) {
    this.setData({ aiText: e.detail.value });
  },

  onAIInput: function (e) {
    this.setData({ aiText: e.detail.value });
  },

  onAISubmit: function () {
    this.onAnalyzeAI();
  },

  onGoNotify: function () {
    wx.showToast({ title: '暂无新消息', icon: 'none' });
  },

  onSelectType: function (e) {
    this.setData({ aiSelectedType: e.currentTarget.dataset.type });
  },

  onAnalyzeAI: function () {
    var text = (this.data.aiText || '').trim();
    if (!text) {
      wx.showToast({ title: '请填写饮食内容', icon: 'none' });
      return;
    }
    if (this.data.aiAnalyzing) return;
    this.setData({ aiAnalyzing: true });
    wx.showLoading({ title: 'AI 分析中…', mask: true });

    var type = this.data.aiSelectedType;
    var typeLabel = MEAL_TYPES[type].label;
    var prompt = '用户今天' + typeLabel + '吃了：' + text + '\n' +
      '请按 JSON 格式返回估算结果：\n' +
      '{"kcal": 数字, "protein": 数字(克), "items": [{"name":"菜名","amount":"份量","kcal":数字}...]}\n' +
      '只返回 JSON，不要其他说明。';

    cloud.callAI([{ role: 'user', content: prompt }])
      .then(function (res) {
        var content = res.content || '';
        // 提取 JSON（支持多行）
        var match = content.match(/\{[\s\S]*?\}/);
        if (!match) throw new Error('AI 未返回 JSON');
        var parsed = null;
        try { parsed = JSON.parse(match[0]); }
        catch (e) { throw new Error('JSON 解析失败'); }
        return parsed;
      })
      .then(function (parsed) {
        var items = [];
        if (Array.isArray(parsed.items)) {
          items = parsed.items.map(function (it) {
            return {
              name: it.name || '',
              amount: it.amount || '',
              kcal: Number(it.kcal) || 0
            };
          });
        }
        var meal = {
          type: type,
          text: text,
          kcal: Number(parsed.kcal) || 0,
          protein: Number(parsed.protein) || 0,
          items: items
        };
        storage.addMealLog(meal);
        wx.hideLoading();
        wx.showToast({ title: '已记录', icon: 'success' });
        this.setData({ aiText: '', aiAnalyzing: false });
        this._refresh();
      }.bind(this))
      .catch(function (err) {
        wx.hideLoading();
        this.setData({ aiAnalyzing: false });
        wx.showToast({ title: 'AI 分析失败：' + (err.message || ''), icon: 'none' });
      }.bind(this));
  },

  onDeleteMeal: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除此记录',
      content: '确定删除这条饮食记录？',
      confirmColor: '#ef4444',
      success: function (res) {
        if (res.confirm) {
          storage.removeMealLog(id);
          this._refresh();
        }
      }.bind(this)
    });
  },

  onEditGoal: function () {
    var that = this;
    wx.showActionSheet({
      itemList: ['1500 kcal（快速减脂）', '1700 kcal（稳步减脂）', '1900 kcal（温和减脂）', '2100 kcal（维持体重）', '2300 kcal（增肌）'],
      success: function (res) {
        var goals = [1500, 1700, 1900, 2100, 2300];
        storage.setIntakeGoal(goals[res.tapIndex]);
        that.setData({ intakeGoal: goals[res.tapIndex] });
        that._refresh();
        wx.showToast({ title: '目标已更新', icon: 'success' });
      }
    });
  },

  noop: function () {}
});
