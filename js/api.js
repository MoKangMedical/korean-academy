// ============================================================
// Korean Academy v2 — API Client
// All endpoints use fetch() with JWT token from localStorage('ka_token')
// API_BASE proxies to FastAPI backend on port 8104
// ============================================================

const API_BASE = 'https://eterna-niannian.cloud/korean-api';

// ─── Core request helper ────────────────────────────────────
const api = {
  /**
   * Low-level fetch wrapper. Injects Bearer token, handles 401.
   * Default Content-Type: application/json. Set options.contentType
   * to null to omit it (for FormData uploads).
   */
  async request(url, options = {}) {
    const token = localStorage.getItem('ka_token');
    const headers = {};
    if (options.contentType !== null) {
      headers['Content-Type'] = options.contentType || 'application/json';
    }
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(API_BASE + url, {
      method: options.method || 'GET',
      headers,
      body: options.data ? (
        options.contentType === null
          ? options.data            // FormData — pass directly
          : JSON.stringify(options.data)
      ) : undefined
    });
    if (res.status === 401) {
      localStorage.removeItem('ka_token');
      return null;
    }
    return res.json();
  },

  // ══════════════════════════════════════════════════════════
  //  AUTH
  // ══════════════════════════════════════════════════════════
  async login(code) {
    const data = await this.request('/auth/wx-login', { method: 'POST', data: { code } });
    if (data && data.token) {
      localStorage.setItem('ka_token', data.token);
      localStorage.setItem('ka_user', JSON.stringify(data.user));
    }
    return data;
  },

  // ══════════════════════════════════════════════════════════
  //  COURSES
  // ══════════════════════════════════════════════════════════
  getCourses()       { return this.request('/courses'); },
  getCourseDetail(id) { return this.request(`/courses/${id}`); },
  getLesson(id)       { return this.request(`/courses/lessons/${id}`); },

  // ══════════════════════════════════════════════════════════
  //  VOCABULARY
  // ══════════════════════════════════════════════════════════
  getVocabulary(lessonId) { return this.request(`/vocabulary?lesson_id=${lessonId}`); },

  // ══════════════════════════════════════════════════════════
  //  QUIZ
  // ══════════════════════════════════════════════════════════
  getExercises(lessonId) { return this.request(`/quiz/exercises?lesson_id=${lessonId}`); },
  async submitAnswer(exerciseId, answer) {
    return this.request('/quiz/submit', { method: 'POST', data: { exercise_id: exerciseId, answer } });
  },
  getQuizResult(lessonId) { return this.request(`/quiz/result?lesson_id=${lessonId}`); },

  // ══════════════════════════════════════════════════════════
  //  PROGRESS
  // ══════════════════════════════════════════════════════════
  getProgress() { return this.request('/progress'); },
  async updateProgress(data) {
    return this.request('/progress/update', { method: 'POST', data });
  },

  // ══════════════════════════════════════════════════════════
  //  GRAMMAR  (NEW)
  // ══════════════════════════════════════════════════════════
  /**
   * Fetch grammar explanations — optionally filtered by lesson or level.
   * @param {number} [lessonId] — filter by lesson_id
   * @param {string} [level]    — TOPIK level e.g. '1', '2'
   */
  getGrammar(lessonId, level) {
    const params = [];
    if (lessonId !== undefined && lessonId !== null) params.push(`lesson_id=${lessonId}`);
    if (level) params.push(`level=${level}`);
    const qs = params.length ? '?' + params.join('&') : '';
    return this.request(`/grammar${qs}`);
  },

  // ══════════════════════════════════════════════════════════
  //  PRONUNCIATION  (NEW — FormData upload)
  // ══════════════════════════════════════════════════════════
  /**
   * Upload recorded audio for pronunciation analysis.
   * @param {Blob|File} audioBlob  — recorded audio (webm/mp3/wav)
   * @param {string}    targetText — the Korean text the user attempted to speak
   */
  async uploadPronunciation(audioBlob, targetText) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('target_text', targetText);
    return this.request('/pronunciation/analyze', {
      method: 'POST',
      data: formData,
      contentType: null   // let the browser set multipart boundary
    });
  },

  // ══════════════════════════════════════════════════════════
  //  DAILY CHALLENGE  (NEW)
  // ══════════════════════════════════════════════════════════
  /** Get today's challenge */
  getDaily() { return this.request('/daily'); },

  /** Submit answer for today's challenge */
  async submitDaily(challengeId, answer) {
    return this.request('/daily/submit', {
      method: 'POST',
      data: { challenge_id: challengeId, answer }
    });
  },

  /** Get current streak & history */
  getStreak() { return this.request('/daily/streak'); },

  // ══════════════════════════════════════════════════════════
  //  ACHIEVEMENTS  (NEW)
  // ══════════════════════════════════════════════════════════
  /** Get all achievements with unlock status */
  getAchievements() { return this.request('/achievements'); },

  // ══════════════════════════════════════════════════════════
  //  FLASHCARD / SPACED REPETITION  (NEW)
  // ══════════════════════════════════════════════════════════
  /** Get cards due for review today */
  getDueCards() { return this.request('/flashcard/due'); },

  /**
   * Submit a review rating for a card.
   * @param {number} vocabId  — vocabulary item id
   * @param {number} quality  — 0-5 SM-2 quality rating (0=complete blackout, 5=perfect)
   */
  async reviewCard(vocabId, quality) {
    return this.request('/flashcard/review', {
      method: 'POST',
      data: { vocab_id: vocabId, quality }
    });
  },

  /** Get SRS stats: total cards, due counts, retention rate, etc. */
  getFlashcardStats() { return this.request('/flashcard/stats'); }
};


