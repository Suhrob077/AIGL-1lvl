// ========== CLASSIC 4-CHOICE WORD GAME ==========
// A static multiple-choice quiz: the prompt word sits in a fixed card, and
// exactly 4 answer buttons (1 correct + 3 distractors) sit in a plain grid
// below it. No floating/physics — tapping a button always works, nothing
// ever drifts behind anything else.

const GAME_ROUNDS_TARGET = 10;
const GAME_OPTION_COUNT = 4;
const GAME_FEEDBACK_MS = 1800;

const GAME_DIFFICULTY = {
  hard: { label: 'Qiyin', seconds: 10 },
  mid: { label: "O'rta", seconds: 20 },
  easy: { label: 'Oson', seconds: 30 },
};

let gameState = {
  direction: 'src-tgt', // 'src-tgt' (prompt in sourceLang) | 'tgt-src'
  difficulty: 'mid',    // 'hard' | 'mid' | 'easy' — seconds-per-word
  rounds: [],
  currentIndex: 0,
  score: 0,
  isLocked: false,
  wrongItems: [],        // { prompt, correct } collected for the end-of-game AI summary
  advanceTimer: null,
  wordTimerInterval: null,
  wordSecondsLeft: 0,
  wordTotalSeconds: 0,
};

function selectGameDirection(dir) {
  gameState.direction = dir;
  document.getElementById('gameDir1').classList.toggle('active', dir === 'src-tgt');
  document.getElementById('gameDir2').classList.toggle('active', dir === 'tgt-src');
}

function selectGameDifficulty(diff) {
  if (!GAME_DIFFICULTY[diff]) return;
  gameState.difficulty = diff;
  document.getElementById('gameDiffHard').classList.toggle('active', diff === 'hard');
  document.getElementById('gameDiffMid').classList.toggle('active', diff === 'mid');
  document.getElementById('gameDiffEasy').classList.toggle('active', diff === 'easy');
}

function gameDirectionLangs() {
  return gameState.direction === 'src-tgt'
    ? { promptLang: Store.settings.sourceLang, answerLang: Store.settings.targetLang }
    : { promptLang: Store.settings.targetLang, answerLang: Store.settings.sourceLang };
}

function wordText(w, lang) {
  return lang === w.sourceLang ? w.source : w.target;
}

function buildRounds() {
  const pool = [...Store.words].sort(() => Math.random() - 0.5);
  const rounds = [];
  let lap = 0;
  while (rounds.length < Math.min(GAME_ROUNDS_TARGET, Math.max(pool.length, GAME_OPTION_COUNT))) {
    const source = lap === 0 ? pool : [...pool].sort(() => Math.random() - 0.5);
    for (const w of source) {
      if (rounds.length >= GAME_ROUNDS_TARGET) break;
      if (rounds.length && rounds[rounds.length - 1].id === w.id) continue;
      rounds.push(w);
    }
    lap++;
    if (lap > 3) break;
  }
  return rounds;
}

function startGameMode() {
  if (Store.words.length < GAME_OPTION_COUNT) {
    showToast(`O'yin uchun kamida ${GAME_OPTION_COUNT} ta so'z kerak. Avval so'z qo'shing!`);
    return;
  }

  gameState.rounds = buildRounds();
  gameState.currentIndex = 0;
  gameState.score = 0;
  gameState.isLocked = false;
  gameState.wrongItems = [];

  document.getElementById('game-setup').style.display = 'none';
  document.getElementById('game-playing').style.display = 'block';
  document.getElementById('game-over').style.display = 'none';

  showGameRound();
}

function stopGame() {
  clearTimeout(gameState.advanceTimer);
  stopWordTimer();
  if (typeof stopSentenceMode === 'function') stopSentenceMode();
  goToScreen('home-screen');
}

