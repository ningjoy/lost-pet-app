import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import LostSection from './LostSection';

const db = vi.hoisted(() => ({ getSession: vi.fn(), maybeSingle: vi.fn() }));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: db.getSession },
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: db.maybeSingle }) }),
      }),
    }),
  },
}));

vi.mock('./MarkLostForm', () => ({
  default: ({
    onCreated,
    onAlreadyOpen,
    onCancel,
  }: {
    onCreated: (r: { id: string; last_seen_at: string }) => void;
    onAlreadyOpen: () => void;
    onCancel: () => void;
  }) => (
    <div>
      <button
        onClick={() =>
          onCreated({ id: 'r9', last_seen_at: '2026-01-01T12:00:00Z' })
        }
      >
        create
      </button>
      <button onClick={onAlreadyOpen}>duplicate</button>
      <button onClick={onCancel}>cancel</button>
    </div>
  ),
}));

const renderSection = () => render(<LostSection petId="p1" ownerId="owner" />);

describe('LostSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.getSession.mockResolvedValue({
      data: { session: { user: { id: 'owner' } } },
    });
    db.maybeSingle.mockResolvedValue({ data: null, error: null });
  });
  afterEach(cleanup);

  test('shows a Mark lost button to the owner', async () => {
    renderSection();
    expect(await screen.findByText('Mark lost')).toBeTruthy();
  });

  test('shows nothing to someone who is not the owner', async () => {
    db.getSession.mockResolvedValue({
      data: { session: { user: { id: 'other' } } },
    });
    const { container } = renderSection();
    await waitFor(() => expect(screen.queryByLabelText('Loading')).toBeNull());
    expect(screen.queryByText('Mark lost')).toBeNull();
    expect(container.textContent).toBe('');
  });

  test('shows the lost status instead of the button when a report is open', async () => {
    db.maybeSingle.mockResolvedValue({
      data: { id: 'r1', last_seen_at: '2026-01-01T12:00:00Z' },
      error: null,
    });
    renderSection();
    expect(await screen.findByText(/Last seen/)).toBeTruthy();
    expect(screen.queryByText('Mark lost')).toBeNull();
  });

  test('opens the form, then shows lost after creating', async () => {
    renderSection();
    fireEvent.click(await screen.findByText('Mark lost'));
    fireEvent.click(screen.getByText('create'));
    expect(await screen.findByText(/Last seen/)).toBeTruthy();
    expect(screen.queryByText('Mark lost')).toBeNull();
  });

  test('cancel goes back to the button', async () => {
    renderSection();
    fireEvent.click(await screen.findByText('Mark lost'));
    fireEvent.click(screen.getByText('cancel'));
    expect(await screen.findByText('Mark lost')).toBeTruthy();
  });

  test('reloads when another report was already open', async () => {
    renderSection();
    fireEvent.click(await screen.findByText('Mark lost'));
    db.maybeSingle.mockResolvedValue({
      data: { id: 'r2', last_seen_at: '2026-01-01T12:00:00Z' },
      error: null,
    });
    fireEvent.click(screen.getByText('duplicate'));
    expect(await screen.findByText(/Last seen/)).toBeTruthy();
  });

  test('shows an error when loading fails', async () => {
    db.maybeSingle.mockResolvedValue({ data: null, error: { code: '500' } });
    renderSection();
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /lost status/,
    );
  });

  test('shows an error when the request throws', async () => {
    db.getSession.mockRejectedValue(new Error('offline'));
    renderSection();
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
