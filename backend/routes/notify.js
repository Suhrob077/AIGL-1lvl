const express = require('express');
const { z } = require('zod');
const { runDailyCheck, isConfigured, publicKey } = require('../utils/dailyCheck');
const store = require('../utils/pushStore');

const router = express.Router();

router.get('/vapid-public-key', (req, res) => {
  if (!isConfigured) return res.json({ publicKey: '' });
  res.json({ publicKey });
});

const subscribeSchema = z.object({
  deviceId: z.string().min(4).max(120),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string(), auth: z.string() }),
  }),
});

router.post('/subscribe', (req, res) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
  store.upsertSubscription(parsed.data.deviceId, parsed.data.subscription);
  res.json({ ok: true });
});

const unsubscribeSchema = z.object({ deviceId: z.string().min(4).max(120) });
router.post('/unsubscribe', (req, res) => {
  const parsed = unsubscribeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });
  store.removeSubscription(parsed.data.deviceId);
  res.json({ ok: true });
});

const progressSchema = z.object({
  deviceId: z.string().min(4).max(120),
  date: z.string().min(8).max(10),
  points: z.number().min(0),
  goal: z.number().min(0),
});
router.post('/progress', (req, res) => {
  const parsed = progressSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });
  const { deviceId, date, points, goal } = parsed.data;
  store.recordProgress(deviceId, date, points, goal);
  res.json({ ok: true });
});

/**
 * GET /api/notify/check-daily
 *
 * Meant to be called once a day by a scheduler (Vercel Cron on production,
 * or any cron/task-runner when self-hosting) — NOT by the app itself. For
 * every device with a stored push subscription: if YESTERDAY's recorded
 * points fell short of that day's goal, and we haven't already notified
 * this device today, send a push telling them their (rolled-over) target
 * for today. Dead subscriptions (410/404 from the push service) are
 * cleaned up automatically.
 */
router.get('/check-daily', async (req, res) => {
  const result = await runDailyCheck();
  res.json(result);
});

module.exports = router;
