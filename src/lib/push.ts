import { supabase } from './supabase';

export type PushSupport = 'supported' | 'ios-needs-install' | 'unsupported';

export type PushEnv = {
  serviceWorker: boolean;
  pushManager: boolean;
  notification: boolean;
  userAgent: string;
  standalone: boolean;
  maxTouchPoints: number;
};

/** Decode a url-safe base64 VAPID key into the bytes PushManager expects. */
export function urlBase64ToUint8Array(
  base64Url: string,
): Uint8Array<ArrayBuffer> {
  const padded = base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * iOS only exposes Push/Notification APIs to sites installed to the home
 * screen (iOS 16.4+), so a Safari tab needs a different message.
 */
export function getPushSupport(env: PushEnv): PushSupport {
  if (env.serviceWorker && env.pushManager && env.notification) {
    return 'supported';
  }
  // iPadOS Safari reports itself as a Mac; touch support gives it away.
  const isIOS =
    /iPhone|iPad|iPod/.test(env.userAgent) ||
    (/Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1);
  if (isIOS && !env.standalone) return 'ios-needs-install';
  return 'unsupported';
}

export function currentPushEnv(): PushEnv {
  return {
    serviceWorker: 'serviceWorker' in navigator,
    pushManager: 'PushManager' in window,
    notification: 'Notification' in window,
    userAgent: navigator.userAgent,
    standalone:
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
  };
}

function sameBytes(a: ArrayBuffer | null, b: Uint8Array) {
  if (!a || a.byteLength !== b.length) return false;
  const view = new Uint8Array(a);
  return b.every((byte, i) => view[i] === byte);
}

/**
 * The browser's current subscription, if it was made with this VAPID key.
 * Never prompts, so it is safe to call on page load.
 */
export async function getExistingSubscription(
  vapidPublicKey: string,
): Promise<PushSubscriptionJSON | null> {
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const key = urlBase64ToUint8Array(vapidPublicKey);
  return existing && sameBytes(existing.options.applicationServerKey, key)
    ? existing.toJSON()
    : null;
}

/** Must be called from a user gesture (iOS requires it). */
export async function subscribeToPush(
  vapidPublicKey: string,
): Promise<PushSubscriptionJSON> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(`Notification permission ${permission}`);
  }
  const registration = await navigator.serviceWorker.ready;
  const key = urlBase64ToUint8Array(vapidPublicKey);
  const existing = await registration.pushManager.getSubscription();
  if (existing && sameBytes(existing.options.applicationServerKey, key)) {
    return existing.toJSON();
  }
  // A subscription from an old VAPID key can't receive our pushes.
  await existing?.unsubscribe();
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  });
  return subscription.toJSON();
}

export async function sendTestPush(subscription: PushSubscriptionJSON) {
  const { error } = await supabase.functions.invoke('send-test-push', {
    body: { subscription },
  });
  if (error) throw error;
}
