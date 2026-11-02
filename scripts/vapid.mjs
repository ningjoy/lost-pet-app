// Generates VAPID keys in the same format as @negrel/webpush's
// generate-vapid-keys command, using Node's WebCrypto (no Deno needed).
import { webcrypto } from 'node:crypto';

const { subtle } = webcrypto;

export async function generateVapidKeys() {
  const pair = await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const vapidKeys = {
    publicKey: await subtle.exportKey('jwk', pair.publicKey),
    privateKey: await subtle.exportKey('jwk', pair.privateKey),
  };
  const raw = new Uint8Array(await subtle.exportKey('raw', pair.publicKey));
  const applicationServerKey = Buffer.from(raw).toString('base64url');
  return { vapidKeys, applicationServerKey };
}
