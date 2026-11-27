// Seven evenings under the Ce soir title; tapping one switches Ce soir to it.
//   eating out                     nothing
//   eating in, no dish chosen yet  dotted terracotta ring, no fill
//   eating in, dish chosen         light terracotta circle
//   selected evening               terracotta circle
// Today has a terracotta letter. Which evenings are in is set in WeekSheet,
// from the calendar button in Ce soir's title bar.
import { Link } from 'react-router';
import { useI18n } from '../i18n/index.tsx';
import { isoWeekday } from '../lib/hooks.ts';
import { Icon } from './Icon.tsx';
import { Checkbox, ListRow, Sheet, SheetHeader } from './ui.tsx';

export interface StripDay {
  date: string;
  together: boolean;
  /** A dish is chosen (or cooked) for this evening. */
  chosen: boolean;
}

export function WeekStrip({ days, today, selected, onSelect }: {
  days: StripDay[]; today: string; selected: string; onSelect: (date: string) => void;
}) {
  const { t, list, locale } = useI18n();
  const names = list('plan.days');
  const long = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  return (
    <div className="card week-strip" role="group" aria-label={t('us.thisWeek')}>
      {days.map((d) => {
        const state = !d.together ? 'out' : d.chosen ? 'chosen' : 'open';
        const cls = ['week-strip__day', `week-strip__day--${state}`, d.date === today && 'week-strip__day--today',
          d.date === selected && 'week-strip__day--selected'].filter(Boolean).join(' ');
        return (
          <button key={d.date} type="button" className={cls} aria-pressed={d.date === selected}
            aria-label={long.format(new Date(`${d.date}T12:00:00Z`))} onClick={() => onSelect(d.date)}>
            <span className="week-strip__letter" aria-hidden>{names[isoWeekday(d.date) - 1].slice(0, 1)}</span>
            <span className="week-strip__circle" aria-hidden>
              {state === 'open' && d.date !== selected && (
                // 18 round dots spaced exactly evenly (pathLength), which a CSS dotted border can't do.
                <svg className="week-strip__ring" viewBox="0 0 34 34"><circle cx="17" cy="17" r="16" pathLength={18} /></svg>
              )}
              <span className="week-strip__num">{Number(d.date.slice(8))}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** This week: the next seven evenings, each switched in or out for that date only; the calendar for the rest. */
export function WeekSheet({ open, onClose, days, today, selected, onToggle, back }: {
  open: boolean;
  onClose: () => void;
  days: StripDay[];
  today: string;
  /** The evening Ce soir shows: the calendar marks it. */
  selected: string;
  onToggle: (date: string, cook: boolean) => void;
  /** Where the regular schedule's back button returns. */
  back: string;
}) {
  const { t, list, locale } = useI18n();
  const names = list('plan.daysLong');
  const short = list('plan.days');
  const dayMonth = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' });
  // "Nov 26 – Dec 2": the seven evenings the list switches.
  const range = days.length ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .formatRange(new Date(`${days[0].date}T12:00:00Z`), new Date(`${days[days.length - 1].date}T12:00:00Z`)) : undefined;
  return (
    <Sheet open={open} onClose={onClose} label={t('us.thisWeek')}>
      <SheetHeader title={t('us.thisWeek')} subtitle={range}
        action={(
          <Link to={`/calendar?from=${selected}`} className="pill-link">
            <Icon name="calendar" size={18} /> {t('calendar.open')}
          </Link>
        )} />
      <div className="list">
        {days.map((d, i) => {
          const name = names[isoWeekday(d.date) - 1];
          return (
            <ListRow key={d.date} title={name}
              icon={<span className={`week__day${d.date === today ? ' week__day--today' : ''}`} aria-hidden>
                <span>{short[isoWeekday(d.date) - 1]}</span>
                <span className="headline">{Number(d.date.slice(8))}</span>
              </span>}
              meta={i === 0 ? t('week.today') : i === 1 ? t('week.tomorrow') : undefined}
              trailing={<Checkbox checked={d.together} label={`${name} ${dayMonth.format(new Date(`${d.date}T12:00:00Z`))}`}
                onChange={(v) => onToggle(d.date, v)} color="var(--accent)" />} />
          );
        })}
      </div>
      <div className="list mt-4">
        <ListRow to="/us/plan" state={{ back }} tile="plain" icon={<Icon name="sync" size={18} />}
          title={t('week.usual')} meta={t('week.usualHint')} />
      </div>
    </Sheet>
  );
}
