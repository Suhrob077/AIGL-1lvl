// ========== APP CONTROLLER ==========

let direction = 'src-tgt'; // 'src-tgt' (prompt in sourceLang) | 'tgt-src'
let practiceList = [];
let practiceWrongItems = []; // { prompt, correct } collected for the end-of-session AI summary
let currentIndex = 0;
let isChecking = false;
let floatCards = [];
let animFrame = null;
const colors = ['c1','c2','c3','c4','c5','c6','c7','c8'];

function init() {
  populateLangSelectors();
  renderWordList();
  renderDashboard();
  initYangimanToggle();
  setupSpeech();
  bindStaticEvents();
  if (typeof updateNotificationToggleUI === 'function') updateNotificationToggleUI();
  if (typeof checkYesterdayGoalOnLoad === 'function') checkYesterdayGoalOnLoad();
  goToScreen('home-screen');
}

// ---------- Navigation ----------
function goToScreen(id) {
  const leavingGame = document.getElementById('game-screen').classList.contains('active') && id !== 'game-screen';
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.target === id));

  if (id === 'dashboard-screen') renderDashboard();
  if (id === 'settings-screen' && typeof renderWeekStrip === 'function') renderWeekStrip();
  if (id === 'scan-screen') { resetScanScreen(); startCamera(); }
  else stopCamera();

  if (id === 'game-screen') {
    // Always land back on the word-bubble tab, freshly reset.
    if (typeof selectGameMode === 'function') selectGameMode('words');
    else if (typeof restartGameMode === 'function') restartGameMode();
  }
  if (leavingGame) {
    if (typeof stopWordTimer === 'function') stopWordTimer();
    if (typeof gameState !== 'undefined' && gameState) clearTimeout(gameState.advanceTimer);
    if (typeof stopSentenceMode === 'function') stopSentenceMode();
  }
}

// ---------- Settings / language selectors ----------
function populateLangSelectors() {
  const selects = ['settingsSourceLang', 'settingsTargetLang', 'scanSourceLang', 'scanTargetLang'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    el.innerHTML = LANGUAGES.map(l => `<option value="${l.code}">${l.label}</option>`).join('');
  });
  document.getElementById('settingsSourceLang').value = Store.settings.sourceLang;
  document.getElementById('settingsTargetLang').value = Store.settings.targetLang;
  document.getElementById('scanSourceLang').value = Store.settings.sourceLang;
  document.getElementById('scanTargetLang').value = Store.settings.targetLang;
  document.getElementById('apiBaseUrlInput').value = Store.settings.apiBaseUrl;
  document.getElementById('addArticlesToggle').checked = Store.settings.addArticles !== false;
  document.getElementById('dailyGoalInput').value = Store.settings.dailyGoal || 100;
  updateDirectionLabels();
}

function saveSettings() {
  Store.settings.sourceLang = document.getElementById('settingsSourceLang').value;
  Store.settings.targetLang = document.getElementById('settingsTargetLang').value;
  Store.settings.apiBaseUrl = document.getElementById('apiBaseUrlInput').value.trim().replace(/\/$/, '');
  const goalInput = document.getElementById('dailyGoalInput');
  Store.settings.dailyGoal = Math.max(10, Number(goalInput.value) || 100);
  Store.saveSettings();
  updateDirectionLabels();
  if (typeof renderDailyGoalWidgets === 'function') renderDailyGoalWidgets();
  showToast("Sozlamalar saqlandi ✅");
}

function swapLanguages() {
  const s = document.getElementById('settingsSourceLang');
  const t = document.getElementById('settingsTargetLang');
  const tmp = s.value; s.value = t.value; t.value = tmp;
  saveSettings();
}

function toggleAddArticles(enabled) {
  Store.settings.addArticles = enabled;
  Store.saveSettings();
  showToast(enabled ? "Artikllarni avtomatik qo'shish yoqildi 🇩🇪" : "Artikllarni avtomatik qo'shish o'chirildi");
}

function updateDirectionLabels() {
  const src = LANGUAGES.find(l => l.code === Store.settings.sourceLang)?.label || Store.settings.sourceLang;
  const tgt = LANGUAGES.find(l => l.code === Store.settings.targetLang)?.label || Store.settings.targetLang;
  document.getElementById('dir-fwd').textContent = `${src} → ${tgt}`;
  document.getElementById('dir-bwd').textContent = `${tgt} → ${src}`;
}

function setDirection(dir) {
  direction = dir;
  document.getElementById('dir-fwd').classList.toggle('active', dir === 'src-tgt');
  document.getElementById('dir-bwd').classList.toggle('active', dir === 'tgt-src');
}

