const api = require('../../utils/api');

Page({
  data: {
    user: {},
    progress: {}
  },

  onShow() {
    this.setData({ user: wx.getStorageSync('ka_user') || {} });
    this.loadProgress();
  },

  async loadProgress() {
    try {
      const progress = await api.getProgress();
      this.setData({ progress: progress || {} });
    } catch (err) {
      this.setData({ progress: {} });
    }
  }
});
