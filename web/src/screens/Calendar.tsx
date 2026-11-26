// Calendar (design/calendar/HANDOFF.md §3): every evening, month by month.
// Starts on this month; earlier months are above, back to the household's
// first logged dinner. Tapping a date opens Ce soir for that evening.
//   today                          filled terracotta circle
//   past, dinner logged            the dish, round, its number under it
//   future, dish decided           the dish with a terracotta ring
//   future, at home, not decided   dotted terracotta ring (as on the week strip)
//   eating out / nothing logged    a plain grey number
//   the date you came from         a dark ring
// No legend, on purpose.
import { useLayoutEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Icon } from '../components/Icon.tsx';
import { Spinner, thumbUrl } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import { addDays, isDate, monthDays, monthStart } from '../lib/dates.ts';
import { isoWeekday, todayIn, useLive } from '../lib/hooks.ts';
import { cooksOn, eveningPath } from '../lib/plan.ts';
import { useSession } from '../lib/session.tsx';
import { must, supabase } from '../lib/supabase.ts';
import type { PlanDate, PlanDay, Recipe } from '../lib/types.ts';

/** How far ahead the calendar goes, in months after this one. */
const MONTHS_AHEAD = 3;
/** How far back it can go at most, in months. */
const MONTHS_BACK = 24;

type DayMeal = { for_date: string; status: string; recipe: Pick<Recipe, 'title' | 'tags' | 'image_path'> | null };
interface CalendarData { meals: DayMeal[]; plan: PlanDay[]; dates: PlanDate[] }

export function CalendarScreen() {
  const { t, list, locale } = useI18n();
  const { household } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const today = todayIn(household!.timezone);
  const from = isDate(params.get('from')) ? params.get('from')! : today;
  const first = monthStart(today, -MONTHS_BACK);
  const last = addDays(monthStart(today, MONTHS_AHEAD + 1), -1);

  const { data } = useLive<CalendarData>(`calendar:${household!.id}:${today}`, async () => {
    const [meals, plan, dates] = await Promise.all([
      supabase.from('meals').select('for_date, status, recipe:recipes(title, tags, image_path)')
        .eq('household_id', household!.id).gte('for_date', first).lte('for_date', last).neq('status', 'skipped'),
      supabase.from('plan_days').select('*').eq('household_id', household!.id),
      supabase.from('plan_dates').select('*').eq('household_id', household!.id).gte('for_date', today).lte('for_date', last),
    ]);
    return { meals: must(meals) as unknown as DayMeal[], plan: must(plan) as PlanDay[], dates: must(dates) as PlanDate[] };
  }, [
    { table: 'meals', filter: `household_id=eq.${household!.id}` },
    { table: 'plan_dates', filter: `household_id=eq.${household!.id}` },
  ]);

  // From the month of the first logged dinner (this one when there's none) to MONTHS_AHEAD later.
  const earliest = data?.meals.reduce((min, m) => (m.for_date < min ? m.for_date : min), today) ?? today;
  const months: string[] = [];
  for (let m = monthStart(earliest); m <= last; m = monthStart(m, 1)) months.push(m);
  const meals = new Map((data?.meals ?? []).filter((m) => m.recipe).map((m) => [m.for_date, m]));

  // Opens on this month: the earlier ones are a scroll up.
  const current = useRef<HTMLElement>(null);
  const scrolled = useRef(false);
  useLayoutEffect(() => {
    if (!data || scrolled.current || !current.current) return;
    scrolled.current = true;
    current.current.scrollIntoView({ block: 'start' });
  }, [data]);

  const monthName = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' });
  const monthYear = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const long = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const letters = list('plan.days').map((d) => d.slice(0, 1));
  const thisYear = today.slice(0, 4);

  return (
    <main className="calendar">
      <div className="calendar__top">
        <div className="calendar__bar">
          <button type="button" className="icon-btn icon-btn--filled" aria-label={t('app.back')} onClick={() => navigate(-1)}>
            <Icon name="back" />
          </button>
          <h1 className="calendar__title">{t('calendar.title')}</h1>
          <button type="button" className="calendar__today" onClick={() => navigate('/')}>{t('calendar.today')}</button>
        </div>
        <div className="calendar__weekdays" aria-hidden>
          {letters.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      </div>
      {!data ? <Spinner /> : (
        <>
          {months.map((m) => {
            const days = monthDays(m);
            const label = cap((m.slice(0, 4) === thisYear ? monthName : monthYear).format(new Date(`${m}T12:00:00Z`)));
            return (
              <section key={m} className="calendar__month" ref={m === monthStart(today) ? current : undefined} aria-label={label}>
                <h2 className="calendar__month-name">{label}</h2>
                <div className="calendar__grid">
                  {days.map((date, i) => {
                    const meal = meals.get(date);
                    const past = date < today;
                    const state = date === today ? 'today'
                      : meal ? (past ? 'eaten' : 'decided')
                        : !past && cooksOn(date, data.plan, data.dates) ? 'open' : 'plain';
                    const src = meal?.recipe ? thumbUrl(meal.recipe.image_path) : null;
                    const cls = ['calendar__day', `calendar__day--${state}`, date === from && date !== today && 'calendar__day--from'].filter(Boolean).join(' ');
                    return (
                      <button key={date} type="button" className={cls}
                        style={i === 0 ? { gridColumnStart: isoWeekday(date) } : undefined}
                        aria-label={long.format(new Date(`${date}T12:00:00Z`))} aria-current={date === today ? 'date' : undefined}
                        onClick={() => navigate(eveningPath(date, today))}>
                        <span className="calendar__circle">
                          {(state === 'eaten' || state === 'decided')
                            ? (src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <span className="calendar__num">{Number(date.slice(8))}</span>)
                            : <span className="calendar__num">{Number(date.slice(8))}</span>}
                          {state === 'open' && (
                            <svg className="calendar__ring" viewBox="0 0 34 34" aria-hidden><circle cx="17" cy="17" r="16" pathLength={18} /></svg>
                          )}
                        </span>
                        {(state === 'eaten' || state === 'decided') && src && <span className="calendar__under">{Number(date.slice(8))}</span>}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {months[0] < monthStart(today) && <p className="calendar__earlier">{t('calendar.earlier')}</p>}
        </>
      )}
    </main>
  );
}
