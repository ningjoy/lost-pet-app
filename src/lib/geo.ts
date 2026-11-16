export type LatLng = { lat: number; lng: number };

const EWKB_SRID_FLAG = 0x20000000;
const WKB_POINT = 1;

/** Text form Postgres accepts for a geography column. Longitude comes first. */
export function toPointText({ lat, lng }: LatLng): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}

/**
 * Reads a point from the hex string PostgREST returns for a geography column,
 * e.g. "0101000020E6100000...". Returns null if the value is not a point.
 */
export function parsePoint(value: unknown): LatLng | null {
  if (typeof value !== 'string' || !/^([0-9a-f]{2})+$/i.test(value)) {
    return null;
  }
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }
  const view = new DataView(bytes.buffer);
  if (view.byteLength < 21) return null;

  const littleEndian = view.getUint8(0) === 1;
  const type = view.getUint32(1, littleEndian);
  if ((type & 0xff) !== WKB_POINT) return null;

  // An SRID, when present, sits between the type and the coordinates.
  const offset = type & EWKB_SRID_FLAG ? 9 : 5;
  if (view.byteLength < offset + 16) return null;

  return {
    lng: view.getFloat64(offset, littleEndian),
    lat: view.getFloat64(offset + 8, littleEndian),
  };
}

const METERS_PER_MILE = 1609.344;

export function milesToMeters(miles: number): number {
  return miles * METERS_PER_MILE;
}
