require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const { generalLimiter } = require('./middleware/rateLimiter');
const visionRoute = require('./routes/vision');
const translateRoute = require('./routes/translate');
const gameRoute = require('./routes/game');
const articleRoute = require('./routes/article');
const chatRoute = require('./routes/chat');
const feedbackRoute = require('./routes/feedback');
const sentenceRoute = require('./routes/sentence');
const notifyRoute = require('./routes/notify');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// ---- Security hardening ----
app.disable('x-powered-by');
// contentSecurityPolicy disabled here because we now also serve the static
// frontend from this same server — its inline onclick="" handlers would be
// blocked by helmet's default CSP. The /api/* JSON responses don't need CSP.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' })); // small limit: images go through multer, not JSON body
app.use(morgan(isProd ? 'combined' : 'dev'));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow same-origin / server-to-server (no Origin header) requests, and
    // requests with no explicit allow-list configured.
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // In development, don't hard-fail on origin mismatches (localhost vs
    // 127.0.0.1, different dev-server ports, file:// -> "null" origin, the
    // phone's LAN IP, etc. are all extremely common while testing locally).
    // Production deployments should always set ALLOWED_ORIGINS explicitly.
    if (!isProd) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
}));

// Global rate limit on every route (vision route also has its own stricter limit)
app.use(generalLimiter);

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/vision', visionRoute);
app.use('/api/translate', translateRoute);
app.use('/api/game', gameRoute);
app.use('/api/article', articleRoute);
app.use('/api/chat', chatRoute);
app.use('/api/feedback', feedbackRoute);
app.use('/api/sentence', sentenceRoute);
app.use('/api/notify', notifyRoute);

// ---- Serve the frontend from the SAME server/origin as the API ----
// This is the simplest fix for CORS/"host" confusion: open
// http://localhost:8787 (or PORT below) directly, no separate static
// server or Settings > Backend host configuration required.
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Centralized error handler — never leak stack traces or the API key to clients
app.use((err, req, res, next) => {
  console.error(err.message);
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Image too large.' });
  }
  const status = err.status || 500;
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`Vocab AI backend listening on :${PORT}`);
});

// ---- Internal daily-goal push scheduler (self-hosted/local only) ----
// This only works here because `npm start` keeps one Node process running
// continuously. On Vercel this file isn't even loaded (api/index.js is
// used instead) — there, wire Vercel Cron to hit /api/notify/check-daily
// on a schedule instead (see vercel.json).
const { runDailyCheck } = require('./utils/dailyCheck');
setInterval(() => {
  runDailyCheck().catch(err => console.warn('Daily push check failed:', err.message));
}, 60 * 60 * 1000); // once an hour is enough — the check itself is idempotent per day
