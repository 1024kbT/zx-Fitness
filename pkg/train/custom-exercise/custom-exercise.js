const exerciseDB = require('../../../data/exercises');
const storage = require('../../../utils/storage.js');

Page({
  data: {
    list: [],
    categories: exerciseDB.categories,
    equipment: ['杠铃', '哑铃', '器械', '绳索', '史密斯', 'EZ杠', '壶铃', '徒手', '弹力带', '其他'],
    levels: ['初级', '中级', '高级'],
    types: ['reps', 'time'],
    showForm: false,
    editing: null,
    categoryIndex: 0,
    categoryName: '胸部',
    levelIndex: 0,
    equipIndex: 1,
    typeIndex: 0,
    navBarHeight: 64,
    form: {
      name: '',
      name_en: '',
      category: 'chest',
      level: '初级',
      equipment: '哑铃',
      primary_muscle: '',
      secondary_muscle: '',
      type: 'reps',
      default_sets: 4,
      default_reps: 12,
      default_seconds: 30,
      rest_seconds: 60,
      instructions: ''
    }
  },

  onLoad: function () {
    var app = getApp();
    if (app && app.globalData) {
      this.setData({ navBarHeight: app.globalData.navBarHeight || 64 });
    }
  },

  onShow() {
    this._refresh();
  },

  _refresh() {
    this.setData({ list: storage.getCustomExercises() });
  },

  onShowForm() {
    this.setData({
      showForm: true,
      editing: null,
      form: {
        name: '', name_en: '', category: 'chest', level: '初级',
        equipment: '哑铃', primary_muscle: '', secondary_muscle: '',
        type: 'reps', default_sets: 4, default_reps: 12,
        default_seconds: 30, rest_seconds: 60, instructions: ''
      },
      categoryIndex: 0, categoryName: '胸部',
      levelIndex: 0, equipIndex: 1, typeIndex: 0
    });
  },

  onCloseForm() {
    this.setData({ showForm: false, editing: null });
  },

  onEdit(e) {
    const item = e.currentTarget.dataset.item;
    const ci = this.data.categories.findIndex((c) => c.id === item.category);
    const li = this.data.levels.indexOf(item.level);
    const ei = this.data.equipment.indexOf(item.equipment);
    this.setData({
      showForm: true,
      editing: item.id,
      form: Object.assign({}, item, {
        instructions: (item.instructions || []).join('\n')
      }),
      categoryIndex: ci >= 0 ? ci : 0,
      categoryName: ci >= 0 ? this.data.categories[ci].name : '胸部',
      levelIndex: li >= 0 ? li : 0,
      equipIndex: ei >= 0 ? ei : 1,
      typeIndex: this.data.types.indexOf(item.type) >= 0 ? this.data.types.indexOf(item.type) : 0
    });
  },

  onInput(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ ['form.' + k]: e.detail.value });
  },

  onPickCategory(e) {
    const idx = Number(e.detail.value);
    this.setData({
      'form.category': this.data.categories[idx].id,
      categoryIndex: idx,
      categoryName: this.data.categories[idx].name
    });
  },

  onPickLevel(e) {
    this.setData({
      'form.level': this.data.levels[Number(e.detail.value)],
      levelIndex: Number(e.detail.value)
    });
  },

  onPickEquip(e) {
    this.setData({
      'form.equipment': this.data.equipment[Number(e.detail.value)],
      equipIndex: Number(e.detail.value)
    });
  },

  onPickType(e) {
    this.setData({
      'form.type': this.data.types[Number(e.detail.value)],
      typeIndex: Number(e.detail.value)
    });
  },

  onStep(e) {
    const k = e.currentTarget.dataset.k;
    const d = Number(e.currentTarget.dataset.d);
    const v = Math.max(0, this.data.form[k] + d);
    this.setData({ ['form.' + k]: v });
  },

  onSave() {
    const f = this.data.form;
    if (!f.name.trim()) {
      wx.showToast({ title: '请填写动作名', icon: 'none' });
      return;
    }
    const data = Object.assign({}, f, {
      instructions: f.instructions
        ? f.instructions.split('\n').map((s) => s.trim()).filter(Boolean)
        : []
    });
    if (this.data.editing) {
      storage.updateCustomExercise(this.data.editing, data);
      wx.showToast({ title: '已更新', icon: 'success' });
    } else {
      storage.addCustomExercise(data);
      wx.showToast({ title: '已添加', icon: 'success' });
    }
    this.setData({ showForm: false, editing: null });
    this._refresh();
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除动作',
      content: '确定删除该自定义动作？',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          storage.removeCustomExercise(id);
          this._refresh();
        }
      }
    });
  },
  noop() {}
});
