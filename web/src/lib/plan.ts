// Cook-at-home days: a date set on the This week screen wins, otherwise the
// usual week's weekday, otherwise yes. Mirrors is_cook_day() on the server.

import { useI18n } from '../i18n/index.tsx';
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

/** Ce soir for one evening of the week: today is plain "/", another day "/?day=…". */
export function eveningPath(date: string, today: string): string {
  return date === today ? '/' : `/?day=${date}`;
}

/** "Tonight", "Tomorrow" or the weekday's name, for an evening of the week. */
export function useEveningName(): (date: string, today: string) => string {
  const { t, list } = useI18n();
  const names = list('plan.daysLong');
  return (date, today) => {
    if (date === today) return t('tonight.title');
    if (date === todayAfter(today)) return t('tonight.tomorrow');
    return names[isoWeekday(date) - 1];
  };
}

const todayAfter = (date: string) => new Date(Date.parse(`${date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