function showGameRound() {
  if (gameState.currentIndex >= gameState.rounds.length) {
    endGameMode();
    return;
  }

  gameState.isLocked = false;
  const word = gameState.rounds[gameState.currentIndex];
  const { promptLang, answerLang } = gameDirectionLangs();
  const promptText = wordText(word, promptLang);
  const correctText = wordText(word, answerLang);

  document.getElementById('gameProgressText').textContent =
    `${gameState.currentIndex + 1} / ${gameState.rounds.length}`;
  document.getElementById('gameProgressFill').style.width =
    (gameState.currentIndex / gameState.rounds.length * 100) + '%';

  const promptCard = document.getElementById('gamePromptCard');
  promptCard.classList.remove('entering'); void promptCard.offsetWidth; promptCard.classList.add('entering');
  document.getElementById('gamePromptWord').textContent = promptText;
  document.getElementById('gamePromptHint').textContent = "To'g'ri javobni tanlang!";

  const banner = document.getElementById('gameFeedbackBanner');
  banner.className = 'game-feedback-banner';
  banner.textContent = '';

  buildGameOptions(word, correctText, answerLang);
  startWordTimer(GAME_DIFFICULTY[gameState.difficulty].seconds);
}

/** Renders exactly GAME_OPTION_COUNT static answer buttons: 1 correct +
 *  (n-1) distractors pulled from the user's other saved words. */
function buildGameOptions(currentWord, correctText, answerLang) {
  const grid = document.getElementById('gameOptionsGrid');
  grid.innerHTML = '';

  const otherPool = Store.words.filter(w => w.id !== currentWord.id);
  const shuffled = [...otherPool].sort(() => Math.random() - 0.5);
  const distractors = [];
  const seen = new Set([correctText.toLowerCase()]);
  for (const w of shuffled) {
    const text = wordText(w, answerLang);
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    distractors.push(text);
    if (distractors.length >= GAME_OPTION_COUNT - 1) break;
  }

  const options = [...distractors, correctText].sort(() => Math.random() - 0.5);
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  options.forEach((text, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'game-option-btn';
    btn.innerHTML = `<span class="game-option-letter">${letters[i]}</span><span class="game-option-text">${escapeHtml(text)}</span>`;
    btn.dataset.correct = text === correctText ? '1' : '0';
    btn.addEventListener('click', () => handleGameOptionClick(btn, text === correctText, correctText));
    grid.appendChild(btn);
  });
}

function handleGameOptionClick(btnEl, isCorrect, correctText) {
  if (gameState.isLocked) return;
  if (gameState.wordSecondsLeft <= 0) return; // timeout already handled this round
  gameState.isLocked = true;
  stopWordTimer();

  const word = gameState.rounds[gameState.currentIndex];
  Store.recordAttempt(word.id, isCorrect);
  renderWordList();
  if (typeof renderDashboard === 'function') renderDashboard();

  document.querySelectorAll('#gameOptionsGrid .game-option-btn').forEach(el => {
    el.disabled = true;
    if (el === btnEl) {
      el.classList.add(isCorrect ? 'correct-answer' : 'wrong-answer');
    } else if (el.dataset.correct === '1') {
      el.classList.add('correct-answer');
    } else {
      el.classList.add('dim');
    }
  });

  const banner = document.getElementById('gameFeedbackBanner');
  const { promptLang } = gameDirectionLangs();
  const promptText = wordText(word, promptLang);

  if (isCorrect) {
    gameState.score++;
    const earned = pointsForWord(word, gameState.difficulty);
    if (typeof addDailyPoints === 'function') addDailyPoints(earned);
    banner.textContent = `✅ To'g'ri! +${earned} ball`;
    banner.className = 'game-feedback-banner show correct';
  } else {
    gameState.wrongItems.push({ prompt: promptText, correct: correctText });
    banner.textContent = `❌ Noto'g'ri! To'g'ri javob: ${correctText}`;
    banner.className = 'game-feedback-banner show wrong';
  }

  // Ask the AI for a short reaction to this attempt, same as the practice
  // screen — shown as a small skippable popup, never blocks the game loop.
  if (typeof requestAnswerComment === 'function') {
    requestAnswerComment(promptText, correctText, btnEl.textContent, isCorrect);
  }

  clearTimeout(gameState.advanceTimer);
  gameState.advanceTimer = setTimeout(() => {
    gameState.currentIndex++;
    showGameRound();
  }, GAME_FEEDBACK_MS);
}

