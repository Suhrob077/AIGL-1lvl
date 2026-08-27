// ========== ADVANCED AUDIO & VOICE ==========
// Two layers:
//  1. getUserMedia with tuned constraints (echo cancellation, noise
//     suppression, auto gain, high sample rate) feeding a live level
//     meter — this is the "professional audio" pipeline used for
//     pronunciation feedback.
//  2. The Web Speech API (SpeechRecognition) for actual STT, since
//     browsers don't expose raw STT from a MediaStream directly.

let recognition = null;
let isListening = false;
let micStream = null;
let audioCtx = null;
let analyser = null;
let levelRAF = null;

const HIGH_FIDELITY_AUDIO_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    sampleRate: 48000,
    sampleSize: 16,
  },
};

async function acquireMicStream() {
  if (micStream) return micStream;
  micStream = await navigator.mediaDevices.getUserMedia(HIGH_FIDELITY_AUDIO_CONSTRAINTS);
  return micStream;
}

function startLevelMeter(stream) {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.6;
  source.connect(analyser);

  const data = new Uint8Array(analyser.frequencyBinCount);
  const fill = document.getElementById('micLevelFill');

  function tick() {
    analyser.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    const pct = Math.min(100, Math.round((avg / 140) * 100));
    if (fill) fill.style.width = pct + '%';
    levelRAF = requestAnimationFrame(tick);
  }
  tick();
}

function stopLevelMeter() {
  if (levelRAF) cancelAnimationFrame(levelRAF);
  levelRAF = null;
  if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; }
  const fill = document.getElementById('micLevelFill');
  if (fill) fill.style.width = '0%';
}

function releaseMicStream() {
  if (micStream) {
    micStream.getTracks().forEach(t => t.stop());
    micStream = null;
  }
}

const STT_LOCALE_MAP = { de: 'de-DE', uz: 'uz-UZ', en: 'en-US', ru: 'ru-RU', tr: 'tr-TR' };

function setupSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micBtn = document.getElementById('micBtn');

  if (!SpeechRecognition) {
    micBtn.classList.add('disabled');
    micBtn.title = "Bu brauzer ovozni qo'llab-quvvatlamaydi";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 3;

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript.trim();
    document.getElementById('answerInput').value = text;
    stopListening();
    setTimeout(() => checkAnswer(), 350);
  };

  recognition.onerror = (event) => {
    stopListening();
    let msg = "Ovoz aniqlanmadi. Qayta urinib ko'ring.";
    if (event.error === 'not-allowed') {
      msg = "Mikrofon ruxsati berilmagan.\n\nBrauzer sozlamalaridan mikrofonni yoqing.";
    } else if (event.error === 'no-speech') {
      msg = "Hech narsa eshitilmadi. Yana bir bor ayting.";
    }
    showToast(msg);
  };

  recognition.onend = () => stopListening();
}

function stopListening() {
  isListening = false;
  const btn = document.getElementById('micBtn');
  if (btn) btn.classList.remove('listening');
  stopLevelMeter();
  releaseMicStream();
}

async function toggleVoice() {
  if (!recognition) {
    showToast("Brauzeringiz ovozli kiritishni qo'llab-quvvatlamaydi. Chrome dan foydalaning.");
    return;
  }
  if (isListening) {
    try { recognition.stop(); } catch (e) {}
    stopListening();
    return;
  }

  try {
    const stream = await acquireMicStream();
    startLevelMeter(stream);
  } catch (e) {
    showToast("Mikrofonga ruxsat berilmadi.");
    return;
  }

  const dir = getDirection();
  recognition.lang = STT_LOCALE_MAP[dir.promptLang] || 'en-US';

  try {
    recognition.start();
    isListening = true;
    document.getElementById('micBtn').classList.add('listening');
  } catch (e) {
    stopListening();
    showToast("Mikrofonni ishga tushirib bo'lmadi. Sahifani qayta yuklang.");
  }
}
