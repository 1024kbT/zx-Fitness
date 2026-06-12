// 训练计划模板
// 三分化：推/拉/腿 (PPL)
// 五分化：胸/背/肩/臂/腿
// 上下肢二分化
// 注意：所有 exercises ID 必须在 data/exercises.js 中存在
module.exports = {
  plans: [
    {
      id: 'ppl-3day',
      name: '三分化 (PPL)',
      name_en: 'Push Pull Legs',
      desc: '推/拉/腿循环，适合中级训练者',
      days: [
        {
          label: '推日',
          dayOfWeek: 1,
          muscle: '胸/肩/三头',
          exercises: [
            'barbell-bench-press',      // 杠铃卧推
            'incline-dumbbell-press',   // 上斜哑铃卧推
            'cable-crossover-mid',      // 中位龙门架夹胸
            'barbell-overhead-press',   // 杠铃推举
            'lateral-raise',            // 哑铃侧平举
            'close-grip-bench-press'    // 窄握卧推
          ]
        },
        {
          label: '拉日',
          dayOfWeek: 3,
          muscle: '背/二头/后束',
          exercises: [
            'lat-pulldown-wide',        // 高位下拉(宽握)
            'seated-cable-row',         // 坐姿划船
            'barbell-row',              // 杠铃划船
            'barbell-curl',             // 杠铃弯举
            'hammer-curl',              // 锤式弯举
            'face-pull'                 // 面拉
          ]
        },
        {
          label: '腿日',
          dayOfWeek: 5,
          muscle: '腿/核心',
          exercises: [
            'barbell-squat',            // 杠铃深蹲
            'leg-press',                // 腿举
            'lying-leg-curl',           // 俯卧腿弯举
            'leg-extension',            // 坐姿腿屈伸
            'bulgarian-split-squat',    // 保加利亚分腿蹲
            'cable-crunch-kneeling'     // 绳索卷腹
          ]
        }
      ]
    },
    {
      id: 'bro-5day',
      name: '五分化',
      name_en: 'Bro Split',
      desc: '每天一个肌群，经典健美分法',
      days: [
        {
          label: '胸部日',
          dayOfWeek: 1,
          muscle: '胸',
          exercises: [
            'barbell-bench-press',
            'incline-dumbbell-press',
            'cable-crossover-mid',
            'butterfly-machine',        // 蝴蝶机夹胸
            'push-up'
          ]
        },
        {
          label: '背部日',
          dayOfWeek: 2,
          muscle: '背',
          exercises: [
            'lat-pulldown-wide',
            'barbell-row',
            'seated-cable-row',
            't-bar-row',
            'pull-up'
          ]
        },
        {
          label: '肩部日',
          dayOfWeek: 3,
          muscle: '肩',
          exercises: [
            'barbell-overhead-press',
            'dumbbell-shoulder-press',
            'lateral-raise',
            'front-raise',
            'face-pull'
          ]
        },
        {
          label: '手臂日',
          dayOfWeek: 4,
          muscle: '二头/三头/前臂',
          exercises: [
            'barbell-curl',
            'hammer-curl',
            'preacher-curl-barbell',    // 牧师椅弯举
            'close-grip-bench-press',
            'skull-crusher'
          ]
        },
        {
          label: '腿部日',
          dayOfWeek: 5,
          muscle: '腿/臀',
          exercises: [
            'barbell-squat',
            'leg-press',
            'lying-leg-curl',
            'leg-extension',
            'romanian-deadlift',
            'barbell-hip-thrust'        // 杠铃臀推
          ]
        }
      ]
    },
    {
      id: 'upper-lower',
      name: '上下肢二分化',
      name_en: 'Upper / Lower',
      desc: '上下肢交替，适合新手和频率优先',
      days: [
        {
          label: '上肢A',
          dayOfWeek: 1,
          muscle: '胸/背/肩/臂',
          exercises: [
            'barbell-bench-press',
            'lat-pulldown-wide',
            'barbell-overhead-press',
            'barbell-curl',
            'close-grip-bench-press'
          ]
        },
        {
          label: '下肢A',
          dayOfWeek: 2,
          muscle: '腿/核心',
          exercises: [
            'barbell-squat',
            'leg-press',
            'lying-leg-curl',
            'leg-extension',
            'cable-crunch-kneeling'
          ]
        },
        {
          label: '上肢B',
          dayOfWeek: 4,
          muscle: '胸/背/肩/臂',
          exercises: [
            'incline-dumbbell-press',
            'seated-cable-row',
            'dumbbell-shoulder-press',
            'hammer-curl',
            'skull-crusher'
          ]
        },
        {
          label: '下肢B',
          dayOfWeek: 5,
          muscle: '腿/核心',
          exercises: [
            'romanian-deadlift',
            'bulgarian-split-squat',
            'lying-leg-curl',
            'calf-raise-stand',         // 站姿提踵
            'hanging-leg-raise'         // 悬垂举腿
          ]
        }
      ]
    }
  ],

  // 根据当前周几 + 已选计划，返回今日推荐
  getTodayPlan: function (activePlanId) {
    var plan = this.plans.find(function (p) { return p.id === activePlanId; });
    if (!plan) return null;
    var dow = new Date().getDay();
    var day = plan.days.find(function (d) { return d.dayOfWeek === dow; });
    return day || null;
  },

  // 获取计划中某天的动作列表
  getDayExercises: function (activePlanId, dayIndex) {
    var plan = this.plans.find(function (p) { return p.id === activePlanId; });
    if (!plan || !plan.days[dayIndex]) return [];
    return plan.days[dayIndex].exercises;
  }
};
