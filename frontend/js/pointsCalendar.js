// ========== KUNLIK BALLAR — HAFTA / OY KO'RINISHI ==========
// Renders the "Kunlik ballaringiz" widget in Settings: a Monday-Sunday
// strip with points per day, plus an "All days" modal with a full month
// calendar. Tapping any day (in either view) opens a small popup that
// explains whether the goal was met, exceeded, or missed that day.

const WEEKDAY_LABELS_UZ = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya']; // Monday..Sunday
const MONTH_NAMES_UZ = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

let calendarViewDate = new Date();

/** Monday (00:00) of the week containing `date`. */
function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 'empty' (no record), 'under' (goal missed), 'met' (goal reached),
 *  'over' (goal reached by a wide margin). */
function dayStatus(rec) {
  if (!rec || !rec.goal) return 'empty';
  if (rec.points >= rec.goal * 1.5) return 'over';
  if (rec.points >= rec.goal) return 'met';
  return 'under';
}

function buildWeekData(anchorDate) {
  const store = loadDailyStore();
  const monday = startOfWeek(anchorDate);
  const todayStr = todayKey();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const key = dateKeyFor(d);
    const rec = store[key];
    days.push({
      key,
      label: WEEKDAY_LABELS_UZ[i],
      dayNum: d.getDate(),
      points: rec ? rec.points : 0,
      isToday: key === todayStr,
      status: dayStatus(rec),
    });
  }
  return days;
}

/** Renders the 7-day strip in Settings (id="weekPointsStrip"). No-op if
 *  the element isn't on the current screen. */
function renderWeekStrip() {
  const el = document.getElementById('weekPointsStrip');
  if (!el) return;
  const days = buildWeekData(new Date());
  el.innerHTML = days.map(d => `
    <div class="week-day status-${d.status}${d.isToday ? ' today' : ''}" onclick="showDayInfo('${d.key}')">
      <div class="wd-label">${d.label}</div>
      <div class="wd-badge">${d.status === 'empty' ? '–' : d.points}</div>
      <div class="wd-date">${d.dayNum}</div>
    </div>
  `).join('');
}

// ---------- All-days (monthly) modal ----------

function openAllDaysModal() {
  calendarViewDate = new Date();
  renderMonthCalendar();
  document.getElementById('allDaysModal').classList.add('active');
}

function closeAllDaysModal() {
  document.getElementById('allDaysModal').classList.remove('active');
}

function shiftCalendarMonth(delta) {
  calendarViewDate.setMonth(calendarViewDate.getMonth() + delta);
  renderMonthCalendar();
}

function renderMonthCalendar() {
  const grid = document.getElementById('monthGrid');
  if (!grid) return;

  const store = loadDailyStore();
  const year = calendarViewDate.getFullYear();
  const month = calendarViewDate.getMonth();
  document.getElementById('monthTitle').textContent = `${MONTH_NAMES_UZ[month]} ${year}`;

  const hdEl = document.getElementById('monthWeekdayHeader');
  if (hdEl && !hdEl.dataset.filled) {
    hdEl.innerHTML = WEEKDAY_LABELS_UZ.map(l => `<div class="month-weekday-hd">${l}</div>`).join('');
    hdEl.dataset.filled = '1';
  }

  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7; // 0=Mon..6=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = todayKey();

  let cells = '';
  for (let i = 0; i < firstWeekday; i++) cells += `<div class="month-day empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const key = dateKeyFor(d);
    const rec = store[key];
    const status = dayStatus(rec);
    const isToday = key === todayStr;
    cells += `
      <div class="month-day status-${status}${isToday ? ' today' : ''}" onclick="showDayInfo('${key}')">
        <div class="md-num">${day}</div>
        <div class="md-pts">${rec ? rec.points : '–'}</div>
      </div>`;
  }
  grid.innerHTML = cells;
}

// ---------- Day-info popup (shared by week strip + month grid) ----------

function formatDateUz(d) {
  return `${d.getDate()} ${MONTH_NAMES_UZ[d.getMonth()]}`;
}

function showDayInfo(key) {
  const store = loadDailyStore();
  const rec = store[key];
  const d = new Date(key + 'T00:00:00');
  const title = formatDateUz(d);
  const todayStr = todayKey();

  const emojiEl = document.getElementById('dayInfoEmoji');
  const titleEl = document.getElementById('dayInfoTitle');
  const textEl = document.getElementById('dayInfoText');

  if (!rec) {
    emojiEl.textContent = key > todayStr ? '⏳' : '😴';
    titleEl.textContent = title;
    textEl.textContent = key > todayStr
      ? "Bu kun hali kelmagan."
      : "Bu kuni hech qanday ball to'planmagan.";
  } else {
    const diff = rec.points - rec.goal;
    titleEl.textContent = `${title} — ${rec.points} / ${rec.goal} ball`;
    if (diff >= 0) {
      emojiEl.textContent = diff === 0 ? '🎯' : (rec.points >= rec.goal * 1.5 ? '🚀' : '✅');
      textEl.textContent = diff === 0
        ? `Aynan kunlik normani (${rec.goal} ball) bajardingiz!`
        : `Kunlik normadan ${diff} ball ortiqcha bajardingiz. 🔥`;
    } else {
      emojiEl.textContent = '⚠️';
      textEl.textContent = `Kunlik norma (${rec.goal} ball) bajarilmadi — ${Math.abs(diff)} ball yuklama sifatida ertasi kunga qoldi.`;
    }
  }
  document.getElementById('dayInfoModal').classList.add('active');
}

function closeDayInfoModal() {
  document.getElementById('dayInfoModal').classList.remove('active');
}
