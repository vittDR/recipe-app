// Seven evenings under the Ce soir title; tapping one switches Ce soir to it.
// What each circle says:
//   cooking at home, nothing chosen yet  dashed accent ring
//   cooking at home, dish chosen         accent-soft circle + photo dot
//   cooked                               accent-soft circle + sage check
//   out                                  no circle, faint number
// The selected evening is the solid accent circle; today has an accent letter.
// The calendar button at the end turns the strip into in/out switches for the
// week, in place: tap the evenings you cook at home, then done.
import { useState } from 'react';
import { Link } from 'react-router';
import { useI18n } from '../i18n/index.tsx';
import { isoWeekday } from '../lib/hooks.ts';
import { Icon } from './Icon.tsx';
import { thumbUrl } from './ui.tsx';

export interface StripDay {
  date: string;
  together: boolean;
  /** The chosen dish, if any. */
  meal?: { cooked: boolean; image_path: string | null };
}

export function WeekStrip({ days, today, selected, onSelect, onToggle, back }: {
  days: StripDay[];
  today: string;
  selected: string;
  onSelect: (date: string) => void;
  /** Switch an evening to cooking at home (true) or out. */
  onToggle: (date: string, cook: boolean) => void;
  /** Where the regular schedule's back button returns. */
  back: string;
}) {
  const { t, list, locale } = useI18n();
  const [editing, setEditing] = useState(false);
  const names = list('plan.days');
  const long = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  return (
    <section className={`card week-strip${editing ? ' week-strip--editing' : ''}`} aria-label={t('us.thisWeek')}>
      <div className="week-strip__row">
        <div className="week-strip__days" role="group">
          {days.map((d) => {
            const photo = d.meal && !d.meal.cooked ? thumbUrl(d.meal.image_path) : null;
            const state = d.meal?.cooked ? 'cooked' : d.meal ? 'chosen' : d.together ? 'open' : 'out';
            const cls = ['week-strip__day', `week-strip__day--${state}`, d.date === today && 'week-strip__day--today',
              !editing && d.date === selected && 'week-strip__day--selected', editing && d.together && 'week-strip__day--in']
              .filter(Boolean).join(' ');
            const label = long.format(new Date(`${d.date}T12:00:00Z`));
            return (
              <button key={d.date} type="button" className={cls} aria-label={label}
                aria-pressed={editing ? d.together : d.date === selected}
                onClick={() => (editing ? onToggle(d.date, !d.together) : onSelect(d.date))}>
                <span className="week-strip__letter" aria-hidden>{names[isoWeekday(d.date) - 1].slice(0, 1)}</span>
                <span className="week-strip__circle" aria-hidden>
                  {Number(d.date.slice(8))}
                  {!editing && d.meal?.cooked && (
                    <span className="week-strip__mark week-strip__mark--done"><Icon name="check" size={9} strokeWidth={3.5} /></span>
                  )}
                  {!editing && d.meal && !d.meal.cooked && (
                    <span className="week-strip__mark week-strip__mark--photo"
                      style={photo ? { backgroundImage: `url("${photo}")` } : undefined} />
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <button type="button" className="week-strip__edit" aria-pressed={editing}
          aria-label={editing ? t('app.done') : t('week.edit')} onClick={() => setEditing(!editing)}>
          <Icon name={editing ? 'check' : 'calendar'} size={18} strokeWidth={editing ? 2.6 : undefined} />
        </button>
      </div>
      {editing && (
        <p className="week-strip__hint">
          {t('week.hint')}{' '}
          <Link to="/us/plan" state={{ back }}>{t('week.usual')}</Link>
        </p>
      )}
    </section>
  );
}
