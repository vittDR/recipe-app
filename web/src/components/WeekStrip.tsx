// Seven evenings under the Ce soir title; tapping one switches Ce soir to it.
// Selected: accent circle. Today, when another day is selected: accent ring.
// Evenings eaten together: accent-soft circle. Others: no circle, faint
// number. A sage check once cooked, a photo dot once chosen.
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

export function WeekStrip({ days, today, selected, onSelect }: {
  days: StripDay[]; today: string; selected: string; onSelect: (date: string) => void;
}) {
  const { t, list, locale } = useI18n();
  const names = list('plan.days');
  const long = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  return (
    <div className="card week-strip" role="group" aria-label={t('us.thisWeek')}>
      {days.map((d) => {
        const photo = d.meal && !d.meal.cooked ? thumbUrl(d.meal.image_path) : null;
        const cls = ['week-strip__day', d.date === today && 'week-strip__day--today', d.date === selected && 'week-strip__day--selected',
          d.together && 'week-strip__day--together'].filter(Boolean).join(' ');
        return (
          <button key={d.date} type="button" className={cls} aria-pressed={d.date === selected}
            aria-label={long.format(new Date(`${d.date}T12:00:00Z`))} onClick={() => onSelect(d.date)}>
            <span className="week-strip__letter" aria-hidden>{names[isoWeekday(d.date) - 1].slice(0, 1)}</span>
            <span className="week-strip__circle" aria-hidden>
              {Number(d.date.slice(8))}
              {d.meal?.cooked && <span className="week-strip__mark week-strip__mark--done"><Icon name="check" size={9} strokeWidth={3.5} /></span>}
              {d.meal && !d.meal.cooked && (
                <span className="week-strip__mark week-strip__mark--photo"
                  style={photo ? { backgroundImage: `url("${photo}")` } : undefined} />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
