// ========== NOTIFICATIONS ("kunlik norma" reminders) ==========
// Two layers, from most to least reliable:
//  1. LOCAL reminder: whenever the app is opened and yesterday's goal was
//     missed, we show an in-app banner AND (if permission is already
//     granted) fire an immediate browser Notification. This works with NO
//     backend at all, but only while the user actually opens the app.
//  2. REAL PUSH (best-effort): if the user taps "Bildirishnomalarni
//     yoqish", we register a Service Worker and subscribe to Web Push via
//     the backend's /api/notify/* endpoints + a VAPID keypair, so a
//     notification can in principle arrive even when the app/tab is
//     closed, whenever the backend's daily check finds the goal was
//     missed. This layer needs a server that runs `check-daily` on a
//     schedule (see backend/routes/notify.js) and HTTPS in production —
//     see README notes for platform caveats (iOS Home-Screen requirement,
//     serverless storage, etc).

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/** Immediate, local-only notification — no server round trip needed. */
function showLocalReminderNotification(msg) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification("📚 So'z O'rganish — kunlik norma", {
      body: msg,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
    });
    n.onclick = () => { window.focus(); n.close(); };
  } catch (e) { /* some platforms only allow Notifications via a Service Worker — ignore */ }
}

async function enableNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    showToast("Bu brauzer bildirishnomalarni qo'llab-quvvatlamaydi.");
    return;
  }

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    showToast("Bildirishnoma uchun ruxsat berilmadi.");
    return;
  }

  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;

    const keyRes = await fetch(`${Store.settings.apiBaseUrl}/api/notify/vapid-public-key`);
    const { publicKey } = await keyRes.json();
    if (!publicKey) throw new Error('Server VAPID kalitini bermadi.');

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    await fetch(`${Store.settings.apiBaseUrl}/api/notify/subscribe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceId: getDeviceId(), subscription: sub }),
    });

    Store.settings.notificationsEnabled = true;
    Store.saveSettings();
    updateNotificationToggleUI();
    showToast('Bildirishnomalar yoqildi ✅');
    syncProgressToServer();
  } catch (e) {
    console.warn('Push subscribe failed:', e);
    showToast("Bildirishnomani yoqib bo'lmadi. Backend ishga tushganini tekshiring.");
  }
}

async function disableNotifications() {
  Store.settings.notificationsEnabled = false;
  Store.saveSettings();
  updateNotificationToggleUI();
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg && await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    }
    fetch(`${Store.settings.apiBaseUrl}/api/notify/unsubscribe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceId: getDeviceId() }),
    }).catch(() => {});
  } catch (e) { /* best effort */ }
  showToast('Bildirishnomalar o\'chirildi');
}

function updateNotificationToggleUI() {
  const btn = document.getElementById('notifToggleBtn');
  if (!btn) return;
  const on = !!Store.settings.notificationsEnabled;
  btn.textContent = on ? '🔕 Bildirishnomani o\'chirish' : '🔔 Bildirishnomani yoqish';
  btn.onclick = on ? disableNotifications : enableNotifications;
}

/** Best-effort: tells the backend how many points this device has today
 *  (and its goal), so the server-side daily check can decide whether to
 *  push a reminder. Silently does nothing if the backend is unreachable —
 *  this must never block or break the app's local functionality. */
async function syncProgressToServer() {
  if (!Store.settings.notificationsEnabled) return;
  try {
    const { points, goal } = getTodayProgress();
    await fetch(`${Store.settings.apiBaseUrl}/api/notify/progress`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceId: getDeviceId(), date: todayKey(), points, goal }),
    });
  } catch (e) { /* best effort */ }
}
