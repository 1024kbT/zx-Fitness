Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/dashboard/dashboard', text: '数据看板', icon: 'grid' },
      { pagePath: '/pages/schedule/schedule',   text: '训练日程', icon: 'chain' },
      { pagePath: '/pages/diet/diet',           text: '饮食计划', icon: 'apple' },
      { pagePath: '/pages/weight/weight',       text: '身体数据', icon: 'line' },
      { pagePath: '/pages/record/record',       text: '运动记录', icon: 'pulse' }
    ]
  },
  methods: {
    onSwitchTab: function (e) {
      var idx = e.currentTarget.dataset.index;
      var item = this.data.list[idx];
      if (this.data.selected === idx) return;
      wx.switchTab({ url: item.pagePath });
    }
  }
});
