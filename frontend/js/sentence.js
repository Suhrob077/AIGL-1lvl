// ========== SENTENCE TRANSLATION MODE ("Gaplarni tarjima qilish") ==========
// A second mode inside the Game tab. The AI composes one short, everyday
// sentence built (as much as possible) from the user's own saved vocabulary
// and the player rebuilds it by tapping the shuffled word chips in the
// correct order. If the saved vocabulary can't support any natural
// sentence, the AI says so instead of making one up, and we surface that
// message directly instead of pretending the round succeeded.

const SENTENCE_ROUNDS_TARGET = 5;
const SENTENCE_MIN_WORDS = 6;
const SENTENCE_FEEDBACK_MS = 2600;

let sentenceState = {
  round: 0,
  score: 0,
  current: null,   // { promptSentence, answerTokens }
  chosen: [],      // indices into pool, in tapped order
  pool: [],        // shuffled token strings for the current round
  poolUsed: [],    // parallel bool array
  wrongItems: [],  // { prompt, correct } collected for the end-of-session AI summary
  locked: false,
  advanceTimer: null,
};

// ---------- Mode switch (Words <-> Sentences) ----------
function selectGameMode(mode) {
  document.getElementById('gameModeWords').classList.toggle('active', mode === 'words');
  document.getElementById('gameModeSentence').classList.toggle('active', mode === 'sentence');
  document.getElementById('game-words-wrap').style.display = mode === 'words' ? 'block' : 'none';
  document.getElementById('game-sentence-wrap').style.display = mode === 'sentence' ? 'block' : 'none';

  if (mode === 'words') {
    stopSentenceMode();
    if (typeof restartGameMode === 'function') restartGameMode();
  } else {
    stopWordGameTimersOnly();
    restartSentenceMode();
  }
}

/** Freezes the word-bubble game's timers without navigating away from the
 *  game screen (stopGame() would also send the user to Home). */
function stopWordGameTimersOnly() {
  if (typeof stopWordTimer === 'function') stopWordTimer();
  if (typeof gameState !== 'undefined' && gameState) clearTimeout(gameState.advanceTimer);
}

function restartSentenceMode() {
  clearTimeout(sentenceState.advanceTimer);
  sentenceState = { round: 0, score: 0, current: null, chosen: [], pool: [], poolUsed: [], wrongItems: [], locked: false, advanceTimer: null };
  const setup = document.getElementById('sentence-setup');
  const playing = document.getElementById('sentence-playing');
  const over = document.getElementById('sentence-over');
  if (setup) setup.style.display = 'block';
  if (playing) playing.style.display = 'none';
  if (over) over.style.display = 'none';
}

function stopSentenceMode() {
  clearTimeout(sentenceState.advanceTimer);
}

/** Mirrors the word game's src-tgt / tgt-src direction toggle so both
 *  modes always practice the same language pair/direction. */
function sentenceDirectionLangs() {
  return typeof gameDirectionLangs === 'function'
    ? gameDirectionLangs()
    : { promptLang: Store.settings.sourceLang, answerLang: Store.settings.targetLang };
}

// ---------- Round flow ----------
async function startSentenceMode() {
  if (Store.words.length < SENTENCE_MIN_WORDS) {
    showToast(`Gap tuzish uchun kamida ${SENTENCE_MIN_WORDS} ta so'z kerak. Ko'proq so'z qo'shing!`);
    return;
  }
  sentenceState.round = 0;
  sentenceState.score = 0;
  sentenceState.wrongItems = [];
  document.getElementById('sentence-setup').style.display = 'none';
  document.getElementById('sentence-playing').style.display = 'block';
  document.getElementById('sentence-over').style.display = 'none';
  await loadSentenceRound();
}

