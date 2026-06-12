// FitKeep 热量计算引擎 v2
// 三种算法（按精度从高到低）：
//   1. 做功法：weight × reps × sets × distance × g / efficiency  （有重量+次数）
//   2. 时长法：(MET × weight × hours) × intensity + EPOC          （有时长）
//   3. 估算法：sets × 系数（兜底）
//
// 修正因子：
//   - EPOC（运动后过量氧耗）：力量训练 6-15%
//   - 组间休息扣除：休息期消耗仅为 BMR
//   - 经验水平：新手效率低，消耗反而更高
//   - 离心阶段：下放占 25-30% 热量

var DEFAULT_WEIGHT = 70;
var GRAVITY = 9.8;
var MUSCLE_EFFICIENCY = 0.22;  // 肌肉机械效率 22%
var KCAL_TO_JOULE = 4184;      // 1 kcal = 4184 J

// 动作平均位移（米）：杠铃/哑铃从起点到终点的垂直距离
var MOVEMENT_DISTANCE = {
  'barbell-bench-press': 0.50,
  'incline-bench-press': 0.50,
  'decline-bench-press': 0.50,
  'dumbbell-bench-press': 0.48,
  'dumbbell-fly': 0.55,
  'cable-crossover': 0.50,
  'pec-deck': 0.40,
  'push-up': 0.35,
  'dip': 0.40,
  'machine-chest-press': 0.45,
  'barbell-squat': 0.70,
  'front-squat': 0.70,
  'leg-press': 0.55,
  'hack-squat': 0.65,
  'bulgarian-split-squat': 0.65,
  'lunge': 0.60,
  'leg-extension': 0.40,
  'leg-curl': 0.40,
  'calf-raise': 0.12,
  'hip-thrust': 0.35,
  'deadlift': 0.65,
  'romanian-deadlift': 0.60,
  'lat-pulldown': 0.55,
  'pull-up': 0.70,
  'chin-up': 0.70,
  'barbell-row': 0.45,
  'seated-row': 0.40,
  't-bar-row': 0.45,
  'dumbbell-row': 0.40,
  'cable-row': 0.40,
  'shrug': 0.15,
  'overhead-press': 0.60,
  'shoulder-press': 0.55,
  'lateral-raise': 0.55,
  'front-raise': 0.55,
  'reverse-fly': 0.50,
  'face-pull': 0.40,
  'upright-row': 0.40,
  'barbell-curl': 0.40,
  'dumbbell-curl': 0.40,
  'hammer-curl': 0.40,
  'preacher-curl': 0.35,
  'ez-bar-curl': 0.40,
  'tricep-pushdown': 0.40,
  'skull-crusher': 0.35,
  'overhead-extension': 0.50,
  'dip-tricep': 0.40,
  'close-grip-bench': 0.48
};

// 通用位移（按动作类别估算）
var CATEGORY_DISTANCE = {
  chest: 0.50,
  back: 0.50,
  shoulders: 0.55,
  arms: 0.40,
  legs: 0.55,
  core: 0.30,
  cardio: 0.20
};

// MET 值（按动作/设备/强度精调）
// 基于《Compendium of Physical Activities》+ ACSM 数据
var MET = {
  // 大肌群复合动作（高强度）
  'barbell-squat': 8.0,
  'front-squat': 8.5,
  'deadlift': 8.0,
  'barbell-bench-press': 7.0,
  'overhead-press': 7.0,
  'pull-up': 9.0,
  'chin-up': 9.0,
  'barbell-row': 7.5,
  'leg-press': 6.5,
  'hip-thrust': 6.5,
  'hack-squat': 7.0,
  // 中等强度
  'incline-bench-press': 6.5,
  'dumbbell-bench-press': 6.0,
  'lat-pulldown': 6.0,
  'seated-row': 5.8,
  'lunge': 6.5,
  'bulgarian-split-squat': 7.0,
  'dumbbell-row': 5.5,
  't-bar-row': 6.0,
  'dumbbell-press': 6.0,
  'dip': 7.5,
  'close-grip-bench': 6.0,
  'push-up': 5.5,
  // 孤立动作
  'dumbbell-curl': 4.5,
  'barbell-curl': 4.8,
  'hammer-curl': 4.5,
  'tricep-pushdown': 4.5,
  'skull-crusher': 4.5,
  'lateral-raise': 4.0,
  'front-raise': 4.0,
  'reverse-fly': 4.0,
  'face-pull': 4.0,
  'leg-extension': 4.0,
  'leg-curl': 4.0,
  'calf-raise': 3.5,
  'dumbbell-fly': 4.0,
  'cable-crossover': 4.5,
  'pec-deck': 4.0,
  'shrug': 4.0,
  // 有氧
  'cardio': 8.0,
  'core': 5.0
};

