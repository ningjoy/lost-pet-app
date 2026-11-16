// Pure request handling for send-test-push. No Deno/JSR imports here so the
// logic can be unit-tested with Vitest; index.ts wires in the real sender.

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type SendPush = (
  subscription: PushSubscriptionInput,
  payload: string,
) => Promise<void>;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Only browser push services, so the function can't be used to POST to
// arbitrary URLs (SSRF).
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge, Samsung Internet
  /\.push\.apple\.com$/, // Safari / iOS
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /\.notify\.windows\.com$/, // legacy Edge
];

function isPushServiceUrl(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === 'https:' &&
      PUSH_HOSTS.some((host) => host.test(url.hostname))
    );
  } catch {
    return false;
  }
}

function isSubscription(value: unknown): value is PushSubscriptionInput {
  const v = value as PushSubscriptionInput | null;
  return (
    typeof v?.endpoint === 'string' &&
    isPushServiceUrl(v.endpoint) &&
    typeof v.keys?.p256dh === 'string' &&
    typeof v.keys?.auth === 'string'
  );
}

// @negrel/webpush's PushMessageError has an empty `message`; its toString()
// carries the push service's status ("pushing message failed: 403 ...").
function errorText(err: unknown) {
  return (err instanceof Error && err.message) || String(err);
}

export function createHandler(sendPush: SendPush) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    let body: { subscription?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Body must be JSON' }, 400);
    }
    if (!isSubscription(body?.subscription)) {
      return json({ error: 'Invalid push subscription' }, 400);
    }

    const payload = JSON.stringify({
      title: 'Lost Pet Neighbor',
      body: 'Test notification: push works on this device!',
      url: '/settings',
    });

    try {
      await sendPush(body.subscription, payload);
    } catch (err) {
      const message = errorText(err);
      console.error('push failed', message);
      return json({ error: message }, 502);
    }
    return json({ ok: true }, 200);
  };
}
