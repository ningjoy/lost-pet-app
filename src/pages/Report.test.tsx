import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AuthContext } from '../lib/auth-context';
import Report from './Report';

const api = vi.hoisted(() => ({ result: vi.fn() }));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => api.result() }),
      }),
    }),
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
  beforeEach(() => vi.clearAllMocks());

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
});
