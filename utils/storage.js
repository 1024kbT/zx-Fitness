// 本地存储封装：训练记录、自定义动作、自定义计划、用户信息、体重、饮食
// 同时在云开发就绪时以双写方式同步到云端（写操作均接入）
var KEY = 'workout_records';
var CUSTOM_EX_KEY = 'custom_exercises';
var CUSTOM_PLAN_KEY = 'custom_plans';
var USER_KEY = 'user_profile';
var SYNC_FLAG_KEY = 'cloud_sync_status';
var WEIGHT_KEY = 'body_weight_logs';      // [{id, date, weight, waist, note, createdAt}]
var MEAL_KEY = 'meal_logs';              // [{id, date, type, text, kcal, protein, items, createdAt}]
var INTAKE_GOAL_KEY = 'intake_goal';     // number (kcal)
var START_WEIGHT_KEY = 'start_weight';   // number (kg)

// 懒加载 cloud，避免循环依赖
function _cloud() {
  try { return require('./cloud.js'); } catch (e) { return null; }
}

// 记录最近一次同步状态
function _markSync(topic, ok) {
  try {
    var status = wx.getStorageSync(SYNC_FLAG_KEY) || {};
    status[topic] = { ok: !!ok, at: Date.now() };
    wx.setStorageSync(SYNC_FLAG_KEY, status);
  } catch (e) {}
}

function getSyncStatus() {
  try { return wx.getStorageSync(SYNC_FLAG_KEY) || {}; } catch (e) { return {}; }
}

/* ============ 训练记录 ============ */
function getAll() {
  var list = wx.getStorageSync(KEY);
  return Array.isArray(list) ? list : [];
}

function add(record) {
  var list = getAll();
  list.unshift(record);
  wx.setStorageSync(KEY, list);
  var c = _cloud();
  if (c && c.isReady()) {
    c.syncRecord(record)
      .then(function () { _markSync('records', true); })
      .catch(function () { _markSync('records', false); });
  }
  return list;
}

function remove(id) {
  var list = getAll().filter(function (r) { return r.id !== id; });
  wx.setStorageSync(KEY, list);
  var c = _cloud();
  if (c && c.isReady()) {
    c.removeRecord(id).catch(function () {});
  }
  return list;
}

function clear() {
  wx.removeStorageSync(KEY);
  var c = _cloud();
  if (c && c.isReady()) {
    c.clearRecords().catch(function () {});
  }
}

function summary() {
  var list = getAll();
  var totalSeconds = list.reduce(function (s, r) { return s + (r.duration || 0); }, 0);
  var totalSets = list.reduce(function (s, r) { return s + (r.sets || 0); }, 0);
  return { totalCount: list.length, totalSeconds: totalSeconds, totalSets: totalSets };
}

/* ============ 自定义动作 ============ */
function getCustomExercises() {
  var list = wx.getStorageSync(CUSTOM_EX_KEY);
  return Array.isArray(list) ? list : [];
}

function addCustomExercise(ex) {
  var list = getCustomExercises();
  var item = Object.assign({
    id: 'custom_' + Date.now(),
    name_en: '',
    level: '初级',
    primary_muscle: '',
    secondary_muscle: '',
    type: 'reps',
    default_reps: 12,
    default_seconds: 0,
    default_sets: 4,
    rest_seconds: 60,
    instructions: [],
    image_url: '',
    custom: true
  }, ex);
  list.unshift(item);
  wx.setStorageSync(CUSTOM_EX_KEY, list);
  var c = _cloud();
  if (c && c.isReady()) {
    c.syncExercise(item)
      .then(function () { _markSync('exercises', true); })
      .catch(function () { _markSync('exercises', false); });
  }
  return list;
}

function updateCustomExercise(id, patch) {
  var list = getCustomExercises().map(function (x) {
    return x.id === id ? Object.assign({}, x, patch) : x;
  });
  wx.setStorageSync(CUSTOM_EX_KEY, list);
  var updated = list.find(function (x) { return x.id === id; });
  var c = _cloud();
  if (updated && c && c.isReady()) c.syncExercise(updated).catch(function () {});
  return list;
}

