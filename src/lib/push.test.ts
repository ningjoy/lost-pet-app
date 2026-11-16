import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  getExistingSubscription,
  getPushSupport,
  subscribeToPush,
  urlBase64ToUint8Array,
} from './push';

vi.mock('./supabase', () => ({ supabase: {} }));

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

describe('urlBase64ToUint8Array', () => {
  test('decodes url-safe base64 without padding', () => {
    // bytes 0xfb 0xff 0xbf -> standard "+/+/" style chars in url-safe form
    expect(Array.from(urlBase64ToUint8Array('-_-_'))).toEqual([
      0xfb, 0xff, 0xbf,
    ]);
    expect(Array.from(urlBase64ToUint8Array('AQ'))).toEqual([1]);
  });
});

describe('getPushSupport', () => {
  const full = { serviceWorker: true, pushManager: true, notification: true };
  const phone = { standalone: false, maxTouchPoints: 5 };

  test('supported when all APIs exist', () => {
    expect(getPushSupport({ ...full, ...phone, userAgent: ANDROID_UA })).toBe(
      'supported',
    );
  });

  test('iPhone in a Safari tab must be installed first', () => {
    expect(
      getPushSupport({
        serviceWorker: true,
        pushManager: false,
        notification: false,
        userAgent: IPHONE_UA,
        standalone: false,
        maxTouchPoints: 0,
      }),
    ).toBe('ios-needs-install');
  });

  test('installed iPhone with APIs is supported', () => {
    expect(
      getPushSupport({
        ...full,
        ...phone,
        userAgent: IPHONE_UA,
        standalone: true,
      }),
    ).toBe('supported');
  });

  test('installed iPhone without APIs (iOS < 16.4) is unsupported', () => {
    expect(
      getPushSupport({
        serviceWorker: true,
        pushManager: false,
        notification: false,
        userAgent: IPHONE_UA,
        standalone: true,
        maxTouchPoints: 0,
      }),
    ).toBe('unsupported');
  });

  test('iPad in a Safari tab (reports as Mac) must be installed first', () => {
    expect(
      getPushSupport({
        serviceWorker: true,
        pushManager: false,
        notification: false,
        userAgent: IPAD_UA,
        standalone: false,
        maxTouchPoints: 5,
      }),
    ).toBe('ios-needs-install');
  });

  test('other browsers without APIs are unsupported', () => {
    expect(
      getPushSupport({
        serviceWorker: false,
        pushManager: false,
        notification: false,
        userAgent: ANDROID_UA,
        standalone: false,
        maxTouchPoints: 0,
      }),
    ).toBe('unsupported');
  });
});

describe('subscribeToPush', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubBrowser(permission: NotificationPermission) {
    const subscriptionJson = {
      endpoint: 'https://push.example/abc',
      keys: { p256dh: 'p', auth: 'a' },
    };
    const getSubscription = vi.fn().mockResolvedValue(null);
    const subscribe = vi
      .fn()
      .mockResolvedValue({ toJSON: () => subscriptionJson });
    vi.stubGlobal('Notification', {
      requestPermission: vi.fn().mockResolvedValue(permission),
    });
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve({ pushManager: { getSubscription, subscribe } }),
      },
    });
    return { subscribe, getSubscription, subscriptionJson };
  }

  test('asks permission, subscribes with the VAPID key, returns JSON', async () => {
    const { subscribe, subscriptionJson } = stubBrowser('granted');
    const result = await subscribeToPush('AQ');
    expect(result).toEqual(subscriptionJson);
    const opts = subscribe.mock.calls[0][0];
    expect(opts.userVisibleOnly).toBe(true);
    expect(Array.from(opts.applicationServerKey)).toEqual([1]);
  });

  function existingSub(keyBytes: number[]) {
    const json = { endpoint: 'https://push.example/old', keys: {} };
    return {
      json,
      sub: {
        options: { applicationServerKey: new Uint8Array(keyBytes).buffer },
        toJSON: () => json,
        unsubscribe: vi.fn().mockResolvedValue(true),
      },
    };
  }

  test('reuses an existing subscription made with the same key', async () => {
    const { subscribe, getSubscription } = stubBrowser('granted');
    const { sub, json } = existingSub([1]);
    getSubscription.mockResolvedValue(sub);
    expect(await subscribeToPush('AQ')).toEqual(json);
    expect(subscribe).not.toHaveBeenCalled();
    expect(sub.unsubscribe).not.toHaveBeenCalled();
  });

  test('replaces a subscription made with an old key', async () => {
    const { subscribe, getSubscription, subscriptionJson } =
      stubBrowser('granted');
    const { sub } = existingSub([9, 9]);
    getSubscription.mockResolvedValue(sub);
    expect(await subscribeToPush('AQ')).toEqual(subscriptionJson);
    expect(sub.unsubscribe).toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalled();
  });

  test('getExistingSubscription returns a matching subscription without prompting', async () => {
    const { getSubscription } = stubBrowser('granted');
    const { sub, json } = existingSub([1]);
    getSubscription.mockResolvedValue(sub);
    expect(await getExistingSubscription('AQ')).toEqual(json);
    expect(Notification.requestPermission).not.toHaveBeenCalled();
  });

  test('getExistingSubscription ignores a subscription with an old key', async () => {
    const { getSubscription } = stubBrowser('granted');
    getSubscription.mockResolvedValue(existingSub([9]).sub);
    expect(await getExistingSubscription('AQ')).toBeNull();
  });

  test('throws when permission is denied', async () => {
    const { subscribe } = stubBrowser('denied');
    await expect(subscribeToPush('AQ')).rejects.toThrow(/permission/i);
    expect(subscribe).not.toHaveBeenCalled();
  });
});
