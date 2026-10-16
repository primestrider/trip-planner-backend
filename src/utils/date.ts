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
 * Number of calendar days from start to end, both inclusive
 */
export function countDaysInclusive(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
}
