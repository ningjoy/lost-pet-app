import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import HomeLocationForm from './HomeLocationForm';

const db = vi.hoisted(() => ({
  getSession: vi.fn(),
  single: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  fitBounds: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: db.getSession },
    from: () => ({
      select: () => ({ eq: () => ({ single: db.single }) }),
      update: (values: unknown) => {
        db.update(values);
        return { eq: db.eq };
      },
    }),
  },
}));

// The real picker needs a drawn map. This stand-in shows the pin it was given,
// lets a test place a new one, and renders the layers passed inside it.
vi.mock('./MapPinPicker', () => ({
  default: ({
    value,
    onChange,
    children,
  }: {
    value: { lat: number; lng: number } | null;
    onChange: (p: { lat: number; lng: number }) => void;
    children: React.ReactNode;
  }) => (
    <div
      data-testid="picker"
      data-pin={value ? `${value.lat},${value.lng}` : ''}
    >
      <button onClick={() => onChange({ lat: 40.2, lng: -88.3 })}>place</button>
      {children}
    </div>
  ),
}));

vi.mock('react-leaflet', () => ({
  Circle: ({ radius }: { radius: number }) => (
    <div data-testid="circle" data-radius={radius} />
  ),
  useMap: () => ({ fitBounds: db.fitBounds }),
}));

// Alice's seeded home, as the database returns it.
const ALICE_HEX = '0101000020E61000007E1D3867440D56C003780B24280E4440';

const signedIn = () =>
  db.getSession.mockResolvedValue({
    data: { session: { user: { id: 'u1' } } },
  });
const profile = (home_location: string | null, alert_radius_miles = 1) =>
  db.single.mockResolvedValue({
    data: { home_location, alert_radius_miles },
    error: null,
  });

const renderForm = () =>
  render(
    <MemoryRouter>
      <HomeLocationForm />
    </MemoryRouter>,
  );

beforeEach(() => {
  signedIn();
  db.eq.mockReturnValue({ select: db.select });
  db.select.mockResolvedValue({ data: [{ id: 'u1' }], error: null });
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('HomeLocationForm loading', () => {
  test('does not mount the picker until the saved home has loaded', async () => {
    profile(ALICE_HEX);
    renderForm();
    expect(screen.queryByTestId('picker')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    await screen.findByTestId('picker');
  });

  test('shows the saved pin, radius and circle', async () => {
    profile(ALICE_HEX, 2.5);
    renderForm();
    const picker = await screen.findByTestId('picker');
    const [lat, lng] = picker.dataset.pin!.split(',').map(Number);
    expect(lat).toBeCloseTo(40.1106, 4);
    expect(lng).toBeCloseTo(-88.2073, 4);
    expect(screen.getByLabelText(/alert radius/i)).toHaveValue('2.5');
    expect(screen.getByText('2.5 mi')).toBeInTheDocument();
    expect(Number(screen.getByTestId('circle').dataset.radius)).toBeCloseTo(
      2.5 * 1609.344,
    );
  });

  test('with no saved home there is no pin or circle, and Save is off', async () => {
    profile(null);
    renderForm();
    const picker = await screen.findByTestId('picker');
    expect(picker.dataset.pin).toBe('');
    expect(screen.queryByTestId('circle')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  test('offers sign in when there is no session', async () => {
    db.getSession.mockResolvedValue({ data: { session: null } });
    renderForm();
    expect(
      await screen.findByRole('link', { name: 'Sign in' }),
    ).toHaveAttribute('href', '/sign-in');
    expect(db.single).not.toHaveBeenCalled();
  });

  test('shows an error instead of hanging when loading throws', async () => {
    db.getSession.mockRejectedValue(new Error('offline'));
    renderForm();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load your home location.',
    );
  });

  test('shows an error when the profile cannot be loaded', async () => {
    db.single.mockResolvedValue({ data: null, error: { message: 'boom' } });
    renderForm();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load your home location.',
    );
  });
});

describe('HomeLocationForm saving', () => {
  test('saves the new pin and radius as longitude-first text', async () => {
    profile(ALICE_HEX);
    renderForm();
    await screen.findByTestId('picker');

    fireEvent.click(screen.getByText('place'));
    fireEvent.change(screen.getByLabelText(/alert radius/i), {
      target: { value: '3.5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(db.update).toHaveBeenCalledWith({
      home_location: 'SRID=4326;POINT(-88.3 40.2)',
      alert_radius_miles: 3.5,
    });
    expect(db.eq).toHaveBeenCalledWith('id', 'u1');
  });

  test('shows an error when the save fails', async () => {
    profile(ALICE_HEX);
    db.select.mockResolvedValue({ data: null, error: { message: 'nope' } });
    renderForm();
    await screen.findByTestId('picker');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not save',
    );
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  test('shows an error when the update matched no row', async () => {
    profile(ALICE_HEX);
    db.select.mockResolvedValue({ data: [], error: null });
    renderForm();
    await screen.findByTestId('picker');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not save',
    );
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  test('shows an error when the save request throws', async () => {
    profile(ALICE_HEX);
    db.select.mockRejectedValue(new Error('offline'));
    renderForm();
    await screen.findByTestId('picker');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not save',
    );
  });

  test('disables Save while saving', async () => {
    profile(ALICE_HEX);
    let finish: (v: unknown) => void = () => {};
    db.select.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderForm();
    await screen.findByTestId('picker');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled(),
    );
    finish({ data: [{ id: 'u1' }], error: null });
    await screen.findByText('Saved');
  });

  test('does not show "Saved" for edits made while the save was in flight', async () => {
    profile(ALICE_HEX);
    let finish: (v: unknown) => void = () => {};
    db.select.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderForm();
    await screen.findByTestId('picker');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.change(screen.getByLabelText(/alert radius/i), {
      target: { value: '4' },
    });
    finish({ data: [{ id: 'u1' }], error: null });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled(),
    );
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  test('clears "Saved" when the radius changes again', async () => {
    profile(ALICE_HEX);
    renderForm();
    await screen.findByTestId('picker');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved');

    fireEvent.change(screen.getByLabelText(/alert radius/i), {
      target: { value: '4' },
    });
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  test('zooms to the circle when the radius changes', async () => {
    profile(ALICE_HEX);
    renderForm();
    await screen.findByTestId('picker');
    db.fitBounds.mockClear();

    fireEvent.change(screen.getByLabelText(/alert radius/i), {
      target: { value: '5' },
    });
    expect(db.fitBounds).toHaveBeenCalledTimes(1);
  });

  test('does not re-zoom when the pin moves', async () => {
    profile(ALICE_HEX);
    renderForm();
    await screen.findByTestId('picker');
    db.fitBounds.mockClear();

    fireEvent.click(screen.getByText('place'));
    expect(db.fitBounds).not.toHaveBeenCalled();
  });

  test('rounds a saved radius that is off the slider steps', async () => {
    profile(ALICE_HEX, 1.25);
    renderForm();
    await screen.findByTestId('picker');
    expect(screen.getByText('1.5 mi')).toBeInTheDocument();
    expect(screen.getByLabelText(/alert radius/i)).toHaveValue('1.5');
  });

  test('radius slider runs 0.5 to 5 in half-mile steps', async () => {
    profile(ALICE_HEX);
    renderForm();
    await screen.findByTestId('picker');
    const slider = screen.getByLabelText(/alert radius/i);
    expect(slider).toHaveAttribute('min', '0.5');
    expect(slider).toHaveAttribute('max', '5');
    expect(slider).toHaveAttribute('step', '0.5');
  });
});
