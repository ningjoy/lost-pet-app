import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SIGHTING_PHOTO_MAX_BYTES } from '../lib/sighting';
import SightingForm from './SightingForm';

const api = vi.hoisted(() => ({ submitSighting: vi.fn() }));

// The real client needs env vars that CI does not have.
vi.mock('../lib/supabase', () => ({ supabase: {} }));

vi.mock('../lib/sighting', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/sighting')>()),
  submitSighting: api.submitSighting,
}));

// The real picker needs a drawn map.
vi.mock('./MapPinPicker', () => ({
  default: ({
    onChange,
  }: {
    onChange: (p: { lat: number; lng: number }) => void;
  }) => (
    <button type="button" onClick={() => onChange({ lat: 40.2, lng: -88.3 })}>
      place
    </button>
  ),
}));

const onDone = vi.fn();
const onCancel = vi.fn();

const renderForm = () =>
  render(
    <SightingForm
      reportId="r1"
      userId="u1"
      onDone={onDone}
      onCancel={onCancel}
    />,
  );

const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Send Sighting' }));
const place = () => fireEvent.click(screen.getByText('place'));
const pickPhoto = (file: File) =>
  fireEvent.change(screen.getByLabelText('Photo (optional)'), {
    target: { files: [file] },
  });

beforeEach(() => api.submitSighting.mockResolvedValue(undefined));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('SightingForm', () => {
  test('blocks submit with no pin', async () => {
    renderForm();
    submit();
    expect(
      await screen.findByText('Tap the map to place the pin'),
    ).toBeInTheDocument();
    expect(api.submitSighting).not.toHaveBeenCalled();
  });

  test('time seen defaults to now and caps at now', () => {
    renderForm();
    const input = screen.getByLabelText('Time seen');
    expect(input).toHaveValue((input as HTMLInputElement).max);
  });

  test('rejects a future time', async () => {
    renderForm();
    place();
    fireEvent.change(screen.getByLabelText('Time seen'), {
      target: { value: '2999-01-01T10:00' },
    });
    submit();
    expect(
      await screen.findByText('Time seen cannot be in the future'),
    ).toBeInTheDocument();
    expect(api.submitSighting).not.toHaveBeenCalled();
  });

  test('rejects a cleared time', async () => {
    renderForm();
    place();
    fireEvent.change(screen.getByLabelText('Time seen'), {
      target: { value: '' },
    });
    submit();
    expect(await screen.findByText('Enter a valid time')).toBeInTheDocument();
    expect(api.submitSighting).not.toHaveBeenCalled();
  });

  test('rejects a wrong-type photo', async () => {
    renderForm();
    place();
    pickPhoto(new File(['x'], 'a.gif', { type: 'image/gif' }));
    submit();
    expect(
      await screen.findByText('Photo must be a JPEG, PNG or WebP image'),
    ).toBeInTheDocument();
    expect(api.submitSighting).not.toHaveBeenCalled();
  });

  test('rejects an oversized photo', async () => {
    renderForm();
    place();
    pickPhoto(
      new File([new Uint8Array(SIGHTING_PHOTO_MAX_BYTES + 1)], 'a.png', {
        type: 'image/png',
      }),
    );
    submit();
    expect(
      await screen.findByText('Photo must be 5 MB or smaller'),
    ).toBeInTheDocument();
    expect(api.submitSighting).not.toHaveBeenCalled();
  });

  test('submits typed values then calls onDone', async () => {
    renderForm();
    place();
    fireEvent.change(screen.getByLabelText('Note (optional)'), {
      target: { value: '  by the park  ' },
    });
    submit();
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(api.submitSighting).toHaveBeenCalledWith({
      reportId: 'r1',
      userId: 'u1',
      pin: { lat: 40.2, lng: -88.3 },
      seenAt: expect.any(Date),
      note: 'by the park',
      photo: undefined,
    });
  });

  test('on failure shows an error and keeps the note', async () => {
    api.submitSighting.mockRejectedValue(new Error('offline'));
    renderForm();
    place();
    fireEvent.change(screen.getByLabelText('Note (optional)'), {
      target: { value: 'by the park' },
    });
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not save. Try again.',
    );
    expect(screen.getByLabelText('Note (optional)')).toHaveValue('by the park');
    expect(screen.getByRole('button', { name: 'Send Sighting' })).toBeEnabled();
    expect(onDone).not.toHaveBeenCalled();
  });

  test('disables submit and cancel while saving', async () => {
    let finish: () => void = () => {};
    api.submitSighting.mockReturnValue(new Promise<void>((r) => (finish = r)));
    renderForm();
    place();
    submit();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled(),
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    finish();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  test('Cancel calls onCancel', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
