const express = require('express');
const { z } = require('zod');

const router = express.Router();

/**
 * Uzbek-German vocabulary dataset for the game
 * Each entry contains source, target, and an ID
 */
const VOCABULARY_POOL = [
  { id: 1, uz: 'Oila', de: 'die Familie' },
  { id: 2, uz: 'It', de: 'der Hund' },
  { id: 3, uz: 'Mushuk', de: 'die Katze' },
  { id: 4, uz: 'Kitob', de: 'das Buch' },
  { id: 5, uz: 'Uy', de: 'das Haus' },
  { id: 6, uz: 'Suv', de: 'das Wasser' },
  { id: 7, uz: 'Non', de: 'das Brot' },
  { id: 8, uz: 'Maktab', de: 'die Schule' },
  { id: 9, uz: 'Do\'st', de: 'der Freund' },
  { id: 10, uz: 'O\'rtoq (qiz)', de: 'die Freundin' },
  { id: 11, uz: 'Olma', de: 'der Apfel' },
  { id: 12, uz: 'Sut', de: 'die Milch' },
  { id: 13, uz: 'Quyosh', de: 'die Sonne' },
  { id: 14, uz: 'Oy', de: 'der Mond' },
  { id: 15, uz: 'Stol', de: 'der Tisch' },
  { id: 16, uz: 'Stul', de: 'der Stuhl' },
  { id: 17, uz: 'Deraza', de: 'das Fenster' },
  { id: 18, uz: 'Eshik', de: 'die Tür' },
  { id: 19, uz: 'Mashina', de: 'das Auto' },
  { id: 20, uz: 'Ish', de: 'die Arbeit' },
  { id: 21, uz: 'Vaqt', de: 'die Zeit' },
  { id: 22, uz: 'Sevgi', de: 'die Liebe' },
  { id: 23, uz: 'Shahar', de: 'die Stadt' },
  { id: 24, uz: 'Mamlakat', de: 'das Land' },
  { id: 25, uz: 'Pul', de: 'das Geld' },
  { id: 26, uz: 'Ko\'cha', de: 'die Straße' },
  { id: 27, uz: 'Bola', de: 'das Kind' },
  { id: 28, uz: 'O\'qituvchi', de: 'der Lehrer' },
  { id: 29, uz: 'O\'qituvchi (ayol)', de: 'die Lehrerin' },
  { id: 30, uz: 'Ota', de: 'der Vater' },
  { id: 31, uz: 'Ona', de: 'die Mutter' },
  { id: 32, uz: 'Aka/Uka', de: 'der Bruder' },
  { id: 33, uz: 'Opa/Singil', de: 'die Schwester' },
  { id: 34, uz: 'O\'g\'il', de: 'der Sohn' },
  { id: 35, uz: 'Qiz (farzand)', de: 'die Tochter' },
  { id: 36, uz: 'Erkak', de: 'der Mann' },
  { id: 37, uz: 'Ayol', de: 'die Frau' },
  { id: 38, uz: 'O\'g\'il bola', de: 'der Junge' },
  { id: 39, uz: 'Qiz bola', de: 'das Mädchen' },
  { id: 40, uz: 'Shifokor', de: 'der Arzt' },
  { id: 41, uz: 'Shifokor (ayol)', de: 'die Ärztin' },
  { id: 42, uz: 'Ruchka / Qalam', de: 'der Stift' },
  { id: 43, uz: 'Qog\'oz', de: 'das Papier' },
  { id: 44, uz: 'Sumka', de: 'die Tasche' },
  { id: 45, uz: 'Telefon', de: 'das Handy' },
  { id: 46, uz: 'Kompyuter', de: 'der Computer' },
  { id: 47, uz: 'Soat', de: 'die Uhr' },
  { id: 48, uz: 'Kalit', de: 'der Schlüssel' },
  { id: 49, uz: 'Chamadon', de: 'der Koffer' },
  { id: 50, uz: 'Samolyot', de: 'das Flugzeug' },
  { id: 51, uz: 'Poezd', de: 'der Zug' },
  { id: 52, uz: 'Avtobus', de: 'der Bus' },
  { id: 53, uz: 'Velosiped', de: 'das Fahrrad' },
  { id: 54, uz: 'Vokzal', de: 'der Bahnhof' },
  { id: 55, uz: 'Aeroport', de: 'der Flughafen' },
  { id: 56, uz: 'Oshxona', de: 'die Küche' },
  { id: 57, uz: 'Xona', de: 'das Zimmer' },
  { id: 58, uz: 'Krovet', de: 'das Bett' },
  { id: 59, uz: 'Javon', de: 'der Schrank' },
  { id: 60, uz: 'Bog\'', de: 'der Garten' },
  { id: 61, uz: 'Daraxt', de: 'der Baum' },
  { id: 62, uz: 'Gul', de: 'die Blume' },
  { id: 63, uz: 'Osmon', de: 'der Himmel' },
  { id: 64, uz: 'Yomg\'ir', de: 'der Regen' },
  { id: 65, uz: 'Qor', de: 'der Schnee' },
  { id: 66, uz: 'Shamol', de: 'der Wind' },
  { id: 67, uz: 'Ob-havo', de: 'das Wetter' },
  { id: 68, uz: 'Choy', de: 'der Tee' },
  { id: 69, uz: 'Kofe', de: 'der Kaffee' },
  { id: 70, uz: 'Sharbat', de: 'der Saft' },
  { id: 71, uz: 'Pishloq', de: 'der Käse' },
  { id: 72, uz: 'Go\'sht', de: 'das Fleisch' },
  { id: 73, uz: 'Baliq', de: 'der Fisch' },
  { id: 74, uz: 'Tuxum', de: 'das Ei' },
  { id: 75, uz: 'Sho\'rva', de: 'die Suppe' },
  { id: 76, uz: 'Salat', de: 'der Salat' },
  { id: 77, uz: 'Meva', de: 'das Obst' },
  { id: 78, uz: 'Sabzavot', de: 'das Gemüse' },
  { id: 79, uz: 'Banan', de: 'die Banane' },
  { id: 80, uz: 'Kartoshka', de: 'die Kartoffel' },
  { id: 81, uz: 'Pomidor', de: 'die Tomate' },
  { id: 82, uz: 'Bosh', de: 'der Kopf' },
  { id: 83, uz: 'Qo\'l', de: 'die Hand' },
  { id: 84, uz: 'Oyoq', de: 'der Fuß' },
  { id: 85, uz: 'Ko\'z', de: 'das Auge' },
  { id: 86, uz: 'Quloq', de: 'das Ohr' },
  { id: 87, uz: 'Og\'iz', de: 'der Mund' },
  { id: 88, uz: 'Burun', de: 'die Nase' },
  { id: 89, uz: 'Yurak', de: 'das Herz' },
  { id: 90, uz: 'Bozor', de: 'der Markt' },
  { id: 91, uz: 'Do\'kon', de: 'der Laden' },
  { id: 92, uz: 'Bank', de: 'die Bank' },
  { id: 93, uz: 'Mehmonxona', de: 'das Hotel' },
  { id: 94, uz: 'Restoran', de: 'das Restaurant' },
  { id: 95, uz: 'Muzey', de: 'das Museum' },
  { id: 96, uz: 'Bog\' / Park', de: 'der Park' },
  { id: 97, uz: 'Savol', de: 'die Frage' },
  { id: 98, uz: 'Javob', de: 'die Antwort' },
  { id: 99, uz: 'So\'z', de: 'das Wort' },
  { id: 100, uz: 'Til', de: 'die Sprache' },
  { id: 101, uz: 'O\'yin', de: 'das Spiel' },
  { id: 102, uz: 'Sport', de: 'der Sport' },
  { id: 103, uz: 'Sayohat', de: 'die Reise' },
  { id: 104, uz: 'Ta\'til', de: 'der Urlaub' },
  { id: 105, uz: 'Salomatlik', de: 'die Gesundheit' },
  { id: 106, uz: 'Muammo', de: 'das Problem' },
  { id: 107, uz: 'Yechim', de: 'die Lösung' },
];

