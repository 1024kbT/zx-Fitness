const cloud = require('../../../utils/cloud.js');

const STORAGE_KEY = 'ai_chat_history';
const MAX_HISTORY = 30;

const QUICK_PROMPTS = [
  { label: '🎯 今日训练', text: '我今天该练什么？请给我一个 60 分钟的训练方案' },
  { label: '💪 新手入门', text: '我是健身新手，给我一份一周 3 练的入门计划' },
  { label: '⚠️ 动作纠错', text: '杠铃深蹲腰酸背痛，可能是哪里不对？' },
  { label: '🥩 增肌饮食', text: '我体重 70kg 想增肌，每天该吃多少蛋白质？给我一日三餐示例' },
  { label: '🔥 减脂方案', text: '想 1 个月减 5 斤脂肪，给我训练 + 饮食方案' },
  { label: '😴 休息恢复', text: '训练后第二天肌肉很酸痛，还要继续练吗？' },
  { label: '🎬 动作要领', text: '请详细讲解「上斜哑铃卧推」的动作要领和常见错误' },
  { label: '🔥 热身准备', text: '练胸之前该怎么热身？给我 10 分钟热身流程' },
  { label: '📈 突破平台期', text: '力量训练卡平台期 2 个月，该怎么突破？' },
  { label: '🧘 拉伸放松', text: '训练后该怎么拉伸？给我 5 分钟全身放松流程' }
];

Page({
  data: {
    messages: [],     // [{ role: 'user'|'assistant', content, time }]
    inputText: '',
    sending: false,
    showQuick: true,
    quickPrompts: QUICK_PROMPTS,
    scrollToView: '',
    inputBottomOffset: 0,
    navBarHeight: 64,
    statusBarHeight: 20,
    menuRight: 96,
    contentHeight: 44
  },

  onLoad() {
    var app = getApp();
    if (app && app.globalData) {
      this.setData({
        navBarHeight: app.globalData.navBarHeight || 64,
        statusBarHeight: app.globalData.statusBarHeight || 20,
        menuRight: app.globalData.menuRight || 96,
        contentHeight: app.globalData.contentHeight || 44
      });
    }
    const history = wx.getStorageSync(STORAGE_KEY);
    if (Array.isArray(history) && history.length > 0) {
      this.setData({
        messages: history,
        showQuick: false
      });
      this._scrollToBottom();
    }
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  onPickQuick(e) {
    const text = e.currentTarget.dataset.text;
    this.setData({ inputText: text });
    this._send(text);
  },

  onSend() {
    const text = (this.data.inputText || '').trim();
    if (!text) return;
    this._send(text);
  },

  async _send(text) {
    if (this.data.sending) return;
    const userMsg = { role: 'user', content: text, time: Date.now() };
    const messages = this.data.messages.concat([userMsg]);
    this.setData({
      messages,
      inputText: '',
      sending: true,
      showQuick: false
    });
    this._scrollToBottom();
    this._persist(messages);

    // 占位"思考中"
    const placeholder = { role: 'assistant', content: '正在思考...', time: Date.now(), pending: true };
    const withPlaceholder = messages.concat([placeholder]);
    this.setData({ messages: withPlaceholder });
    this._scrollToBottom();

    try {
      // 只发送最近 10 条作为上下文
      const ctx = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      const res = await cloud.callAI(ctx);
      const reply = {
        role: 'assistant',
        content: res.content || '（无内容）',
        time: Date.now()
      };
      const finalMessages = messages.concat([reply]);
      this.setData({ messages: finalMessages, sending: false });
      this._persist(finalMessages);
      this._scrollToBottom();
    } catch (err) {
      var msg = err.message || err.errMsg || 'AI 调用失败';
      var hint = msg;
      if (msg.indexOf('url not in domain list') >= 0 || msg.indexOf('合法域名') >= 0) {
        hint = 'API 地址未配置合法域名\n请在开发者工具「详情-本地设置」勾选「不校验合法域名」';
      } else if (msg.indexOf('网络') >= 0 || msg.indexOf('timeout') >= 0) {
        hint = '网络连接失败，请检查网络';
      }
      var errMsg = {
        role: 'assistant',
        content: '⚠️ ' + hint,
        time: Date.now(),
        error: true
      };
      var finalMessages = messages.concat([errMsg]);
      this.setData({ messages: finalMessages, sending: false });
      this._persist(finalMessages);
      this._scrollToBottom();
    }
  },

  _persist(messages) {
    const trimmed = messages.slice(-MAX_HISTORY);
    wx.setStorageSync(STORAGE_KEY, trimmed);
  },

  _scrollToBottom() {
    setTimeout(() => {
      const last = this.data.messages.length - 1;
      if (last >= 0) {
        this.setData({ scrollToView: 'msg-' + last });
      }
    }, 50);
  },

  onClear() {
    if (this.data.messages.length === 0) return;
    wx.showModal({
      title: '清空对话',
      content: '将清除所有对话历史，确定？',
      confirmText: '清空',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync(STORAGE_KEY);
          this.setData({ messages: [], showQuick: true });
        }
      }
    });
  },

  // 长按消息复制
  onCopyMessage(e) {
    const content = e.currentTarget.dataset.content;
    if (!content) return;
    wx.setClipboardData({ data: content });
  }
});
