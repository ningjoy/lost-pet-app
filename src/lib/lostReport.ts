/** Postgres unique violation, raised when a pet already has an open report. */
export const DUPLICATE_OPEN_REPORT = '23505';

/** Value for a datetime-local input, in the user's local time. */
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Reads a datetime-local value as local time. Returns null if it is empty or invalid. */
export function parseLocalInput(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatSeenAt(iso: string): string {
  return new Date(iso).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
