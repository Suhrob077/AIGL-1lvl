// ========== VERCEL SERVERLESS ENTRY POINT ==========
// This file is ONLY used when deployed on Vercel (see /vercel.json). It is a
// deliberately separate, slimmer copy of backend/server.js:
//  - No app.listen() — Vercel calls the exported `app` per request instead.
//  - No static frontend serving/catch-all — Vercel serves everything under
//    /frontend as plain static files directly (see vercel.json routes),
//    which is faster and simpler than routing it through this function.
// backend/server.js (with `npm start`) is untouched and still works exactly
// as before for local development.

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const { generalLimiter } = require('../backend/middleware/rateLimiter');
const visionRoute = require('../backend/routes/vision');
const translateRoute = require('../backend/routes/translate');
const gameRoute = require('../backend/routes/game');
const articleRoute = require('../backend/routes/article');
const chatRoute = require('../backend/routes/chat');
const feedbackRoute = require('../backend/routes/feedback');
const sentenceRoute = require('../backend/routes/sentence');
const notifyRoute = require('../backend/routes/notify');

const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));

// Frontend and API live on the same Vercel domain, so a permissive CORS
// policy here is safe (no cookies/auth are involved — the API key never
// leaves the server).
app.use(cors({ origin: true }));

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

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  console.error(err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Image too large.' });
  }
  const status = err.status || 500;
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
});

module.exports = app;
