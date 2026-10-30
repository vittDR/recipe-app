// Cook-at-home days: a date set on the This week screen wins, otherwise the
// usual week's weekday, otherwise yes. Mirrors is_cook_day() on the server.

import { isoWeekday, todayIn } from './hooks.ts';
import type { PlanDate, PlanDay } from './types.ts';

/** Today and the six days after it, in the household's time zone. */
export function comingDays(timeZone: string): string[] {
  return Array.from({ length: 7 }, (_, i) => todayIn(timeZone, i));
}

export function cooksOn(date: string, usual: PlanDay[] | null | undefined, dates: PlanDate[] | null | undefined): boolean {
  return dates?.find((d) => d.for_date === date)?.cook_at_home
    ?? usual?.find((d) => d.weekday === isoWeekday(date))?.cook_at_home
    ?? true;
}
