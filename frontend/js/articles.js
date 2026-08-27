// ========== GERMAN ARTICLE AUTO-FIX ==========
// When "Add Articles" is enabled in Settings and the source language is
// German, this module makes sure every noun carries its correct der/die/das.
//
// Two layers, fastest first:
//  1. Local lookup table + suffix heuristics — instant, no network.
//  2. AI fallback (backend /api/article/fix) for words the local layer
//     doesn't recognize — runs in the background so it never blocks the UI.
// Whenever a word gets auto-fixed, a small popup tells the user, with a
// "Chat" button to discuss it and a "Skip" button to dismiss.

const ARTICLE_RE = /^(der|die|das)\s+/i;

// A compact table of common nouns this app already knows the gender of
// (covers the seed dataset + everyday words). Keys are lowercase, no article.
const KNOWN_GENDERS = {
  hund: 'der', katze: 'die', buch: 'das', haus: 'das', wasser: 'das', brot: 'das',
  schule: 'die', freund: 'der', freundin: 'die', apfel: 'der', milch: 'die',
  sonne: 'die', mond: 'der', tisch: 'der', stuhl: 'der', fenster: 'das', tür: 'die',
  auto: 'das', arbeit: 'die', zeit: 'die', liebe: 'die', stadt: 'die', land: 'das',
  geld: 'das', straße: 'die', kind: 'das', lehrer: 'der', lehrerin: 'die',
  vater: 'der', mutter: 'die', bruder: 'der', schwester: 'die', sohn: 'der',
  tochter: 'die', mann: 'der', frau: 'die', junge: 'der', mädchen: 'das',
  arzt: 'der', ärztin: 'die', stift: 'der', papier: 'das', tasche: 'die',
  handy: 'das', computer: 'der', uhr: 'die', schlüssel: 'der', koffer: 'der',
  flugzeug: 'das', zug: 'der', bus: 'der', fahrrad: 'das', bahnhof: 'der',
  flughafen: 'der', küche: 'die', zimmer: 'das', bett: 'das', schrank: 'der',
  garten: 'der', baum: 'der', blume: 'die', himmel: 'der', regen: 'der',
  schnee: 'der', wind: 'der', wetter: 'das', tee: 'der', kaffee: 'der',
  saft: 'der', käse: 'der', fleisch: 'das', fisch: 'der', ei: 'das',
  suppe: 'die', salat: 'der', obst: 'das', gemüse: 'das', banane: 'die',
  kartoffel: 'die', tomate: 'die', kopf: 'der', hand: 'die', fuß: 'der',
  auge: 'das', ohr: 'das', mund: 'der', nase: 'die', herz: 'das', markt: 'der',
  laden: 'der', bank: 'die', hotel: 'das', restaurant: 'das', museum: 'das',
  park: 'der', frage: 'die', antwort: 'die', wort: 'das', sprache: 'die',
  spiel: 'das', sport: 'der', reise: 'die', urlaub: 'der', gesundheit: 'die',
  problem: 'das', lösung: 'die', musik: 'die', film: 'der', zeitung: 'die',
  brief: 'der',
};

/** Suffix-based fallback rules (well-known German gender heuristics). */
function guessGenderBySuffix(word) {
  const w = word.toLowerCase();
  if (/(chen|lein|ment|um)$/.test(w)) return 'das';
  if (/(ung|heit|keit|schaft|tion|ik|ei|ur)$/.test(w)) return 'die';
  if (/(er|en|ling|ismus|or|ig)$/.test(w)) return 'der';
  if (/e$/.test(w)) return 'die';
  return null;
}

function looksLikeGermanNounNeedingArticle(source) {
  const trimmed = source.trim();
  if (!trimmed) return false;
  if (ARTICLE_RE.test(trimmed)) return false; // already has an article
  if (trimmed.split(/\s+/).length > 3) return false; // probably a phrase, leave it
  return true;
}

/**
 * Try to fix a single German word synchronously (no network).
 * Returns the fixed string (with article) or null if no local match.
 */
function localArticleFix(source) {
  const trimmed = source.trim();
  const firstWord = trimmed.split(/\s+/)[0].toLowerCase();
  const lookupKey = trimmed.toLowerCase();

  let article = KNOWN_GENDERS[lookupKey] || KNOWN_GENDERS[firstWord];
  if (!article) article = guessGenderBySuffix(trimmed);
  if (!article) return null;

  // Capitalize the noun the way German orthography expects.
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return `${article} ${capitalized}`;
}

/**
 * Ask the backend AI to determine the article for a word the local
 * heuristics couldn't confidently resolve. Best-effort — errors are
 * swallowed so it never disrupts the main flow.
 */
async function aiArticleFix(source, targetLang) {
  try {
    const res = await fetch(`${Store.settings.apiBaseUrl}/api/article/fix`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ word: source, targetLang }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.needsFix && data.fixed) return data;
    return null;
  } catch (e) {
    console.warn('AI article fix unavailable:', e);
    return null;
  }
}

/**
 * Main entry point. Call right before/after saving a German word.
 * Returns the (possibly fixed) source string synchronously via the local
 * layer. If nothing local matched and a network fallback is desired, pass
 * `wordId` so the AI layer can patch the already-saved word later.
 */
function applyArticleAutoFix(source, wordId) {
  if (!Store.settings.addArticles) return source;
  if (Store.settings.sourceLang !== 'de') return source;
  if (!looksLikeGermanNounNeedingArticle(source)) return source;

  const localFixed = localArticleFix(source);
  if (localFixed && localFixed.toLowerCase() !== source.toLowerCase()) {
    showAiSuggestionPopup(source, localFixed);
    return localFixed;
  }

  // No confident local guess — ask AI in the background, patch afterwards.
  if (wordId) {
    aiArticleFix(source, Store.settings.targetLang).then(result => {
      if (!result) return;
      const w = Store.words.find(x => x.id === wordId);
      if (!w) return;
      const original = w.source;
      w.source = result.fixed;
      Store.saveWords();
      renderWordList();
      showAiSuggestionPopup(original, result.fixed, result.explanation);
    });
  }
  return source;
}

// ---------- AI suggestion popup ----------
let lastSuggestion = { original: '', fixed: '' };

function showAiSuggestionPopup(original, fixed, explanation) {
  lastSuggestion = { original, fixed, explanation };
  const box = document.getElementById('aiSuggestToast');
  document.getElementById('aiSuggestMsg').innerHTML =
    `<b>${escapeHtml(original)}</b> → <b>${escapeHtml(fixed)}</b> ga o'zgartirildi (artikl qo'shildi).`;
  box.classList.add('show');
  clearTimeout(showAiSuggestionPopup._t);
  showAiSuggestionPopup._t = setTimeout(() => box.classList.remove('show'), 9000);
}

function dismissAiSuggestion() {
  document.getElementById('aiSuggestToast').classList.remove('show');
}

function openChatAboutSuggestion() {
  document.getElementById('aiSuggestToast').classList.remove('show');
  const intro = lastSuggestion.original
    ? `Nega "${lastSuggestion.original}" so'zi "${lastSuggestion.fixed}" ga o'zgartirildi?`
    : "So'zlar haqida savolim bor.";
  openChatDrawer(intro);
}
