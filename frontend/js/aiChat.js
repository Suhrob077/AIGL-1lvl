// ========== SESSION-ONLY AI CHAT DRAWER ==========
// Privacy rule: chat history lives ONLY in this in-memory array. It is
// never written to localStorage, so it disappears the moment the page is
// refreshed or the tab is closed — matches the Settings privacy notice.

let chatHistory = []; // { role: 'user'|'ai', text }[]
let chatSending = false;

function openChatDrawer(prefill) {
  document.getElementById('chatDrawerBackdrop').classList.add('active');
  document.getElementById('chatDrawer').classList.add('active');
  if (prefill && !chatHistory.length) {
    document.getElementById('chatInput').value = prefill;
  }
  setTimeout(() => document.getElementById('chatInput').focus(), 150);
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
