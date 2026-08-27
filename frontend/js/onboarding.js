// ========== YANGIMAN (auto-onboarding) ==========
// When the toggle is ON and the user has no words yet, automatically
// populate the dictionary from the bundled seed dataset.

let SEED_WORDS = [];

async function loadSeedDataset() {
  if (SEED_WORDS.length) return SEED_WORDS;
  // Uses the bundled seed-words.js (loaded via <script> in index.html) instead
  // of fetch()-ing seed-words.json. fetch() of a local JSON file fails with
  // "TypeError: Failed to fetch" whenever the app is opened directly as a
  // file:// path (double-clicked) rather than served over http(s) — a plain
  // <script> tag has no such restriction, so this always works.
  if (typeof SEED_WORDS_DATA !== 'undefined' && Array.isArray(SEED_WORDS_DATA)) {
    SEED_WORDS = SEED_WORDS_DATA;
    return SEED_WORDS;
  }
  // Fallback for setups that still only have the .json file and are served
  // over http(s) (fetch works fine there).
  try {
    const res = await fetch('data/seed-words.json');
    SEED_WORDS = await res.json();
  } catch (e) {
    console.warn('Could not load seed dataset:', e);
    SEED_WORDS = [];
  }
  return SEED_WORDS;
}

async function applySeedDataset() {
  const seed = await loadSeedDataset();
  let added = 0;
  seed.forEach(item => {
    const w = Store.addWord(item.source, item.target, {
      sourceLang: Store.settings.sourceLang,
      targetLang: Store.settings.targetLang,
    });
    if (w) added += 1;
  });
  return added;
}

function setYangiman(enabled) {
  Store.yangiman = enabled;
  Store.saveYangiman();
  if (enabled && Store.words.length === 0) {
    applySeedDataset().then(count => {
      renderWordList();
      showToast(count ? `Yangiman: ${count} ta so'z avtomatik yuklandi ✅` : "Yangiman yoqildi");
    });
  }
}

function initYangimanToggle() {
  const toggle = document.getElementById('yangimanToggle');
  toggle.checked = Store.yangiman;
  toggle.addEventListener('change', e => setYangiman(e.target.checked));

  // First-run convenience: if nothing is stored at all yet, default it on.
  const neverInitialized = localStorage.getItem('vocab_bootstrapped_v2') !== '1';
  if (neverInitialized) {
    localStorage.setItem('vocab_bootstrapped_v2', '1');
    if (Store.words.length === 0) {
      toggle.checked = true;
      setYangiman(true);
    }
  }
}