function getDirection() {
  const promptLang = direction === 'src-tgt' ? Store.settings.sourceLang : Store.settings.targetLang;
  const answerLang = direction === 'src-tgt' ? Store.settings.targetLang : Store.settings.sourceLang;
  return { promptLang, answerLang };
}

// ---------- Word list (home) ----------
function renderWordList() {
  const list = document.getElementById('wordList');
  list.innerHTML = '';
  Store.words.forEach(w => {
    const div = document.createElement('div');
    div.className = 'word-item';
    const badge = w.state === 'starred' ? '⭐' : w.state === 'hard' ? '⚠️' : '';
    div.innerHTML = `
      <span><b>${escapeHtml(w.source)}</b> — ${escapeHtml(w.target)} <span class="badge">${badge} ${w.attempts}×</span></span>
      <button class="btn-danger" onclick="deleteWord('${w.id}')">×</button>
    `;
    list.appendChild(div);
  });
  document.getElementById('wordCount').textContent = Store.words.length;
  document.getElementById('emptyMsg').style.display = Store.words.length ? 'none' : 'block';
}

function addWord() {
  let source = document.getElementById('deInput').value.trim();
  const target = document.getElementById('uzInput').value.trim();
  if (!source || !target) { showToast("Ikkala maydonni ham to'ldiring!"); return; }

  // Try a fast local fix synchronously (no network) before saving.
  if (typeof applyArticleAutoFix === 'function') {
    const preFixed = applyArticleAutoFix(source, null);
    source = preFixed;
  }

  const w = Store.addWord(source, target);
  if (!w) { showToast("Bu so'z allaqachon bor!"); return; }

  // If the local layer couldn't resolve it, let AI try in the background
  // and patch the saved word once it responds (never blocks the UI).
  if (typeof applyArticleAutoFix === 'function') {
    applyArticleAutoFix(w.source, w.id);
  }

  renderWordList();
  document.getElementById('deInput').value = '';
  document.getElementById('uzInput').value = '';
  document.getElementById('deInput').focus();
}

function deleteWord(id) {
  Store.deleteWord(id);
  renderWordList();
  renderDashboard();
}

function clearAll() {
  if (confirm("Barcha so'zlarni o'chirishni xohlaysizmi?")) {
    Store.clearAll();
    renderWordList();
    renderDashboard();
  }
}

async function loadExamples() {
  const added = await applySeedDataset();
  renderWordList();
  showToast(added ? `${added} ta yangi so'z qo'shildi!` : "Barcha so'zlar allaqachon bor.");
}

// ---------- Practice loop ----------
function startPractice() {
  if (Store.words.length === 0) {
    showToast("Avval kamida 1 ta so'z qo'shing yoki tayyor so'zlarni yuklang!");
    return;
  }
  practiceList = [...Store.words].sort(() => Math.random() - 0.5);
  practiceWrongItems = [];
  currentIndex = 0;
  isChecking = false;

  goToScreen('practice-screen');
  createFloatingCards();
  startFloatingAnimation();
  showCurrentWord();
  setTimeout(() => document.getElementById('answerInput').focus(), 200);
}

function stopPractice() {
  goToScreen('home-screen');
  stopFloatingAnimation();
  document.getElementById('floatingArea').innerHTML = '';
  document.getElementById('feedback').textContent = '';
  document.getElementById('answerInput').value = '';
  if (isListening && recognition) { try { recognition.stop(); } catch (e) {} }
  stopListening();
  if (typeof dismissAiAnswerComment === 'function') dismissAiAnswerComment();
}

function createFloatingCards() {
  const area = document.getElementById('floatingArea');
  area.innerHTML = '';
  floatCards = [];
  const { promptLang } = getDirection();
  const pool = [...practiceList, ...practiceList, ...practiceList];
  const w = window.innerWidth, h = window.innerHeight;

  pool.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = `float-card ${colors[i % colors.length]}`;
    card.textContent = promptLang === item.sourceLang ? item.source : item.target;
    const x = Math.random() * (w - 90), y = Math.random() * (h - 50);
    const vx = (Math.random() - 0.5) * 0.65, vy = (Math.random() - 0.5) * 0.65;
    const scale = 0.75 + Math.random() * 0.4;
    card.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    area.appendChild(card);
    floatCards.push({ el: card, x, y, vx, vy, scale });
  });
}

function startFloatingAnimation() {
  function animate() {
    const w = window.innerWidth, h = window.innerHeight;
    floatCards.forEach(c => {
      c.x += c.vx; c.y += c.vy;
      if (c.x < -30 || c.x > w - 50) c.vx *= -1;
      if (c.y < -20 || c.y > h - 30) c.vy *= -1;
      c.x = Math.max(-40, Math.min(w - 40, c.x));
      c.y = Math.max(-30, Math.min(h - 20, c.y));
      c.el.style.transform = `translate(${c.x}px, ${c.y}px) scale(${c.scale})`;
    });
    animFrame = requestAnimationFrame(animate);
  }
  animFrame = requestAnimationFrame(animate);
}

