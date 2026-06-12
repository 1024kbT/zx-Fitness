Component({
  properties: {
    // 当前页标题（可选，不传则显示问候语+用户名）
    title: { type: String, value: '' },
    // 当前页图标 emoji（可选）
    icon: { type: String, value: '' },
    // 是否显示通知铃铛
    showBell: { type: Boolean, value: true },
    // 是否固定定位（默认 true）
    fixed: { type: Boolean, value: true }
  },

  data: {
    greeting: '',
    userName: '',
    statusBarHeight: 20,
    // 胶囊按钮相关
    menuTop: 26,         // 胶囊顶部距离（px）
    menuHeight: 32,      // 胶囊高度（px）
    menuRight: 96,       // 胶囊占用的右侧宽度（px），铃铛要避开
    navBarHeight: 44     // 导航栏总高度（状态栏 + 内容区）
  },

  lifetimes: {
    attached: function () {
      this._setGreeting();
      this._calcNavBar();
    }
  },

  pageLifetimes: {
    show: function () {
      this._setGreeting();
    }
  },

  methods: {
    _setGreeting: function () {
      var h = new Date().getHours();
      var greeting = '晚上好';
      if (h < 6) greeting = '夜深了';
      else if (h < 11) greeting = '早上好';
      else if (h < 14) greeting = '中午好';
      else if (h < 18) greeting = '下午好';

      var profile = {};
      try {
        profile = wx.getStorageSync('user_profile') || {};
      } catch (e) {}
      var name = profile.nickName || profile.name || 'FitKeep';

      this.setData({
        greeting: greeting + '，继续加油',
        userName: name
      });
    },

    // 计算导航栏布局（优先全局，兼容独立使用）
    _calcNavBar: function () {
      var app = getApp();
      if (app && app.globalData && app.globalData.navBarHeight) {
        this.setData({
          statusBarHeight: app.globalData.statusBarHeight,
          menuTop: 0, // 不单独使用
          menuHeight: 0,
          menuRight: app.globalData.menuRight,
          navBarHeight: app.globalData.navBarHeight,
          contentHeight: app.globalData.contentHeight
        });
        return;
      }
      // 兆底：独立计算
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
        this.setData({
          statusBarHeight: statusBarHeight,
          menuTop: menuTop,
          menuHeight: menuHeight,
          menuRight: menuRight,
          navBarHeight: navBarHeight,
          contentHeight: contentHeight
        });
      } catch (e) {
        this.setData({
          statusBarHeight: 20,
          menuTop: 26,
          menuHeight: 32,
          menuRight: 96,
          navBarHeight: 64,
          contentHeight: 44
        });
      }
    },

    onGoMine: function () {
      wx.navigateTo({ url: '/pages/mine/mine' });
    },

    onNotify: function () {
      this.triggerEvent('notify');
      wx.showToast({ title: '暂无新消息', icon: 'none' });
    }
  }
});