// ============================================================
//  Korean TTS v3 — Robust SpeechSynthesis + Server MP3 Fallback
//  FIXED: Mobile playback (iOS Safari), voice selection, feedback
// ============================================================
const KoreanTTS = {
  _voices: [],
  _ready: false,
  _currentAudio: null,       // Active <audio> element (recreated each play)
  _voiceType: 'female',      // 'female' | 'male'

  /** Initialise — preload voices and set up fallback infrastructure. */
  init() {
    this._loadVoices();
    if ('speechSynthesis' in window) {
      speechSynthesis.onvoiceschanged = () => this._loadVoices();
    }
    // Load voice preference from localStorage
    const saved = localStorage.getItem('ka_tts_voice');
    if (saved === 'male' || saved === 'female') this._voiceType = saved;
    this._ready = true;
    console.log('KoreanTTS v3 ready — voices:', this._voices.length, '| voice:', this._voiceType);
  },

  _loadVoices() {
    if ('speechSynthesis' in window) {
      this._voices = speechSynthesis.getVoices();
    }
  },

  /** True if at least one Korean voice is available locally. */
  get hasLocalKorean() {
    return this._voices.some(v => v.lang.startsWith('ko'));
  },

  /** Set voice preference and persist. */
  setVoiceType(type) {
    this._voiceType = type;
    localStorage.setItem('ka_tts_voice', type);
  },

  /** Get the server voice name based on preference. */
  get _serverVoice() {
    return this._voiceType === 'male' ? 'ko-KR-InJoonNeural' : 'ko-KR-SunHiNeural';
  },

  /**
   * Speak Korean text. Local SpeechSynthesis first; server MP3 fallback.
   * @param {string}  text      — Korean text
   * @param {number}  [rate=0.85]
   * @param {boolean} [forceServer=false]
   */
  speak(text, rate = 0.85, forceServer = false) {
    if (!text) return;
    if (!this._ready) this.init();

    // Stop any previous playback
    this.stop();

    // Try local SpeechSynthesis first if available
    if (!forceServer && this.hasLocalKorean) {
      this._speakLocal(text, rate);
      return;
    }

    // No local Korean voice — go directly to server fallback.
    // (Must stay within the user-gesture call chain for mobile autoplay.)
    this._speakServer(text);
  },

  /** Browser-native SpeechSynthesis with Korean voice. */
  _speakLocal(text, rate = 0.85) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ko-KR';
    utter.rate = rate;
    utter.pitch = 1.0;

    const koVoice = this._voices.find(v => v.lang.startsWith('ko'));
    if (koVoice) utter.voice = koVoice;

    speechSynthesis.speak(utter);
  },

  /**
   * Fetch MP3 from backend and play via a fresh Audio element.
   * KEY FIX for mobile: creates a new Audio(url) each time,
   * calls .load() then .play() for iOS Safari compatibility.
   */
  _speakServer(text) {
    // Kill any previous audio
    if (this._currentAudio) {
      this._currentAudio.pause();
      this._currentAudio.src = '';
      this._currentAudio.load();
      this._currentAudio = null;
    }

    const voice = this._serverVoice;
    const url = API_BASE + '/tts?text=' + encodeURIComponent(text) + '&voice=' + encodeURIComponent(voice);

    // Create a fresh Audio element — mobile browsers play Audio(url)
    // more reliably than reusing a hidden <audio> element.
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = url;
    this._currentAudio = audio;

    // iOS Safari requires .load() before .play() when changing src
    audio.load();

    // Play with error feedback
    audio.play().then(() => {
      console.log('KoreanTTS: server playback started');
    }).catch(err => {
      console.error('KoreanTTS: server playback blocked —', err.name, err.message);
      // On mobile, autoplay may be blocked if not in direct user gesture.
      // Fallback: try play() again after a short delay (some browsers need it)
      setTimeout(() => {
        audio.play().catch(e2 => {
          console.error('KoreanTTS: retry also failed —', e2.message);
          if (typeof toast !== 'undefined') toast('⚠️ 播放失败，请重试');
        });
      }, 100);
    });

    // Clean up after playback ends
    audio.onended = () => {
      if (this._currentAudio === audio) {
        this._currentAudio = null;
      }
    };
  },

  /** Speak a vocabulary word: Korean then romanization after delay. */
  speakWord(korean, romanization = '') {
    this.speak(korean, 0.7);
    if (romanization && this.hasLocalKorean) {
      setTimeout(() => {
        const utter = new SpeechSynthesisUtterance(romanization);
        utter.lang = 'ko-KR'; utter.rate = 0.6;
        speechSynthesis.speak(utter);
      }, 1500);
    }
  },

  /** Speak slowly for learner breakdown. */
  speakSlow(text) { this.speak(text, 0.55); },

  /** Stop all playback (local SpeechSynthesis + server audio). */
  stop() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (this._currentAudio) {
      this._currentAudio.pause();
      this._currentAudio.src = '';
      this._currentAudio.load();
      this._currentAudio = null;
    }
  },

  /** True if audio is currently playing (server fallback). */
  get isPlaying() {
    return this._currentAudio && !this._currentAudio.paused;
  }
};

