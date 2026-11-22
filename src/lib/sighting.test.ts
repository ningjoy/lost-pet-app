import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fetchSightings, sightingSchema, submitSighting } from './sighting';

const db = vi.hoisted(() => ({
  insert: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  order: vi.fn(),
  eq: vi.fn(),
  in: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      insert: db.insert,
      select: () => ({
        eq: (...a: unknown[]) => {
          db.eq(...a);
          return {
            in: (...b: unknown[]) => {
              db.in(...b);
              return { order: db.order };
            },
          };
        },
      }),
    }),
    storage: {
      from: () => ({ upload: db.upload, remove: db.remove }),
    },
  },
}));

const pin = { lat: 40.1, lng: -88.2 };
const past = new Date(Date.now() - 60_000);

function file(type: string, size = 10) {
  return new File([new Uint8Array(size)], 'p', { type });
}

describe('sightingSchema', () => {
  test('accepts valid input', () => {
    const r = sightingSchema.safeParse({ pin, seenAt: past, note: 'by tree' });
    expect(r.success).toBe(true);
  });

  test('requires a pin', () => {
    expect(sightingSchema.safeParse({ seenAt: past, note: '' }).success).toBe(
      false,
    );
  });

  test('rejects a future time', () => {
    const seenAt = new Date(Date.now() + 3_600_000);
    expect(sightingSchema.safeParse({ pin, seenAt, note: '' }).success).toBe(
      false,
    );
  });

  test('rejects a bad file type', () => {
    const photo = file('image/gif');
    expect(
      sightingSchema.safeParse({ pin, seenAt: past, note: '', photo }).success,
    ).toBe(false);
  });

  test('rejects an oversize file', () => {
    const photo = file('image/png', 5242881);
    expect(
      sightingSchema.safeParse({ pin, seenAt: past, note: '', photo }).success,
    ).toBe(false);
  });

  test('trims the note and turns empty into null', () => {
    const a = sightingSchema.parse({ pin, seenAt: past, note: '  hi  ' });
    const b = sightingSchema.parse({ pin, seenAt: past, note: '   ' });
    expect(a.note).toBe('hi');
    expect(b.note).toBeNull();
  });

  test('rejects a note over 500 characters', () => {
    const note = 'a'.repeat(501);
    expect(sightingSchema.safeParse({ pin, seenAt: past, note }).success).toBe(
      false,
    );
  });
});

describe('submitSighting', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.insert.mockResolvedValue({ error: null });
    db.upload.mockResolvedValue({ error: null });
    db.remove.mockResolvedValue({ error: null });
  });

  const base = { reportId: 'r1', userId: 'u1', pin, seenAt: past, note: null };

  test('sends seen_at and never posted_at', async () => {
    await submitSighting(base);
    const row = db.insert.mock.calls[0][0];
    expect(row).toMatchObject({
      report_id: 'r1',
      reporter_id: 'u1',
      seen_at: past.toISOString(),
      photo_path: null,
      note: null,
      location: 'SRID=4326;POINT(-88.2 40.1)',
    });
    expect(row).not.toHaveProperty('posted_at');
    expect(db.upload).not.toHaveBeenCalled();
  });

  test('uploads the photo then inserts its path', async () => {
    await submitSighting({ ...base, photo: file('image/png') });
    const path = db.upload.mock.calls[0][0] as string;
    expect(path).toMatch(/^u1\/sightings\/[0-9a-f-]+\.png$/);
    expect(db.insert.mock.calls[0][0].photo_path).toBe(path);
    expect(db.upload.mock.invocationCallOrder[0]).toBeLessThan(
      db.insert.mock.invocationCallOrder[0],
    );
  });

  test('removes the file when the insert fails', async () => {
    db.insert.mockResolvedValue({ error: new Error('nope') });
    await expect(
      submitSighting({ ...base, photo: file('image/webp') }),
    ).rejects.toThrow('nope');
    expect(db.remove).toHaveBeenCalledWith([db.upload.mock.calls[0][0]]);
  });

  test('throws and skips the insert when the upload fails', async () => {
    db.upload.mockResolvedValue({ error: new Error('upload') });
    await expect(
      submitSighting({ ...base, photo: file('image/jpeg') }),
    ).rejects.toThrow('upload');
    expect(db.insert).not.toHaveBeenCalled();
  });
});

describe('fetchSightings', () => {
  beforeEach(() => vi.resetAllMocks());

  // POINT(-88.2 40.1) as EWKB hex, little endian with SRID 4326.
  const hex = '0101000020E6100000CDCCCCCCCC0C56C0CDCCCCCCCC0C4440';
  const row = (id: string, location: unknown, status = 'confirmed') => ({
    id,
    location,
    seen_at: '2026-01-01T00:00:00Z',
    note: 'n',
    photo_path: null,
    status,
  });

  test('keeps only unconfirmed and confirmed, orders by time, maps rows', async () => {
    db.order.mockResolvedValue({ data: [row('a', hex)], error: null });
    const r = await fetchSightings('r1');
    expect(db.eq).toHaveBeenCalledWith('report_id', 'r1');
    expect(db.in).toHaveBeenCalledWith('status', ['unconfirmed', 'confirmed']);
    expect(db.order).toHaveBeenCalledWith('seen_at');
    expect(r).toEqual([
      {
        id: 'a',
        point: { lat: 40.1, lng: -88.2 },
        seenAt: '2026-01-01T00:00:00Z',
        note: 'n',
        photoPath: null,
        status: 'confirmed',
      },
    ]);
  });

  test('drops rows with an unreadable location', async () => {
    db.order.mockResolvedValue({
      data: [row('a', hex), row('b', null), row('c', 'zz')],
      error: null,
    });
    expect((await fetchSightings('r1')).map((s) => s.id)).toEqual(['a']);
  });

  test('throws on error', async () => {
    db.order.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(fetchSightings('r1')).rejects.toThrow('boom');
  });
});
