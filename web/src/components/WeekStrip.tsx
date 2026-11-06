// Seven evenings under the Ce soir title; tapping opens This week.
// Today: accent circle. Evenings eaten together: accent-soft circle. Others:
// no circle, faint number. A sage check once cooked, a photo dot once chosen.
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

export function WeekStrip({ days, today }: { days: StripDay[]; today: string }) {
  const { t, list } = useI18n();
  const names = list('plan.days');
  return (
    <Link to="/us/week" state={{ back: '/' }} className="card week-strip" aria-label={t('us.thisWeek')}>
      {days.map((d) => {
        const photo = d.meal && !d.meal.cooked ? thumbUrl(d.meal.image_path) : null;
        const cls = ['week-strip__day', d.date === today && 'week-strip__day--today', d.together && 'week-strip__day--together']
          .filter(Boolean).join(' ');
        return (
          <span key={d.date} className={cls}>
            <span className="week-strip__letter">{names[isoWeekday(d.date) - 1].slice(0, 1)}</span>
            <span className="week-strip__circle">
              {Number(d.date.slice(8))}
              {d.meal?.cooked && <span className="week-strip__mark week-strip__mark--done"><Icon name="check" size={9} strokeWidth={3.5} /></span>}
              {d.meal && !d.meal.cooked && (
                <span className="week-strip__mark week-strip__mark--photo"
                  style={photo ? { backgroundImage: `url("${photo}")` } : undefined} />
              )}
            </span>
          </span>
        );
      })}
    </Link>
  );
}
