const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Convert YYYY-MM-DD into a Date at UTC midnight
 */
export function toDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * Convert a DATE column value back into YYYY-MM-DD
 */
export function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Add whole days to a date
 */
export function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

/**
 * Convert local date-time YYYY-MM-DDTHH:mm into a Date.
 * The value is kept as-is (stored as if UTC) because it has no timezone.
 */
export function toLocalDateTime(value: string): Date {
  return new Date(`${value}:00.000Z`);
}

/**
 * Convert a stored local date-time back into YYYY-MM-DDTHH:mm
 */
export function toLocalDateTimeString(value: Date): string {
  return value.toISOString().slice(0, 16);
}

/**
 * Whether value is a real local date-time in YYYY-MM-DDTHH:mm format
 * (rejects impossible dates such as 2026-02-30T10:00)
 */
export function isLocalDateTime(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return false;
  }

  const date = toLocalDateTime(value);
  return !Number.isNaN(date.getTime()) && toLocalDateTimeString(date) === value;
}

/**
 * Number of calendar days from start to end, both inclusive
 */
export function countDaysInclusive(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
}
