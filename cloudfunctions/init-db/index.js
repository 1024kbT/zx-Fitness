// 云函数：init-db
// 一键初始化数据库集合（users / workout_records / custom_plans）
// 使用方式：云函数控制台手动调用一次即可
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const COLLECTIONS = ['users', 'workout_records', 'custom_plans', 'ai_conversations'];

exports.main = async () => {
  const result = {};
  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name);
      result[name] = 'created';
    } catch (err) {
      // -501001 表示集合已存在，忽略即可
      if (err && err.errCode === -501001) {
        result[name] = 'exists';
      } else {
        result[name] = 'error: ' + (err.errMsg || err.message);
      }
    }
  }
  return { success: true, collections: result };
};
