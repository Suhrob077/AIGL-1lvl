const { webpush, isConfigured, publicKey } = require('./webPush');
const store = require('./pushStore');

/**
 * For every device with a stored push subscription: if YESTERDAY's
 * recorded points fell short of that day's goal, and we haven't already
 * notified this device today, send a push telling them their (rolled-over)
 * target for today. Dead subscriptions (404/410 from the push service) are
 * cleaned up automatically. Safe to call as often as you like — it's a
 * no-op for devices already notified today or that met their goal.
 */
async function runDailyCheck() {
  if (!isConfigured) {
    return { ok: false, reason: 'VAPID keys not configured on the server.' };
  }

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const devices = store.getAllDevices();
  let sent = 0, skipped = 0, cleaned = 0;

  for (const d of devices) {
    if (!d.subscription) { skipped++; continue; }
    if (d.lastNotifiedDate === today) { skipped++; continue; }
    const yRecord = d.progress && d.progress[yesterday];
    if (!yRecord || yRecord.points >= yRecord.goal) { skipped++; continue; }

    const tRecord = d.progress && d.progress[today];
    const todayGoal = tRecord ? tRecord.goal : (yRecord.goal - yRecord.points) + yRecord.goal;

    const payload = JSON.stringify({
      title: "📚 So'z O'rganish — kunlik norma",
      body: `Siz kecha kunlik normani bajarmadingiz. Bugun ${todayGoal} ball to'plashingiz lozim!`,
      url: '/',
    });

    try {
      await webpush.sendNotification(d.subscription, payload);
      store.markNotified(d.deviceId, today);
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        store.removeSubscription(d.deviceId);
        cleaned++;
      }
      skipped++;
    }
  }

  return { ok: true, sent, skipped, cleaned, totalDevices: devices.length };
}

module.exports = { runDailyCheck, isConfigured, publicKey };
