Component({
  properties: {
    icon: { type: String, value: '🎯' },
    title: { type: String, value: '暂无内容' },
    subtitle: { type: String, value: '' },
    btnText: { type: String, value: '' },
    btnIcon: { type: String, value: '' }
  },
  methods: {
    onBtnTap: function () {
      this.triggerEvent('btntap');
    }
  }
});
