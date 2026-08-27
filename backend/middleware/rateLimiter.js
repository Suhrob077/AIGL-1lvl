const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter — applied to every route.
 * Protects the AI provider quota / cost and mitigates abuse & scraping.
 */
const generalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again shortly.' },
});

/**
 * Tighter limiter for the vision/OCR endpoint specifically, since image
 * analysis calls are the most expensive and the most attractive to abuse.
 */
const visionLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max: Number(process.env.VISION_RATE_LIMIT_MAX_REQUESTS) || 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many image-scan requests. Please wait a minute before scanning again.' },
});

module.exports = { generalLimiter, visionLimiter };
