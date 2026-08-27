const express = require('express');
const { z } = require('zod');
const { callClaude } = require('../utils/aiClient');

const router = express.Router();

const historyItemSchema = z.object({
  role: z.enum(['user', 'ai']),
  text: z.string().max(1000),
});

const statsSchema = z.object({
  todayPoints: z.number().optional(),
  todayGoal: z.number().optional(),
  weekTotal: z.number().optional(),
  metDays: z.number().optional(),
}).optional();

const schema = z.object({
  message: z.string().min(1).max(1000),
  history: z.array(historyItemSchema).max(10).optional(),
  mode: z.enum(['general', 'aigl']).optional(),
  stats: statsSchema,
});

/**
 * POST /api/chat
 * body: { message, history? }
 *
 * Stateless by design: nothing here is written to a database or file — the
 * short rolling `history` array is round-tripped from the client's
 * in-memory session state each call and discarded once the response is
 * sent, matching the app's "session privacy" guarantee.
 */
router.post('/', async (req, res, next) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }
    const { message, history = [], mode = 'general', stats } = parsed.data;

    const messages = [
      ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.text })),
      { role: 'user', content: message },
    ];

    const isAigl = mode === 'aigl';
    const statsLine = isAigl && stats
      ? `\n\nUser's current data: today ${stats.todayPoints ?? 0}/${stats.todayGoal ?? 100} points, ` +
        `${stats.metDays ?? 0}/7 goal days met this week, ${stats.weekTotal ?? 0} points this week. ` +
        `Use these numbers naturally when relevant.`
      : '';

    const system = isAigl
      ? `You are "AI-GL", an encouraging progress coach built into a German-Uzbek
vocabulary flashcard app. You ONLY discuss the user's daily/weekly points,
streaks, study habits, and learning strategy for THIS app (e.g. how to hit
their daily goal, how to review hard words, pacing, motivation). Politely
decline anything unrelated to the app's points/learning (e.g. general chit-chat,
unrelated topics) and steer back to their progress. Answer in Uzbek (unless the
user writes in another language), keep replies short (2-4 sentences), be warm
and motivating, never invent numbers not given to you.${statsLine}`
      : `You are a friendly, concise German-Uzbek vocabulary tutor helping inside a
flashcard app. Answer in Uzbek (unless the user writes in another language),
keep replies short (2-4 sentences), and focus on explaining word meanings,
grammar (especially der/die/das articles), and translations.`;

    const reply = await callClaude({
      system,
      maxTokens: 400,
      messages,
    });

    res.json({ reply: reply || "Kechirasiz, javob bera olmadim." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