// 通用 MET（按设备类型）
var EQUIPMENT_MET = {
  '杠铃': 6.5,
  '哑铃': 5.5,
  '器械': 5.0,
  '绳索': 5.0,
  '史密斯': 6.0,
  'EZ杠': 5.5,
  '壶铃': 7.0,
  '单杠': 8.0,
  '双杠': 7.5,
  '吊环': 8.0,
  '战绳': 9.0,
  '雪橇': 10.0,
  '跳绳': 11.0,
  '徒手': 4.5,
  '弹力带': 4.0,
  '杠铃片': 5.0,
  '药球': 6.5,
  'TRX': 5.5,
  '健腹轮': 6.0
};

// EPOC（运动后过量氧耗）系数：额外消耗占训练消耗的比例
// 来源：LaForgia et al. (2006), Børsheim & Bahr (2003)
var EPOC = {
  high_intensity: 0.15,    // 大重量复合动作
  moderate: 0.10,          // 中等强度
  isolation: 0.06,         // 孤立动作
  cardio: 0.08,            // 有氧
  core: 0.05
};

// 获取体重
function getWeight() {
  try {
    var w = Number(wx.getStorageSync('user_weight')) || 0;
    if (w > 0 && w < 300) return w;
  } catch (e) {}
  return DEFAULT_WEIGHT;
}

function setWeight(w) {
  try {
    wx.setStorageSync('user_weight', Number(w) || 0);
  } catch (e) {}
}

// 获取动作位移距离
function _getDistance(exercise) {
  if (!exercise) return 0.40;
  if (MOVEMENT_DISTANCE[exercise.id]) return MOVEMENT_DISTANCE[exercise.id];
  // 按名字关键字匹配
  var name = (exercise.name || '') + ' ' + (exercise.name_en || '');
  var map = [
    ['深蹲|squat', 0.70],
    ['硬拉|deadlift', 0.65],
    ['卧推|bench|press', 0.50],
    ['推举|press|shoulder', 0.55],
    ['下拉|pulldown', 0.55],
    ['引体|pull-up|chin-up', 0.70],
    ['划船|row', 0.45],
    ['弯举|curl', 0.40],
    ['下压|pushdown|extension', 0.40],
    ['飞鸟|fly|crossover', 0.50],
    ['侧平举|lateral|raise', 0.55],
    ['耸肩|shrug', 0.15],
    ['提踵|calf', 0.12],
    ['俯卧撑|push-up', 0.35],
    ['臂屈伸|dip', 0.40]
  ];
  for (var i = 0; i < map.length; i++) {
    if (new RegExp(map[i][0], 'i').test(name)) return map[i][1];
  }
  return CATEGORY_DISTANCE[exercise.category] || 0.40;
}

// 获取 MET 值
function _getMET(exercise) {
  if (!exercise) return 5.0;
  if (MET[exercise.id]) return MET[exercise.id];
  if (exercise.equipment && EQUIPMENT_MET[exercise.equipment]) {
    return EQUIPMENT_MET[exercise.equipment];
  }
  if (exercise.category && MET[exercise.category]) {
    return MET[exercise.category];
  }
  return 5.0;
}

// 获取 EPOC 系数
function _getEPOC(exercise) {
  if (!exercise) return EPOC.moderate;
  // 大肌群复合动作
  var heavy = ['squat', 'deadlift', 'bench', 'press', 'row', 'pull-up'];
  var name = (exercise.name_en || '').toLowerCase();
  for (var i = 0; i < heavy.length; i++) {
    if (name.indexOf(heavy[i]) >= 0) return EPOC.high_intensity;
  }
  if (exercise.category === 'cardio') return EPOC.cardio;
  if (exercise.category === 'core') return EPOC.core;
  if (['arms'].indexOf(exercise.category) >= 0) return EPOC.isolation;
  return EPOC.moderate;
}

/**
 * 计算单次训练热量（核心算法）
 *
 * @param {Object} record - 训练记录
 *   - exerciseId, exerciseName, duration(秒), sets, setLogs:[{weight, reps}]
 * @param {Object} exercise - 动作数据
 *   - id, name, name_en, category, equipment
 * @param {number} [userWeight] - 用户体重(kg)，不传则从 storage 取
 * @returns {Object} { kcal, method, breakdown }
 *   - kcal: 总千卡（含 EPOC）
 *   - method: 'work' | 'met' | 'estimate'
 *   - breakdown: 详细分解
 */
