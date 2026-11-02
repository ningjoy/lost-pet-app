import { describe, expect, test, vi } from 'vitest';
import { createHandler } from './handler';

const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  keys: { p256dh: 'p256', auth: 'auth' },
};

function post(body: unknown) {
  return new Request('http://localhost/send-test-push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('send-test-push handler', () => {
  test('answers CORS preflight', async () => {
    const res = await createHandler(vi.fn())(
      new Request('http://localhost', { method: 'OPTIONS' }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  test('rejects non-POST methods', async () => {
    const res = await createHandler(vi.fn())(
      new Request('http://localhost', { method: 'GET' }),
    );
    expect(res.status).toBe(405);
  });

  test('rejects invalid JSON', async () => {
    const send = vi.fn();
    const res = await createHandler(send)(post('not json'));
    expect(res.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  test('rejects a malformed subscription', async () => {
    const send = vi.fn();
    const res = await createHandler(send)(
      post({ subscription: { endpoint: 'x' } }),
    );
    expect(res.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  test('rejects a non-https endpoint', async () => {
    const send = vi.fn();
    const res = await createHandler(send)(
      post({ subscription: { ...subscription, endpoint: 'http://evil' } }),
    );
    expect(res.status).toBe(400);
  });

  test('sends one push and returns 200', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const res = await createHandler(send)(post({ subscription }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(send).toHaveBeenCalledTimes(1);
    const [sub, payload] = send.mock.calls[0];
    expect(sub).toEqual(subscription);
    expect(JSON.parse(payload)).toMatchObject({ title: expect.any(String) });
  });

  test.each([
    'https://fcm.googleapis.com/fcm/send/x',
    'https://web.push.apple.com/x',
    'https://updates.push.services.mozilla.com/wpush/v2/x',
    'https://wns2-by3p.notify.windows.com/w/?token=x',
  ])('accepts known push service %s', async (endpoint) => {
    const send = vi.fn().mockResolvedValue(undefined);
    const res = await createHandler(send)(
      post({ subscription: { ...subscription, endpoint } }),
    );
    expect(res.status).toBe(200);
  });

  test.each([
    'https://evil.example/push',
    'https://fcm.googleapis.com.evil.example/x',
    'not a url',
  ])('rejects unknown push host %s', async (endpoint) => {
    const send = vi.fn();
    const res = await createHandler(send)(
      post({ subscription: { ...subscription, endpoint } }),
    );
    expect(res.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  test('reports the push service status when the error has no message', async () => {
    class PushMessageError extends Error {
      toString() {
        return 'pushing message failed: 403 Forbidden';
      }
    }
    const send = vi.fn().mockRejectedValue(new PushMessageError());
    const res = await createHandler(send)(post({ subscription }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: 'pushing message failed: 403 Forbidden',
    });
  });

  test('returns 502 when the push service fails', async () => {
    const send = vi.fn().mockRejectedValue(new Error('410 Gone'));
    const res = await createHandler(send)(post({ subscription }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: '410 Gone' });
  });
});
