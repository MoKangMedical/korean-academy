const api = require('../../utils/api');

const recorder = wx.getRecorderManager();
let audio = null;

function addStudyActivity(type, title, meta, xp) {
  const activity = wx.getStorageSync('ka_activity') || [];
  activity.unshift({ type, title, meta, xp, timestamp: Date.now() });
  wx.setStorageSync('ka_activity', activity.slice(0, 20));
  wx.setStorageSync('ka_local_xp', Number(wx.getStorageSync('ka_local_xp') || 0) + xp);
}

Page({
  data: {
    vocab: [],
    targetText: '',
    targetKorean: '',
    recording: false,
    tempFilePath: '',
    result: null
  },

  onLoad() {
    this.bindRecorder();
    this.loadVocab();
  },

  onShow() {
    const target = wx.getStorageSync('ka_voice_target');
    if (target && target.sentence) {
      this.setData({
        targetKorean: target.korean,
        targetText: target.sentence,
        result: null
      });
      wx.removeStorageSync('ka_voice_target');
    }
  },

  onUnload() {
    if (audio) {
      audio.destroy();
      audio = null;
    }
  },

  bindRecorder() {
    recorder.onStop((res) => {
      this.setData({
        recording: false,
        tempFilePath: res.tempFilePath
      });
      wx.showToast({ title: '录音完成', icon: 'none' });
    });
    recorder.onError(() => {
      this.setData({ recording: false });
      wx.showToast({ title: '录音失败', icon: 'none' });
    });
  },

  async loadVocab() {
    try {
      const vocab = await api.getVocabulary(1);
      this.setData({ vocab: (vocab || []).slice(0, 10) });
      if (!this.data.targetText && vocab && vocab.length) {
        this.setData({
          targetKorean: vocab[0].korean,
          targetText: vocab[0].example_ko || vocab[0].korean
        });
      }
    } catch (err) {
      wx.showToast({ title: '词汇加载失败', icon: 'none' });
    }
  },

  chooseTarget(e) {
    const { korean, sentence } = e.currentTarget.dataset;
    this.setData({
      targetKorean: korean,
      targetText: sentence || korean,
      tempFilePath: '',
      result: null
    });
  },

  playStandard() {
    if (!this.data.targetText) return;
    if (audio) audio.destroy();
    audio = wx.createInnerAudioContext();
    audio.src = `${api.API_BASE}/tts?text=${encodeURIComponent(this.data.targetText)}&voice=ko-KR-SunHiNeural`;
    audio.play();
  },

  toggleRecord() {
    if (!this.data.targetText) {
      wx.showToast({ title: '请先选择词汇', icon: 'none' });
      return;
    }
    if (this.data.recording) {
      recorder.stop();
      return;
    }
    recorder.start({
      duration: 12000,
      sampleRate: api.AUDIO_QUALITY.sampleRate,
      numberOfChannels: api.AUDIO_QUALITY.channelCount,
      encodeBitRate: api.AUDIO_QUALITY.bitRate,
      format: 'mp3'
    });
    this.setData({ recording: true, result: null });
  },

  async submitVoice() {
    if (!this.data.tempFilePath) {
      wx.showToast({ title: '请先录音', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '评分中' });
    try {
      const result = await api.uploadPronunciation(this.data.tempFilePath, this.data.targetText);
      this.setData({ result: result || {} });
      wx.setStorageSync('ka_voice_count', Number(wx.getStorageSync('ka_voice_count') || 0) + 1);
      addStudyActivity('音', '完成发音评分', `${this.data.targetKorean || this.data.targetText} · 得分 ${(result || {}).score || '-'}`, 5);
    } catch (err) {
      wx.showToast({ title: '评分失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  }
});