/** Round auto-loses if nobody taps an option before the per-word timer hits 0. */
function handleTimeUp() {
  if (gameState.isLocked) return;
  gameState.isLocked = true;
  stopWordTimer();

  const word = gameState.rounds[gameState.currentIndex];
  Store.recordAttempt(word.id, false);
  renderWordList();
  if (typeof renderDashboard === 'function') renderDashboard();

  let correctText = '';
  document.querySelectorAll('#gameOptionsGrid .game-option-btn').forEach(el => {
    el.disabled = true;
    if (el.dataset.correct === '1') {
      el.classList.add('correct-answer');
      correctText = el.querySelector('.game-option-text').textContent;
    } else {
      el.classList.add('dim');
    }
  });

  const banner = document.getElementById('gameFeedbackBanner');
  banner.textContent = `⏰ Vaqt tugadi! To'g'ri javob: ${correctText}`;
  banner.className = 'game-feedback-banner show wrong';

  const { promptLang } = gameDirectionLangs();
  const promptText = wordText(word, promptLang);
  gameState.wrongItems.push({ prompt: promptText, correct: correctText });

  if (typeof requestAnswerComment === 'function') {
    requestAnswerComment(promptText, correctText, "(vaqt tugadi, javob tanlanmadi)", false);
  }

  clearTimeout(gameState.advanceTimer);
  gameState.advanceTimer = setTimeout(() => {
    gameState.currentIndex++;
    showGameRound();
  }, GAME_FEEDBACK_MS);
}

// ---------- Per-word countdown ----------
function startWordTimer(seconds) {
  stopWordTimer();
  gameState.wordSecondsLeft = seconds;
  gameState.wordTotalSeconds = seconds;
  updateWordTimerUI();
  gameState.wordTimerInterval = setInterval(() => {
    gameState.wordSecondsLeft -= 1;
    updateWordTimerUI();
    if (gameState.wordSecondsLeft <= 0) {
      handleTimeUp();
    }
  }, 1000);
}

function stopWordTimer() {
  if (gameState.wordTimerInterval) clearInterval(gameState.wordTimerInterval);
  gameState.wordTimerInterval = null;
}

function updateWordTimerUI() {
  const t = document.getElementById('gameWordTimer');
  const f = document.getElementById('gameWordTimeFill');
  if (!t || !f) return;
  t.textContent = Math.max(0, gameState.wordSecondsLeft);
  const pct = gameState.wordTotalSeconds ? Math.max(0, (gameState.wordSecondsLeft / gameState.wordTotalSeconds) * 100) : 0;
  f.style.width = pct + '%';
  t.classList.toggle('low', gameState.wordSecondsLeft <= 3 && gameState.wordSecondsLeft > 0);
}

async function endGameMode() {
  stopWordTimer();
  clearTimeout(gameState.advanceTimer);

  const total = gameState.rounds.length;
  const percent = total ? Math.round((gameState.score / total) * 100) : 0;

  document.getElementById('gameOverScore').textContent = gameState.score;
  document.getElementById('gameOverTotal').textContent = total;
  document.getElementById('gameOverPercent').textContent = percent + '%';

  document.getElementById('game-setup').style.display = 'none';
  document.getElementById('game-playing').style.display = 'none';
  document.getElementById('game-over').style.display = 'block';

  if (typeof checkForFullMastery === 'function') checkForFullMastery();
  if (typeof requestSessionSummary === 'function') {
    requestSessionSummary('game', gameState.score, total, gameState.wrongItems, 'gameOverAiComment');
  }
}

function restartGameMode() {
  stopWordTimer();
  clearTimeout(gameState.advanceTimer);
  document.getElementById('game-setup').style.display = 'block';
  document.getElementById('game-playing').style.display = 'none';
  document.getElementById('game-over').style.display = 'none';
  selectGameDirection('src-tgt');
  selectGameDifficulty('mid');
}
