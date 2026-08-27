const express = require('express');
const { z } = require('zod');
const { callClaude, extractJson } = require('../utils/aiClient');

const router = express.Router();

const schema = z.object({
  word: z.string().min(1).max(60),
  targetLang: z.string().min(2).max(6).optional(),
});

/**
 * POST /api/article/fix
 * body: { word, targetLang? }
 *
 * Used when a German noun is added without its gender article (der/die/das)
 * and the app's local heuristic table doesn't recognize it. Fire-and-forget
 * from the frontend's perspective — the word is already saved, this just
 * patches it afterward if the AI is confident about the correct article.
 */
router.post('/fix', async (req, res, next) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }
    const { word } = parsed.data;

    // Already has an article — nothing to fix.
    if (/^(der|die|das)\s+/i.test(word.trim())) {
      return res.json({ needsFix: false });
    }

    const raw = await callClaude({
      system: `You are a German grammar assistant. Given a German noun WITHOUT its article,
determine the correct gender article (der, die, or das) and return strict JSON only, no markdown:
{"needsFix": true|false, "fixed": "der/die/das Wort", "explanation": "one short sentence"}
Set needsFix to false only if the input is not a noun or already looks fine as-is.
Capitalize the noun correctly. Keep the explanation under 20 words.`,
      maxTokens: 200,
      messages: [
        { role: 'user', content: `Word: "${word}"` },
      ],
    });

    const parsedJson = extractJson(raw);
    if (!parsedJson.needsFix || !parsedJson.fixed) {
      return res.json({ needsFix: false });
    }

    res.json({
      needsFix: true,
      original: word,
      fixed: parsedJson.fixed,
      explanation: parsedJson.explanation || '',
    });
  } catch (err) {
    // Article-fix is a nice-to-have — fail soft rather than surfacing a 500 to the user.
    res.json({ needsFix: false });
  }
});

module.exports = router;
