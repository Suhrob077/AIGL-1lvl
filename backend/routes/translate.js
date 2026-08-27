const express = require('express');
const { z } = require('zod');
const { callClaude, extractJson } = require('../utils/aiClient');

const router = express.Router();

const schema = z.object({
  text: z.string().min(1).max(200),
  sourceLang: z.string().min(2).max(6),
  targetLang: z.string().min(2).max(6),
});

/**
 * POST /api/translate
 */
router.post('/', async (req, res, next) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }
    const { text, sourceLang, targetLang } = parsed.data;

    const raw = await callClaude({
      system: `You are a precise dictionary translator. Respond ONLY with strict JSON: {"translation": "...", "partOfSpeech": "...", "example": "..."}. No commentary, no markdown.`,
      maxTokens: 300,
      messages: [
        { role: 'user', content: `Translate "${text}" from ${sourceLang} to ${targetLang}. Give a short example sentence in ${sourceLang}.` },
      ],
    });

    const parsedJson = extractJson(raw);
    res.json(parsedJson);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/translate/autofix
 * Automatically checks and prepends German gender articles (der/die/das) to German nouns if missing.
 */
router.post('/autofix', async (req, res, next) => {
  try {
    const autofixSchema = z.object({
      word: z.string().min(1).max(150),
      translation: z.string().optional().default(''),
      sourceLang: z.string().default('de'),
      targetLang: z.string().default('uz'),
      addArticles: z.boolean().default(true),
    });

    const parsed = autofixSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { word, translation, sourceLang, addArticles } = parsed.data;

    if (!addArticles || (sourceLang !== 'de' && !/^[a-zA-ZäöüÄÖÜß\s]+$/.test(word))) {
      return res.json({ original: word, fixed: word, changed: false, explanation: 'No article fix required.' });
    }

    const raw = await callClaude({
      system: `You are an expert German lexicographer. Your task is to auto-correct German words or nouns provided by learners.
If the input word is a German noun missing its definite article (der, die, das), prepend the correct article (e.g., "Familie" -> "die Familie", "Hund" -> "der Hund", "Buch" -> "das Buch").
If it already has an article or is not a German noun, keep it as is.
Return strict JSON format:
{
  "original": "${word}",
  "fixed": "corrected word with article if applicable",
  "changed": true|false,
  "article": "der|die|das|none",
  "explanation": "Short sentence explaining why the article was added/fixed in Uzbek or English."
}`,
      maxTokens: 250,
      messages: [
        { role: 'user', content: `German word to check: "${word}" (Translation context: "${translation}")` },
      ],
    });

    const parsedJson = extractJson(raw);
    res.json(parsedJson);
  } catch (err) {
    // Fallback gracefully if AI is unreachable or fails
    res.json({ original: req.body.word, fixed: req.body.word, changed: false, explanation: 'AI auto-fix skipped.' });
  }
});

/**
 * POST /api/translate/chat
 * AI Chat panel backend endpoint for user feedback and learning discussions.
 * Note: Session privacy rule applies - server does not store chat history!
 */
router.post('/chat', async (req, res, next) => {
  try {
    const chatSchema = z.object({
      messages: z.array(z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().min(1).max(1000),
      })).min(1).max(20),
    });

    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const systemPrompt = "You are a friendly, helpful German & Foreign Language Tutor assistant embedded in a vocabulary learning app. Help the user understand word roots, articles (der/die/das), grammar rules, and translations clearly and concisely in Uzbek or simple English.";

    const raw = await callClaude({
      system: systemPrompt,
      maxTokens: 500,
      messages: parsed.data.messages,
    });

    res.json({ reply: raw });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
