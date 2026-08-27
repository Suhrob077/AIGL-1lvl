// ========== CAMERA & IMAGE PROCESSING (OCR) ==========
// The browser only captures/uploads an image and shows a UI over the
// result. All AI vision calls happen on the backend (see camera.js's
// fetch to Store.settings.apiBaseUrl) so the API key never touches the
// client — see backend/routes/vision.js.

let cameraStream = null;
let lastCapturedBlob = null;
let scanResults = [];

async function startCamera() {
  const video = document.getElementById('scanVideo');
  const img = document.getElementById('scanPreviewImg');
  img.style.display = 'none';
  video.style.display = 'block';
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1440 } },
      audio: false,
    });
    video.srcObject = cameraStream;
    await video.play();
    document.getElementById('captureBtn').disabled = false;
  } catch (e) {
    setScanStatus("Kameraga ruxsat berilmadi. Rasm yuklashdan foydalaning.");
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
}

function capturePhoto() {
  const video = document.getElementById('scanVideo');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 960;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(blob => {
    lastCapturedBlob = blob;
    showPreview(blob);
    stopCamera();
  }, 'image/jpeg', 0.92);
}

function handleFileUpload(fileInput) {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;
  lastCapturedBlob = file;
  showPreview(file);
  stopCamera();
}

function showPreview(blob) {
  const video = document.getElementById('scanVideo');
  const img = document.getElementById('scanPreviewImg');
  video.style.display = 'none';
  img.style.display = 'block';
  img.src = URL.createObjectURL(blob);
  document.getElementById('scanUploadBtn').style.display = 'block';
  document.getElementById('captureBtn').disabled = true;
}

function setScanStatus(text, spinning = false) {
  const el = document.getElementById('scanStatus');
  el.innerHTML = spinning ? '<div class="spinner"></div>' + text : text;
}

async function submitScan() {
  if (!lastCapturedBlob) {
    setScanStatus("Avval rasm oling yoki yuklang.");
    return;
  }

  const sourceLang = document.getElementById('scanSourceLang').value;
  const targetLang = document.getElementById('scanTargetLang').value;

  setScanStatus("Rasm tahlil qilinmoqda (faqat lug'at matni)...", true);
  document.getElementById('scanUploadBtn').disabled = true;

  const form = new FormData();
  form.append('image', lastCapturedBlob, 'scan.jpg');
  form.append('sourceLang', sourceLang);
  form.append('targetLang', targetLang);

  try {
    const res = await fetch(`${Store.settings.apiBaseUrl}/api/vision/scan`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server xatosi (${res.status})`);
    }
    const data = await res.json();

    if (!data.detectedLanguageMatch) {
      setScanStatus("⚠️ Rasmdagi til tanlangan manba til bilan mos kelmadi yoki lug'at matni topilmadi.");
    } else if (!data.entries.length) {
      setScanStatus("Lug'at yozuvlari topilmadi. Aniqroq/yaqinroq rasm bilan urinib ko'ring.");
    } else {
      setScanStatus(`${data.entries.length} ta so'z topildi. Qo'shmoqchilaringizni belgilang:`);
    }
    scanResults = data.entries || [];
    renderScanResults(sourceLang, targetLang);
  } catch (e) {
    setScanStatus(`Xatolik: ${e.message}`);
  } finally {
    document.getElementById('scanUploadBtn').disabled = false;
  }
}

function renderScanResults(sourceLang, targetLang) {
  const list = document.getElementById('scanResultList');
  list.innerHTML = '';
  scanResults.forEach((entry, i) => {
    const row = document.createElement('div');
    row.className = 'scan-result-item';
    row.innerHTML = `
      <input type="checkbox" checked data-idx="${i}">
      <span><b>${escapeHtml(entry.source)}</b> — ${escapeHtml(entry.target)}</span>
    `;
    list.appendChild(row);
  });
  document.getElementById('scanImportBtn').style.display = scanResults.length ? 'block' : 'none';
  document.getElementById('scanImportBtn').onclick = () => importScanResults(sourceLang, targetLang);
}

function importScanResults(sourceLang, targetLang) {
  const checks = document.querySelectorAll('#scanResultList input[type=checkbox]');
  let added = 0;
  checks.forEach(cb => {
    if (cb.checked) {
      const entry = scanResults[Number(cb.dataset.idx)];
      let source = entry.source;
      // Fast, synchronous, no-network fix — bulk import must stay fast.
      if (sourceLang === 'de' && Store.settings.addArticles && typeof localArticleFix === 'function'
          && typeof looksLikeGermanNounNeedingArticle === 'function' && looksLikeGermanNounNeedingArticle(source)) {
        const fixed = localArticleFix(source);
        if (fixed) source = fixed;
      }
      const w = Store.addWord(source, entry.target, { sourceLang, targetLang });
      if (w) added += 1;
    }
  });
  showToast(added ? `${added} ta so'z qo'shildi ✅` : "Hech narsa tanlanmadi");
  renderWordList();
  resetScanScreen();
  goToScreen('home-screen');
}

function resetScanScreen() {
  lastCapturedBlob = null;
  scanResults = [];
  document.getElementById('scanResultList').innerHTML = '';
  document.getElementById('scanImportBtn').style.display = 'none';
  document.getElementById('scanUploadBtn').style.display = 'none';
  document.getElementById('scanPreviewImg').style.display = 'none';
  document.getElementById('scanFileInput').value = '';
  setScanStatus('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
