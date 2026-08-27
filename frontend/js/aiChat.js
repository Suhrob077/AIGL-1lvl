// ========== SESSION-ONLY AI CHAT DRAWER ==========
// Privacy rule: chat history lives ONLY in this in-memory array. It is
// never written to localStorage, so it disappears the moment the page is
// refreshed or the tab is closed — matches the Settings privacy notice.

let chatHistory = []; // { role: 'user'|'ai', text }[]
let chatSending = false;
let chatMode = 'general'; // 'general' (word/grammar tutor) | 'aigl' (points & learning advisor)

function openChatDrawer(prefill, mode) {
  chatMode = mode || 'general';
  const titleEl = document.getElementById('chatDrawerTitle');
  if (titleEl) titleEl.textContent = chatMode === 'aigl' ? '🤖 AI-GL — Ballar va maslahat' : '💬 AI bilan suhbat';
  document.getElementById('chatDrawerBackdrop').classList.add('active');
  document.getElementById('chatDrawer').classList.add('active');
  if (prefill && !chatHistory.length) {
    document.getElementById('chatInput').value = prefill;
  }
  setTimeout(() => document.getElementById('chatInput').focus(), 150);
}

/** Settings > AI-GL entry point: opens the chat drawer scoped to points,
 *  progress and learning-strategy advice, with today's/weekly stats sent
 *  as context (never persisted — same session-only rule as the rest of chat). */
function openAiglChat() {
  chatHistory = [];
  const today = (typeof getTodayProgress === 'function') ? getTodayProgress() : { points: 0, goal: 100 };
  const weekDays = (typeof buildWeekData === 'function') ? buildWeekData(new Date()) : [];
  const weekTotal = weekDays.reduce((sum, d) => sum + (d.points || 0), 0);
  const metDays = weekDays.filter(d => d.status === 'met' || d.status === 'over').length;

  chatHistory.push({
    role: 'ai',
    text: `Salom! Men AI-GL — ballaringiz va o'rganish jarayoningiz bo'yicha yordamchiman. Bugun ${today.points}/${today.goal} ball to'pladingiz, shu hafta ${metDays}/7 kun normani bajardingiz (jami ${weekTotal} ball). Nima haqida gaplashamiz?`,
  });

  window._aiglStats = { todayPoints: today.points, todayGoal: today.goal, weekTotal, metDays };
  openChatDrawer(null, 'aigl');
  renderChatMessages();
}

function closeChatDrawer() {
  document.getElementById('chatDrawerBackdrop').classList.remove('active');
  document.getElementById('chatDrawer').classList.remove('active');
}

function renderChatMessages() {
  const box = document.getElementById('chatMessages');
  box.innerHTML = chatHistory.map(m => `
    <div class="chat-msg ${m.role === 'user' ? 'user' : 'ai'}">${escapeHtml(m.text)}</div>
  `).join('');
  box.scrollTop = box.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || chatSending) return;

  chatHistory.push({ role: 'user', text });
  input.value = '';
  renderChatMessages();

  chatSending = true;
  chatHistory.push({ role: 'ai', text: '…' });
  renderChatMessages();

  try {
    const res = await fetch(`${Store.settings.apiBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: chatHistory.slice(0, -1).slice(-8), // small rolling window, never persisted
        mode: chatMode,
        stats: chatMode === 'aigl' ? window._aiglStats : undefined,
      }),
    });
    const data = await res.json();
    chatHistory[chatHistory.length - 1] = { role: 'ai', text: data.reply || "Kechirasiz, javob topilmadi." };
  } catch (e) {
    chatHistory[chatHistory.length - 1] = { role: 'ai', text: "Server bilan bog'lanib bo'lmadi." };
  } finally {
    chatSending = false;
    renderChatMessages();
  }
}

/** Called on app init/refresh to guarantee zero persistence across sessions. */
function clearChatSession() {
  chatHistory = [];
  const box = document.getElementById('chatMessages');
  if (box) box.innerHTML = '';
}

// ========== PRACTICE-SCREEN AI ANSWER FEEDBACK ==========
// After every checkAnswer() in the practice screen (right OR wrong), ask
// the backend for one short reaction and show it as a small dismissible
// popup — same "Skip" / "Chat" pattern as the article-fix suggestion.
// Best-effort only: never blocks or delays the practice flow, and quietly
// does nothing if the backend/API key isn't available.

let lastAnswerComment = { promptText: '', correctText: '', comment: '' };

async function requestAnswerComment(promptText, correctText, userAnswer, isCorrect) {
  try {
    const res = await fetch(`${Store.settings.apiBaseUrl}/api/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: promptText, correctAnswer: correctText, userAnswer, isCorrect }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.comment) showAiAnswerComment(promptText, correctText, data.comment);
  } catch (e) {
    console.warn('AI answer feedback unavailable:', e);
  }
}

function showAiAnswerComment(promptText, correctText, comment) {
  lastAnswerComment = { promptText, correctText, comment };
  document.getElementById('aiAnswerMsg').textContent = comment;
  const box = document.getElementById('aiAnswerToast');
  box.classList.add('show');
  clearTimeout(showAiAnswerComment._t);
  showAiAnswerComment._t = setTimeout(() => box.classList.remove('show'), 9000);
}

function dismissAiAnswerComment() {
  document.getElementById('aiAnswerToast').classList.remove('show');
}

function openChatAboutAnswer() {
  document.getElementById('aiAnswerToast').classList.remove('show');
  if (!chatHistory.length && lastAnswerComment.comment) {
    chatHistory.push({ role: 'ai', text: lastAnswerComment.comment });
  }
  const intro = lastAnswerComment.promptText
    ? `"${lastAnswerComment.promptText}" so'zi haqida ko'proq bilmoqchiman.`
    : "So'zlar haqida savolim bor.";
  document.getElementById('chatInput').value = intro;
  openChatDrawer();
  renderChatMessages();
}

// ========== END-OF-SESSION AI SUMMARY + SCORE ==========
// Called once when a game/practice/sentence session finishes. Shows a
// "AI fikri yozilmoqda..." placeholder immediately, then fills in the
// real comment once the backend responds. Never blocks navigation.
async function requestSessionSummary(mode, score, total, wrongItems, targetElId) {
  const el = document.getElementById(targetElId);
  if (!el) return;
  el.style.display = 'block';
  el.textContent = '🤖 AI fikr yozmoqda...';

  try {
    const res = await fetch(`${Store.settings.apiBaseUrl}/api/feedback/summary`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode,
        score,
        total,
        missed: (wrongItems || []).slice(0, 5),
      }),
    });
    if (!res.ok) throw new Error('bad status');
    const data = await res.json();
    el.textContent = data.comment ? `🤖 ${data.comment}` : '';
    if (!data.comment) el.style.display = 'none';
  } catch (e) {
    el.style.display = 'none';
  }
}
