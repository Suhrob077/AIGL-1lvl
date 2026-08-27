> ## ⚡ TEZKOR ISHGA TUSHIRISH (FIX qilindi — endi 1 ta server yetarli)
> Avval frontend va backend **alohida** 2 ta serverda ishga tushirilishi kerak edi (masalan `:5500` va `:8787`),
> shu sabab CORS xatoligi tufayli **rasm skaneri, o'yin bo'limi va "host" sozlamasi ishlamas edi**.
> Endi backend frontendni ham o'zi beradi — faqat shuni bajaring:
> ```bash
> cd backend
> npm install      # birinchi marta
> npm start
> ```
> Keyin brauzerda **http://localhost:8787** manzilini oching (boshqa hech narsa kerak emas,
> Sozlamalar > Backend host'ni ham qo'lda to'ldirish shart emas — o'zi to'g'ri sozlanadi).
>
> ⚠️ **Diqqat**: `backend/.env` faylidagi `GEMINI_API_KEY` qiymati odatiy Gemini kalit formatiga
> (`AIzaSy...`) mos kelmayapti — agar rasm skaneri "AI provider error" desa, https://ai.google.dev/
> saytidan yangi, to'g'ri Gemini API kalitini oling va `.env` faylga qo'ying, so'ng serverni qayta ishga tushiring.

# So'z O'rganish 2.0 — AI-Powered Uzbek Vocabulary Learning App

A modern, feature-rich vocabulary learning application powered by **Google Gemini AI** with real-time OCR scanning, speech recognition, and an engaging vocabulary-matching game mode.

## 🌟 Features

### 📚 Core Learning
- **Vocabulary Management**: Add, organize, and delete vocabulary words with translations
- **Practice Mode**: Interactive practice with computer-monitored flashcards
- **Dual Direction**: Learn German↔Uzbek in both directions
- **Speech Recognition**: Speak answers instead of typing (Chrome optimized)
- **Floating Animation**: Engaging animated background during practice

### 📷 OCR Scanning
- **Image Recognition**: Scan dictionary pages using camera or upload images
- **Dictionary Extraction**: Automatically extract vocabulary entries from scanned images
- **Language Detection**: Validates that scanned text matches selected language

### 🎮 Game Mode (NEW!)
- **Matching Gameplay**: Find correct translations from 4 scrambled options
- **3 Difficulty Levels**: 
  - 🟢 Easy: 30 seconds per question
  - 🟡 Medium: 20 seconds per question  
  - 🔴 Hard: 10 seconds per question
- **Dual Language Modes**: Uzbek→German or German→Uzbek
- **Real-time Scoring**: Track progress and accuracy
- **Game Statistics**: Performance metrics after each game session

### 📊 Dashboard & Stats
- **Progress Tracking**: Total words, mastered (⭐), and difficult (⚠️) counts
- **Mastery Bar**: Visual progress indicator for language learning
- **Word Tables**: Detailed views of starred and hard vocabularies
- **Attempt Counter**: See how many attempts for each word

### 🖥️ PC-Optimized Interface
- Desktop-first, responsive design
- Enhanced layouts for large screens (tablets & desktops)  
- Smooth animations and transitions
- Touch-friendly mobile support

---

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js (≥18.0.0)
- **Framework**: Express.js
- **AI Provider**: Google Gemini 2.0 Flash (vision + text)
- **Security**: Helmet.js, Rate Limiting, CORS
- **Validation**: Zod schemas
- **Logging**: Morgan

