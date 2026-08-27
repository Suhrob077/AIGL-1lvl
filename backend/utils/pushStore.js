// ========== ANONYMOUS DEVICE PROGRESS/SUBSCRIPTION STORE ==========
// No login/accounts exist in this app, so devices are identified by a
// random id generated client-side (see frontend/js/state.js getDeviceId()).
//
// IMPORTANT PERSISTENCE CAVEAT: this uses a plain JSON file on disk, which
// is perfectly fine for a normal, always-on Node process (local `npm
// start`, a VPS, Render, Railway, etc — anywhere the filesystem persists
// between requests). It will NOT reliably survive on Vercel/serverless
// hosting, where each invocation can get a fresh, ephemeral filesystem.
// If you deploy the notification feature to Vercel, swap this for a real
// datastore (Vercel KV, Upstash Redis, etc) — the API surface below
// (upsertSubscription/removeSubscription/recordProgress/getAllDevices) is
// intentionally small so that swap is a self-contained change.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'push-store.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) fs.writeFileSync(STORE_PATH, JSON.stringify({ devices: {} }, null, 2));
}

function load() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return { devices: {} };
  }
}

function save(store) {
  ensureFile();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function upsertSubscription(deviceId, subscription) {
  const store = load();
  store.devices[deviceId] = store.devices[deviceId] || { progress: {} };
  store.devices[deviceId].subscription = subscription;
  save(store);
}

function removeSubscription(deviceId) {
  const store = load();
  if (store.devices[deviceId]) {
    delete store.devices[deviceId].subscription;
    save(store);
  }
}

function recordProgress(deviceId, date, points, goal) {
  const store = load();
  store.devices[deviceId] = store.devices[deviceId] || { progress: {} };
  store.devices[deviceId].progress[date] = { points, goal };
  save(store);
}

function markNotified(deviceId, date) {
  const store = load();
  if (store.devices[deviceId]) {
    store.devices[deviceId].lastNotifiedDate = date;
    save(store);
  }
}

function getAllDevices() {
  const store = load();
  return Object.entries(store.devices).map(([deviceId, data]) => ({ deviceId, ...data }));
}

module.exports = { upsertSubscription, removeSubscription, recordProgress, markNotified, getAllDevices };
