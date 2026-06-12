// 时间和日期格式化工具
function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

// 秒 -> mm:ss
function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return pad(m) + ':' + pad(sec);
}

// 秒 -> 中文友好（如 1小时20分 / 12分30秒）
function humanDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  if (s < 60) return s + '秒';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return h + '小时' + (m > 0 ? m + '分' : '');
  return m + '分' + (sec > 0 ? sec + '秒' : '');
}

// 时间戳 -> YYYY-MM-DD HH:mm
function formatTime(ts) {
  const d = new Date(ts);
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    ' ' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  );
}

// 时间戳 -> MM-DD
function formatDate(ts) {
  const d = new Date(ts);
  return pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

module.exports = {
  formatDuration,
  humanDuration,
  formatTime,
  formatDate
};
