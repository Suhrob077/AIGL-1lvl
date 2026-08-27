// ========== INFO-USER DASHBOARD ==========

function renderDashboard() {
  const starred = Store.starredWords();
  const hard = Store.hardWords();
  const total = Store.words.length;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statStarred').textContent = starred.length;
  document.getElementById('statHard').textContent = hard.length;

  renderMiniTable('starredTableBody', starred, '⭐');
  renderMiniTable('hardTableBody', hard, '⚠️');

  document.getElementById('starredEmpty').style.display = starred.length ? 'none' : 'block';
  document.getElementById('hardEmpty').style.display = hard.length ? 'none' : 'block';

  const pct = total ? Math.round((starred.length / total) * 100) : 0;
  document.getElementById('masteryFill').style.width = pct + '%';
  document.getElementById('masteryPct').textContent = pct + '%';
}

function renderMiniTable(bodyId, list, icon) {
  const body = document.getElementById(bodyId);
  body.innerHTML = '';
  list
    .slice()
    .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
    .forEach(w => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${icon} <b>${escapeHtml(w.source)}</b></td>
        <td>${escapeHtml(w.target)}</td>
        <td><span class="attempt-pill" title="Urinishlar soni">${w.attempts}×</span></td>
      `;
      body.appendChild(tr);
    });
}