async function loadSentenceRound() {
  if (sentenceState.round >= SENTENCE_ROUNDS_TARGET) {
    endSentenceMode();
    return;
  }
  sentenceState.locked = false;
  sentenceState.chosen = [];

  const promptCard = document.getElementById('sentencePromptCard');
  promptCard.classList.add('loading');
  document.getElementById('sentencePromptText').textContent = "🤖 AI gap tayyorlamoqda...";
  document.getElementById('sentenceChipPool').innerHTML = '';
  document.getElementById('sentenceAnswerSlot').innerHTML = '';
  document.getElementById('sentenceCheckBtn').disabled = true;
  const banner = document.getElementById('sentenceFeedbackBanner');
  banner.className = 'game-feedback-banner';
  banner.textContent = '';
  document.getElementById('sentenceProgressText').textContent = `${sentenceState.round + 1} / ${SENTENCE_ROUNDS_TARGET}`;

  const { promptLang, answerLang } = sentenceDirectionLangs();

  try {
    const res = await fetch(`${Store.settings.apiBaseUrl}/api/sentence/build`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        words: Store.words.map(w => ({ source: w.source, target: w.target })),
        promptLang, answerLang,
      }),
    });
    const data = await res.json().catch(() => ({}));
    promptCard.classList.remove('loading');

    if (!res.ok || !data.possible) {
      const msg = data.message || "So'zlaringiz gap tuzish uchun yetarli emas yoki mos kelmayapti.";
      showToast(msg);
      document.getElementById('sentencePromptText').textContent = msg;
      returnToSentenceSetupSoon();
      return;
    }

    sentenceState.current = { promptSentence: data.promptSentence, answerTokens: data.answerTokens };
    document.getElementById('sentencePromptText').textContent = data.promptSentence;
    buildSentenceChips(data.answerTokens);
  } catch (e) {
    promptCard.classList.remove('loading');
    const msg = "Serverga ulanib bo'lmadi. Backend manzilini Sozlamalardan tekshiring.";
    showToast(msg);
    document.getElementById('sentencePromptText').textContent = msg;
    returnToSentenceSetupSoon();
  }
}

function returnToSentenceSetupSoon() {
  clearTimeout(sentenceState.advanceTimer);
  sentenceState.advanceTimer = setTimeout(() => {
    document.getElementById('sentence-playing').style.display = 'none';
    document.getElementById('sentence-setup').style.display = 'block';
  }, 2400);
}

function buildSentenceChips(tokens) {
  // Mix in a few distractor words from the user's own vocabulary alongside
  // the correct tokens, so the round is a real "to'g'ri va xato aralash
  // so'zlardan tanlash" exercise, not just re-ordering a pre-filtered set.
  const { answerLang } = sentenceDirectionLangs();
  const correctSet = new Set(tokens.map(t => t.toLowerCase().replace(/[?!.,;:]+$/g, '')));
  const distractorPool = [...Store.words]
    .sort(() => Math.random() - 0.5)
    .map(w => wordText(w, answerLang))
    .filter(t => t && !correctSet.has(t.toLowerCase()));

  const distractorCount = Math.min(4, distractorPool.length);
  const distractors = distractorPool.slice(0, distractorCount);

  sentenceState.pool = [...tokens, ...distractors].sort(() => Math.random() - 0.5);
  sentenceState.poolUsed = sentenceState.pool.map(() => false);

  const wrap = document.getElementById('sentenceChipPool');
  wrap.innerHTML = '';
  sentenceState.pool.forEach((tok, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'sentence-chip';
    chip.textContent = tok;
    chip.dataset.idx = String(i);
    chip.addEventListener('click', () => tapSentenceChip(i));
    wrap.appendChild(chip);
  });
  renderSentenceAnswerSlot();
}

function tapSentenceChip(poolIdx) {
  if (sentenceState.locked || sentenceState.poolUsed[poolIdx]) return;
  sentenceState.poolUsed[poolIdx] = true;
  sentenceState.chosen.push(poolIdx);
  renderSentenceAnswerSlot();
  updateSentenceChipStates();
}

