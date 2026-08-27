const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const { callClaude, extractJson } = require('../utils/aiClient');
const { visionLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const MAX_IMAGE_MB = Number(process.env.MAX_IMAGE_SIZE_MB) || 6;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Unsupported image type. Use JPEG, PNG, or WEBP.'));
    }
    cb(null, true);
  },
});

const LANG_CODE = /^[a-z]{2}(-[A-Z]{2})?$/;

const bodySchema = z.object({
  sourceLang: z.string().regex(LANG_CODE, 'Invalid source language code'),
  targetLang: z.string().regex(LANG_CODE, 'Invalid target language code'),
});

const LANG_NAMES = {
  de: 'German', uz: 'Uzbek', en: 'English', ru: 'Russian',
  tr: 'Turkish', es: 'Spanish', fr: 'French', it: 'Italian',
};

function langName(code) {
  return LANG_NAMES[code.slice(0, 2).toLowerCase()] || code;
}

/**
 * POST /api/vision/scan
 * multipart/form-data: image=<file>, sourceLang=de, targetLang=uz
 *
 * Strictly extracts dictionary-style entries (word + its listed
 * translation/definition) from the image. Ignores prose, ads, unrelated
 * text, and anything that is not a vocabulary/dictionary entry. Validates
 * that the detected text plausibly matches the requested source language
 * before accepting it.
 */
router.post('/scan', visionLimiter, upload.single('image'), async (req, res, next) => {
  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded.' });
    }

    const { sourceLang, targetLang } = parsed.data;
    const base64 = req.file.buffer.toString('base64');

    const system = `You are a strict dictionary-scanning OCR assistant.
Rules:
1. ONLY extract text that is a dictionary entry or vocabulary-list entry: a headword plus its translation/definition (e.g. "Wasser - water", numbered vocab lists, glossary columns).
2. IGNORE any other text in the image: ads, page numbers, unrelated paragraphs, prose, captions.
3. The headwords MUST plausibly be written in ${langName(sourceLang)}. If the dominant visible language does not match, return an empty list rather than guessing.
4. Output ONLY strict JSON, no commentary, no markdown fences, in this exact shape:
{"detectedLanguageMatch": true|false, "entries": [{"source": "word in ${langName(sourceLang)}", "target": "translation in ${langName(targetLang)}"}]}
5. If you are not confident an entry is a genuine dictionary/vocabulary pair, omit it. Do not invent entries that are not visible in the image.`;

    const raw = await callClaude({
      system,
      maxTokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: req.file.mimetype, data: base64 } },
            { type: 'text', text: `Extract dictionary entries. Source language: ${langName(sourceLang)}. Target language: ${langName(targetLang)}.` },
          ],
        },
      ],
    });

    const parsedJson = extractJson(raw);
    const entries = Array.isArray(parsedJson.entries) ? parsedJson.entries : [];

    const clean = entries
      .filter(e => e && typeof e.source === 'string' && typeof e.target === 'string')
      .map(e => ({ source: e.source.trim(), target: e.target.trim() }))
      .filter(e => e.source && e.target)
      .slice(0, 60);

    res.json({
      detectedLanguageMatch: Boolean(parsedJson.detectedLanguageMatch),
      count: clean.length,
      entries: clean,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
