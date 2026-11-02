import { describe, expect, test } from 'vitest';
import { generateVapidKeys } from './vapid.mjs';

function b64urlToBytes(s: string) {
  return Buffer.from(s, 'base64url');
}

describe('generateVapidKeys', () => {
  test('produces a JWK pair and matching application server key', async () => {
    const { vapidKeys, applicationServerKey } = await generateVapidKeys();
    expect(vapidKeys.publicKey).toMatchObject({ kty: 'EC', crv: 'P-256' });
    expect(vapidKeys.privateKey.d).toBeTruthy();
    expect(vapidKeys.publicKey.d).toBeUndefined();

    const raw = b64urlToBytes(applicationServerKey);
    expect(raw.length).toBe(65);
    expect(raw[0]).toBe(0x04);
    expect(raw.subarray(1, 33)).toEqual(b64urlToBytes(vapidKeys.publicKey.x));
    expect(raw.subarray(33)).toEqual(b64urlToBytes(vapidKeys.publicKey.y));
  });
});
