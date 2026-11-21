import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import type { Sighting } from '../lib/sighting';
import ReportMap from './ReportMap';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  TileLayer: () => null,
  Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Marker: ({
    icon,
    children,
  }: {
    icon: { options: { html: string } };
    children: ReactNode;
  }) => (
    <div>
      <span dangerouslySetInnerHTML={{ __html: icon.options.html }} />
      {children}
    </div>
  ),
}));
vi.mock('react-leaflet-cluster', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (p: string) => ({ data: { publicUrl: `http://x/${p}` } }),
      }),
    },
  },
}));

const lastSeen = { lat: 40, lng: -88 };
const make = (over: Partial<Sighting>): Sighting => ({
  id: 's1',
  point: { lat: 40.1, lng: -88.1 },
  seenAt: '2026-01-01T12:00:00Z',
  note: null,
  photoPath: null,
  status: 'unconfirmed',
  ...over,
});

describe('ReportMap', () => {
  test('shows the last-seen pin and no sighting markers when empty', () => {
    const { container } = render(
      <ReportMap lastSeen={lastSeen} sightings={[]} isOwner={false} />,
    );
    expect(container.querySelector('[data-marker="last-seen"]')).toBeTruthy();
    expect(container.querySelector('[data-marker="confirmed"]')).toBeNull();
  });

  test('uses a different icon per status', () => {
    const { container } = render(
      <ReportMap
        lastSeen={lastSeen}
        sightings={[
          make({ id: 'a', status: 'confirmed' }),
          make({ id: 'b', status: 'unconfirmed' }),
        ]}
        isOwner={false}
      />,
    );
    expect(
      container.querySelectorAll('[data-marker="confirmed"]'),
    ).toHaveLength(1);
    expect(
      container.querySelectorAll('[data-marker="unconfirmed"]'),
    ).toHaveLength(1);
  });

  test('popup shows status, time, note and photo', () => {
    render(
      <ReportMap
        lastSeen={lastSeen}
        sightings={[
          make({
            note: 'by the tree',
            photoPath: 'u/p.jpg',
            status: 'confirmed',
          }),
        ]}
        isOwner={false}
      />,
    );
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(
      screen.getByText(new Date('2026-01-01T12:00:00Z').toLocaleString()),
    ).toBeInTheDocument();
    expect(screen.getByText('by the tree')).toHaveClass('break-words');
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'http://x/u/p.jpg');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  test('omits the photo when there is none', () => {
    render(<ReportMap lastSeen={lastSeen} sightings={[make({})]} isOwner />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  test('actions render only for the owner', () => {
    const renderActions = (s: Sighting) => <button>act {s.id}</button>;
    const props = { lastSeen, sightings: [make({})], renderActions };
    const { rerender } = render(<ReportMap {...props} isOwner={false} />);
    expect(screen.queryByText('act s1')).not.toBeInTheDocument();
    rerender(<ReportMap {...props} isOwner />);
    expect(screen.getByText('act s1')).toBeInTheDocument();
  });
});
