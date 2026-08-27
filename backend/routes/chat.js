const express = require('express');
const { z } = require('zod');
const { callClaude } = require('../utils/aiClient');

const router = express.Router();

const historyItemSchema = z.object({
  role: z.enum(['user', 'ai']),
  text: z.string().max(1000),
});

const schema = z.object({
  message: z.string().min(1).max(1000),
  history: z.array(historyItemSchema).max(10).optional(),
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
    const { message, history = [] } = parsed.data;

    const messages = [
      ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.text })),
      { role: 'user', content: message },
    ];

    const reply = await callClaude({
      system: `You are a friendly, concise German-Uzbek vocabulary tutor helping inside a
flashcard app. Answer in Uzbek (unless the user writes in another language),
keep replies short (2-4 sentences), and focus on explaining word meanings,
grammar (especially der/die/das articles), and translations.`,
      maxTokens: 400,
      messages,
    });

    res.json({ reply: reply || "Kechirasiz, javob bera olmadim." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
