const api = require('./utils/api');

App({
  globalData: {
    apiBase: api.API_BASE,
    audioQuality: api.AUDIO_QUALITY,
    user: null
  },

  onLaunch() {
    this.login();
  },

  login() {
    wx.login({
      success: async ({ code }) => {
        try {
          const data = await api.login(code || `mini_${Date.now()}`);
          if (data && data.user) {
            this.globalData.user = data.user;
          }
        } catch (err) {
          console.warn('miniapp login failed', err);
        }
      }
    });
  }
});
