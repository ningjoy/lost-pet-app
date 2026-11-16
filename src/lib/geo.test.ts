import { describe, expect, test } from 'vitest';
import { milesToMeters, parsePoint, toPointText } from './geo';

// Real values returned by local Supabase for Alice's seeded home.
const ALICE_HEX = '0101000020E61000007E1D3867440D56C003780B24280E4440';

describe('toPointText', () => {
  test('puts longitude before latitude', () => {
    expect(toPointText({ lat: 40.12, lng: -88.25 })).toBe(
      'SRID=4326;POINT(-88.25 40.12)',
    );
  });
});

describe('parsePoint', () => {
  test('reads the hex string the database returns', () => {
    const point = parsePoint(ALICE_HEX);
    expect(point?.lng).toBeCloseTo(-88.2073, 4);
    expect(point?.lat).toBeCloseTo(40.1106, 4);
  });

  test('reads a point written without an SRID', () => {
    const hex = '0101000000' + '7E1D3867440D56C0' + '03780B24280E4440';
    expect(parsePoint(hex)?.lat).toBeCloseTo(40.1106, 4);
  });

  test.each([null, undefined, '', 'not hex', 42, '0101000020E6100000'])(
    'returns null for %j',
    (value) => {
      expect(parsePoint(value)).toBeNull();
    },
  );

  test('returns null for a non-point shape', () => {
    // Type 2 is a line string.
    const hex = '0102000020E61000007E1D3867440D56C003780B24280E4440';
    expect(parsePoint(hex)).toBeNull();
  });
});

describe('milesToMeters', () => {
  test('converts', () => {
    expect(milesToMeters(1)).toBeCloseTo(1609.344);
  });
});