// Initialise on script load
KoreanTTS.init();


// ============================================================
//  VoiceRecorder — MediaRecorder + waveform visualisation
//  Kangbo dark-gold waveform colour: #E2B64F
// ============================================================
const VoiceRecorder = {
  // ── internal state ───────────────────────────────────────
  _stream: null,
  _mediaRecorder: null,
  _chunks: [],
  _audioContext: null,
  _analyser: null,
  _source: null,
  _animFrame: null,
  _canvas: null,
  _ctx: null,
  _onStop: null,
  _onError: null,
  _state: 'idle',         // 'idle' | 'recording' | 'paused'

  // Waveform colours
  COLOR_WAVE: '#E2B64F',       // Kangbo dark gold — main waveform
  COLOR_GRADIENT_START: '#E2B64F',
  COLOR_GRADIENT_END: '#1a1a2e',
  COLOR_BG: '#0f0f1a',

  // ── public API ───────────────────────────────────────────

  /**
   * Start recording with waveform drawn on `canvas`.
   *
   * @param {HTMLCanvasElement} canvas   — canvas element for waveform
   * @param {Object}           [opts]
   * @param {string}           [opts.mimeType='audio/webm'] — preferred MIME type
   * @param {Function}         [opts.onStop]   — callback(blob) when recording stops
   * @param {Function}         [opts.onError]  — callback(err) on error
   * @returns {Promise<void>}
   */
  async start(canvas, opts = {}) {
    if (this._state === 'recording') return;

    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._onStop = opts.onStop || null;
    this._onError = opts.onError || null;
    this._chunks = [];

    try {
      this._stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // AudioContext for waveform analysis
      this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this._analyser = this._audioContext.createAnalyser();
      this._analyser.fftSize = 256;
      this._analyser.smoothingTimeConstant = 0.7;
      this._source = this._audioContext.createMediaStreamSource(this._stream);
      this._source.connect(this._analyser);

      // MediaRecorder
      const mimeType = this._getSupportedMime(opts.mimeType || 'audio/webm');
      this._mediaRecorder = new MediaRecorder(this._stream, {
        mimeType,
        audioBitsPerSecond: 128000
      });

      this._mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this._chunks.push(e.data);
      };

      this._mediaRecorder.onstop = () => {
        this._cleanup();
        this._stopVisualisation();
        const blob = this._getBlob(mimeType);
        if (this._onStop) this._onStop(blob);
      };

      this._mediaRecorder.start();
      this._state = 'recording';
      this._startVisualisation();

    } catch (err) {
      this._state = 'idle';
      this._cleanup();
      if (this._onError) this._onError(err);
      else console.error('VoiceRecorder: mic access denied or not supported', err);
    }
  },

  /** Stop recording and return a Promise that resolves with the audio Blob. */
  stop() {
    return new Promise((resolve, reject) => {
      if (this._state !== 'recording' || !this._mediaRecorder) {
        reject(new Error('Not recording'));
        return;
      }
      // Override onstop to resolve with the blob
      const prevOnStop = this._onStop;
      const mime = this._mediaRecorder.mimeType || 'audio/webm';
      this._mediaRecorder.onstop = () => {
        this._state = 'idle';
        this._cleanup();
        this._stopVisualisation();
        const blob = new Blob(this._chunks, { type: mime });
        if (prevOnStop) prevOnStop(blob);
        resolve(blob);
      };
      this._mediaRecorder.stop();
    });
  },

  /**
   * Stop recording and return the blob (simple sync alternative).
   * Call only after the onStop callback has fired or if stop() was called.
   */
  getBlob() {
    const mime = this._mediaRecorder ? this._mediaRecorder.mimeType : 'audio/webm';
    return this._getBlob(mime);
  },

  /** Pause recording (if supported by the codec). */
  pause() {
    if (this._state === 'recording' && this._mediaRecorder.state === 'recording') {
      this._mediaRecorder.pause();
      this._state = 'paused';
      this._stopVisualisation();
    }
  },

  /** Resume after pause. */
  resume() {
    if (this._state === 'paused' && this._mediaRecorder.state === 'paused') {
      this._mediaRecorder.resume();
      this._state = 'recording';
      if (this._canvas && this._analyser) this._startVisualisation();
    }
  },

  /** True while actively recording. */
  get isRecording() {
    return this._state === 'recording';
  },

  /** Current state string: 'idle' | 'recording' | 'paused' */
  get state() { return this._state; },

  // ── internal helpers ─────────────────────────────────────

  _getBlob(mimeType) {
    return new Blob(this._chunks, { type: mimeType || 'audio/webm' });
  },

  _getSupportedMime(preferred) {
    const candidates = [preferred, 'audio/webm', 'audio/mp4', 'audio/ogg; codecs=opus'];
    for (const m of candidates) {
      if (MediaRecorder.isTypeSupported(m)) return m;
    }
    return 'audio/webm'; // fallback (some browsers)
  },

  _cleanup() {
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
    if (this._source) {
      this._source.disconnect();
      this._source = null;
    }
    if (this._audioContext && this._audioContext.state !== 'closed') {
      this._audioContext.close().catch(() => {});
    }
    this._audioContext = null;
    this._analyser = null;
    this._mediaRecorder = null;
  },

  // ── waveform visualisation ───────────────────────────────

  _startVisualisation() {
    if (!this._canvas || !this._analyser) return;
    this._canvas.width = this._canvas.offsetWidth * (window.devicePixelRatio || 1);
    this._canvas.height = this._canvas.offsetHeight * (window.devicePixelRatio || 1);
    this._draw();
  },

  _stopVisualisation() {
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
    // Clear canvas
    if (this._ctx && this._canvas) {
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }
  },

  _draw() {
    if (this._state !== 'recording') return;

    const W = this._canvas.width;
    const H = this._canvas.height;
    const ctx = this._ctx;

    // Frequency data
    const bufferLen = this._analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLen);
    this._analyser.getByteFrequencyData(dataArray);

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = this.COLOR_BG;
    ctx.fillRect(0, 0, W, H);

    // Draw frequency bars — mirrored from centre
    const barCount = Math.min(bufferLen, 64);
    const barWidth = (W / barCount) * 0.8;
    const gap = (W / barCount) * 0.2;
    const centerY = H / 2;

    for (let i = 0; i < barCount; i++) {
      const rawVal = dataArray[i] / 255;          // 0–1
      const smoothed = Math.pow(rawVal, 0.7);     // compress tiny values
      const barHeight = smoothed * centerY * 0.95;

      const x = i * (barWidth + gap) + gap / 2;

      // Gradient: gold at tip → transparent at centre
      const gradTop = ctx.createLinearGradient(x, centerY - barHeight, x, centerY);
      gradTop.addColorStop(0, this.COLOR_WAVE);
      gradTop.addColorStop(1, 'rgba(226, 182, 79, 0.05)');

      const gradBot = ctx.createLinearGradient(x, centerY, x, centerY + barHeight);
      gradBot.addColorStop(0, 'rgba(226, 182, 79, 0.05)');
      gradBot.addColorStop(1, this.COLOR_WAVE);

      // Top half (mirrored up)
      ctx.fillStyle = gradTop;
      ctx.fillRect(x, centerY - barHeight, barWidth, barHeight);

      // Bottom half (mirrored down)
      ctx.fillStyle = gradBot;
      ctx.fillRect(x, centerY, barWidth, barHeight);
    }

    // Gold centre-line glow
    ctx.strokeStyle = 'rgba(226, 182, 79, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(W, centerY);
    ctx.stroke();

    this._animFrame = requestAnimationFrame(() => this._draw());
  }
};


// ============================================================
//  Simple page router (preserved from v1)
// ============================================================
function navigate(page, params = {}) {
  const app = document.getElementById('app');
  if (!app) return;
  app.dataset.page = page;
  app.dataset.params = JSON.stringify(params);
  window.dispatchEvent(new CustomEvent('ka-navigate', { detail: { page, params } }));
}

// Expose the shared API objects for inline handlers and browser QA tools.
window.API_BASE = API_BASE;
window.api = api;
window.KoreanTTS = KoreanTTS;
window.VoiceRecorder = VoiceRecorder;
window.navigate = navigate;
