#!/usr/bin/env node
/**
 * 爬 wger API，输出一个 { localId: imageUrl } 映射，可直接贴到 config/images.js
 *
 * 用法：
 *   node scripts/crawl-image-map.js > config/image-map.generated.js
 */

const https = require('https');
const fs = require('fs');

const SEARCH_MAP = {
  'barbell-bench-press': ['bench press', 'barbell bench press'],
  'incline-dumbbell-press': ['incline dumbbell press', 'incline db press'],
  'dumbbell-bench-press': ['dumbbell bench press', 'flat dumbbell press'],
  'decline-barbell-press': ['decline bench press'],
  'push-up': ['push up', 'push-up'],
  'flat-barbell-bench-press-wide': ['bench press'],
  'flat-barbell-bench-press-close': ['bench press'],
  'incline-barbell-press': ['incline barbell press', 'incline bench press'],
  'lat-pulldown-wide': ['lat pulldown', 'pulldown', 'modified pulldown'],
  'seated-cable-row': ['seated cable row', 'cable row'],
  'barbell-row': ['bent over rowing', 'barbell row'],
  'pull-up': ['pull ups', 'pull up'],
  't-bar-row': ['t-bar row', 't bar row'],
  'chin-up': ['chin up', 'chin-up'],
  'barbell-overhead-press': ['shoulder press, barbell', 'shoulder press'],
  'dumbbell-shoulder-press': ['shoulder press, dumbbells', 'dumbbell shoulder press'],
  'lateral-raise': ['lateral raises', 'lateral raise'],
  'face-pull': ['face pull'],
  'front-raise': ['front raise'],
  'barbell-curl': ['biceps curls with barbell', 'barbell curl'],
  'hammer-curl': ['hammer curl'],
  'dumbbell-curl': ['biceps curls with barbell'],
  'close-grip-bench-press': ['close grip bench press'],
  'skull-crusher': ['barbell triceps extension', 'skull crusher'],
  'barbell-squat': ['barbell full squat', 'barbell squat'],
  'front-squat': ['front squat'],
  'leg-press': ['leg press'],
  'leg-extension': ['leg extension'],
  'lying-leg-curl': ['leg curl', 'lying leg curl'],
  'seated-leg-curl': ['leg curl'],
  'calf-raise-stand': ['standing calf raises', 'calf raise'],
  'barbell-hip-thrust': ['hip thrust'],
  'deadlift': ['deadlifts', 'deadlift'],
  'romanian-deadlift': ['romanian deadlift'],
  'bulgarian-split-squat': ['bulgarian squat'],
  'crunch': ['crunches', 'crunch'],
  'cable-crunch-kneeling': ['crunches'],
  'hanging-leg-raise': ['leg raises pull up bar', 'leg raise'],
  'plank': ['plank'],
  'russian-twist': ['russian twist']
};

const API = 'https://wger.de/api/v2';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.error('爬 wger translation 索引 ...');
  const nameIndex = {};
  let url = API + '/exercise-translation/?format=json&language=2&limit=100';
  while (url) {
    const data = await get(url);
    data.results.forEach((t) => {
      if (t.name && t.exercise) {
        const k = t.name.toLowerCase();
        if (!nameIndex[k]) nameIndex[k] = [];
        if (!nameIndex[k].includes(t.exercise)) nameIndex[k].push(t.exercise);
      }
    });
    url = data.next;
    await sleep(150);
  }
  console.error('  翻译索引 ' + Object.keys(nameIndex).length + ' 条');

  console.error('爬 wger 图片索引 ...');
  const imgData = await get(API + '/exerciseimage/?format=json&limit=500');
  const imageIndex = {};
  imgData.results.forEach((i) => {
    if (i.exercise && i.image) {
      if (!imageIndex[i.exercise] || i.is_main) imageIndex[i.exercise] = i.image;
    }
  });
  console.error('  图片索引 ' + Object.keys(imageIndex).length + ' 条');

  console.error('匹配 ' + Object.keys(SEARCH_MAP).length + ' 个本地动作 ...');
  const map = {};
  let ok = 0, fail = 0;
  for (const [localId, keywords] of Object.entries(SEARCH_MAP)) {
    const ids = new Set();
    for (const kw of keywords) {
      for (const [name, idArr] of Object.entries(nameIndex)) {
        if (name === kw || name.includes(kw) || kw.includes(name)) {
          idArr.forEach((id) => ids.add(id));
        }
      }
    }
    let picked = '';
    for (const id of ids) {
      if (imageIndex[id]) { picked = imageIndex[id]; break; }
    }
    if (picked) {
      map[localId] = picked;
      ok++;
      console.error('  ✓ ' + localId + ' → ' + picked.split('/').pop());
    } else {
      fail++;
      console.error('  ✗ ' + localId + ' (无图)');
    }
  }

  console.error('');
  console.error('结果：匹配 ' + ok + ', 失败 ' + fail);
  console.error('');

  // 输出 JS 文件内容
  console.log('// 自动生成 - wger 动作图片 URL 映射');
  console.log('// 生成时间: ' + new Date().toISOString());
  console.log('// 总数: ' + ok + ' 条');
  console.log('');
  console.log('const IMAGE_URL_MAP = {');
  Object.entries(map).forEach(([k, v]) => {
    console.log("  '" + k + "': '" + v + "',");
  });
  console.log('};');
  console.log('');
  console.log('module.exports = IMAGE_URL_MAP;');
}

main().catch((e) => { console.error('error:', e); process.exit(1); });
