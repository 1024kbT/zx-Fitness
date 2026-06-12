const exerciseDB = require('../../../data/exercises');
const storage = require('../../../utils/storage.js');
const caloriesUtil = require('../../../utils/calories.js');
const { humanDuration, formatDuration } = require('../../../utils/format.js');
const feedback = require('../utils/feedback.js');

Page({
  data: {
    exercise: null,
    completedSets: 0,
    targetSets: 0,
    duration: 0,
    running: false,
    finished: false,
    setLogs: [],
    currentWeight: 0,
    weightStep: 2.5,      // 按 equipment 自动：哑铃 2，杠铃 5，其他 2.5，徒手 0
    showWeightInput: true, // 徒手时隐藏重量输入
    showTips: false,       // 动作要领默认折叠
    currentReps: 0,
    // 休息倒计时
    resting: false,
    restRemaining: 0,
    restTotal: 0,
    restDisplay: '00:00',
    restPaused: false,       // 休息倒计时是否暂停
    // 休息配置（用户可调）
    restMode: 'full',      // 'full' 完整倒计时 | 'hint' 仅提示不锁定 | 'off' 关闭
    restDuration: 60,      // 当前选择的休息秒数
    // 训练模式
    isPlanMode: false,
    sequence: [],
    sequenceIndex: -1,
    // Session（计划模式）
    sessionPlanName: '',
    sessionExercises: [],    // [{id, name, emoji, defaultSets, defaultReps, type, status:'pending'|'current'|'done', completedSets, totalSets}]
    sessionCurrentIndex: 0,
    sessionTotal: 0,
    sessionDoneCount: 0,
    showSummary: false,      // 全部完成时显示总结
    summaryExercises: [],
    // 滑块
    swipePercent: 0,
    _swipeStartX: 0,
    _swipeTrackWidth: 0,
    statusBarHeight: 20,
    navBarHeight: 64
  },

  onLoad(options) {
    // 从全局读取胶囊安全区
    var app = getApp();
    if (app && app.globalData) {
      this.setData({
        statusBarHeight: app.globalData.statusBarHeight || 20,
        navBarHeight: app.globalData.navBarHeight || 64
      });
    }

    const id = options.id;
    const isPlan = options.plan === '1';
    const ex =
      exerciseDB.exercises.find((x) => x.id === id) ||
      storage.getCustomExercises().find((x) => x.id === id);
    if (!ex) {
      wx.showToast({ title: '动作不存在', icon: 'error' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    let sequence = [];
    let currentIndex = -1;
    if (isPlan && options.sequence) {
      try {
        sequence = decodeURIComponent(options.sequence).split(',').filter(Boolean);
        currentIndex = sequence.indexOf(id);
      } catch (e) {
        sequence = [];
      }
    }
    // 读取用户上次的休息偏好
    const savedMode = wx.getStorageSync('rest_mode') || 'full';
    const savedDuration = Number(wx.getStorageSync('rest_duration')) || ex.rest_seconds || 60;

    // Session 处理
    let sessionExercises = [];
    let sessionCurrentIndex = 0;
    let sessionPlanName = '';
    const app = getApp();
    if (isPlan && app && app.globalData && app.globalData.session) {
      const session = app.globalData.session;
      sessionPlanName = session.planName || '';
      sessionCurrentIndex = currentIndex >= 0 ? currentIndex : (session.currentIndex || 0);
      // 构造带状态的列表
      sessionExercises = (session.exercises || []).map(function (x, idx) {
        var completed = session.completed[x.id];
        var status = 'pending';
        if (completed && completed.done) status = 'done';
        else if (idx === sessionCurrentIndex) status = 'current';
        return Object.assign({}, x, {
          status: status,
          completedSets: completed ? (completed.completedSets || 0) : 0,
          totalSets: x.defaultSets || 4,
          calories: completed ? (completed.calories || 0) : 0
        });
      });
    }

    // 根据 equipment 决定重量步进
    const eq = (ex.equipment || '').toLowerCase();
    let weightStep = 2.5;
    let showWeightInput = true;
    if (eq === 'bodyweight' || eq === 'none' || eq === '徒手') {
      weightStep = 0;
      showWeightInput = false;
    } else if (eq === 'barbell' || eq === '杠铃') {
      weightStep = 5;
    } else if (eq === 'dumbbell' || eq === '哑铃') {
      weightStep = 2;
    }

    this.setData({
      exercise: ex,
      targetSets: ex.default_sets,
      currentReps: ex.type === 'reps' ? ex.default_reps : ex.default_seconds,
      currentWeight: 0,
      weightStep: weightStep,
      showWeightInput: showWeightInput,
      showTips: false,
      restDuration: savedDuration,
      restMode: savedMode,
      restTotal: savedDuration,
      isPlanMode: isPlan,
      sequence: sequence,
      sequenceIndex: currentIndex,
      sessionPlanName: sessionPlanName,
      sessionExercises: sessionExercises,
      sessionCurrentIndex: sessionCurrentIndex >= 0 ? sessionCurrentIndex : 0,
      sessionTotal: sessionExercises.length,
      sessionDoneCount: sessionExercises.filter(function (x) { return x.status === 'done'; }).length
    });
  },

  onReady() {
    this.timer = this.selectComponent('#mainTimer');
    // Session 模式下，自动从 globalData 累计时长继续计时
    if (this.data.isPlanMode && this.data.sessionTotal > 0) {
      var app = getApp();
      var elapsed = (app && app.globalData && app.globalData.sessionElapsed) || 0;
      if (this.timer) {
        if (elapsed > 0) {
          this.timer.startFrom(elapsed);
        } else {
          this.timer.start();
        }
        this.setData({ running: true, duration: elapsed });
      }
    }
  },

  // 图片加载失败：标记该动作为 imageFailed，回退到 emoji
  onExerciseImageError: function (e) {
    var idx = Number(e.currentTarget.dataset.idx);
    var key = 'sessionExercises[' + idx + '].imageFailed';
    this.setData({ [key]: true });
  },

  onUnload() {
    if (this.timer) this.timer.pause();
    this._clearRest();
  },

  onTick(e) {
    this.setData({ duration: e.detail.seconds });
    // Session 模式下，每 5 秒回写一次累计时长到 globalData，防止页面重定向丢失
    if (this.data.isPlanMode && this.data.sessionTotal > 0) {
      var s = e.detail.seconds || 0;
      if (s % 5 === 0) {
        var app = getApp();
        if (app && app.globalData) app.globalData.sessionElapsed = s;
      }
    }
  },

  onToggle() {
    if (!this.timer) return;
    this.timer.toggle();
    this.setData({ running: !this.data.running });
  },

  onAdjustWeight(e) {
    const step = this.data.weightStep || 2.5;
    const deltaRaw = Number(e.currentTarget.dataset.delta);
    // 保持符号与步长一致
    const delta = deltaRaw < 0 ? -step : step;
    const next = Math.max(0, +(this.data.currentWeight + delta).toFixed(1));
    this.setData({ currentWeight: next });
    feedback.tap();
  },

  onToggleTips() {
    this.setData({ showTips: !this.data.showTips });
  },

  onAdjustReps(e) {
    const delta = Number(e.currentTarget.dataset.delta);
    const next = Math.max(1, this.data.currentReps + delta);
    this.setData({ currentReps: next });
  },

  // ===== 休息配置 =====
  onPickRestDuration(e) {
    const sec = Number(e.currentTarget.dataset.sec);
    this.setData({ restDuration: sec, restTotal: sec });
    wx.setStorageSync('rest_duration', sec);
  },

  onPickRestMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ restMode: mode });
    wx.setStorageSync('rest_mode', mode);
  },

  // ===== 完成一组 =====
  onCompleteSet() {
    if (this.data.finished || this.data.resting) return;
    if (!this.data.running) {
      this.timer && this.timer.start();
      this.setData({ running: true });
    }
    const log = {
      set: this.data.completedSets + 1,
      reps: this.data.currentReps,
      weight: this.data.currentWeight,
      rest: this.data.restDuration
    };
    const logs = this.data.setLogs.concat([log]);
    const next = this.data.completedSets + 1;
    feedback.tap();
    this.setData({ completedSets: next, setLogs: logs });

    if (next >= this.data.targetSets) {
      wx.showToast({ title: '目标完成', icon: 'none' });
      setTimeout(() => this.onFinish(), 1200);
      return;
    }

    // 根据 restMode 决定后续行为
    const mode = this.data.restMode;
    if (mode === 'off') {
      // 关闭：直接不做任何休息提示
      return;
    }
    if (mode === 'hint') {
      // 仅提示：弹 toast 但不锁定界面
      wx.showToast({
        title: '建议休息 ' + this.data.restDuration + 's',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    // full：完整倒计时覆盖层
    this._startRest(this.data.restDuration);
  },

  // ===== 组间休息倒计时 =====
  _startRest(seconds) {
    this._clearRest();
    const total = Math.max(10, seconds);
    this.setData({
      resting: true,
      restTotal: total,
      restRemaining: total,
      restDisplay: formatDuration(total)
    });
    this._restTimer = setInterval(() => {
      // 暂停时不减少
      if (this.data.restPaused) return;
      const next = this.data.restRemaining - 1;
      if (next <= 0) {
        this._clearRest();
        this.setData({ resting: false, restRemaining: 0, restDisplay: '00:00' });
        feedback.restEnd();
        wx.showToast({ title: '休息结束，继续!', icon: 'none' });
        return;
      }
      this.setData({ restRemaining: next, restDisplay: formatDuration(next) });
    }, 1000);
  },

  _clearRest() {
    if (this._restTimer) {
      clearInterval(this._restTimer);
      this._restTimer = null;
    }
    this.setData({ restPaused: false });
  },

  onSkipRest() {
    this._clearRest();
    this.setData({ resting: false, restRemaining: 0, restDisplay: '00:00' });
  },

  onExtendRest() {
    const next = this.data.restRemaining + 15;
    this.setData({ restRemaining: next, restTotal: next, restDisplay: formatDuration(next) });
  },

  // 暂停/继续休息倒计时
  onToggleRestPause() {
    const paused = !this.data.restPaused;
    this.setData({ restPaused: paused });
    feedback.tap();
  },

  // 休息覆盖层里的快捷调整
  onTuneRest(e) {
    const delta = Number(e.currentTarget.dataset.delta);
    const next = Math.max(5, this.data.restRemaining + delta);
    const total = Math.max(5, this.data.restTotal + delta);
    this.setData({
      restRemaining: next,
      restTotal: total,
      restDisplay: formatDuration(next)
    });
  },

  onAdjustSets(e) {
    const delta = Number(e.currentTarget.dataset.delta);
    const next = Math.max(1, this.data.targetSets + delta);
    this.setData({ targetSets: next });
  },

  // ===== 结束并保存 =====
  onFinish() {
    if (this.data.completedSets === 0) {
      wx.showToast({ title: '至少完成一组', icon: 'none' });
      return;
    }
    this.timer && this.timer.pause();
    this._clearRest();
    const ex = this.data.exercise;
    const record = {
      id: 'r_' + Date.now(),
      exerciseId: ex.id,
      exerciseName: ex.name,
      category: ex.category,
      type: ex.type,
      sets: this.data.completedSets,
      setLogs: this.data.setLogs,
      repsPerSet: ex.type === 'reps' ? ex.default_reps : null,
      secondsPerSet: ex.type === 'time' ? ex.default_seconds : null,
      duration: this.data.duration,
      createdAt: Date.now()
    };
    storage.add(record);
    // 计算卡路里
    const calResult = caloriesUtil.calcCalories(record, ex);
    feedback.success();

    // Session 模式：更新状态并切换下一个
    if (this.data.isPlanMode && this.data.sessionTotal > 0) {
      const app = getApp();
      if (app && app.updateSessionExercise) {
        app.updateSessionExercise(ex.id, {
          done: true,
          completedSets: this.data.completedSets,
          totalSets: this.data.targetSets,
          calories: calResult.kcal,
          duration: this.data.duration
        });
      }
      this._refreshSessionList();
      // 检查是否全部完成
      if (this._allDone()) {
        this._showSummary();
        return;
      }
      // 未全部完成：提示并自动进入下一个未完成动作
      wx.showToast({ title: ex.name + ' 完成！', icon: 'success', duration: 1200 });
      setTimeout(() => this._goNextUndone(), 1200);
      return;
    }

    // 单动作模式：显示完成卡片
    this.setData({
      finished: true,
      finishedCalories: calResult.kcal,
      finishedMethod: calResult.method,
      finishedMethodLabel: calResult.method === 'work' ? '做功法' : calResult.method === 'met' ? 'MET法' : '估算法',
      finishedBreakdown: calResult.breakdown || {},
      finishedDurationLabel: humanDuration(record.duration),
      finishedSets: record.sets,
      finishedHasNext: false
    });
  },

  // 刷新 session 列表状态（增量更新，不重新生成整个数组，避免 swiper 重渲染）
  _refreshSessionList: function () {
    var app = getApp();
    if (!app || !app.globalData || !app.globalData.session) return;
    var session = app.globalData.session;
    var currentIdx = this.data.sessionCurrentIndex;
    var currentList = this.data.sessionExercises || [];

    var updates = {};
    var doneCount = 0;
    currentList.forEach(function (x, i) {
      var completed = session.completed[x.id];
      var newStatus = 'pending';
      var newCompletedSets = 0;
      var newCalories = 0;
      if (completed && completed.done) {
        newStatus = 'done';
        newCompletedSets = completed.completedSets || 0;
        newCalories = completed.calories || 0;
      } else if (i === currentIdx) {
        newStatus = 'current';
      }
      if (newStatus === 'done') doneCount++;
      // 只在状态有变化时才更新
      if (x.status !== newStatus || x.completedSets !== newCompletedSets) {
        updates['sessionExercises[' + i + '].status'] = newStatus;
        updates['sessionExercises[' + i + '].completedSets'] = newCompletedSets;
        updates['sessionExercises[' + i + '].calories'] = newCalories;
      }
    });
    updates['sessionDoneCount'] = doneCount;
    this.setData(updates);
  },

  _allDone: function () {
    return this.data.sessionDoneCount >= this.data.sessionTotal;
  },

  // 跳到下一个未完成动作
  _goNextUndone: function () {
    var list = this.data.sessionExercises;
    var nextIdx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].status !== 'done') { nextIdx = i; break; }
    }
    if (nextIdx < 0) {
      this._showSummary();
      return;
    }
    this._switchToIndex(nextIdx);
  },

  // 点击顶部动作图标切换
  onTapSessionIcon: function (e) {
    var idx = Number(e.currentTarget.dataset.idx);
    if (idx === this.data.sessionCurrentIndex) return;
    this._confirmAndSwitch(idx);
  },

  // swiper 滑动中（记录目标索引，不跳转）
  onExerciseSlideChange: function (e) {
    this._pendingSlideIndex = e.detail.current;
  },

  // swiper 动画结束后跳转
  onExerciseSlideFinish: function () {
    var idx = this._pendingSlideIndex;
    if (idx === undefined || idx === this.data.sessionCurrentIndex) return;
    this._confirmAndSwitch(idx);
  },

  // 带确认的切换
  _confirmAndSwitch: function (idx) {
    var that = this;
    if (this.data.completedSets > 0 && !this.data.finished) {
      wx.showModal({
        title: '切换动作',
        content: '当前动作未完成 ' + this.data.completedSets + ' 组，切换后数据将保留在会话中。是否切换？',
        confirmText: '切换',
        success: function (res) {
          if (res.confirm) {
            that._doSaveCurrentProgress();
            that._switchToIndex(idx);
          } else {
            // 取消：把 swiper 复位
            that.setData({ sessionCurrentIndex: that.data.sessionCurrentIndex });
          }
        }
      });
      return;
    }
    this._switchToIndex(idx);
  },

  // 保存当前进度到 session（但不标记完成）
  _doSaveCurrentProgress: function () {
    if (this.data.completedSets <= 0) return;
    var app = getApp();
    if (app && app.updateSessionExercise) {
      app.updateSessionExercise(this.data.exercise.id, {
        done: false,
        completedSets: this.data.completedSets,
        totalSets: this.data.targetSets,
        calories: 0,
        duration: this.data.duration
      });
    }
  },

  _switchToIndex: function (idx) {
    var app = getApp();
    if (app && app.setCurrentIndex) app.setCurrentIndex(idx);
    // 跳转前立即保存累计时长，防止 onTick 未触发导致丢失
    if (app && app.globalData) {
      app.globalData.sessionElapsed = this.data.duration || 0;
    }
    var ex = this.data.sessionExercises[idx];
    if (!ex) return;
    var ids = this.data.sessionExercises.map(function (x) { return x.id; }).join(',');
    wx.redirectTo({
      url: '/pkg/train/workout/workout?id=' + ex.id + '&plan=1&sequence=' + encodeURIComponent(ids)
    });
  },

  // 显示训练总结
  _showSummary: function () {
    var app = getApp();
    var list = this.data.sessionExercises;
    var totalCal = 0;
    var totalSets = 0;
    list.forEach(function (x) {
      totalCal += x.calories || 0;
      totalSets += x.completedSets || 0;
    });
    this.setData({
      showSummary: true,
      summaryExercises: list,
      summaryTotalCalories: totalCal,
      summaryTotalSets: totalSets,
      summaryPlanName: this.data.sessionPlanName
    });
  },

  // 结束 session 并返回首页
  onEndSession: function () {
    var app = getApp();
    if (app && app.clearSession) app.clearSession();
    wx.navigateBack({ delta: 10 });
  },

  // 生成训练海报并保存到相册
  onSharePoster: function () {
    var that = this;
    wx.showLoading({ title: '生成海报中...' });

    wx.createSelectorQuery().in(this)
      .select('#posterCanvas')
      .fields({ node: true, size: true })
      .exec(function (res) {
        if (!res || !res[0] || !res[0].node) {
          wx.hideLoading();
          wx.showToast({ title: '生成失败', icon: 'none' });
          return;
        }
        var canvas = res[0].node;
        var ctx = canvas.getContext('2d');
        var dpr = wx.getWindowInfo().pixelRatio || 2;
        canvas.width = 600 * dpr;
        canvas.height = 900 * dpr;
        ctx.scale(dpr, dpr);

        // 背景（深色渐变）
        var grad = ctx.createLinearGradient(0, 0, 600, 900);
        grad.addColorStop(0, '#0d2818');
        grad.addColorStop(0.6, '#0a1628');
        grad.addColorStop(1, '#0e0a28');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 600, 900);

        // 装饰条
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(40, 60, 4, 60);

        // 标题
        ctx.fillStyle = '#00ff88';
        ctx.font = 'bold 22px -apple-system';
        ctx.fillText('FITKEEP', 60, 95);
        ctx.fillStyle = '#8b8fa3';
        ctx.font = '14px -apple-system';
        ctx.fillText('训练总结', 60, 120);

        // 日期
        var now = new Date();
        var dateStr = now.getFullYear() + '.' + (now.getMonth() + 1) + '.' + now.getDate();
        ctx.fillStyle = '#f0f0f5';
        ctx.font = 'bold 36px -apple-system';
        ctx.fillText(dateStr, 60, 175);

        // 计划名
        var plan = that.data.sessionPlanName || '今日训练';
        ctx.fillStyle = '#00e5ff';
        ctx.font = '18px -apple-system';
        ctx.fillText(plan, 60, 210);

        // 三统计
        var stats = [
          { label: '动作数', value: that.data.sessionTotal },
          { label: '总组数', value: that.data.summaryTotalSets },
          { label: '总千卡', value: that.data.summaryTotalCalories }
        ];
        var statW = 160;
        for (var i = 0; i < stats.length; i++) {
          var x = 60 + i * statW;
          ctx.fillStyle = '#f0f0f5';
          ctx.font = 'bold 52px -apple-system';
          ctx.fillText('' + stats[i].value, x, 300);
          ctx.fillStyle = '#8b8fa3';
          ctx.font = '14px -apple-system';
          ctx.fillText(stats[i].label, x, 325);
        }

        // 分割线
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(60, 360);
        ctx.lineTo(540, 360);
        ctx.stroke();

        // 动作列表（最多 5 个）
        var list = (that.data.summaryExercises || []).slice(0, 5);
        var y = 395;
        ctx.font = '18px -apple-system';
        for (var j = 0; j < list.length; j++) {
          var ex = list[j];
          // 绿勾
          ctx.fillStyle = '#00ff88';
          ctx.fillText('✓', 60, y);
          // 动作名
          ctx.fillStyle = '#f0f0f5';
          ctx.font = 'bold 18px -apple-system';
          var name = ex.name;
          if (name.length > 14) name = name.slice(0, 13) + '…';
          ctx.fillText(name, 90, y);
          // 右侧统计
          ctx.fillStyle = '#8b8fa3';
          ctx.font = '15px -apple-system';
          var meta = (ex.completedSets || 0) + ' 组 · ' + (ex.calories || 0) + ' kcal';
          ctx.fillText(meta, 540 - ctx.measureText(meta).width, y);
          y += 36;
        }

        // 底部 Slogan
        ctx.fillStyle = '#2a2e3a';
        ctx.font = '12px -apple-system';
        ctx.textAlign = 'center';
        ctx.fillText('FITKEEP · 科学管理热量 · 健康减脂', 300, 860);

        // 导出图片
        setTimeout(function () {
          wx.canvasToTempFilePath({
            canvas: canvas,
            width: 600,
            height: 900,
            destWidth: 600 * dpr,
            destHeight: 900 * dpr,
            fileType: 'jpg',
            quality: 0.92,
            success: function (r) {
              wx.hideLoading();
              wx.saveImageToPhotosAlbum({
                filePath: r.tempFilePath,
                success: function () {
                  feedback.success();
                  wx.showToast({ title: '海报已保存', icon: 'success' });
                },
                fail: function (err) {
                  if (err.errMsg && err.errMsg.indexOf('auth deny') >= 0) {
                    wx.showModal({
                      title: '需要相册权限',
                      content: '请在「设置」中授权访问相册以保存海报',
                      confirmText: '去授权',
                      success: function (mres) {
                        if (mres.confirm) wx.openSetting();
                      }
                    });
                  } else {
                    wx.showToast({ title: '保存失败', icon: 'none' });
                  }
                }
              });
            },
            fail: function () {
              wx.hideLoading();
              wx.showToast({ title: '生成失败', icon: 'none' });
            }
          });
        }, 100);
      });
  },

  // 手动结束 session
  onAbortSession: function () {
    var that = this;
    wx.showModal({
      title: '结束今日训练',
      content: '已完成的动作会保留记录，未完成的可下次再练。',
      confirmText: '结束',
      confirmColor: '#ef4444',
      success: function (res) {
        if (res.confirm) that.onEndSession();
      }
    });
  },

  // 统一确认结束（session 与单动作都走这里）
  onConfirmAbort: function () {
    var that = this;
    if (this.data.sessionTotal > 0) {
      this.onAbortSession();
      return;
    }
    // 单动作模式：二次确认结束训练
    wx.showModal({
      title: '结束训练',
      content: '确认结束本次训练？已完成组数会保存。',
      confirmText: '结束',
      cancelText: '取消',
      confirmColor: '#ef4444',
      success: function (res) {
        if (res.confirm) that.onFinish();
      }
    });
  },

  // ===== 滑块：滑动完成一组 =====
  _ensureTrackWidth: function (cb) {
    var that = this;
    if (this._swipeTrackWidth > 0) { cb(); return; }
    wx.createSelectorQuery().in(this).select('.swipe-track').boundingClientRect(function (rect) {
      if (rect && rect.width) {
        that._swipeTrackWidth = Math.max(100, rect.width - 60);
      }
      cb();
    }).exec();
  },

  onSwipeStart: function (e) {
    if (this.data.finished || this.data.resting) return;
    this._swipeStartX = e.touches[0].clientX;
    this._lastVibrateAt = 0;
    this._ensureTrackWidth(function () {});
  },

  onSwipeMove: function (e) {
    if (this.data.finished || this.data.resting) return;
    var that = this;
    this._ensureTrackWidth(function () {
      var trackW = that._swipeTrackWidth;
      if (!trackW) return;
      var deltaX = e.touches[0].clientX - that._swipeStartX;
      var percent = Math.max(0, Math.min(100, (deltaX / trackW) * 100));
      that.setData({ swipePercent: percent });
      // 超过 80% 时震动反馈
      var step = Math.floor(percent / 10);
      if (percent > 80 && that._lastVibrateAt !== step) {
        that._lastVibrateAt = step;
        feedback.tap();
      }
    });
  },

  onSwipeEnd: function () {
    if (this.data.finished || this.data.resting) return;
    var percent = this.data.swipePercent;
    if (percent >= 70) {
      // 触发完成一组（阈值降到 70%）
      this.setData({ swipePercent: 100 });
      var that = this;
      setTimeout(function () {
        that.setData({ swipePercent: 0 });
        that.onCompleteSet();
      }, 150);
    } else {
      // 未完成：弹回原位
      this.setData({ swipePercent: 0 });
    }
  },

  onBackHome: function () {
    wx.navigateBack({ delta: 10 });
  },

  noop: function () {}
});
