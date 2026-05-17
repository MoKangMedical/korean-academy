const api = require('../../utils/api');

let audio = null;

function stripMarkdown(content = '') {
  return content
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\|/g, ' ')
    .replace(/-{3,}/g, '')
    .trim();
}

Page({
  data: {
    id: null,
    title: '',
    lesson: {},
    vocab: [],
    plainContent: '',
    playing: false
  },

  onLoad(query) {
    const id = Number(query.id || 1);
    this.setData({ id, title: decodeURIComponent(query.title || '') });
    this.loadLesson(id);
  },

  onUnload() {
    if (audio) {
      audio.destroy();
      audio = null;
    }
  },

  async loadLesson(id) {
    try {
      const [lesson, vocab] = await Promise.all([
        api.getLesson(id),
        api.getVocabulary(id)
      ]);
      this.setData({
        lesson: lesson || {},
        vocab: vocab || [],
        plainContent: stripMarkdown((lesson || {}).content || '')
      });
    } catch (err) {
      wx.showToast({ title: '课时加载失败', icon: 'none' });
    }
  },

  toggleAudio() {
    if (!this.data.id) return;
    if (!audio) {
      audio = wx.createInnerAudioContext();
      audio.src = `${api.API_BASE}/tts/lesson/${this.data.id}`;
      audio.onEnded(() => this.setData({ playing: false }));
      audio.onError(() => {
        this.setData({ playing: false });
        wx.showToast({ title: '音频播放失败', icon: 'none' });
      });
    }

    if (this.data.playing) {
      audio.pause();
      this.setData({ playing: false });
      return;
    }

    audio.play();
    this.setData({ playing: true });
  },

  goVoice(e) {
    const { korean, sentence } = e.currentTarget.dataset;
    wx.setStorageSync('ka_voice_target', { korean, sentence });
    wx.switchTab({ url: '/pages/voice/voice' });
  }
});
