const express = require('express');
const { z } = require('zod');
const { callClaude, extractJson } = require('../utils/aiClient');

const router = express.Router();

const LANG_NAMES = {
  de: 'nemis (Deutsch)',
  uz: "o'zbek",
  en: 'ingliz (English)',
  ru: 'rus (русский)',
  tr: 'turk (Türkçe)',
};
function langName(code) { return LANG_NAMES[code] || code; }

const wordSchema = z.object({
  source: z.string().min(1).max(120),
  target: z.string().min(1).max(120),
});

const schema = z.object({
  words: z.array(wordSchema).min(1).max(300),
  promptLang: z.string().min(2).max(5),
  answerLang: z.string().min(2).max(5),
});

/**
 * POST /api/sentence/build
 * body: { words: [{source, target}], promptLang, answerLang }
 *
 * "Gaplarni tarjima qilish" mode: asks the AI to compose ONE short, natural,
 * everyday sentence whose meaningful words (nouns/verbs/adjectives) come
 * from the user's OWN saved vocabulary as much as possible, written out in
 * `answerLang` (this is what the player reconstructs, word by word) plus its
 * natural translation into `promptLang` (shown on-screen as the prompt).
 *
 * If the saved vocabulary is too sparse or thematically mismatched to
 * support any coherent everyday sentence, the AI is told to say so instead
 * of inventing one — surfaced to the client as { possible: false, message }.
 */
router.post('/build', async (req, res, next) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }
    const { words, promptLang, answerLang } = parsed.data;

    // Keep the vocab list compact in the prompt.
    const vocabLines = words.slice(0, 120).map(w => `${w.source} = ${w.target}`).join('\n');

    let raw;
    try {
      raw = await callClaude({
      system: `Siz til o'qituvchisisiz. Foydalanuvchining shaxsiy lug'atidagi so'zlardan
foydalanib, kundalik hayotda ishlatiladigan, tabiiy va qisqa (4-9 so'zli) bitta gap tuzing.
Gapning ma'noli qismlari (ot, fe'l, sifat) IMKON QADAR foydalanuvchi lug'atidagi so'zlardan
bo'lishi kerak; artikl, old qo'shimcha, olmosh, bog'lovchi kabi grammatik yordamchi so'zlarni
qo'shishga ruxsat etiladi (bular lug'atda bo'lmasligi tabiiy). Agar lug'atdagi so'zlar
birorta ham tabiiy, kundalik gap tuzish uchun yetarli yoki mos bo'lmasa (masalan juda kam,
yoki bir-biriga mutlaqo bog'liq bo'lmagan so'zlar bo'lsa), gap TO'QIB CHIQARMANG — buning
o'rniga "possible": false qaytaring.

Gapni "${langName(answerLang)}" tilida yozing (bu — javob tili, o'yinchi buni so'zlarni
tartib bilan tanlab qayta tuzadi). So'ngra shu gapni "${langName(promptLang)}" tiliga
tabiiy tarzda tarjima qiling (bu — o'yinchiga savol sifatida ko'rsatiladigan matn).
"${langName(answerLang)}" tilidagi gapni so'zma-so'z (token) massivga ham ajratib bering —
har bir elementi bitta so'z (kerak bo'lsa oxiridagi tinish belgisi bilan birga: "kuningiz",
"o'tdi?"), token'lar gapdagi TO'G'RI tartibda bo'lsin.

Faqat quyidagi qat'iy JSON formatida javob bering, hech qanday izoh, tushuntirish yoki
markdown belgisisiz:
{"possible": true, "promptSentence": "...", "answerSentence": "...", "answerTokens": ["...", "..."]}
yoki
{"possible": false, "message": "..."}
"message" maydoni o'zbek tilida, foydalanuvchiga tushunarli va qisqa (bitta gap) bo'lsin —
masalan "So'zlaringiz hali bir-biriga bog'liq gap tuzish uchun yetarli emas, ko'proq so'z qo'shing."`,
      maxTokens: 500,
      messages: [
        {
          role: 'user',
          content: `Foydalanuvchi lug'ati (manba = tarjima):\n${vocabLines}\n\nJavob tili (answerLang): ${langName(answerLang)}\nSavol/prompt tili (promptLang): ${langName(promptLang)}`,
        },
      ],
      });
    } catch (aiErr) {
      // Never leak raw provider/network error text to the player — the AI
      // being unreachable isn't the same thing as "your vocab isn't enough",
      // but from the player's seat it should look like the same calm
      // "couldn't build a sentence right now" message either way.
      console.error('Sentence build AI call failed:', aiErr.message);
      return res.json({ possible: false, message: "AI hozircha javob bermadi. Birozdan so'ng qayta urinib ko'ring." });
    }

    let data;
    try {
      data = extractJson(raw);
    } catch {
      return res.json({ possible: false, message: "AI javobini o'qib bo'lmadi. Qayta urinib ko'ring." });
    }

    if (!data || typeof data !== 'object') {
      return res.json({ possible: false, message: "AI javobini o'qib bo'lmadi. Qayta urinib ko'ring." });
    }
    if (data.possible === false) {
      return res.json({ possible: false, message: data.message || "So'zlaringiz gap tuzish uchun yetarli emas." });
    }
    if (!Array.isArray(data.answerTokens) || !data.answerTokens.length || !data.promptSentence) {
      return res.json({ possible: false, message: "AI to'liq gap tuza olmadi. Qayta urinib ko'ring." });
    }

    res.json({
      possible: true,
      promptSentence: String(data.promptSentence),
      answerSentence: String(data.answerSentence || data.answerTokens.join(' ')),
      answerTokens: data.answerTokens.map(String),
    });
  } catch (err) {
    console.error('Sentence build failed:', err.message);
    res.json({ possible: false, message: "Kutilmagan xatolik yuz berdi. Qayta urinib ko'ring." });
  }
});

module.exports = router;
