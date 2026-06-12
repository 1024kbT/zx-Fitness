// 云开发封装：用户/记录/计划/动作同步 + AI 调用 + 对话历史
// AI 降级：云开发没就绪时，直接客户端 wx.request 调接口
var AI_FALLBACK_URL = 'http://1.94.147.144:3360/v1/chat/completions';
var AI_FALLBACK_KEY = 'sk-nX3flvhnrYkYXFgZVIBdnbjBQxGUjnmXUDB5yf3MwD7AM0NW';
var SYSTEM_PROMPT = '你是 FitKeep 的 AI 健身教练，专业、简洁、友好。\n- 回答结构清晰、可操作\n- 涉及训练动作时给出组数×次数/重量/休息具体建议\n- 涉及饮食给出热量蛋白质量化建议\n- 不回答与健身/饮食/健康无关的问题\n- 用中文回复控制在300字以内';

function isReady() {
  if (typeof wx === 'undefined' || !wx.cloud) return false;
  var app = getApp && getApp();
  return !!(app && app.globalData && app.globalData.cloudReady);
}

// 安全获取 db（未就绪返回 null）
function _db() {
  if (!isReady()) return null;
  try { return wx.cloud.database(); } catch (e) { return null; }
}

/* ============ AI 调用（云函数优先 → 失败降级到客户端直调） ============ */
function callAI(messages, model) {
  if (isReady()) {
    return new Promise(function (resolve, reject) {
      wx.cloud.callFunction({
        name: 'ai-chat',
        data: { messages: messages, model: model || 'deepseek-chat' },
        success: function (res) {
          if (res.result && res.result.success) {
            resolve(res.result);
          } else {
            console.warn('[AI] 云函数失败，降级到客户端');
            callAILocal(messages, model).then(resolve).catch(reject);
          }
        },
        fail: function () {
          console.warn('[AI] 云函数调用失败，降级到客户端');
          callAILocal(messages, model).then(resolve).catch(reject);
        }
      });
    });
  }
  return callAILocal(messages, model);
}

function callAILocal(messages, model) {
  var finalMessages = (messages[0] && messages[0].role === 'system')
    ? messages
    : [{ role: 'system', content: SYSTEM_PROMPT }].concat(messages);
  return new Promise(function (resolve, reject) {
    wx.request({
      url: AI_FALLBACK_URL,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + AI_FALLBACK_KEY
      },
      data: {
        model: model || 'deepseek-chat',
        messages: finalMessages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: false
      },
      timeout: 30000,
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.choices) {
          var choice = res.data.choices[0];
          resolve({
            success: true,
            content: choice ? choice.message.content : '(无内容)',
            usage: res.data.usage,
            model: res.data.model
          });
        } else if (res.data && res.data.error) {
          reject(new Error(res.data.error.message || 'API 返回错误'));
        } else {
          reject(new Error('AI 调用失败 (HTTP ' + res.statusCode + ')'));
        }
      },
      fail: function (err) {
        reject(new Error(err.errMsg || '网络请求失败'));
      }
    });
  });
}

/* ============ 用户信息 ============ */
function syncUser(profile) {
  var db = _db();
  if (!db) return Promise.resolve(null);
  return db.collection('users').where({}).limit(1).get().then(function (res) {
    var data = res.data || [];
    var payload = {
      nickName: profile.nickName || '',
      avatarUrl: profile.avatarUrl || '',
      bio: profile.bio || '',
      weight: profile.weight || 0,
      updatedAt: db.serverDate()
    };
    if (data.length > 0) {
      return db.collection('users').doc(data[0]._id).update({ data: payload })
        .then(function () { return data[0]._id; });
    }
    var payload2 = Object.assign({ createdAt: db.serverDate() }, payload);
    return db.collection('users').add({ data: payload2 }).then(function (r) { return r._id; });
  });
}

function fetchUser() {
  var db = _db();
  if (!db) return Promise.resolve(null);
  return db.collection('users').where({}).limit(1).get().then(function (res) {
    return (res.data && res.data[0]) || null;
  }).catch(function () { return null; });
}

/* ============ 训练记录 ============ */
function syncRecord(record) {
  var db = _db();
  if (!db) return Promise.resolve(null);
  // 用 record.id 查重，避免同一记录多次上传
  return db.collection('workout_records').where({ recordId: record.id }).limit(1).get().then(function (res) {
    if (res.data && res.data.length > 0) return res.data[0]._id;
    var payload = Object.assign({}, record, {
      recordId: record.id,
      createdAt: db.serverDate()
    });
    return db.collection('workout_records').add({ data: payload }).then(function (r) { return r._id; });
  }).catch(function (err) {
    console.warn('[cloud] 记录同步失败', err);
    return null;
  });
}

function fetchRecords(limit) {
  var db = _db();
  if (!db) return Promise.resolve([]);
  return db.collection('workout_records')
    .orderBy('createdAt', 'desc')
    .limit(limit || 100)
    .get()
    .then(function (res) { return res.data || []; })
    .catch(function () { return []; });
}

function removeRecord(recordId) {
  var db = _db();
  if (!db) return Promise.resolve();
  return db.collection('workout_records').where({ recordId: recordId }).remove()
    .catch(function (err) { console.warn('[cloud] 记录删除失败', err); });
}

