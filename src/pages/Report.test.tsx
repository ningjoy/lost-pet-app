import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AuthContext } from '../lib/auth-context';
import Report from './Report';

const api = vi.hoisted(() => ({
  result: vi.fn(),
  fetchSightings: vi.fn(),
  on: vi.fn(),
  subscribe: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
}));

vi.mock('../lib/sighting', () => ({ fetchSightings: api.fetchSightings }));

vi.mock('../components/ReportMap', () => ({
  default: ({
    sightings,
    isOwner,
  }: {
    sightings: unknown[];
    isOwner: boolean;
  }) => (
    <p>
      map {sightings.length} {isOwner ? 'owner' : 'guest'}
    </p>
  ),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => api.result() }),
      }),
    }),
    channel: (name: string) => {
      api.channel(name);
      return { on: api.on };
    },
    removeChannel: api.removeChannel,
    storage: {
      from: () => ({
        getPublicUrl: (p: string) => ({ data: { publicUrl: `http://x/${p}` } }),
      }),
    },
  },
}));

// The real form needs a drawn map.
vi.mock('../components/SightingForm', () => ({
  default: ({
    onDone,
    onCancel,
  }: {
    onDone: () => void;
    onCancel: () => void;
  }) => (
    <div>
      <p>form</p>
      <button onClick={onDone}>done</button>
      <button onClick={onCancel}>cancel</button>
    </div>
  ),
}));

const report = (status: string) => ({
  data: {
    status,
    owner_id: 'u1',
    last_seen_location: '0101000020E6100000CDCCCCCCCC0C56C0CDCCCCCCCC0C4440',
    last_seen_at: '2026-01-01T12:00:00Z',
    pets: { name: 'Rex', photo_paths: ['a.jpg'] },
  },
  error: null,
});

