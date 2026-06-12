const exerciseDB = require('../../../data/exercises');
const storage = require('../../../utils/storage.js');

const WEEKDAYS = [
  { dow: 0, label: '周日' }, { dow: 1, label: '周一' }, { dow: 2, label: '周二' },
  { dow: 3, label: '周三' }, { dow: 4, label: '周四' }, { dow: 5, label: '周五' },
  { dow: 6, label: '周六' }
];

Page({
  data: {
    list: [],
    categories: exerciseDB.categories,
    weekdays: WEEKDAYS,
    // 展开的计划 id
    expandedPlan: '',
    // 当前展开编辑的天 key（planId-idx）
    editingDay: '',
    // 新建计划简表
    showPlanForm: false,
    planForm: { name: '', desc: '' },
    // 动作选择器
    showExPicker: false,
    exSearch: '',
    exList: [],
    exSelected: [],
    // 记录动作选择器的目标
    pickerTarget: { planId: '', dayIdx: -1 },
    navBarHeight: 64
  },

  onLoad(options) {
    var app = getApp();
    if (app && app.globalData) {
      this.setData({ navBarHeight: app.globalData.navBarHeight || 64 });
    }
    if (options.add === '1') {
      setTimeout(() => this.onAddPlan(), 300);
    }
  },

  onShow() {
    this._refresh();
  },

  _refresh() {
    const list = storage.getCustomPlans();
    const all = exerciseDB.exercises.concat(storage.getCustomExercises());
    const nameMap = {};
    all.forEach((x) => { nameMap[x.id] = x.name; });
    const planExNames = {};
    list.forEach((p) => {
      const map = {};
      (p.days || []).forEach((d) => {
        (d.exercises || []).forEach((id) => { map[id] = nameMap[id] || id; });
      });
      planExNames[p.id] = map;
    });
    this.setData({ list, getExName: nameMap, planExNames });
  },

  // ===== 计划 新建/删除/展开 =====
  onAddPlan() {
    this.setData({
      showPlanForm: true,
      planForm: { name: '', desc: '' }
    });
  },

  onClosePlanForm() {
    this.setData({ showPlanForm: false });
  },

  onPlanInput(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ ['planForm.' + k]: e.detail.value });
  },

  onSavePlan() {
    const f = this.data.planForm;
    if (!f.name.trim()) {
      wx.showToast({ title: '请填写计划名', icon: 'none' });
      return;
    }
    const created = storage.addCustomPlan({
      name: f.name,
      name_en: '',
      desc: f.desc,
      days: []
    });
    this.setData({ showPlanForm: false });
    this._refresh();
    // 自动展开新创建的计划
    if (created && created.length > 0) {
      this.setData({ expandedPlan: created[0].id, editingDay: '' });
    }
    wx.showToast({ title: '已创建', icon: 'success' });
  },

  onDeletePlan(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除计划',
      content: '确定删除该自定义计划？',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          storage.removeCustomPlan(id);
          if (wx.getStorageSync('active_plan') === id) {
            wx.removeStorageSync('active_plan');
          }
          this.setData({ expandedPlan: '', editingDay: '' });
          this._refresh();
        }
      }
    });
  },

  onTogglePlan(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      expandedPlan: this.data.expandedPlan === id ? '' : id,
      editingDay: ''
    });
  },

  // ===== 计划内联编辑 =====
  onInlinePlanInput(e) {
    const id = e.currentTarget.dataset.id;
    const k = e.currentTarget.dataset.k;
    const v = e.detail.value;
    const plan = this.data.list.find((p) => p.id === id);
    if (!plan) return;
    storage.updateCustomPlan(id, { [k]: v });
    this._refresh();
  },

  // ===== 天内联编辑 =====
  onInlineAddDay(e) {
    const id = e.currentTarget.dataset.id;
    const plan = this.data.list.find((p) => p.id === id);
    if (!plan) return;
    const newDay = { label: '', dayOfWeek: 1, muscle: '', exercises: [] };
    const days = (plan.days || []).concat([newDay]);
    storage.updateCustomPlan(id, { days });
    this._refresh();
    this.setData({ editingDay: id + '-' + (days.length - 1) });
  },

  onToggleDay(e) {
    const id = e.currentTarget.dataset.id;
    const idx = e.currentTarget.dataset.idx;
    const key = id + '-' + idx;
    this.setData({ editingDay: this.data.editingDay === key ? '' : key });
  },

  onInlineDayInput(e) {
    const id = e.currentTarget.dataset.id;
    const idx = Number(e.currentTarget.dataset.idx);
    const k = e.currentTarget.dataset.k;
    const v = e.detail.value;
    const plan = this.data.list.find((p) => p.id === id);
    if (!plan) return;
    const days = plan.days.slice();
    days[idx] = Object.assign({}, days[idx], { [k]: v });
    storage.updateCustomPlan(id, { days });
    this._refresh();
  },

  onInlinePickWeekday(e) {
    const id = e.currentTarget.dataset.id;
    const idx = Number(e.currentTarget.dataset.idx);
    const dow = Number(e.detail.value);
    const plan = this.data.list.find((p) => p.id === id);
    if (!plan) return;
    const days = plan.days.slice();
    days[idx] = Object.assign({}, days[idx], { dayOfWeek: dow });
    storage.updateCustomPlan(id, { days });
    this._refresh();
  },

  onInlineDeleteDay(e) {
    const id = e.currentTarget.dataset.id;
    const idx = Number(e.currentTarget.dataset.idx);
    const plan = this.data.list.find((p) => p.id === id);
    if (!plan) return;
    const days = plan.days.slice();
    days.splice(idx, 1);
    storage.updateCustomPlan(id, { days });
    this.setData({ editingDay: '' });
    this._refresh();
  },

  // ===== 动作选择器 =====
  onOpenExPicker(e) {
    const id = e.currentTarget.dataset.id;
    const idx = Number(e.currentTarget.dataset.idx);
    const plan = this.data.list.find((p) => p.id === id);
    if (!plan || !plan.days[idx]) return;
    this.setData({
      showExPicker: true,
      pickerTarget: { planId: id, dayIdx: idx },
      exSearch: '',
      exSelected: plan.days[idx].exercises.slice(),
      exList: this._buildExList('')
    });
  },

  onCloseExPicker() {
    this.setData({ showExPicker: false });
  },

  _buildExList(keyword) {
    const all = exerciseDB.exercises.concat(storage.getCustomExercises());
    const k = (keyword || '').trim().toLowerCase();
    const list = k
      ? all.filter((x) =>
          x.name.toLowerCase().indexOf(k) >= 0 ||
          (x.name_en || '').toLowerCase().indexOf(k) >= 0 ||
          (x.primary_muscle || '').toLowerCase().indexOf(k) >= 0
        )
      : all;
    return list.slice(0, 80);
  },

  onExSearch(e) {
    this.setData({
      exSearch: e.detail.value,
      exList: this._buildExList(e.detail.value)
    });
  },

  onToggleEx(e) {
    const id = e.currentTarget.dataset.id;
    const selected = this.data.exSelected.slice();
    const i = selected.indexOf(id);
    if (i >= 0) selected.splice(i, 1);
    else selected.push(id);
    this.setData({ exSelected: selected });
  },

  onConfirmEx() {
    const t = this.data.pickerTarget;
    const plan = this.data.list.find((p) => p.id === t.planId);
    if (!plan || !plan.days[t.dayIdx]) return;
    const days = plan.days.slice();
    days[t.dayIdx] = Object.assign({}, days[t.dayIdx], {
      exercises: this.data.exSelected.slice()
    });
    storage.updateCustomPlan(t.planId, { days });
    this.setData({ showExPicker: false });
    this._refresh();
  },

  onRemoveExFromDay(e) {
    const id = e.currentTarget.dataset.id;
    const didx = Number(e.currentTarget.dataset.didx);
    const eid = e.currentTarget.dataset.eid;
    const plan = this.data.list.find((p) => p.id === id);
    if (!plan || !plan.days[didx]) return;
    const days = plan.days.slice();
    const exs = days[didx].exercises.filter((x) => x !== eid);
    days[didx] = Object.assign({}, days[didx], { exercises: exs });
    storage.updateCustomPlan(id, { days });
    this._refresh();
  },

  noop() {}
});
