/**
 * 动作图片 URL 映射（硬编码）
 *
 * 数据来源: wger.de Exercise Images API（已爬取固化）
 * URL 模板: https://wger.de/media/exercise-images/{exercise_id}/{filename}
 *
 * 使用方式（同步，零网络依赖）:
 *   const images = require('../../config/images');
 *   const url = images.getImageUrl('barbell-bench-press');
 *   // → 'https://wger.de/media/exercise-images/192/Bench-press-1.png'
 *
 * 小程序后台需配置 downloadFile 合法域名: https://wger.de
 */

// 爬取自 wger.de 的图片 URL 映射（localId → 完整 URL）
// 共 39 条，爬取时间: 2026-06-11
const IMAGE_URL_MAP = {
  // === 胸部 chest (8) ===
  'barbell-bench-press': 'https://wger.de/media/exercise-images/192/Bench-press-1.png',
  'flat-barbell-bench-press-wide': 'https://wger.de/media/exercise-images/192/Bench-press-1.png',
  'flat-barbell-bench-press-close': 'https://wger.de/media/exercise-images/192/Bench-press-1.png',
  'incline-barbell-press': 'https://wger.de/media/exercise-images/192/Bench-press-1.png',
  'incline-dumbbell-press': 'https://wger.de/media/exercise-images/1277/9f3c7817-3e3d-417d-8b08-2c0a1aa5fe03.jpg',
  'dumbbell-bench-press': 'https://wger.de/media/exercise-images/192/Bench-press-1.png',
  'decline-barbell-press': 'https://wger.de/media/exercise-images/192/Bench-press-1.png',
  'push-up': 'https://wger.de/media/exercise-images/907/f6121ac9-330e-4ed7-8219-91ce246bf871.png',

  // === 背部 back (6) ===
  'lat-pulldown-wide': 'https://wger.de/media/exercise-images/1971/729af526-19a0-4d3d-a258-196c7575d139.jpg',
  'seated-cable-row': 'https://wger.de/media/exercise-images/1117/e74255c0-67a0-4309-b78d-2d79e6ff8c11.png',
  'barbell-row': 'https://wger.de/media/exercise-images/109/Barbell-rear-delt-row-1.png',
  'pull-up': 'https://wger.de/media/exercise-images/475/b0554016-16fd-4dbe-be47-a2a17d16ae0e.jpg',
  'chin-up': 'https://wger.de/media/exercise-images/181/Chin-ups-2.png',
  // t-bar-row 在 wger 无对应图

  // === 肩部 shoulders (5) ===
  'barbell-overhead-press': 'https://wger.de/media/exercise-images/119/seated-barbell-shoulder-press-large-1.png',
  'dumbbell-shoulder-press': 'https://wger.de/media/exercise-images/123/dumbbell-shoulder-press-large-1.png',
  'lateral-raise': 'https://wger.de/media/exercise-images/1378/7c1fcf34-fb7e-4a4c-8124-51f296235315.jpg',
  'face-pull': 'https://wger.de/media/exercise-images/1639/8927346e-f5ca-4795-bdf1-5ac9309401e7.webp',
  'front-raise': 'https://wger.de/media/exercise-images/1745/9c92843a-6b90-428b-a868-9af4b11bad38.jpg',

  // === 手臂 arms (5) ===
  'barbell-curl': 'https://wger.de/media/exercise-images/74/Bicep-curls-1.png',
  'hammer-curl': 'https://wger.de/media/exercise-images/1567/0a8c155c-a48e-47e8-9df3-e39f025c6cad.png',
  'dumbbell-curl': 'https://wger.de/media/exercise-images/74/Bicep-curls-1.png',
  'close-grip-bench-press': 'https://wger.de/media/exercise-images/192/Bench-press-1.png',
  'skull-crusher': 'https://wger.de/media/exercise-images/50/695ced5c-9961-4076-add2-cb250d01089e.png',

  // === 腿部 legs (11) ===
  'barbell-squat': 'https://wger.de/media/exercise-images/1801/60043328-1cfb-4289-9865-aaf64d5aaa28.jpg',
  'front-squat': 'https://wger.de/media/exercise-images/1640/bdea82f1-15ef-4649-8b5a-1303cfc178e7.webp',
  'leg-press': 'https://wger.de/media/exercise-images/146/8b284904-d072-4381-a256-4c81d8fd9c1f.png',
  'leg-extension': 'https://wger.de/media/exercise-images/369/78c915d1-e46d-4d30-8124-65d68664c3ef.png',
  'lying-leg-curl': 'https://wger.de/media/exercise-images/364/b318dde9-f5f2-489f-940a-cd864affb9e3.png',
  'seated-leg-curl': 'https://wger.de/media/exercise-images/364/b318dde9-f5f2-489f-940a-cd864affb9e3.png',
  'calf-raise-stand': 'https://wger.de/media/exercise-images/622/9a429bd0-afd3-4ad0-8043-e9beec901c81.jpeg',
  'barbell-hip-thrust': 'https://wger.de/media/exercise-images/1642/a81ad922-caf5-47f8-99b4-640cb0717436.webp',
  'deadlift': 'https://wger.de/media/exercise-images/184/1709c405-620a-4d07-9658-fade2b66a2df.jpeg',
  'romanian-deadlift': 'https://wger.de/media/exercise-images/1652/0306c8c0-70cc-45d4-92de-6fa72ceaa834.webp',
  'bulgarian-split-squat': 'https://wger.de/media/exercise-images/1706/0c5243cc-2539-4005-aee0-d3a8c5d3a32c.jfif',

  // === 核心 core (5) ===
  'crunch': 'https://wger.de/media/exercise-images/91/Crunches-1.png',
  'cable-crunch-kneeling': 'https://wger.de/media/exercise-images/91/Crunches-1.png',
  'hanging-leg-raise': 'https://wger.de/media/exercise-images/979/27097a3a-5749-428d-b94c-6082afe390f6.png',
  'plank': 'https://wger.de/media/exercise-images/458/b7bd9c28-9f1d-4647-bd17-ab6a3adf5770.png',
  'russian-twist': 'https://wger.de/media/exercise-images/1193/70ca5d80-3847-4a8c-8882-c6e9e485e29e.png'
};

/**
 * 同步获取动作图片 URL
 * @param {string} localId 本地动作 ID
 * @returns {string} 图片 URL，无图返回空字符串
 */
function getImageUrl(localId) {
  return IMAGE_URL_MAP[localId] || '';
}

/**
 * 检查动作是否有图片
 */
function hasImage(localId) {
  return !!IMAGE_URL_MAP[localId];
}

/**
 * 获取全部映射表（调试用）
 */
function getAll() {
  return IMAGE_URL_MAP;
}

module.exports = {
  IMAGE_URL_MAP: IMAGE_URL_MAP,
  getImageUrl: getImageUrl,
  hasImage: hasImage,
  getAll: getAll
};
