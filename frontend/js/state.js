// ========== STATE & PERSISTENCE ==========
// Single source of truth for words, settings, and the "yangiman" onboarding flag.
// Nothing here talks to the network — that's camera.js / backend.

const STORAGE_KEYS = {
  words: 'vocab_words_v2',
  settings: 'vocab_settings_v2',
  yangiman: 'vocab_yangiman_v2',
};

const MASTER_THRESHOLD = 5; // correct answers -> ⭐ starred / mastered
const HARD_THRESHOLD = 5;   // wrong answers -> ⚠️ hard-to-remember

const LANGUAGES = [
  { code: 'de', label: 'Nemischa (DE)' },
  { code: 'uz', label: "O'zbekcha (UZ)" },
  { code: 'en', label: 'Inglizcha (EN)' },
  { code: 'ru', label: 'Ruscha (RU)' },
  { code: 'tr', label: 'Turkcha (TR)' },
];

function uid() {
  return 'w_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/** Stable per-browser id so the (optional) push-notification backend can
 *  address this device without any login/account system. */
function getDeviceId() {
  let id = localStorage.getItem('vocab_device_id_v1');
  if (!id) {
    id = 'd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('vocab_device_id_v1', id);
  }
  return id;
}

// Default backend address:
// - If this page itself was loaded over http(s) (e.g. you opened
//   http://localhost:8787, which is what the backend now serves the
//   frontend from), use the SAME origin — no config needed, no CORS issues.
// - Otherwise (e.g. the html file was opened directly as file://), fall
//   back to the default local dev backend address; the user can still
//   override this in Settings > Backend (AI proxy) manzili.
function defaultApiBaseUrl() {
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    return location.origin;
  }
  return 'http://localhost:8787';
}

const Store = {
  words: [],
  settings: {
    sourceLang: 'de', targetLang: 'uz', apiBaseUrl: defaultApiBaseUrl(), addArticles: true,
    dailyGoal: 100,          // "kunlik yig'ish bali" — base daily point goal
    notificationsEnabled: false,
    aiglEnabled: false,      // AI-GL toggle: enables the points/learning AI chat entry point
  },
  yangiman: false,

  load() {
    try { this.words = JSON.parse(localStorage.getItem(STORAGE_KEYS.words) || '[]'); }
    catch { this.words = []; }
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || 'null');
      if (s) this.settings = { ...this.settings, ...s };
    } catch { /* keep defaults */ }
    this.yangiman = localStorage.getItem(STORAGE_KEYS.yangiman) === '1';
  },

  saveWords() { localStorage.setItem(STORAGE_KEYS.words, JSON.stringify(this.words)); },
  saveSettings() { localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(this.settings)); },
  saveYangiman() { localStorage.setItem(STORAGE_KEYS.yangiman, this.yangiman ? '1' : '0'); },

  addWord(source, target, meta = {}) {
    const exists = this.words.some(w =>
      w.source.toLowerCase() === source.toLowerCase() &&
      w.sourceLang === (meta.sourceLang || this.settings.sourceLang));
    if (exists) return null;
    const word = {
      id: uid(),
      source, target,
      sourceLang: meta.sourceLang || this.settings.sourceLang,
      targetLang: meta.targetLang || this.settings.targetLang,
      attempts: 0, correct: 0, incorrect: 0,
      state: 'new', // 'new' | 'starred' | 'hard'
      createdAt: Date.now(), lastSeen: null,
    };
    this.words.push(word);
    this.saveWords();
    return word;
  },

  deleteWord(id) {
    this.words = this.words.filter(w => w.id !== id);
    this.saveWords();
  },

  clearAll() {
    this.words = [];
    this.saveWords();
  },

  /** Record a quiz attempt result and recompute the word's memory state. */
  recordAttempt(id, wasCorrect) {
    const w = this.words.find(x => x.id === id);
    if (!w) return null;
    w.attempts += 1;
    w.lastSeen = Date.now();
    if (wasCorrect) { w.correct += 1; } else { w.incorrect += 1; }

    if (w.correct >= MASTER_THRESHOLD) w.state = 'starred';
    else if (w.incorrect >= HARD_THRESHOLD) w.state = 'hard';
    else w.state = 'new';

    this.saveWords();
    return w;
  },

  starredWords() { return this.words.filter(w => w.state === 'starred'); },
  hardWords() { return this.words.filter(w => w.state === 'hard'); },
  activeWords() { return this.words; },

  /** True once every active word has been fully mastered (100% starred). */
  isFullyMastered() {
    return this.words.length > 0 && this.words.every(w => w.state === 'starred');
  },

  /** Reset session progress for the current word set, keep the words. */
  restartSession() {
    this.words.forEach(w => { w.attempts = 0; w.correct = 0; w.incorrect = 0; w.state = 'new'; w.lastSeen = null; });
    this.saveWords();
  },

  /** Full factory reset of memory scores/attempt counters (keeps the words themselves). */
  resetAllScores() {
    this.restartSession();
  },
};

Store.load();
