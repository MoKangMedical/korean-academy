const api = require('../../utils/api');

Page({
  data: {
    user: {},
    progress: {},
    avatarLetter: 'K',
    activity: [],
    localStats: {
      completed_lessons: 0,
      quiz_count: 0,
      voice_count: 0,
      total_xp: 0
    }
  },

  onShow() {
    const user = wx.getStorageSync('ka_user_profile') || wx.getStorageSync('ka_user') || {};
    this.setData({ user, avatarLetter: (user.nickname || 'K').slice(0, 1).toUpperCase() });
    this.loadLocalProgress();
    this.loadProgress();
  },

  bindWechatProfile() {
    wx.getUserProfile({
      desc: '用于展示学习头像和昵称',
      success: ({ userInfo }) => {
        const current = wx.getStorageSync('ka_user') || {};
        const user = Object.assign({}, current, {
          nickname: userInfo.nickName,
          avatar_url: userInfo.avatarUrl
        });
        wx.setStorageSync('ka_user_profile', user);
        wx.setStorageSync('ka_user', user);
        this.setData({ user, avatarLetter: (user.nickname || 'K').slice(0, 1).toUpperCase() });
        wx.showToast({ title: '已更新资料', icon: 'none' });
      },
      fail: () => wx.showToast({ title: '未授权资料', icon: 'none' })
    });
  },

  async loadProgress() {
    try {
      const progress = await api.getProgress();
      this.setData({ progress: progress || {} });
    } catch (err) {
      this.setData({ progress: {} });
    }
  },

  loadLocalProgress() {
    const completed = wx.getStorageSync('ka_completed_lessons') || [];
    const activity = wx.getStorageSync('ka_activity') || [];
    this.setData({
      activity: activity.slice(0, 10),
      localStats: {
        completed_lessons: completed.length,
        quiz_count: Number(wx.getStorageSync('ka_quiz_count') || 0),
        voice_count: Number(wx.getStorageSync('ka_voice_count') || 0),
        total_xp: Number(wx.getStorageSync('ka_local_xp') || 0)
      }
    });
  }
});
