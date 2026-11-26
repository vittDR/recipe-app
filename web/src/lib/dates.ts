// Calendar dates as YYYY-MM-DD strings, worked out at noon UTC so a time zone
// or a daylight-saving change never moves a day.

import { isoWeekday } from './hooks.ts';

const DAY_MS = 86_400_000;
const noon = (date: string) => Date.parse(`${date}T12:00:00Z`);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const isDate = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(noon(s));

export function addDays(date: string, n: number): string {
  return iso(noon(date) + n * DAY_MS);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((noon(to) - noon(from)) / DAY_MS);
}

/** Monday to Sunday of the week a date is in. */
export function weekOf(date: string): string[] {
  const monday = addDays(date, 1 - isoWeekday(date));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** The first day of the date's month, and of the month `n` months later. */
export function monthStart(date: string, n = 0): string {
  const d = new Date(noon(date));
  return iso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 12));
}

/** Every day of the month that starts on `first`. */
export function monthDays(first: string): string[] {
  const next = monthStart(first, 1);
  return Array.from({ length: daysBetween(first, next) }, (_, i) => addDays(first, i));
}
