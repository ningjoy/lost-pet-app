import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import MarkLostForm from './MarkLostForm';

const db = vi.hoisted(() => ({ insert: vi.fn(), single: vi.fn() }));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: (values: unknown) => {
        db.insert(values);
        return { select: () => ({ single: db.single }) };
      },
    }),
  },
}));

vi.mock('./MapPinPicker', () => ({
  default: ({
    onChange,
  }: {
    onChange: (p: { lat: number; lng: number }) => void;
  }) => (
    <button onClick={() => onChange({ lat: 40.2, lng: -88.3 })}>place</button>
  ),
}));

const props = {
  petId: 'pet-1',
  ownerId: 'user-1',
  onCreated: vi.fn(),
  onAlreadyOpen: vi.fn(),
  onCancel: vi.fn(),
};

const submit = () => fireEvent.click(screen.getByText('Report lost'));
const setTime = (value: string) =>
  fireEvent.change(screen.getByLabelText('Last seen at'), {
    target: { value },
  });

describe('MarkLostForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.single.mockResolvedValue({
      data: { id: 'r1', last_seen_at: '2026-01-01T00:00:00Z' },
      error: null,
    });
  });
  afterEach(cleanup);

  test('requires a pin before saving', () => {
    render(<MarkLostForm {...props} />);
    submit();
    expect(screen.getByRole('alert').textContent).toMatch(/tap the map/i);
    expect(db.insert).not.toHaveBeenCalled();
  });

  test('requires a last seen time', () => {
    render(<MarkLostForm {...props} />);
    fireEvent.click(screen.getByText('place'));
    setTime('');
    submit();
    expect(screen.getByRole('alert').textContent).toMatch(/enter when/i);
    expect(db.insert).not.toHaveBeenCalled();
  });

  test('rejects a time in the future', () => {
    render(<MarkLostForm {...props} />);
    fireEvent.click(screen.getByText('place'));
    setTime('2999-01-01T10:00');
    submit();
    expect(screen.getByRole('alert').textContent).toMatch(/future/i);
    expect(db.insert).not.toHaveBeenCalled();
  });

  test('creates the report and reports it back', async () => {
    render(<MarkLostForm {...props} />);
    fireEvent.click(screen.getByText('place'));
    setTime('2026-01-01T10:00');
    submit();
    await waitFor(() => expect(props.onCreated).toHaveBeenCalled());
    expect(db.insert).toHaveBeenCalledWith({
      pet_id: 'pet-1',
      owner_id: 'user-1',
      last_seen_location: 'SRID=4326;POINT(-88.3 40.2)',
      last_seen_at: new Date('2026-01-01T10:00').toISOString(),
    });
    expect(props.onCreated).toHaveBeenCalledWith({
      id: 'r1',
      last_seen_at: '2026-01-01T00:00:00Z',
    });
  });

  test('handles a report that is already open', async () => {
    db.single.mockResolvedValue({ data: null, error: { code: '23505' } });
    render(<MarkLostForm {...props} />);
    fireEvent.click(screen.getByText('place'));
    submit();
    await waitFor(() => expect(props.onAlreadyOpen).toHaveBeenCalled());
    expect(props.onCreated).not.toHaveBeenCalled();
  });

  test('shows an error when saving fails', async () => {
    db.single.mockResolvedValue({ data: null, error: { code: '500' } });
    render(<MarkLostForm {...props} />);
    fireEvent.click(screen.getByText('place'));
    submit();
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Could not save the report. Try again.',
    );
    expect(screen.getByText('Report lost')).toBeTruthy();
  });

  test('shows an error when the request throws', async () => {
    db.single.mockRejectedValue(new Error('offline'));
    render(<MarkLostForm {...props} />);
    fireEvent.click(screen.getByText('place'));
    submit();
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  test('cancel calls onCancel', () => {
    render(<MarkLostForm {...props} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(props.onCancel).toHaveBeenCalled();
  });
});