function renderPage() {
  const session = { user: { id: 'u1' } } as never;
  return render(
    <AuthContext.Provider value={{ session, loading: false }}>
      <MemoryRouter initialEntries={['/reports/r1']}>
        <Routes>
          <Route path="/reports/:id" element={<Report />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

const sawButton = () => screen.findByRole('button', { name: 'I saw this pet' });

describe('Report page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchSightings.mockResolvedValue([]);
    api.on.mockReturnValue({ subscribe: api.subscribe });
    api.subscribe.mockReturnValue({ id: 'chan' });
  });

  test('open report shows the button', async () => {
    api.result.mockResolvedValue(report('open'));
    renderPage();
    expect(await sawButton()).toBeInTheDocument();
    expect(screen.getByText('Rex')).toBeInTheDocument();
  });

  test('found report hides the button', async () => {
    api.result.mockResolvedValue(report('found'));
    renderPage();
    expect(await screen.findByText('Rex')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('form is absent until the safety screen is acknowledged', async () => {
    api.result.mockResolvedValue(report('open'));
    renderPage();
    fireEvent.click(await sawButton());
    expect(screen.queryByText('form')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'I understand' }));
    expect(screen.getByText('form')).toBeInTheDocument();
  });

  test('cancel returns to the view and the safety screen shows again', async () => {
    api.result.mockResolvedValue(report('open'));
    renderPage();
    fireEvent.click(await sawButton());
    fireEvent.click(screen.getByRole('button', { name: 'I understand' }));
    fireEvent.click(screen.getByText('cancel'));
    fireEvent.click(await sawButton());
    expect(screen.getByRole('button', { name: 'I understand' })).toBeVisible();
  });

  test('moving to another report shows the safety screen again', async () => {
    api.result.mockResolvedValue(report('open'));
    const session = { user: { id: 'u1' } } as never;
    function Jump() {
      const navigate = useNavigate();
      return <button onClick={() => navigate('/reports/r2')}>jump</button>;
    }
    render(
      <AuthContext.Provider value={{ session, loading: false }}>
        <MemoryRouter initialEntries={['/reports/r1']}>
          <Jump />
          <Routes>
            <Route path="/reports/:id" element={<Report />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    fireEvent.click(await sawButton());
    fireEvent.click(screen.getByRole('button', { name: 'I understand' }));
    fireEvent.click(screen.getByText('jump'));
    expect(await sawButton()).toBeInTheDocument();
    expect(screen.queryByText('form')).not.toBeInTheDocument();
  });

  test('done shows Sighting sent', async () => {
    api.result.mockResolvedValue(report('open'));
    renderPage();
    fireEvent.click(await sawButton());
    fireEvent.click(screen.getByRole('button', { name: 'I understand' }));
    fireEvent.click(screen.getByText('done'));
    expect(screen.getByText('Sighting sent')).toBeInTheDocument();
  });

  test('not found', async () => {
    api.result.mockResolvedValue({ data: null, error: null });
    renderPage();
    expect(await screen.findByText('Report not found')).toBeInTheDocument();
  });

  test('error with retry', async () => {
    api.result.mockResolvedValueOnce({ data: null, error: { message: 'x' } });
    renderPage();
    const retry = await screen.findByRole('button', { name: 'Retry' });
    api.result.mockResolvedValue(report('open'));
    fireEvent.click(retry);
    expect(await screen.findByText('Rex')).toBeInTheDocument();
  });

  test('shows the map with sightings and owner flag', async () => {
    api.result.mockResolvedValue(report('open'));
    api.fetchSightings.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
    renderPage();
    expect(await screen.findByText('map 2 owner')).toBeInTheDocument();
    expect(api.fetchSightings).toHaveBeenCalledWith('r1');
  });

  test('sightings error shows retry that refetches', async () => {
    api.result.mockResolvedValue(report('open'));
    api.fetchSightings.mockRejectedValueOnce(new Error('x'));
    renderPage();
    expect(
      await screen.findByText('Could not load sightings'),
    ).toBeInTheDocument();
    expect(screen.getByText('Rex')).toBeInTheDocument();
    api.fetchSightings.mockResolvedValue([{ id: 's1' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('map 1 owner')).toBeInTheDocument();
    expect(
      screen.queryByText('Could not load sightings'),
    ).not.toBeInTheDocument();
  });

  test('subscribes with the report filter and refetches on change', async () => {
    api.result.mockResolvedValue(report('open'));
    renderPage();
    await sawButton();
    expect(api.channel).toHaveBeenCalledWith(
      expect.stringMatching(/^sightings:r1:/),
    );
    expect(api.on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sightings',
        filter: 'report_id=eq.r1',
      },
      expect.any(Function),
    );
    api.fetchSightings.mockClear();
    api.fetchSightings.mockResolvedValue([{ id: 's1' }]);
    await act(async () => api.on.mock.calls[0][2]());
    expect(api.fetchSightings).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('map 1 owner')).toBeInTheDocument();
  });

  test('becoming visible refetches and resubscribes', async () => {
    api.result.mockResolvedValue(report('open'));
    renderPage();
    await sawButton();
    api.fetchSightings.mockClear();
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(api.removeChannel).toHaveBeenCalledTimes(1);
    expect(api.channel).toHaveBeenCalledTimes(2);
    expect(api.fetchSightings).toHaveBeenCalledTimes(1);
    // The report itself reloads too, so a found pet loses the button.
    expect(api.result).toHaveBeenCalledTimes(2);
  });

  test('refetches once the channel is live', async () => {
    api.result.mockResolvedValue(report('open'));
    renderPage();
    await sawButton();
    api.fetchSightings.mockClear();
    await act(async () => api.subscribe.mock.calls[0][0]('SUBSCRIBED'));
    expect(api.fetchSightings).toHaveBeenCalledTimes(1);
  });

  test('removes the channel on unmount', async () => {
    api.result.mockResolvedValue(report('open'));
    const { unmount } = renderPage();
    await sawButton();
    unmount();
    expect(api.removeChannel).toHaveBeenCalledWith({ id: 'chan' });
  });

  test('saving a sighting refetches', async () => {
    api.result.mockResolvedValue(report('open'));
    renderPage();
    fireEvent.click(await sawButton());
    fireEvent.click(screen.getByRole('button', { name: 'I understand' }));
    api.fetchSightings.mockClear();
    fireEvent.click(screen.getByText('done'));
    expect(api.fetchSightings).toHaveBeenCalledTimes(1);
  });
});
