// Usage: npm run vapid
// Prints the public key for .env and the JSON to store as a Supabase secret.
import { generateVapidKeys } from './vapid.mjs';

const { vapidKeys, applicationServerKey } = await generateVapidKeys();
console.log('# Public: put in .env and in the Vercel project env vars:');
console.log(`VITE_VAPID_PUBLIC_KEY=${applicationServerKey}\n`);
console.log('# Store as a Supabase secret (PRIVATE, never commit):');
console.log(`VAPID_KEYS='${JSON.stringify(vapidKeys)}'`);
