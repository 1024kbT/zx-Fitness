// app.js
App({
  globalData: {
    version: '0.4.0',
    user: null,
    cloudReady: false,
    // ⚠️ 云开发环境 ID：在微信开发者工具「云开发」面板创建后填入
    cloudEnv: 'your-cloud-env-id',
    // 训练会话（跨 workout 页跳转保持状态）
    session: null,
    // 训练会话累计时长（秒），用于跨页继续计时
    sessionElapsed: 0,
    // 全局状态栏/胶囊安全区（用于自定义导航栏避让）
    statusBarHeight: 20,
    navBarHeight: 64,
    menuRight: 96,
    contentHeight: 44
  },

  // 计算胶囊按钮安全区（onLaunch 时调用一次）
  _calcSafeArea: function () {
    try {
      var sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      var statusBarHeight = sys.statusBarHeight || 20;
      var menu = wx.getMenuButtonBoundingClientRect
        ? wx.getMenuButtonBoundingClientRect()
        : { top: 26, height: 32, width: 87, right: sys.windowWidth - 7 };
      var menuTop = menu.top || statusBarHeight + 4;
      var menuHeight = menu.height || 32;
      var menuRight = (sys.windowWidth - menu.right) + menu.width + 10;
      var contentHeight = (menuTop - statusBarHeight) * 2 + menuHeight;
      var navBarHeight = statusBarHeight + contentHeight;
      this.globalData.statusBarHeight = statusBarHeight;
      this.globalData.navBarHeight = navBarHeight;
      this.globalData.menuRight = menuRight;
      this.globalData.contentHeight = contentHeight;
    } catch (e) {
      // 使用默认值
    }
  },

  // 初始化 / 重置训练会话
  // session: { planName, planId, exercises:[{id, name, emoji, sets, reps, duration, calories}], currentIndex, completed:{id: {done, completedSets, totalSets, calories}} }
  startSession: function (plan) {
    this.globalData.session = {
      planName: plan.planName || '',
      planId: plan.planId || '',
      exercises: plan.exercises || [],
      currentIndex: plan.currentIndex || 0,
      completed: {},
      startedAt: Date.now()
    };
    this.globalData.sessionElapsed = 0;
  },

  updateSessionExercise: function (id, data) {
    var s = this.globalData.session;
    if (!s) return;
    s.completed[id] = Object.assign({}, s.completed[id] || {}, data);
  },

  setCurrentIndex: function (idx) {
    var s = this.globalData.session;
    if (s) s.currentIndex = idx;
  },

  clearSession: function () {
    this.globalData.session = null;
    this.globalData.sessionElapsed = 0;
  },
  onLaunch() {
    // 计算胶囊按钮安全区（最先执行，供后续页面使用）
    this._calcSafeArea();

    // 初始化本地存储结构
    const records = wx.getStorageSync('workout_records');
    if (!Array.isArray(records)) wx.setStorageSync('workout_records', []);
    const customEx = wx.getStorageSync('custom_exercises');
    if (!Array.isArray(customEx)) wx.setStorageSync('custom_exercises', []);
    const customPlan = wx.getStorageSync('custom_plans');
    if (!Array.isArray(customPlan)) wx.setStorageSync('custom_plans', []);

    // 初始化云开发
    this._initCloud();
    // 主动拉取用户信息
    this._ensureUser();
  },

  _initCloud() {
    if (!wx.cloud) {
      console.warn('[云开发] 当前微信版本过低，请升级到最新版');
      return;
    }
    try {
      wx.cloud.init({
        env: this.globalData.cloudEnv,
        traceUser: true
      });
      this.globalData.cloudReady = true;
      console.log('[云开发] 初始化成功 env=' + this.globalData.cloudEnv);
      // 初始化成功后拉取云端数据并合并到本地
      this._pullCloud();
    } catch (err) {
      console.error('[云开发] 初始化失败', err);
      this.globalData.cloudReady = false;
    }
  },

  _pullCloud() {
    try {
      var storage = require('./utils/storage.js');
      storage.pullFromCloud().then(function (res) {
        console.log('[云开发] 云端同步完成，新增记录 ' + (res && res.added || 0));
      }).catch(function (err) {
        console.warn('[云开发] 云端同步失败', err);
      });
    } catch (err) {
      console.warn('[云开发] pull 异常', err);
    }
  },

  _ensureUser() {
    const existing = wx.getStorageSync('user_profile');
    if (existing && typeof existing === 'object') {
      this.globalData.user = existing;
      this._syncUserToCloud(existing);
      return;
    }
    if (wx.getUserProfile) {
      wx.getUserProfile({
        desc: '用于个人中心展示',
        success: (res) => {
          if (res && res.userInfo) {
            const profile = {
              nickName: res.userInfo.nickName || '坚持训练的你',
              avatarUrl: res.userInfo.avatarUrl || '',
              bio: '每一次坚持，都是更好的自己',
              updatedAt: Date.now()
            };
            wx.setStorageSync('user_profile', profile);
            this.globalData.user = profile;
            this._syncUserToCloud(profile);
          }
        },
        fail: () => this._writeDefaultUser()
      });
    } else {
      this._writeDefaultUser();
    }
  },

  _writeDefaultUser() {
    const profile = {
      nickName: '坚持训练的你',
      avatarUrl: '',
      bio: '每一次坚持，都是更好的自己',
      updatedAt: Date.now()
    };
    wx.setStorageSync('user_profile', profile);
    this.globalData.user = profile;
  },

  // 用户信息同步到云端 users 集合（异步，失败不阻塞）
  _syncUserToCloud(profile) {
    if (!this.globalData.cloudReady || !wx.cloud) return;
    const cloud = require('./utils/cloud.js');
    cloud.syncUser(profile).catch((err) => {
      console.warn('[云开发] 用户同步失败', err);
    });
  }
});
