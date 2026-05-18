const API_BASE = 'https://koreanacademy.cn/korean-api';

const AUDIO_QUALITY = {
  sampleRate: 24000,
  channelCount: 1,
  bitRate: 48000,
  loudness: 'I=-16:TP=-1.5:LRA=9'
};

function getToken() {
  return wx.getStorageSync('ka_token') || '';
}

function request(path, options = {}) {
  const token = getToken();
  const header = Object.assign({
    'Content-Type': 'application/json'
  }, options.header || {});
  if (token) header.Authorization = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    wx.request({
      url: API_BASE + path,
      method: options.method || 'GET',
      data: options.data,
      header,
      success: (res) => {
        if (res.statusCode === 401) {
          wx.removeStorageSync('ka_token');
          resolve(null);
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        reject(new Error(`HTTP ${res.statusCode}`));
      },
      fail: reject
    });
  });
}

async function login(code) {
  const data = await request('/auth/wx-login', {
    method: 'POST',
    data: { code }
  });
  if (data && data.token) {
    wx.setStorageSync('ka_token', data.token);
    wx.setStorageSync('ka_user', data.user);
  }
  return data;
}

function uploadPronunciation(filePath, targetText) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: API_BASE + '/pronunciation/analyze',
      filePath,
      name: 'audio',
      header: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
      formData: {
        target_text: targetText,
        sample_rate: String(AUDIO_QUALITY.sampleRate),
        channel_count: String(AUDIO_QUALITY.channelCount),
        bit_rate: String(AUDIO_QUALITY.bitRate),
        loudness: AUDIO_QUALITY.loudness
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(res.data));
          } catch (err) {
            resolve(res.data);
          }
          return;
        }
        reject(new Error(`HTTP ${res.statusCode}`));
      },
      fail: reject
    });
  });
}

module.exports = {
  API_BASE,
  AUDIO_QUALITY,
  request,
  login,
  uploadPronunciation,
  getCourses: () => request('/courses'),
  getCourseDetail: (id) => request(`/courses/${id}`),
  getLesson: (id) => request(`/courses/lessons/${id}`),
  getVocabulary: (lessonId) => request(`/vocabulary?lesson_id=${lessonId}`),
  getProgress: () => request('/progress'),
  updateProgress: (data) => request('/progress/update', { method: 'POST', data }),
  getStreak: () => request('/daily/streak'),
  getAchievements: () => request('/achievements')
};
