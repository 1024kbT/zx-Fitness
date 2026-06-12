/**
 * 统一反馈工具（触觉 + 声音）
 *  - tap()      轻触感（点按钮、切换）
 *  - medium()   中触感（完成小任务、标记）
 *  - heavy()    重触感（完成大任务、训练结束）
 *  - success()  完成提示音 + 重触感
 *  - restEnd()  休息结束提示音 + 中触感
 *  - error()    错误提示音 + 轻触感
 */

function _vibrate(type) {
  if (wx && wx.vibrateShort) {
    try {
      wx.vibrateShort({ type: type || 'light' });
    } catch (e) {
      // 某些机型/基础库版本不支持 type
      try { wx.vibrateShort(); } catch (_) {}
    }
  }
}

function tap() {
  _vibrate('light');
}

function medium() {
  _vibrate('medium');
}

function heavy() {
  _vibrate('heavy');
}

/** 通用提示音（短促 beep） */
function _beep(freq, durationMs) {
  // 微信没有全局 beep，但可用 wx.createInnerAudioContext 播放短音效
  // 这里简化：用 vibrateLong 代替，或完全依赖触感
  if (wx && wx.vibrateLong) {
    try { wx.vibrateLong(); } catch (e) {}
  }
}

/** 完成大任务（训练完成） */
function success() {
  heavy();
  // 微信没有系统声音接口，依赖触觉
}

/** 休息结束（提醒继续） */
function restEnd() {
  medium();
  medium();
  // 间隔两次中触感模拟"提示"
}

/** 错误反馈 */
function error() {
  tap();
  tap();
}

module.exports = {
  tap: tap,
  medium: medium,
  heavy: heavy,
  success: success,
  restEnd: restEnd,
  error: error
};
