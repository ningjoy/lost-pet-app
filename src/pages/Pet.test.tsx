import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import Pet from './Pet';

const db = vi.hoisted(() => ({ maybeSingle: vi.fn() }));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: db.maybeSingle }) }),
    }),
  },
}));

vi.mock('../components/LostSection', () => ({
  default: ({ petId }: { petId: string }) => <p>lost section {petId}</p>,
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/pets/p1']}>
      <Routes>
        <Route path="/pets/:id" element={<Pet />} />
      </Routes>
    </MemoryRouter>,
  );

describe('Pet page', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  test('shows the pet and its lost section', async () => {
    db.maybeSingle.mockResolvedValue({
      data: { id: 'p1', name: 'Biscuit', species: 'Dog', owner_id: 'u1' },
      error: null,
    });
    renderPage();
    expect(await screen.findByText('Biscuit')).toBeTruthy();
    expect(screen.getByText('Dog')).toBeTruthy();
    expect(screen.getByText('lost section p1')).toBeTruthy();
  });

  test('says when the pet does not exist', async () => {
    db.maybeSingle.mockResolvedValue({ data: null, error: null });
    renderPage();
    expect(await screen.findByText('Pet not found.')).toBeTruthy();
  });

  test('shows an error when loading fails', async () => {
    db.maybeSingle.mockResolvedValue({ data: null, error: { code: '500' } });
    renderPage();
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  test('shows an error when the request throws', async () => {
    db.maybeSingle.mockRejectedValue(new Error('offline'));
    renderPage();
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