const querySchema = z.object({
  difficulty: z.enum(['easy', 'mid', 'hard']).default('mid'),
  direction: z.enum(['uz-de', 'de-uz']).default('uz-de'),
  count: z.string().transform(Number).default('4').refine(n => n >= 3 && n <= 8, 'Count must be 3-8'),
});

/**
 * GET /api/game/challenge
 * Returns a game challenge with:
 * - prompt: the word to translate
 * - options: shuffled answer options (including correct answer)
 * - correct: the correct answer (for backend verification)
 * - promptLang: source language
 * - answerLang: target language
 */
router.get('/challenge', (req, res, next) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { difficulty, direction, count } = parsed.data;

    // Get random word from pool
    const randomWord = VOCABULARY_POOL[Math.floor(Math.random() * VOCABULARY_POOL.length)];
    
    // Determine prompt and correct answer based on direction
    const isUzToDe = direction === 'uz-de';
    const prompt = isUzToDe ? randomWord.uz : randomWord.de;
    const correct = isUzToDe ? randomWord.de : randomWord.uz;
    const promptLang = isUzToDe ? 'uz' : 'de';
    const answerLang = isUzToDe ? 'de' : 'uz';

    // Get random options (excluding the correct answer)
    const pool = VOCABULARY_POOL.filter(w => w.id !== randomWord.id);
    const options = [];
    
    for (let i = 0; i < count - 1 && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const word = isUzToDe ? pool[idx].de : pool[idx].uz;
      if (!options.includes(word)) {
        options.push(word);
      }
      pool.splice(idx, 1);
    }

    // Add correct answer and shuffle
    options.push(correct);
    const shuffled = options.sort(() => Math.random() - 0.5);

    res.json({
      prompt,
      promptLang,
      answerLang,
      options: shuffled,
      correct,
      difficulty,
      direction,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/game/check
 * Verify if the user's answer is correct
 * body: { answer, correct, caseSensitive?: false }
 */
router.post('/check', (req, res, next) => {
  try {
    const schema = z.object({
      answer: z.string().min(1).max(100),
      correct: z.string().min(1).max(100),
      caseSensitive: z.boolean().default(false),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { answer, correct, caseSensitive } = parsed.data;
    
    const normalize = (s) => {
      const trimmed = s.trim();
      return caseSensitive ? trimmed : trimmed.toLowerCase();
    };

    const isCorrect = normalize(answer) === normalize(correct);

    res.json({
      isCorrect,
      correctAnswer: correct,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/game/stats
 * Returns general game statistics (vocabulary count, etc.)
 */
router.get('/stats', (req, res) => {
  res.json({
    totalVocabulary: VOCABULARY_POOL.length,
    difficulties: {
      easy: { timeLimit: 30, description: '30 seconds' },
      mid: { timeLimit: 20, description: '20 seconds' },
      hard: { timeLimit: 10, description: '10 seconds' },
    },
    directions: [
      { code: 'uz-de', label: 'Uzbek → German' },
      { code: 'de-uz', label: 'German → Uzbek' },
    ],
  });
});

module.exports = router;
