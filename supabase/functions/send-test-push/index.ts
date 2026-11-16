// Spike: send one Web Push to the subscription in the request body.
// Secrets: VAPID_KEYS (JSON from `npm run vapid`), VAPID_SUBJECT (mailto:...).
import * as webpush from 'jsr:@negrel/webpush@0.5.0';
import { createHandler } from './handler.ts';

const rawVapidKeys = Deno.env.get('VAPID_KEYS');
if (!rawVapidKeys) throw new Error('VAPID_KEYS secret is not set');

const vapidKeys = await webpush.importVapidKeys(JSON.parse(rawVapidKeys), {
  extractable: false,
});

const appServer = await webpush.ApplicationServer.new({
  contactInformation:
    Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
  vapidKeys,
});

Deno.serve(
  createHandler(async (subscription, payload) => {
    await appServer.subscribe(subscription).pushTextMessage(payload, {});
  }),
);
