// 文文的韩语老师 - API Client
const API_BASE = 'http://43.134.3.158:8104';

const api = {
  async request(url, options = {}) {
    const token = localStorage.getItem('ka_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const res = await fetch(API_BASE + url, {
      method: options.method || 'GET',
      headers,
      body: options.data ? JSON.stringify(options.data) : undefined
    });
    if (res.status === 401) {
      localStorage.removeItem('ka_token');
      return null;
    }
    return res.json();
  },

  // Auth
  async login(code) {
    const data = await this.request('/api/auth/wx-login', { method: 'POST', data: { code } });
    if (data && data.token) {
      localStorage.setItem('ka_token', data.token);
      localStorage.setItem('ka_user', JSON.stringify(data.user));
    }
    return data;
  },

  // Courses
  getCourses() { return this.request('/api/courses'); },
  getCourseDetail(id) { return this.request(`/api/courses/${id}`); },
  getLesson(id) { return this.request(`/api/courses/lessons/${id}`); },

  // Vocabulary
  getVocabulary(lessonId) { return this.request(`/api/vocabulary?lesson_id=${lessonId}`); },

  // Quiz
  getExercises(lessonId) { return this.request(`/api/quiz/exercises?lesson_id=${lessonId}`); },
  async submitAnswer(exerciseId, answer) {
    return this.request('/api/quiz/submit', { method: 'POST', data: { exercise_id: exerciseId, answer } });
  },
  getQuizResult(lessonId) { return this.request(`/api/quiz/result?lesson_id=${lessonId}`); },

  // Progress
  getProgress() { return this.request('/api/progress'); },
  async updateProgress(data) {
    return this.request('/api/progress/update', { method: 'POST', data });
  }
};

// ===== Korean TTS (SpeechSynthesis) =====
const KoreanTTS = {
  speak(text, rate = 0.85) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ko-KR';
    utter.rate = rate;
    utter.pitch = 1.0;
    // Try to find Korean voice
    const voices = speechSynthesis.getVoices();
    const koVoice = voices.find(v => v.lang.startsWith('ko'));
    if (koVoice) utter.voice = koVoice;
    speechSynthesis.speak(utter);
  },

  speakWord(korean, romanization = '') {
    // Speak Korean, then show romanization
    this.speak(korean, 0.7);
    if (romanization) {
      setTimeout(() => {
        const utter = new SpeechSynthesisUtterance(romanization);
        utter.lang = 'ko-KR';
        utter.rate = 0.6;
        speechSynthesis.speak(utter);
      }, 1500);
    }
  },

  speakSlow(text) { this.speak(text, 0.55); }
};

// Preload voices
if ('speechSynthesis' in window) {
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}

// ===== Simple router =====
function navigate(page, params = {}) {
  const app = document.getElementById('app');
  if (!app) return;
  app.dataset.page = page;
  app.dataset.params = JSON.stringify(params);
  // Trigger popstate-like navigation
  window.dispatchEvent(new CustomEvent('ka-navigate', { detail: { page, params } }));
}
