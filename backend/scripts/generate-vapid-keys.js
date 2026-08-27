// Run once: `node scripts/generate-vapid-keys.js` (or `npm run generate-vapid`)
// Paste the output into your .env (local) or your host's Environment
// Variables (Vercel/etc). Never commit real keys to a public repo.
const webpush = require('web-push');
const keys = webpush.generateVAPIDKeys();
console.log('\nAdd these to your .env / hosting environment variables:\n');
console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('VAPID_SUBJECT=mailto:you@example.com\n');