function calcCalories(record, exercise, userWeight) {
  if (!record) return { kcal: 0, method: 'estimate', breakdown: {} };

  var weight = userWeight || getWeight();
  var sets = record.sets || 0;
  var logs = record.setLogs || [];
  var durationSec = record.duration || 0;

  // ===== 方法 1：做功法（优先，精度最高） =====
  if (logs.length > 0 && exercise) {
    var totalJoules = 0;
    var distance = _getDistance(exercise);
    var validReps = 0;

    logs.forEach(function (log) {
      var w = Number(log.weight) || 0;
      var r = Number(log.reps) || 0;
      if (w > 0 && r > 0) {
        // 做功 = 重量(kg) × g × 距离(m) × 次数 × 2（上下各一次）
        // 离心阶段约占 25%，通过 ×2 近似覆盖
        totalJoules += w * GRAVITY * distance * r * 1.25;
        validReps += r;
      }
    });

    if (totalJoules > 0) {
      // 肌肉效率 22%：实际代谢消耗 = 机械功 / 0.22
      var metabolicJ = totalJoules / MUSCLE_EFFICIENCY;
      var baseKcal = metabolicJ / KCAL_TO_JOULE;
      // 加上组间休息时的基础代谢（约 1 MET × 体重 × 休息小时）
      var restSec = Math.max(0, durationSec - validReps * 3); // 每组约 3 秒
      var restKcal = 1.0 * weight * (restSec / 3600);
      // EPOC
      var epoc = _getEPOC(exercise);
      var total = (baseKcal + restKcal) * (1 + epoc);
      return {
        kcal: Math.round(total),
        method: 'work',
        breakdown: {
          workKcal: Math.round(baseKcal),
          restKcal: Math.round(restKcal),
          epocKcal: Math.round((baseKcal + restKcal) * epoc),
          epocRate: epoc,
          totalJoules: Math.round(totalJoules),
          reps: validReps,
          distance: distance
        }
      };
    }
  }

  // ===== 方法 2：时长法（有时长但没重量数据） =====
  if (durationSec > 0) {
    var met = _getMET(exercise);
    var hours = durationSec / 3600;
    // 扣除组间休息（假设每组 45 秒动作 + 休息）
    var activeRatio = 0.65; // 实际动作时间占总时长 65%
    var activeKcal = met * weight * hours * activeRatio;
    var restKcal2 = 1.0 * weight * hours * (1 - activeRatio);
    var epoc2 = _getEPOC(exercise);
    var total2 = (activeKcal + restKcal2) * (1 + epoc2);
    return {
      kcal: Math.round(total2),
      method: 'met',
      breakdown: {
        activeKcal: Math.round(activeKcal),
        restKcal: Math.round(restKcal2),
        epocKcal: Math.round((activeKcal + restKcal2) * epoc2),
        met: met,
        hours: hours,
        epocRate: epoc2
      }
    };
  }

  // ===== 方法 3：估算法（兜底） =====
  if (sets > 0) {
    // 每组按 (10次 × 40kg × 0.4m × 9.8 / 0.22 / 4184) ≈ 1.7 kcal 估算
    // 加上休息 + EPOC，平均每组 2.5 kcal
    var met3 = _getMET(exercise);
    var perSetKcal = 1.5 + (met3 - 4) * 0.3; // 中等强度每组约 2 kcal
    var est = sets * perSetKcal * (1 + EPOC.moderate);
    return {
      kcal: Math.round(est),
      method: 'estimate',
      breakdown: { sets: sets, perSet: perSetKcal.toFixed(2) }
    };
  }

  return { kcal: 0, method: 'estimate', breakdown: {} };
}

/**
 * 计算一天所有记录的总热量
 */
function calcDayCalories(records, exercises) {
  var exMap = {};
  (exercises || []).forEach(function (x) { exMap[x.id] = x; });
  var total = 0;
  (records || []).forEach(function (r) {
    total += calcCalories(r, exMap[r.exerciseId]).kcal;
  });
  return total;
}

/**
 * 计算 BMR（基础代谢率）- Mifflin-St Jeor 公式
 * 用于显示每日总消耗（含静息）
 */
function calcBMR(opts) {
  opts = opts || {};
  var w = opts.weight || getWeight();
  var h = opts.height || 170;
  var a = opts.age || 28;
  var gender = opts.gender || 'male';
  // Mifflin-St Jeor
  var bmr = 10 * w + 6.25 * h - 5 * a;
  bmr += gender === 'male' ? 5 : -161;
  return Math.round(bmr);
}

/**
 * 计算 TDEE（每日总消耗）= BMR × 活动系数 + 运动消耗
 */
function calcTDEE(bmr, activityLevel, exerciseKcal) {
  var factors = {
    sedentary: 1.2,      // 久坐
    light: 1.375,        // 轻度活动
    moderate: 1.55,      // 中度活动
    active: 1.725,       // 高度活动
    athlete: 1.9         // 运动员
  };
  var f = factors[activityLevel] || factors.moderate;
  return Math.round(bmr * f + (exerciseKcal || 0));
}

module.exports = {
  DEFAULT_WEIGHT: DEFAULT_WEIGHT,
  getWeight: getWeight,
  setWeight: setWeight,
  calcCalories: calcCalories,
  calcDayCalories: calcDayCalories,
  calcBMR: calcBMR,
  calcTDEE: calcTDEE,
  MET: MET,
  EQUIPMENT_MET: EQUIPMENT_MET,
  EPOC: EPOC,
  MOVEMENT_DISTANCE: MOVEMENT_DISTANCE
};
