const api = require('../../utils/api');

Page({
  data: {
    courses: [],
    streak: {},
    localStats: {
      completed_lessons: 0,
      quiz_count: 0,
      voice_count: 0,
      total_xp: 0
    }
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadLocalProgress();
  },

  loadLocalProgress() {
    const completed = wx.getStorageSync('ka_completed_lessons') || [];
    this.setData({
      localStats: {
        completed_lessons: completed.length,
        quiz_count: Number(wx.getStorageSync('ka_quiz_count') || 0),
        voice_count: Number(wx.getStorageSync('ka_voice_count') || 0),
        total_xp: Number(wx.getStorageSync('ka_local_xp') || 0)
      }
    });
  },

  async loadData() {
    this.loadLocalProgress();
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