### Frontend
- **HTML5** semantic markup
- **Vanilla JavaScript** (no frameworks required)
- **CSS3**: Modern gradients, animations, backdrop filters
- **Web APIs**: Speech Recognition, Web Audio, File API, Fetch

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ ([download](https://nodejs.org/))
- Google Gemini API key ([get free at ai.google.dev](https://ai.google.dev/))
- Modern browser (Chrome recommended for speech features)

### Installation

#### Step 1: Clone or Extract
```bash
cd vocab-app
```

#### Step 2: Backend Setup
```bash
cd backend
npm install
```

#### Step 3: Create .env File
Create `backend/.env`:
```env
# REQUIRED: Get from https://ai.google.dev/
GEMINI_API_KEY=your_api_key_here

# Optional
PORT=8787
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5500,http://localhost:3000
MAX_IMAGE_SIZE_MB=6
```

#### Step 4: Start Backend
```bash
npm start
# or for development with auto-reload:
npm run dev
```
✅ Backend running on `http://localhost:8787`

#### Step 5: Start Frontend
Open another terminal:
```bash
cd frontend
python -m http.server 5500
# (or python3 -m http.server 5500)
```

#### Step 6: Open App
Open browser: `http://localhost:5500`

#### Step 7: Configure Backend URL
1. Click **⚙️ Settings**
2. Set Backend URL: `http://localhost:8787`
3. Click **Save**

---

## 📖 User Guide

### 1️⃣ Adding Vocabulary

**Manual Entry:**
1. Go to **Home** (🏠)
2. Enter German word in first field
3. Enter Uzbek translation in second field
4. Click **➕ Add** or press Enter

**Load Examples:**
- Click **📥 Load Example Words** to load 35 pre-built Uzbek-German pairs

### 2️⃣ Practice Mode

1. Ensure words are added
2. Select direction: **Manba → Tarjima** or reverse
3. Click **🚀 Start**
4. For each word:
   - Read the prompt
   - Type answer or click **🎤** to speak
   - Click **Check** or press Enter
5. Progress:
   - 5+ correct = ⭐ Mastered
   - 5+ wrong = ⚠️ Difficult

### 3️⃣ Game Mode (NEW)

1. Click **🎮 Game** tab
2. Select language direction (UZ↔DE)
3. Pick difficulty:
   - 🟢 Easy: 30 sec/q
   - 🟡 Medium: 20 sec/q
   - 🔴 Hard: 10 sec/q
4. Click **🚀 START GAME**
5. For each question:
   - Read the word shown
   - Click correct translation from 4 options
   - Answer before timer ends!
6. After 10 questions: See score & stats

### 4️⃣ OCR Scanner

1. Click **📷 Scanner** (📷)
2. Pick source & target languages
3. Either:
   - **📸 Capture**: Take photo of dictionary page
   - **🖼️ Upload**: Select image file
4. Click **🔎 Analyze**
5. Check entries, select ones to import
6. Click **✅ Add Selected**

### 5️⃣ Dashboard

1. Click **📊 Results** (📊)
2. See statistics:
   - Total words
   - Mastered (⭐)
   - Difficult (⚠️)
   - Progress bar
3. Tables for starred & hard words

### ⚙️ Settings

1. Click **⚙️ Settings**
2. Options:
   - Change source/target languages
   - Swap language pair
   - Set backend URL
   - Enable/disable Yangiman (auto-load examples)

---

## 📚 API Documentation

### Game Endpoints

**GET /api/game/challenge**
- Returns a random vocabulary question
- Query params: `difficulty`, `direction`, `count`
- Response: `{ prompt, options[], correct, promptLang, answerLang }`

**POST /api/game/check**
- Verify if answer is correct
- Body: `{ answer, correct, caseSensitive }`
- Response: `{ isCorrect, correctAnswer }`

**GET /api/game/stats**
- Get game configuration
- Response: `{ totalVocabulary, difficulties, directions }`

### Translation Endpoints

**POST /api/translate**
- Translate a word or phrase
- Body: `{ text, sourceLang, targetLang }`
- Response: `{ translation, partOfSpeech, example }`

### Chat Endpoint

**POST /api/chat**
- Stateless German-Uzbek tutor chat (used by the in-app chat drawer)
- Body: `{ message, history? }` — `history` is a short rolling window round-tripped from the client's session-only (never persisted) chat state
- Response: `{ reply }`

### Article Auto-Fix Endpoint

**POST /api/article/fix**
- AI fallback for adding the correct German der/die/das article to a noun the local heuristic table doesn't recognize
- Body: `{ word, targetLang? }`
- Response: `{ needsFix, fixed?, explanation? }`

### Answer-Feedback Endpoint

**POST /api/feedback**
- One-off AI reaction to a single practice-screen flashcard attempt (right or wrong), shown as a small popup with "Skip" / "Reply" (opens the chat drawer)
- Body: `{ prompt, correctAnswer, userAnswer, isCorrect }`
- Response: `{ comment }` — best-effort; never blocks the practice flow, returns `{ comment: '' }` on any AI/network failure

### OCR Endpoints

**POST /api/vision/scan**
- Scan image for vocabulary entries
- Multipart form: `image`, `sourceLang`, `targetLang`
- Response: `{ detectedLanguageMatch, entries[], count }`

### Health Check

**GET /api/health**
- Simple health check
- Response: `{ ok: true }`

---

## 🔒 Security & Privacy

✅ **API Keys Never Exposed**: All AI calls go through backend only  
✅ **Local Data**: Vocabulary stored in browser, never sent to AI  
✅ **Rate Limiting**: Protects API from abuse  
✅ **CORS Protection**: Only configured origins can access  
✅ **Input Validation**: Zod schemas validate all inputs  
✅ **File Limits**: Max 6MB per image upload  

---

## ⚙️ Configuration

### Backend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | _(required)_ | Google Gemini API key |
| `PORT` | 8787 | Server port |
| `NODE_ENV` | development | Environment (dev/prod) |
| `ALLOWED_ORIGINS` | _(empty)_ | CORS whitelist |
| `MAX_IMAGE_SIZE_MB` | 6 | Max image size in MB |

### Frontend Settings (In-App)

- **Backend URL**: API server address (default: `http://localhost:8787`)
- **Source Language**: Word language (default: Uzbek)
- **Target Language**: Translation language (default: German)
- **Yangiman**: Auto-load examples if empty (default: on)

---

## 💾 Data Storage

- **Location**: Browser LocalStorage
- **Keys**: 
  - `vocabAppWords` — Vocabulary entries
  - `vocabAppSettings` — App configuration
- **Persistence**: Per browser/device (not synced)
- **Clear Data**: Open DevTools console, run `localStorage.clear()`

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check Node version
node --version  # Should be 18+

# Check if port is free (Windows)
netstat -ano | findstr 8787

# Check environment variable
echo %GEMINI_API_KEY%
```

### Game mode doesn't load
- Verify backend is running: Open `http://localhost:8787/api/health` ✓
- Check Settings: Backend URL must match your server
- Check console (F12) for error messages

### Speech recognition fails
- Chrome only (Firefox has limited support)
- Grant microphone permission
- Test with: `http://localhost:5500` (not `file://`)

### Images don't scan
- Ensure it's a dictionary or vocabulary list page
- Try under good lighting
- Image must be < 6MB

### CORS errors
- Edit `backend/.env`: Add frontend URL to `ALLOWED_ORIGINS`
- Format: `http://localhost:5500,http://localhost:3000`
- Restart backend server after editing

---

## 📦 Project Structure

```
vocab-app/
├── backend/
│   ├── server.js              Entry point
│   ├── package.json          Dependencies
│   ├── .env.example          Config template
│   ├── middleware/
│   │   └── rateLimiter.js
│   ├── routes/
│   │   ├── translate.js      AI translation
│   │   ├── vision.js         OCR scanning
│   │   └── game.js           Game mode API ⭐ NEW
│   └── utils/
│       └── aiClient.js       Gemini wrapper
│
├── frontend/
│   ├── index.html            Main page
│   ├── css/
│   │   └── style.css         Styling (PC-optimized)
│   ├── data/
│   │   └── seed-words.json   Example vocab
│   └── js/
│       ├── app.js            Main controller
│       ├── state.js          Storage/state
│       ├── game.js           Game logic ⭐ NEW
│       ├── speech.js         Speech recognition
│       ├── camera.js         Camera/OCR
│       ├── dashboard.js      Statistics
│       ├── gamification.js   Mastery modal
│       └── onboarding.js     Setup
│
└── README.md                 This file
```

---

## 🚀 Deployment

### Railway
1. Push to GitHub
2. Connect repo in Railway dashboard
3. Add env vars
4. Deploy ✅

### Render
```bash
# Build: npm install (in backend)
# Start: npm start
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app/backend
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8787
CMD ["npm", "start"]
```

---

## 📝 Version History

| Version | Changes |
|---------|---------|
| 2.0 | Google Gemini AI, Game Mode, PC optimization |
| 1.0 | OpenAI integration, OCR, Speech |

---

## 📄 License

Open source — modify and share freely!

---

## 🤝 Contributing

Improvements welcome:
- [ ] Dark mode
- [ ] User accounts
- [ ] Spaced repetition
- [ ] Audio pronunciation
- [ ] More languages

---

**Last Updated**: August 2026  
**Made with** ❤️ **using Express.js, Vanilla JS & Google Gemini**

The server listens on `PORT` (default `8787`) and exposes:
- `GET  /api/health`
- `POST /api/vision/scan` — multipart form: `image`, `sourceLang`, `targetLang`
- `POST /api/translate` — JSON: `{ text, sourceLang, targetLang }`

Security measures already in place:
- `helmet` security headers, `cors` allow-list (`ALLOWED_ORIGINS`)
- `express-rate-limit` — general limiter + a stricter one on the vision route
- Request validation with `zod`, image MIME/size checks with `multer`
- API key read only from `process.env`, centralized error handler that never
  leaks the key or stack traces to the client

### 2. Frontend

Any static file server works (the app makes `fetch()` calls to your backend,
configured in Settings → "Backend (AI proxy) manzili", default
`http://localhost:8787`):

```bash
cd frontend
npx serve .
# or: python3 -m http.server 5173
```

Open the printed URL. Camera/microphone access requires `https://` or
`localhost` per browser security rules.

## Feature → file map

| Requirement | Where |
|---|---|
| Camera capture & image upload | `frontend/js/camera.js`, `#scan-screen` in `index.html` |
| Dictionary-only OCR focus | System prompt in `backend/routes/vision.js` (explicit rules to ignore non-dictionary text) |
| Source-language validation | `detectedLanguageMatch` flag returned by the vision route |
| Language selector (source/target) | `#settings-screen`, `frontend/js/state.js: LANGUAGES` |
| High-fidelity mic / noise suppression | `HIGH_FIDELITY_AUDIO_CONSTRAINTS` in `frontend/js/speech.js` |
| Speech-to-text | Web Speech API in `frontend/js/speech.js` |
| Secure AI integration | `backend/utils/aiClient.js`, `backend/routes/*` |
| Rate limiting / key protection | `backend/middleware/rateLimiter.js`, `.env`-only key |
| Spaced repetition / attempt tracking | `Store.recordAttempt()` in `frontend/js/state.js` |
| ⭐ Starred (5 correct) / ⚠️ Hard (5 wrong) | Same function — thresholds `MASTER_THRESHOLD` / `HARD_THRESHOLD` |
| Info-User dashboard w/ two tables + attempt counters | `frontend/js/dashboard.js`, `#dashboard-screen` |
| "Yangiman" auto-onboarding toggle | `frontend/js/onboarding.js` |
| Seed dataset (35 words) | `frontend/data/seed-words.json` |
| 100%-mastery trigger + 3-choice modal | `frontend/js/gamification.js`, `#masteryModal` |
| Floating word-bubble game w/ 3 difficulties (10/20/30s per word) | `GAME_DIFFICULTY` in `frontend/js/game.js`, `#gameDiffHard/Mid/Easy` |
| Game pill "fly to center" + guaranteed right/wrong reveal | `flyPillToCenter()`, `handleGamePillClick()`, `handleTimeUp()` in `frontend/js/game.js` |
| AI reaction popup after each practice answer (right or wrong) | `requestAnswerComment()` in `frontend/js/aiChat.js`, `backend/routes/feedback.js`, `#aiAnswerToast` |

## Notes & assumptions

- Word memory state is derived, not stored redundantly: `correct >= 5` → `starred`,
  else `incorrect >= 5` → `hard`, else `new`. Adjust thresholds in `state.js`.
- "Yangiman" auto-loads the seed dataset only when the dictionary is empty,
  so it won't clobber existing words.
- The three end-game choices map to: restart session (reset counters, keep
  words, jump back into practice), go add/import a new set (navigates home),
  and a full reset (zeroes every counter after a confirm dialog).
- OCR quality depends entirely on the underlying vision model; the system
  prompt constrains it to dictionary-style entries and asks it to abstain
  (empty result) rather than guess when the image doesn't match the selected
  source language.
