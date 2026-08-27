// ========== DAILY POINTS & GOAL TRACKING ==========
// "Kunlik yig'ish bali" — every correct answer (practice, word-game, or
// sentence mode) earns points. Progress is tracked per calendar day. If
// yesterday's goal wasn't met, today's goal grows by the shortfall (e.g.
// missed by 10 -> today's target becomes 110), and the user is warned about
// it once per day, right when they open the app.

const POINTS_KEY = 'vocab_daily_points_v1';
const LAST_WARNED_KEY = 'vocab_last_warned_date_v1';
const POINTS_PER_SENTENCE = 15; // sentence mode is harder -> worth more

// Single-word points are no longer a flat 10 — each correct word earns a
// random 3-5, biased upward by difficulty (the game's Oson/O'rta/Qiyin
// selector when known, otherwise a word-length estimate in practice mode).
const WORD_POINT_TIERS = [
  [3, 3, 3, 4, 5], // easy — mostly 3, occasionally more
  [3, 4, 4, 5, 5], // medium — evenly spread
  [4, 4, 5, 5, 5], // hard — mostly 5, rarely 4
];

/** Random 3-5 points for one correctly-answered word.
 *  `difficulty` is 'easy' | 'mid' | 'hard' when known (game mode); if
 *  omitted (practice mode), it's estimated from the word's length. */
function pointsForWord(word, difficulty) {
  let tier;
  if (difficulty === 'hard') tier = 2;
  else if (difficulty === 'easy') tier = 0;
  else if (difficulty === 'mid') tier = 1;
  else {
    const text = (word && (word.source || word.target || '')) || '';
    const len = text.trim().length;
    tier = len <= 4 ? 0 : (len <= 7 ? 1 : 2);
  }
  const options = WORD_POINT_TIERS[tier];
  return options[Math.floor(Math.random() * options.length)];
}

function dateKeyFor(date) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function todayKey(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return dateKeyFor(d); // local calendar day is fine here
}

function loadDailyStore() {
  try { return JSON.parse(localStorage.getItem(POINTS_KEY) || '{}'); }
  catch { return {}; }
}

function saveDailyStore(store) {
  localStorage.setItem(POINTS_KEY, JSON.stringify(store));
}

/** Computes today's target: base daily goal from Settings, plus yesterday's
 *  shortfall (if any) rolled forward. */
function computeTodayGoal(store) {
  const base = Number(Store.settings.dailyGoal) || 100;
  const y = store[todayKey(-1)];
  if (y && typeof y.goal === 'number' && y.points < y.goal) {
    return base + (y.goal - y.points);
  }
  return base;
}

/** Makes sure today's row exists (creating it with the correct goal, which
 *  may include yesterday's rolled-over deficit) and returns the whole store. */
function ensureTodayRecord() {
  const store = loadDailyStore();
  const key = todayKey();
  if (!store[key]) {
    store[key] = { points: 0, goal: computeTodayGoal(store) };
    saveDailyStore(store);
  }
  return store;
}

function getTodayProgress() {
  const store = ensureTodayRecord();
  return store[todayKey()];
}

/** Call after every correct answer, anywhere in the app. */
function addDailyPoints(amount) {
  const store = ensureTodayRecord();
  const key = todayKey();
  store[key].points += amount;
  saveDailyStore(store);
  renderDailyGoalWidgets();
  if (typeof syncProgressToServer === 'function') syncProgressToServer();
  return store[key];
}

/** Renders the small "Bugungi maqsad" progress widgets on Home + Dashboard,
 *  if their DOM elements exist on the current screen. */
function renderDailyGoalWidgets() {
  const { points, goal } = getTodayProgress();
  const pct = goal ? Math.max(0, Math.min(100, Math.round((points / goal) * 100))) : 0;

  document.querySelectorAll('.daily-goal-points').forEach(el => { el.textContent = points; });
  document.querySelectorAll('.daily-goal-target').forEach(el => { el.textContent = goal; });
  document.querySelectorAll('.daily-goal-fill').forEach(el => { el.style.width = pct + '%'; });
  document.querySelectorAll('.daily-goal-pct').forEach(el => { el.textContent = pct + '%'; });

  const statusEl = document.getElementById('dailyGoalStatus');
  if (statusEl) {
    statusEl.classList.remove('status-over', 'status-progress', 'status-empty');
    if (goal > 0 && points >= goal) {
      const diff = points - goal;
      statusEl.textContent = diff === 0 ? "🎯 Bugungi norma aynan bajarildi!" : `🔥 Bugun normadan ${diff} ball ortiqcha bajardingiz!`;
      statusEl.classList.add('status-over');
    } else if (points > 0) {
      statusEl.textContent = `⏳ Yuklama bor — yana ${goal - points} ball qoldi`;
      statusEl.classList.add('status-progress');
    } else {
      statusEl.textContent = "😴 Bugun hali ball to'plamadingiz";
      statusEl.classList.add('status-empty');
    }
  }

  if (typeof renderWeekStrip === 'function') renderWeekStrip();
  if (typeof renderMonthCalendar === 'function' && document.getElementById('allDaysModal')?.classList.contains('active')) {
    renderMonthCalendar();
  }
}

/** Runs once per app load: if yesterday's goal was missed, shows a banner +
 *  (if permission already granted) a local notification. Only warns once
 *  per calendar day even across multiple app opens. */
function checkYesterdayGoalOnLoad() {
  const store = ensureTodayRecord();
  const y = store[todayKey(-1)];
  const already = localStorage.getItem(LAST_WARNED_KEY) === todayKey();

  if (y && y.points < y.goal && !already) {
    const today = store[todayKey()];
    const msg = `Siz kecha kunlik normani bajarmadingiz. Bugun ${today.goal} ball to'plashingiz lozim!`;
    showDailyGoalBanner(msg);
    localStorage.setItem(LAST_WARNED_KEY, todayKey());
    if (typeof showLocalReminderNotification === 'function') showLocalReminderNotification(msg);
  }
  renderDailyGoalWidgets();
}

function showDailyGoalBanner(msg) {
  const banner = document.getElementById('dailyGoalBanner');
  if (!banner) { if (typeof showToast === 'function') showToast(msg); return; }
  banner.textContent = `⚠️ ${msg}`;
  banner.style.display = 'block';
}

function dismissDailyGoalBanner() {
  const banner = document.getElementById('dailyGoalBanner');
  if (banner) banner.style.display = 'none';
}
