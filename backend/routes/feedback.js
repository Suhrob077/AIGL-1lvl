const express = require('express');
const { z } = require('zod');
const { callClaude, extractJson } = require('../utils/aiClient');

const router = express.Router();

const schema = z.object({
  prompt: z.string().min(1).max(120),
  correctAnswer: z.string().min(1).max(120),
  userAnswer: z.string().min(1).max(120),
  isCorrect: z.boolean(),
});

/**
 * POST /api/feedback
 * body: { prompt, correctAnswer, userAnswer, isCorrect }
 *
 * A one-off, ultra-short AI reaction to a single practice-screen flashcard
 * attempt (right OR wrong), shown as a small dismissible popup with a
 * "Javob berish" (reply -> opens the chat drawer) / "O'tkazib yuborish"
 * (skip) choice. Unlike /api/chat this is fire-and-forget: it never blocks
 * or delays the practice flow (checkAnswer() already advances on its own
 * timers regardless of whether/when this responds).
 */
router.post('/', async (req, res, next) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }
    const { prompt, correctAnswer, userAnswer, isCorrect } = parsed.data;

    const raw = await callClaude({
      system: `You are a warm, concise German-Uzbek vocabulary tutor reacting to ONE flashcard
attempt inside a practice app. Reply in Uzbek, at most one short sentence (max ~20 words).
If the answer was correct: briefly praise it and add one small useful tidbit (a usage note,
memory hint, related word, or fun fact about the word). If it was wrong: be encouraging and
warm (never harsh), gently point out the mistake, and give one short concrete tip to help
remember the correct word next time. Output STRICT JSON only, no markdown fences:
{"comment": "..."}`,
      maxTokens: 150,
      messages: [
        {
          role: 'user',
          content: `So'z (savol): "${prompt}"\nTo'g'ri javob: "${correctAnswer}"\nFoydalanuvchi javobi: "${userAnswer}"\nNatija: ${isCorrect ? "to'g'ri" : "noto'g'ri"}`,
        },
      ],
    });

    const parsedJson = extractJson(raw);
    res.json({ comment: (parsedJson && parsedJson.comment) || '' });
  } catch (err) {
    // Best-effort feature only — never surface a 500 to the practice screen.
    res.json({ comment: '' });
  }
});

const summarySchema = z.object({
  mode: z.enum(['game', 'practice', 'sentence']),
  score: z.number().min(0),
  total: z.number().min(0),
  missed: z.array(z.object({
    prompt: z.string().max(200),
    correct: z.string().max(200),
  })).max(5).optional().default([]),
});

/**
 * POST /api/feedback/summary
 * body: { mode, score, total, missed: [{prompt, correct}] }
 *
 * A short AI review shown once at the END of a whole session (word game,
 * practice run, or sentence-translation session) — separate from the
 * per-round /api/feedback reactions. Reviews overall performance and gives
 * the user encouragement/advice, mentioning 1-2 missed items by name if any
 * were given. Fire-and-forget: never surfaces a 500, always returns JSON.
 */
router.post('/summary', async (req, res, next) => {
  try {
    const parsed = summarySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }
    const { mode, score, total, missed } = parsed.data;
    const modeLabel = { game: "so'z o'yini", practice: 'lug\'at mashqi', sentence: "gaplarni tarjima qilish mashqi" }[mode];
    const missedLines = missed.length
      ? missed.map(m => `- "${m.prompt}" -> to'g'ri javob: "${m.correct}"`).join('\n')
      : '(xato bo\'lmadi — hammasi to\'g\'ri)';

    const raw = await callClaude({
      system: `Siz iliq, motivatsion til o'qituvchisisiz. Foydalanuvchi bir mashqni (${modeLabel})
tugatdi. Unga umumiy natija haqida qisqa (2-3 gap) fikr bildiring: umumiy darajasini
baholang, agar xato so'zlar/gaplar bo'lsa 1-2 tasini nomlab qisqa maslahat bering, va uni
rag'batlantiring. Iliq va samimiy ohangda, o'zbek tilida yozing. Faqat quyidagi qat'iy JSON
formatida javob bering, boshqa hech narsa yozmang: {"comment": "..."}`,
      maxTokens: 220,
      messages: [
        {
          role: 'user',
          content: `Natija: ${score} / ${total} to'g'ri.\nXato bo'lgan javoblar:\n${missedLines}`,
        },
      ],
    });

    const parsedJson = extractJson(raw);
    res.json({ comment: (parsedJson && parsedJson.comment) || '' });
  } catch (err) {
    res.json({ comment: '' });
  }
});

module.exports = router;