function removeCustomExercise(id) {
  var list = getCustomExercises().filter(function (x) { return x.id !== id; });
  wx.setStorageSync(CUSTOM_EX_KEY, list);
  var c = _cloud();
  if (c && c.isReady()) c.removeExercise(id).catch(function () {});
  return list;
}

/* ============ 自定义计划 ============ */
function getCustomPlans() {
  var list = wx.getStorageSync(CUSTOM_PLAN_KEY);
  return Array.isArray(list) ? list : [];
}

function addCustomPlan(plan) {
  var list = getCustomPlans();
  var item = Object.assign({
    id: 'cplan_' + Date.now(),
    name_en: '',
    desc: '自定义训练计划',
    custom: true,
    days: []
  }, plan);
  list.unshift(item);
  wx.setStorageSync(CUSTOM_PLAN_KEY, list);
  var c = _cloud();
  if (c && c.isReady()) {
    c.syncPlan(item)
      .then(function () { _markSync('plans', true); })
      .catch(function () { _markSync('plans', false); });
  }
  return list;
}

function updateCustomPlan(id, patch) {
  var list = getCustomPlans().map(function (p) {
    return p.id === id ? Object.assign({}, p, patch) : p;
  });
  wx.setStorageSync(CUSTOM_PLAN_KEY, list);
  var updated = list.find(function (p) { return p.id === id; });
  var c = _cloud();
  if (updated && c && c.isReady()) c.syncPlan(updated).catch(function () {});
  return list;
}

function removeCustomPlan(id) {
  var list = getCustomPlans().filter(function (p) { return p.id !== id; });
  wx.setStorageSync(CUSTOM_PLAN_KEY, list);
  var c = _cloud();
  if (c && c.isReady()) c.removePlan(id).catch(function () {});
  return list;
}

/* ============ 用户信息 ============ */
function getUserProfile() {
  var obj = wx.getStorageSync(USER_KEY);
  return obj && typeof obj === 'object' ? obj : null;
}

function saveUserProfile(profile) {
  var current = getUserProfile() || {};
  var merged = Object.assign({}, current, profile, { updatedAt: Date.now() });
  wx.setStorageSync(USER_KEY, merged);
  var c = _cloud();
  if (c && c.isReady()) {
    c.syncUser(merged)
      .then(function () { _markSync('user', true); })
      .catch(function () { _markSync('user', false); });
  }
  return merged;
}

