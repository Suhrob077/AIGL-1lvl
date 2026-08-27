// ========== GAMIFICATION LOOP ==========
// Watches the dictionary state after every practice session. Once 100% of
// the active words are ⭐ starred, present the three-way completion modal.

let masteryModalShown = false; // avoid re-triggering every single render this session

function checkForFullMastery() {
  if (Store.isFullyMastered() && !masteryModalShown) {
    masteryModalShown = true;
    openMasteryModal();
  }
}

function openMasteryModal() {
  document.getElementById('masteryModal').classList.add('active');
}
function closeMasteryModal() {
  document.getElementById('masteryModal').classList.remove('active');
}

/** Option 1: restart the quiz session for the same word set. */
function masteryChoiceRestart() {
  Store.restartSession();
  masteryModalShown = false;
  closeMasteryModal();
  renderWordList();
  renderDashboard();
  showToast("Sessiya qayta boshlandi. Omad! 🚀");
  startPractice();
}

/** Option 2: go create/import a brand-new custom word set. */
function masteryChoiceNewSet() {
  closeMasteryModal();
  masteryModalShown = false;
  goToScreen('home-screen');
  document.getElementById('deInput').focus();
  showToast("Yangi so'zlaringizni pastda qo'shing yoki rasm skanerlang 📷");
}

/** Option 3: fully reset all memory scores & attempt counters to zero. */
function masteryChoiceFullReset() {
  if (confirm("Barcha xotira ballari va urinishlar 0 ga qaytariladi. Davom etasizmi?")) {
    Store.resetAllScores();
    masteryModalShown = false;
    closeMasteryModal();
    renderWordList();
    renderDashboard();
    showToast("Barcha ballar tiklandi ♻️");
    goToScreen('home-screen');
  }
}
