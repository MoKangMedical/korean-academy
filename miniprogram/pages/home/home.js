const api = require('../../utils/api');

Page({
  data: {
    courses: [],
    streak: {}
  },

  onLoad() {
    this.loadData();
  },

  async loadData() {
    try {
      const courses = await api.getCourses();
      this.setData({ courses: (courses || []).slice(0, 3) });
    } catch (err) {
      wx.showToast({ title: '课程加载失败', icon: 'none' });
    }

    try {
      const streak = await api.getStreak();
      this.setData({ streak: streak || {} });
    } catch (err) {
      this.setData({ streak: {} });
    }
  },

  openCourse(e) {
    wx.navigateTo({ url: `/pages/courses/courses?course=${e.currentTarget.dataset.id}` });
  },

  goCourses() {
    wx.switchTab({ url: '/pages/courses/courses' });
  },

  goVoice() {
    wx.switchTab({ url: '/pages/voice/voice' });
  }
});
