#!/usr/bin/env node
/**
 * 批量下载 wger.de 动作图片（v3 - 优先有图 ID）
 *
 * 核心策略：
 *   1. 拉全部 exerciseimage（357 张），建 exercise id → image URL 索引
 *   2. 拉全部英文 translation（1934 条），建 小写 name → [exercise id, ...] 索引（一对多）
 *   3. 对每个本地动作：用关键字匹配全部候选 ID → 从中挑有图的 → 下载
 *
 * 用法：
 *   node scripts/download-wger-images.js
 *   node scripts/download-wger-images.js --retry   # 只重试失败的
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 本地动作 ID → 搜索关键字（小写，按优先级排序，越靠前越匹配）
const SEARCH_MAP = {
  'barbell-bench-press': ['bench press', 'barbell bench press', 'flat bench press'],
  'incline-dumbbell-press': ['incline dumbbell press', 'incline db press'],
  'dumbbell-bench-press': ['dumbbell bench press', 'flat dumbbell press'],
  'decline-barbell-press': ['decline bench press', 'decline barbell bench press'],
  'push-up': ['push up', 'push-up', 'pushups'],
  'lat-pulldown-wide': ['lat pulldown', 'pulldown', 'modified pulldown', 'mentzer pulldown', 'straight-arm pulldown'],
  'seated-cable-row': ['seated cable row', 'cable row', 'seated row'],
  'barbell-row': ['bent over rowing', 'barbell row', 'bent over row'],
  'pull-up': ['pull ups', 'pull up', 'pullup'],
  't-bar-row': ['t-bar row', 't bar row', 't bar'],
  'chin-up': ['chin up', 'chin-up', 'chinup'],
  'barbell-overhead-press': ['shoulder press, barbell', 'shoulder press', 'overhead press', 'barbell shoulder press'],
  'dumbbell-shoulder-press': ['shoulder press, dumbbells', 'dumbbell shoulder press', 'seated dumbbell press'],
  'lateral-raise': ['lateral raises', 'lateral raise', 'side lateral raise'],
  'face-pull': ['face pull', 'cable face pull'],
  'front-raise': ['front raise', 'dumbbell front raise'],
  'barbell-curl': ['biceps curls with barbell', 'biceps curl with barbell', 'barbell curl'],
  'hammer-curl': ['hammer curl', 'dumbbell hammer curl'],
  'close-grip-bench-press': ['close grip bench press', 'close-grip bench press'],
  'skull-crusher': ['barbell triceps extension', 'skull crusher', 'triceps extension'],
  'barbell-squat': ['barbell full squat', 'squat', 'back squat', 'barbell squat'],
  'leg-press': ['leg press', 'leg press machine'],
  'leg-extension': ['leg extension', 'seated leg extension'],
  'lying-leg-curl': ['leg curl', 'lying leg curl'],
  'calf-raise-stand': ['standing calf raises', 'calf raise', 'double leg calf raise'],
  'barbell-hip-thrust': ['hip thrust', 'barbell hip thrust', 'dumbbell hip thrust'],
  'deadlift': ['deadlifts', 'deadlift', 'conventional deadlift'],
  'romanian-deadlift': ['dumbbell romanian deadlift', 'romanian deadlift', 'rdl'],
  'crunch': ['crunches', 'crunch', 'abdominal crunch'],
  'hanging-leg-raise': ['leg raises pull up bar', 'hanging leg raise', 'leg raises, lying', 'leg raise'],
  'plank': ['plank', 'front plank'],
  'russian-twist': ['russian twist', 'seated russian twist']
};

const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'workout-images');
const API_BASE = 'https://wger.de/api/v2';
const DELAY_MS = 200;
const PAGE_SIZE = 100;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function getJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'FitKeep/1.0' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse failed: ' + url)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('timeout: ' + url)));
  });
}

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    const req = https.get(url, { headers: { 'User-Agent': 'FitKeep/1.0' } }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    });
    req.on('error', (err) => { fs.unlink(filepath, () => {}); reject(err); });
    req.setTimeout(30000, () => { req.destroy(); fs.unlink(filepath, () => {}); reject(new Error('timeout')); });
  });
}

async function buildImageIndex() {
  console.log('Step 1: 拉取全部 wger 图片 ...');
  const data = await getJSON(API_BASE + '/exerciseimage/?format=json&limit=500');
  console.log('  共 ' + data.count + ' 张图');
  const index = {};
  (data.results || []).forEach((img) => {
    if (!img.exercise || !img.image) return;
    if (!index[img.exercise] || img.is_main) index[img.exercise] = img.image;
  });
  console.log('  覆盖 ' + Object.keys(index).length + ' 个动作\n');
  return index;
}

// 返回 name → [exercise id]（一对多）
async function buildNameIndex() {
  console.log('Step 2: 构建 name → [exercise ids] 索引 ...');
  const index = {};
  let url = API_BASE + '/exercise-translation/?format=json&language=2&limit=' + PAGE_SIZE;
  let page = 0;
  while (url) {
    page++;
    process.stdout.write('  page ' + page + ' ... ');
    const data = await getJSON(url);
    await sleep(DELAY_MS);
    (data.results || []).forEach((t) => {
      if (!t.name || !t.exercise) return;
      const k = t.name.toLowerCase();
      if (!index[k]) index[k] = [];
      if (!index[k].includes(t.exercise)) index[k].push(t.exercise);
    });
    process.stdout.write(data.results.length + ' 条\n');
    url = data.next || null;
  }
  console.log('  索引完成：' + Object.keys(index).length + ' 条\n');
  return index;
}

// 对每个关键字找全部匹配 ID，然后挑第一个有图的
function findImageId(nameIndex, imageIndex, keywords) {
  const allIds = new Set();
  for (const kw of keywords) {
    for (const [name, ids] of Object.entries(nameIndex)) {
      if (name === kw || name.includes(kw) || kw.includes(name)) {
        ids.forEach((id) => allIds.add(id));
      }
    }
  }
  // 按关键字优先级遍历：先精确匹配的 ID，再其他
  for (const kw of keywords) {
    for (const id of allIds) {
      if (imageIndex[id]) return { id, url: imageIndex[id] };
    }
  }
  // 只要有任何一个有图就用
  for (const id of allIds) {
    if (imageIndex[id]) return { id, url: imageIndex[id] };
  }
  return null;
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const imageIndex = await buildImageIndex();
  const nameIndex = await buildNameIndex();

  const retryOnly = process.argv.includes('--retry');
  const entries = Object.entries(SEARCH_MAP).filter(([localId]) => {
    const outFile = path.join(OUTPUT_DIR, localId + '.png');
    return retryOnly ? !fs.existsSync(outFile) : true;
  });

  console.log('准备下载 ' + entries.length + ' 个动作图片到 ' + OUTPUT_DIR + '\n');

  let success = 0, failed = 0;
  const downloaded = [], skipped = [], noImage = [];

  for (const [localId, keywords] of entries) {
    const outFile = path.join(OUTPUT_DIR, localId + '.png');
    if (fs.existsSync(outFile)) {
      console.log('[skip] ' + localId);
      success++;
      skipped.push(localId);
      continue;
    }

    const result = findImageId(nameIndex, imageIndex, keywords);
    if (!result) {
      console.log('[❌] ' + localId + ' 无可用图');
      failed++;
      noImage.push(localId);
      continue;
    }

    process.stdout.write('[' + localId + '] id=' + result.id + ' 下载 ... ');
    try {
      await downloadImage(result.url, outFile);
      const size = fs.statSync(outFile).size;
      console.log('✓ ' + Math.round(size / 1024) + 'KB');
      success++;
      downloaded.push(localId);
    } catch (e) {
      console.log('❌ ' + e.message);
      failed++;
    }
  }

  console.log('\n==============================');
  console.log('下载完成');
  console.log('  成功: ' + success + ' (新下载 ' + downloaded.length + ', 已存在 ' + skipped.length + ')');
  console.log('  失败: ' + failed);
  if (noImage.length) console.log('  无图: ' + noImage.join(', '));
  console.log('\n下一步：');
  console.log('  1. 微信开发者工具 → 云开发 → 存储');
  console.log('  2. 新建目录: workout-images');
  console.log('  3. 上传 ' + OUTPUT_DIR + ' 的全部 PNG');
  console.log('  4. 复制云环境 ID');
  console.log('  5. 修改 config/images.js:');
  console.log('     const CDN_PREFIX = \'https://<env-id>.tcb.qcloud.la\';');
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
