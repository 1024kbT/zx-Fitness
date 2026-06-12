var storage = require('../../utils/storage.js');

Page({
  data: {
    user: {},
    bmi: 0,
    totalCount: 0,
    totalHours: 0,
    totalCalories: 0,
    showNicknameModal: false,
    nicknameInput: '',
    statusBarHeight: 20,
    contentHeight: 44,
    navBarHeight: 64,
    menuRight: 96
  },

  onLoad: function () {
    var app = getApp();
    if (app && app.globalData) {
      this.setData({
        statusBarHeight: app.globalData.statusBarHeight || 20,
        contentHeight: app.globalData.contentHeight || 44,
        navBarHeight: app.globalData.navBarHeight || 64,
        menuRight: app.globalData.menuRight || 96
      });
    }
  },

  onShow: function () {
    this._refresh();
  },

  _refresh: function () {
    var user = storage.getUserProfile() || {};
    // 计算 BMI
    var bmi = 0;
    if (user.height > 0 && user.weight > 0) {
      var h = user.height / 100;
      bmi = Math.round(user.weight / (h * h) * 10) / 10;
    }

    // 训练统计
    var all = storage.getAll();
    var totalCount = all.length;
    var totalSec = all.reduce(function (s, r) { return s + (r.duration || 0); }, 0);
    var totalHours = Math.round(totalSec / 3600 * 10) / 10;

    // 累计消耗（简单估算）
    var totalCalories = 0;
    var allEx = [];
    try {
      var exDB = require('../../data/exercises');
      allEx = exDB.exercises.concat(storage.getCustomExercises());
    } catch (e) {}
    try {
      var caloriesUtil = require('../../utils/calories.js');
      all.forEach(function (r) {
        var ex = allEx.find(function (x) { return x.id === r.exerciseId; });
        var cal = caloriesUtil.calcCalories(r, ex || {}).kcal || 0;
        totalCalories += cal;
      });
    } catch (e) {}

    this.setData({
      user: user,
      bmi: bmi,
      totalCount: totalCount,
      totalHours: totalHours,
      totalCalories: Math.round(totalCalories)
    });
  },

  // 返回
  onBack: function () {
    wx.navigateBack({ delta: 1 });
  },

  // 头像
  onChooseAvatar: function (e) {
    var that = this;
    var url = e.detail.avatarUrl;
    if (!url) return;
    wx.getFileSystemManager().saveFile({
      tempFilePath: url,
      filePath: wx.env.USER_DATA_PATH + '/avatar.png',
      success: function (res) {
        var saved = res.savedFilePath;
        var user = that.data.user || {};
        user.avatarUrl = saved;
        storage.saveUserProfile(user);
        that.setData({ user: user });
        wx.showToast({ title: '头像已更新', icon: 'success' });
      }
    });
  },

  // 昵称
  onOpenNicknameEditor: function () {
    this.setData({
      showNicknameModal: true,
      nicknameInput: (this.data.user && this.data.user.nickName) || ''
    });
  },
  onCloseNicknameEditor: function () {
    this.setData({ showNicknameModal: false });
  },
  onNicknameInput: function (e) {
    this.setData({ nicknameInput: e.detail.value });
  },
  onSaveNickname: function () {
    var name = (this.data.nicknameInput || '').trim();
    if (!name) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }
    var user = this.data.user || {};
    user.nickName = name;
    storage.saveUserProfile(user);
    this.setData({ user: user, showNicknameModal: false });
    wx.showToast({ title: '已保存', icon: 'success' });
  },

  // 编辑资料（跳到设置页或弹出更多选项）
  onEditProfile: function () {
    var that = this;
    wx.showActionSheet({
      itemList: ['设置身高', '设置体重', '设置年龄', '设置性别'],
      success: function (res) {
        var idx = res.tapIndex;
        if (idx === 0) that._prompt('身高 (cm)', '如 175', 'height', true);
        else if (idx === 1) that._prompt('体重 (kg)', '如 70', 'weight', true);
        else if (idx === 2) that._prompt('年龄', '如 25', 'age', false);
        else if (idx === 3) that._pickGender();
      }
    });
  },

  _prompt: function (title, placeholder, field, isFloat) {
    var that = this;
    wx.showModal({
      title: title,
      editable: true,
      placeholderText: placeholder,
      success: function (res) {
        if (res.confirm && res.content) {
          var v = isFloat ? parseFloat(res.content) : parseInt(res.content);
          if (isNaN(v) || v <= 0) {
            wx.showToast({ title: '数据不合法', icon: 'none' });
            return;
          }
          var user = that.data.user || {};
          user[field] = v;
          storage.saveUserProfile(user);
          that.setData({ user: user });
          that._refresh();
          wx.showToast({ title: '已保存', icon: 'success' });
        }
      }
    });
  },

  _pickGender: function () {
    var that = this;
    wx.showActionSheet({
      itemList: ['男', '女'],
      success: function (res) {
        var user = that.data.user || {};
        user.gender = res.tapIndex === 0 ? 1 : 2;
        storage.saveUserProfile(user);
        that.setData({ user: user });
        wx.showToast({ title: '已保存', icon: 'success' });
      }
    });
  },

  noop: function () {}
});
