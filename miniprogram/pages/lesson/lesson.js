const api = require('../../utils/api');

let audio = null;

function addStudyActivity(type, title, meta, xp) {
  const activity = wx.getStorageSync('ka_activity') || [];
  activity.unshift({ type, title, meta, xp, timestamp: Date.now() });
  wx.setStorageSync('ka_activity', activity.slice(0, 20));
  wx.setStorageSync('ka_local_xp', Number(wx.getStorageSync('ka_local_xp') || 0) + xp);
}

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
  },

  async markComplete() {
    if (!this.data.id) return;
    try {
      await api.updateProgress({ lesson_id: this.data.id, status: 'completed', score: 100 });
    } catch (err) {}
    const completed = wx.getStorageSync('ka_completed_lessons') || [];
    const isNew = !completed.includes(this.data.id);
    if (isNew) {
      completed.push(this.data.id);
      wx.setStorageSync('ka_completed_lessons', completed);
      addStudyActivity('课', '完成课时', `第 ${this.data.id} 课 · ${this.data.lesson.title || this.data.title}`, 10);
    }
    wx.showToast({ title: isNew ? '已记录进步' : '这一课已完成', icon: 'none' });
  }
});