function clearRecords() {
  var db = _db();
  if (!db) return Promise.resolve();
  // 云开发 where({}).remove() 单次最多 100 条，循环清理
  function loop() {
    return db.collection('workout_records').where({}).limit(100).get().then(function (res) {
      if (!res.data || res.data.length === 0) return;
      return db.collection('workout_records').where({}).remove().then(loop);
    });
  }
  return loop().catch(function (err) { console.warn('[cloud] 记录清空失败', err); });
}

/* ============ 自定义动作 ============ */
function syncExercise(ex) {
  var db = _db();
  if (!db) return Promise.resolve(null);
  return db.collection('custom_exercises').where({ exerciseId: ex.id }).limit(1).get().then(function (res) {
    var payload = Object.assign({}, ex, {
      exerciseId: ex.id,
      updatedAt: db.serverDate()
    });
    if (res.data && res.data.length > 0) {
      return db.collection('custom_exercises').doc(res.data[0]._id).update({ data: payload })
        .then(function () { return res.data[0]._id; });
    }
    var payload2 = Object.assign({ createdAt: db.serverDate() }, payload);
    return db.collection('custom_exercises').add({ data: payload2 }).then(function (r) { return r._id; });
  }).catch(function (err) {
    console.warn('[cloud] 动作同步失败', err);
    return null;
  });
}

function removeExercise(exerciseId) {
  var db = _db();
  if (!db) return Promise.resolve();
  return db.collection('custom_exercises').where({ exerciseId: exerciseId }).remove()
    .catch(function (err) { console.warn('[cloud] 动作删除失败', err); });
}

function fetchExercises() {
  var db = _db();
  if (!db) return Promise.resolve([]);
  return db.collection('custom_exercises')
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get()
    .then(function (res) { return res.data || []; })
    .catch(function () { return []; });
}

/* ============ 自定义计划 ============ */
function syncPlan(plan) {
  var db = _db();
  if (!db) return Promise.resolve(null);
  return db.collection('custom_plans').where({ planId: plan.id }).limit(1).get().then(function (res) {
    var payload = {
      planId: plan.id,
      name: plan.name || '',
      name_en: plan.name_en || '',
      desc: plan.desc || '',
      days: plan.days || [],
      updatedAt: db.serverDate()
    };
    if (res.data && res.data.length > 0) {
      return db.collection('custom_plans').doc(res.data[0]._id).update({ data: payload })
        .then(function () { return res.data[0]._id; });
    }
    var payload2 = Object.assign({ createdAt: db.serverDate() }, payload);
    return db.collection('custom_plans').add({ data: payload2 }).then(function (r) { return r._id; });
  }).catch(function (err) {
    console.warn('[cloud] 计划同步失败', err);
    return null;
  });
}

function removePlan(planId) {
  var db = _db();
  if (!db) return Promise.resolve();
  return db.collection('custom_plans').where({ planId: planId }).remove()
    .catch(function (err) { console.warn('[cloud] 计划删除失败', err); });
}

function fetchPlans() {
  var db = _db();
  if (!db) return Promise.resolve([]);
  return db.collection('custom_plans')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()
    .then(function (res) { return res.data || []; })
    .catch(function () { return []; });
}

/* ============ AI 对话历史 ============ */
function saveConversation(messages) {
  var db = _db();
  if (!db) return Promise.resolve(null);
  // 只存最近 30 条
  var sliced = (messages || []).slice(-30);
  return db.collection('ai_conversations').add({
    data: { messages: sliced, createdAt: db.serverDate() }
  }).then(function (r) { return r._id; })
    .catch(function (err) { console.warn('[cloud] 对话保存失败', err); return null; });
}

function fetchConversations(limit) {
  var db = _db();
  if (!db) return Promise.resolve([]);
  return db.collection('ai_conversations')
    .orderBy('createdAt', 'desc')
    .limit(limit || 10)
    .get()
    .then(function (res) { return res.data || []; })
    .catch(function () { return []; });
}

/* ============ 全量同步（启动时调用） ============ */
function fetchAll() {
  if (!isReady()) return Promise.resolve(null);
  return Promise.all([
    fetchUser(),
    fetchRecords(200),
    fetchExercises(),
    fetchPlans()
  ]).then(function (res) {
    return {
      user: res[0],
      records: res[1],
      exercises: res[2],
      plans: res[3]
    };
  }).catch(function (err) {
    console.warn('[cloud] 全量拉取失败', err);
    return null;
  });
}

module.exports = {
  isReady: isReady,
  callAI: callAI,
  syncUser: syncUser,
  fetchUser: fetchUser,
  syncRecord: syncRecord,
  fetchRecords: fetchRecords,
  removeRecord: removeRecord,
  clearRecords: clearRecords,
  syncExercise: syncExercise,
  removeExercise: removeExercise,
  fetchExercises: fetchExercises,
  syncPlan: syncPlan,
  removePlan: removePlan,
  fetchPlans: fetchPlans,
  saveConversation: saveConversation,
  fetchConversations: fetchConversations,
  fetchAll: fetchAll
};