function stopFloatingAnimation() {
  if (animFrame) cancelAnimationFrame(animFrame);
  animFrame = null;
}

function showCurrentWord() {
  if (currentIndex >= practiceList.length) {
    document.getElementById('currentWord').textContent = "🎉 Tugadi!";
    document.getElementById('currentHint').textContent = "Barcha so'zlarni ko'rdingiz";
    document.getElementById('answerInput').style.display = 'none';
    document.querySelector('.answer-box .btn-primary').style.display = 'none';
    document.getElementById('micBtn').style.display = 'none';
    document.getElementById('feedback').textContent = '';
    checkForFullMastery();
    if (typeof requestSessionSummary === 'function') {
      const correct = practiceList.length - practiceWrongItems.length;
      requestSessionSummary('practice', correct, practiceList.length, practiceWrongItems, 'practiceSummaryBox');
    }
    return;
  }

  const w = practiceList[currentIndex];
  const { promptLang } = getDirection();
  const promptText = promptLang === w.sourceLang ? w.source : w.target;
  const hint = "Tarjimasini yozing yoki ayting";

  const bigCard = document.getElementById('bigCard');
  bigCard.classList.remove('entering'); void bigCard.offsetWidth; bigCard.classList.add('entering');

  document.getElementById('currentWord').textContent = promptText;
  document.getElementById('currentHint').textContent = hint;
  document.getElementById('answerInput').value = '';
  document.getElementById('answerInput').style.display = 'block';
  document.querySelector('.answer-box .btn-primary').style.display = 'block';
  document.getElementById('micBtn').style.display = 'flex';
  document.getElementById('feedback').textContent = '';
  document.getElementById('feedback').className = 'feedback';
  const summaryBox = document.getElementById('practiceSummaryBox');
  if (summaryBox) { summaryBox.style.display = 'none'; summaryBox.textContent = ''; }

  document.getElementById('progressText').textContent = `${currentIndex + 1} / ${practiceList.length}`;
  document.getElementById('progressFill').style.width = (currentIndex / practiceList.length * 100) + '%';

  isChecking = false;
  setTimeout(() => document.getElementById('answerInput').focus(), 250);
}

function normalize(s) { return s.replace(/[''`´]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase(); }

function checkAnswer() {
  if (isChecking || currentIndex >= practiceList.length) return;
  const input = document.getElementById('answerInput').value.trim();
  if (!input) return;

  isChecking = true;
  const w = practiceList[currentIndex];
  const { promptLang } = getDirection();
  const promptText = promptLang === w.sourceLang ? w.source : w.target;
  const correctText = promptLang === w.sourceLang ? w.target : w.source;
  const feedback = document.getElementById('feedback');

  const isCorrect = normalize(input) === normalize(correctText);
  Store.recordAttempt(w.id, isCorrect);
  renderWordList();

  // Ask the AI for a short reaction to this attempt (right or wrong). This
  // never blocks the practice flow — it resolves in the background and, if
  // it succeeds, shows a small skippable popup the user can reply to.
  if (typeof requestAnswerComment === 'function') {
    requestAnswerComment(promptText, correctText, input, isCorrect);
  }

  if (isCorrect) {
    const earned = pointsForWord(w);
    if (typeof addDailyPoints === 'function') addDailyPoints(earned);
    feedback.textContent = `✅ To'g'ri! +${earned} ball`;
    feedback.className = 'feedback correct';
    setTimeout(() => { currentIndex++; showCurrentWord(); }, 750);
  } else {
    practiceWrongItems.push({ prompt: promptText, correct: correctText });
    feedback.textContent = `❌ Noto'g'ri. To'g'ri javob: ${correctText}`;
    feedback.className = 'feedback wrong';
    setTimeout(() => { isChecking = false; document.getElementById('answerInput').focus(); }, 1700);
  }
}

// ---------- Misc UI helpers ----------
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 2600);
}

function bindStaticEvents() {
  document.getElementById('answerInput').addEventListener('keydown', e => { if (e.key === 'Enter') checkAnswer(); });
  document.getElementById('deInput').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('uzInput').focus(); });
  document.getElementById('uzInput').addEventListener('keydown', e => { if (e.key === 'Enter') addWord(); });
  document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => goToScreen(b.dataset.target)));

  const chatInput = document.getElementById('chatInput');
  if (chatInput) chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendChatMessage(); });

  // Privacy: chat history never persists across page loads.
  if (typeof clearChatSession === 'function') clearChatSession();
}

init();
