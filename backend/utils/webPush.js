const webpush = require('web-push');

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

const configured = !!(PUBLIC_KEY && PRIVATE_KEY);
if (configured) {
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
}

module.exports = {
  webpush,
  isConfigured: configured,
  publicKey: PUBLIC_KEY,
};