function untapSentenceSlot(chosenPos) {
  if (sentenceState.locked) return;
  const poolIdx = sentenceState.chosen[chosenPos];
  sentenceState.chosen.splice(chosenPos, 1);
  sentenceState.poolUsed[poolIdx] = false;
  renderSentenceAnswerSlot();
  updateSentenceChipStates();
}

function updateSentenceChipStates() {
  document.querySelectorAll('#sentenceChipPool .sentence-chip').forEach((el, i) => {
    el.classList.toggle('used', !!sentenceState.poolUsed[i]);
  });
}

function renderSentenceAnswerSlot() {
  const slot = document.getElementById('sentenceAnswerSlot');
  slot.innerHTML = '';
  if (!sentenceState.chosen.length) {
    slot.innerHTML = '<span class="sentence-slot-hint">So\'zlarni pastdan tanlab, gapni shu yerda tartib bilan tuzing</span>';
  } else {
    sentenceState.chosen.forEach((poolIdx, pos) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'sentence-chip picked';
      chip.textContent = sentenceState.pool[poolIdx];
      chip.addEventListener('click', () => untapSentenceSlot(pos));
      slot.appendChild(chip);
    });
  }
  const checkBtn = document.getElementById('sentenceCheckBtn');
  if (checkBtn) checkBtn.disabled = sentenceState.locked || sentenceState.chosen.length === 0;
}

function normalizeSentenceTokens(tokens) {
  return tokens
    .map(t => t.replace(/[''`´]/g, "'").trim().toLowerCase())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function checkSentenceAnswer() {
  if (sentenceState.locked || !sentenceState.current || !sentenceState.chosen.length) return;
  sentenceState.locked = true;
  document.getElementById('sentenceCheckBtn').disabled = true;

  const chosenTokens = sentenceState.chosen.map(i => sentenceState.pool[i]);
  const correctTokens = sentenceState.current.answerTokens;
  const isCorrect = normalizeSentenceTokens(chosenTokens) === normalizeSentenceTokens(correctTokens);

  if (isCorrect) sentenceState.score++;

  document.querySelectorAll('#sentenceChipPool .sentence-chip').forEach(el => { el.style.pointerEvents = 'none'; });
  document.querySelectorAll('#sentenceAnswerSlot .sentence-chip').forEach(el => { el.style.pointerEvents = 'none'; });

  const banner = document.getElementById('sentenceFeedbackBanner');
  if (isCorrect) {
    if (typeof addDailyPoints === 'function') addDailyPoints(POINTS_PER_SENTENCE);
    banner.textContent = "✅ To'g'ri!";
    banner.className = 'game-feedback-banner show correct';
  } else {
    sentenceState.wrongItems.push({ prompt: sentenceState.current.promptSentence, correct: correctTokens.join(' ') });
    banner.textContent = `❌ Noto'g'ri. To'g'ri tartib: ${correctTokens.join(' ')}`;
    banner.className = 'game-feedback-banner show wrong';
  }

  // Reuse the same one-off AI reaction popup used elsewhere in the app.
  if (typeof requestAnswerComment === 'function') {
    requestAnswerComment(
      sentenceState.current.promptSentence,
      correctTokens.join(' '),
      chosenTokens.join(' ') || '(javob tuzilmadi)',
      isCorrect
    );
  }

  clearTimeout(sentenceState.advanceTimer);
  sentenceState.advanceTimer = setTimeout(() => {
    sentenceState.round++;
    loadSentenceRound();
  }, SENTENCE_FEEDBACK_MS);
}

function endSentenceMode() {
  document.getElementById('sentence-playing').style.display = 'none';
  document.getElementById('sentence-over').style.display = 'block';
  document.getElementById('sentenceOverScore').textContent = sentenceState.score;
  document.getElementById('sentenceOverTotal').textContent = SENTENCE_ROUNDS_TARGET;
  if (typeof requestSessionSummary === 'function') {
    requestSessionSummary('sentence', sentenceState.score, SENTENCE_ROUNDS_TARGET, sentenceState.wrongItems, 'sentenceOverAiComment');
  }
}