/* ============ 全量从云端拉取并合并 ============ */
// 策略：
//   - 本地空 + 云端有 → 用云端覆盖本地
//   - 本地有 + 云端有 → 以本地为准（避免冲突），记录里用 id 去重
//   - 云端有本地无的增量记录 → 补充到本地
function mergeFromCloud(data) {
  if (!data) return { added: 0 };
  var added = 0;

  // 用户信息：本地空时用云端
  if (data.user && !getUserProfile()) {
    var cloudUser = {
      nickName: data.user.nickName || '',
      avatarUrl: data.user.avatarUrl || '',
      bio: data.user.bio || '',
      weight: data.user.weight || 0,
      updatedAt: Date.now()
    };
    wx.setStorageSync(USER_KEY, cloudUser);
  }

  // 训练记录：id 去重
  if (Array.isArray(data.records) && data.records.length > 0) {
    var localRecs = getAll();
    var localIdSet = {};
    localRecs.forEach(function (r) { if (r && r.id) localIdSet[r.id] = true; });
    var toAdd = [];
    data.records.forEach(function (cr) {
      var rid = cr.recordId || cr.id;
      if (rid && !localIdSet[rid]) {
        var copy = Object.assign({}, cr);
        copy.id = rid;
        // serverDate 是对象，转时间戳
        if (cr.createdAt && typeof cr.createdAt === 'object' && cr.createdAt.toDate) {
          copy.createdAt = cr.createdAt.toDate().getTime();
        } else if (cr.createdAt && typeof cr.createdAt === 'object' && cr.createdAt.getTime) {
          copy.createdAt = cr.createdAt.getTime();
        }
        delete copy._id;
        delete copy._openid;
        delete copy.recordId;
        toAdd.push(copy);
        added++;
      }
    });
    if (toAdd.length > 0) {
      var merged = toAdd.concat(localRecs).sort(function (a, b) {
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      wx.setStorageSync(KEY, merged);
    }
  }

  // 自定义动作：id 去重
  if (Array.isArray(data.exercises) && data.exercises.length > 0) {
    var localEx = getCustomExercises();
    var localExSet = {};
    localEx.forEach(function (x) { if (x && x.id) localExSet[x.id] = true; });
    var exToAdd = [];
    data.exercises.forEach(function (cx) {
      var eid = cx.exerciseId || cx.id;
      if (eid && !localExSet[eid]) {
        var copy = Object.assign({}, cx);
        copy.id = eid;
        delete copy._id;
        delete copy._openid;
        delete copy.exerciseId;
        exToAdd.push(copy);
      }
    });
    if (exToAdd.length > 0) {
      wx.setStorageSync(CUSTOM_EX_KEY, exToAdd.concat(localEx));
    }
  }

  // 自定义计划：id 去重
  if (Array.isArray(data.plans) && data.plans.length > 0) {
    var localPlans = getCustomPlans();
    var localPlanSet = {};
    localPlans.forEach(function (p) { if (p && p.id) localPlanSet[p.id] = true; });
    var plansToAdd = [];
    data.plans.forEach(function (cp) {
      var pid = cp.planId || cp.id;
      if (pid && !localPlanSet[pid]) {
        var copy = Object.assign({}, cp);
        copy.id = pid;
        delete copy._id;
        delete copy._openid;
        delete copy.planId;
        plansToAdd.push(copy);
      }
    });
    if (plansToAdd.length > 0) {
      wx.setStorageSync(CUSTOM_PLAN_KEY, plansToAdd.concat(localPlans));
    }
  }

  _markSync('pull', true);
  return { added: added };
}

// 启动时同步（拉取云端并合并）
function pullFromCloud() {
  var c = _cloud();
  if (!c || !c.isReady()) return Promise.resolve({ added: 0 });
  return c.fetchAll().then(mergeFromCloud).catch(function (err) {
    console.warn('[cloud] pull 失败', err);
    _markSync('pull', false);
    return { added: 0 };
  });
}

// 手动触发全量上推
function pushAllToCloud() {
  var c = _cloud();
  if (!c || !c.isReady()) return Promise.resolve({ ok: false, reason: '未就绪' });
  var profile = getUserProfile();
  var recs = getAll();
  var exs = getCustomExercises();
  var plans = getCustomPlans();

  var promises = [];
  if (profile) promises.push(c.syncUser(profile));
  recs.forEach(function (r) { promises.push(c.syncRecord(r)); });
  exs.forEach(function (x) { promises.push(c.syncExercise(x)); });
  plans.forEach(function (p) { promises.push(c.syncPlan(p)); });

  return Promise.all(promises).then(function () {
    _markSync('push', true);
    return { ok: true, count: promises.length };
  }).catch(function (err) {
    _markSync('push', false);
    return { ok: false, reason: err.message || '上传失败' };
  });
}

/* ============ 体重记录 ============ */
// { id, date(yyyy-MM-dd), weight(kg), waist(cm), note, createdAt(ts) }
function getWeightLogs() {
  var list = wx.getStorageSync(WEIGHT_KEY);
  return Array.isArray(list) ? list : [];
}
function addWeightLog(log) {
  var list = getWeightLogs();
  var item = Object.assign({
    id: 'w_' + Date.now(),
    date: _todayKey(),
    weight: 0,
    waist: 0,
    note: '',
    createdAt: Date.now()
  }, log);
  list.unshift(item);
  wx.setStorageSync(WEIGHT_KEY, list);
  // 如果从未设置过初始体重，则自动设为第一条
  if (!wx.getStorageSync(START_WEIGHT_KEY) && item.weight > 0) {
    wx.setStorageSync(START_WEIGHT_KEY, item.weight);
  }
  return list;
}
function removeWeightLog(id) {
  var list = getWeightLogs().filter(function (x) { return x.id !== id; });
  wx.setStorageSync(WEIGHT_KEY, list);
  return list;
}
function getLatestWeight() {
  var list = getWeightLogs();
  for (var i = 0; i < list.length; i++) {
    if (list[i].weight > 0) return list[i].weight;
  }
  return 0;
}
function getStartWeight() {
  var w = Number(wx.getStorageSync(START_WEIGHT_KEY)) || 0;
  if (w > 0) return w;
  // 默认取最早的一条
  var list = getWeightLogs();
  for (var i = list.length - 1; i >= 0; i--) {
    if (list[i].weight > 0) return list[i].weight;
  }
  return 0;
}
function setStartWeight(w) {
  wx.setStorageSync(START_WEIGHT_KEY, Number(w) || 0);
}

/* ============ 饮食记录 ============ */
// { id, date(yyyy-MM-dd), type(breakfast/lunch/dinner/snack), text, kcal, protein, items, createdAt }
function getMealLogs() {
  var list = wx.getStorageSync(MEAL_KEY);
  return Array.isArray(list) ? list : [];
}
function addMealLog(log) {
  var list = getMealLogs();
  var item = Object.assign({
    id: 'm_' + Date.now(),
    date: _todayKey(),
    type: 'breakfast',
    text: '',
    kcal: 0,
    protein: 0,
    items: [],
    createdAt: Date.now()
  }, log);
  list.unshift(item);
  wx.setStorageSync(MEAL_KEY, list);
  return list;
}
function removeMealLog(id) {
  var list = getMealLogs().filter(function (x) { return x.id !== id; });
  wx.setStorageSync(MEAL_KEY, list);
  return list;
}
// 指定日期总摄入（默认今日）
function getDayIntake(dateKey) {
  var key = dateKey || _todayKey();
  var list = getMealLogs().filter(function (m) { return m.date === key; });
  var kcal = 0;
  var protein = 0;
  list.forEach(function (m) {
    kcal += Number(m.kcal) || 0;
    protein += Number(m.protein) || 0;
  });
  return { kcal: kcal, protein: protein, meals: list };
}

/* ============ 摄入目标 ============ */
function getIntakeGoal() {
  var g = Number(wx.getStorageSync(INTAKE_GOAL_KEY)) || 0;
  return g > 0 ? g : 1900;
}
function setIntakeGoal(g) {
  wx.setStorageSync(INTAKE_GOAL_KEY, Number(g) || 0);
}

// 工具：今日字符串 yyyy-MM-dd
function _todayKey() {
  var d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

module.exports = {
  getAll: getAll,
  add: add,
  remove: remove,
  clear: clear,
  summary: summary,
  getCustomExercises: getCustomExercises,
  addCustomExercise: addCustomExercise,
  updateCustomExercise: updateCustomExercise,
  removeCustomExercise: removeCustomExercise,
  getCustomPlans: getCustomPlans,
  addCustomPlan: addCustomPlan,
  updateCustomPlan: updateCustomPlan,
  removeCustomPlan: removeCustomPlan,
  getUserProfile: getUserProfile,
  saveUserProfile: saveUserProfile,
  pullFromCloud: pullFromCloud,
  pushAllToCloud: pushAllToCloud,
  getSyncStatus: getSyncStatus,
  // 体重
  getWeightLogs: getWeightLogs,
  addWeightLog: addWeightLog,
  removeWeightLog: removeWeightLog,
  getLatestWeight: getLatestWeight,
  getStartWeight: getStartWeight,
  setStartWeight: setStartWeight,
  // 饮食
  getMealLogs: getMealLogs,
  addMealLog: addMealLog,
  removeMealLog: removeMealLog,
  getDayIntake: getDayIntake,
  // 目标
  getIntakeGoal: getIntakeGoal,
  setIntakeGoal: setIntakeGoal
};
