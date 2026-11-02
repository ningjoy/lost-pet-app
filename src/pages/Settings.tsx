import { useEffect, useState, type ReactNode } from 'react';
import Button from '../components/Button';
import {
  currentPushEnv,
  getExistingSubscription,
  getPushSupport,
  sendTestPush,
  subscribeToPush,
} from '../lib/push';

export default function Settings() {
  return (
    <div className="flex max-w-md flex-col gap-4">
      <h1 className="text-xl font-bold">Settings</h1>
      <section className="flex flex-col gap-3 rounded border border-gray-200 p-4">
        <h2 className="font-semibold">Notifications</h2>
        <NotificationSettings />
      </section>
    </div>
  );
}

function NotificationSettings() {
  const vapidKey: string = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';
  const support = getPushSupport(currentPushEnv());

  if (support === 'ios-needs-install') {
    return (
      <Hint>
        On iPhone, tap Share → Add to Home Screen, then open the app from your
        home screen to turn on notifications.
      </Hint>
    );
  }
  if (support === 'unsupported') {
    return <Hint>This browser doesn&apos;t support push notifications.</Hint>;
  }
  if (!vapidKey) {
    return (
      <p className="text-sm text-red-600">
        VITE_VAPID_PUBLIC_KEY is not configured.
      </p>
    );
  }
  return <PushControls vapidKey={vapidKey} />;
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-sm text-gray-600">{children}</p>;
}

function PushControls({ vapidKey }: { vapidKey: string }) {
  const [subscription, setSubscription] = useState<PushSubscriptionJSON | null>(
    null,
  );
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  // Already subscribed on an earlier visit? Allow sending right away.
  useEffect(() => {
    getExistingSubscription(vapidKey)
      .then((existing) => existing && setSubscription(existing))
      .catch(() => {});
  }, [vapidKey]);

  async function run(action: () => Promise<string>) {
    setBusy(true);
    try {
      setStatus(await action());
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  const enable = () =>
    run(async () => {
      setSubscription(await subscribeToPush(vapidKey));
      return 'Notifications enabled on this device.';
    });

  const sendTest = (sub: PushSubscriptionJSON) =>
    run(async () => {
      await sendTestPush(sub);
      return 'Test push sent. It should arrive in a few seconds.';
    });

  return (
    <>
      <Button disabled={busy} onClick={enable}>
        Enable notifications
      </Button>
      <Button
        variant="secondary"
        disabled={busy || !subscription}
        onClick={() => subscription && sendTest(subscription)}
      >
        Send test notification
      </Button>
      {status && (
        <p role="status" className="text-sm">
          {status}
        </p>
      )}
    </>
  );
}
