import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import * as push from '../lib/push';
import Settings from './Settings';

vi.mock('../lib/push', () => ({
  currentPushEnv: vi.fn(() => ({})),
  getPushSupport: vi.fn(),
  getExistingSubscription: vi.fn(),
  subscribeToPush: vi.fn(),
  sendTestPush: vi.fn(),
}));

const sub = { endpoint: 'https://fcm.googleapis.com/x', keys: {} };

describe('Settings notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'AQ');
    vi.mocked(push.getPushSupport).mockReturnValue('supported');
    vi.mocked(push.getExistingSubscription).mockResolvedValue(null);
  });

  test('tells iPhone users to install first', () => {
    vi.mocked(push.getPushSupport).mockReturnValue('ios-needs-install');
    render(<Settings />);
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('says when the browser is unsupported', () => {
    vi.mocked(push.getPushSupport).mockReturnValue('unsupported');
    render(<Settings />);
    expect(screen.getByText(/doesn.t support push/)).toBeInTheDocument();
  });

  test('flags a missing VAPID key', () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '');
    render(<Settings />);
    expect(screen.getByText(/not configured/)).toBeInTheDocument();
  });

  test('send is disabled until notifications are enabled', async () => {
    vi.mocked(push.subscribeToPush).mockResolvedValue(sub);
    render(<Settings />);
    const send = screen.getByRole('button', { name: /send test/i });
    expect(send).toBeDisabled();

    fireEvent.click(
      screen.getByRole('button', { name: /enable notifications/i }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(/enabled/);
    expect(push.subscribeToPush).toHaveBeenCalledWith('AQ');
    expect(send).toBeEnabled();

    fireEvent.click(send);
    expect(await screen.findByText(/Test push sent/)).toBeInTheDocument();
    expect(push.sendTestPush).toHaveBeenCalledWith(sub);
  });

  test('send is enabled on load when already subscribed', async () => {
    vi.mocked(push.getExistingSubscription).mockResolvedValue(sub);
    render(<Settings />);
    expect(
      await screen.findByRole('button', { name: /send test/i }),
    ).toBeEnabled();
  });

  test('shows errors in the status line', async () => {
    vi.mocked(push.subscribeToPush).mockRejectedValue(
      new Error('Notification permission denied'),
    );
    render(<Settings />);
    fireEvent.click(
      screen.getByRole('button', { name: /enable notifications/i }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Error: Notification permission denied',
    );
  });
});
