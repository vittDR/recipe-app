// 09 Week (creator): the evenings eaten at home this week, the same rows
// as the This week sheet. "Pareil chaque semaine" also makes it the usual week.
import { useEffect, useState } from 'react';
import { Checkbox, ListRow, Switch } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { isoWeekday } from '../../lib/hooks.ts';
import { useSetup } from '../../lib/onboarding.ts';
import { comingDays, cooksOn } from '../../lib/plan.ts';
import { useSession } from '../../lib/session.tsx';
import { supabase } from '../../lib/supabase.ts';
import type { PlanDate, PlanDay } from '../../lib/types.ts';
import { Step } from './Step.tsx';

export function WeekScreen() {
  const { t, list } = useI18n();
  const { household } = useSession();
  const setup = useSetup('week');
  const hid = household!.id;
  const days = comingDays(household!.timezone);
  const [cook, setCook] = useState<Record<string, boolean>>({});
  const [routine, setRoutine] = useState(true);
  const [busy, setBusy] = useState(false);
  const names = list('plan.daysLong');
  const short = list('plan.days');

  // Prefilled from the usual week (and any day already set).
  useEffect(() => {
    void Promise.all([
      supabase.from('plan_days').select('*').eq('household_id', hid),
      supabase.from('plan_dates').select('*').eq('household_id', hid).gte('for_date', days[0]).lte('for_date', days[6]),
    ]).then(([u, d]) => {
      const usual = u.data as PlanDay[] | null;
      const dates = d.data as PlanDate[] | null;
      setCook(Object.fromEntries(days.map((day) => [day, cooksOn(day, usual, dates)])));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hid, days[0]]);

  const next = async () => {
    setBusy(true);
    await supabase.from('plan_dates').upsert(days.map((day) => ({ household_id: hid, for_date: day, cook_at_home: cook[day] ?? true })));
    if (routine) {
      await supabase.from('plan_days').upsert(days.map((day) => ({ household_id: hid, weekday: isoWeekday(day), cook_at_home: cook[day] ?? true })));
    }
    setBusy(false);
    setup.next();
  };

  return (
    <Step back progress={setup} title={t('ob.week.title')} action={{ onClick: () => void next(), disabled: busy }}>
      <div className="stack">
        <div className="list">
          {days.map((day, i) => {
            const on = cook[day] ?? true;
            const name = names[isoWeekday(day) - 1];
            // As in the "Cette semaine" sheet: day and date as the icon, the day spelt out.
            return (
              <ListRow key={day} title={<span className={on ? undefined : 'muted'}>{name}</span>}
                icon={<span className={`week__day${i === 0 ? ' week__day--today' : ''}`} aria-hidden>
                  <span>{short[isoWeekday(day) - 1]}</span>
                  <span className="headline">{Number(day.slice(8, 10))}</span>
                </span>}
                meta={i === 0 ? t('week.today') : i === 1 ? t('week.tomorrow') : undefined}
                trailing={<Checkbox checked={on} label={`${name} ${Number(day.slice(8, 10))}`} onChange={(v) => setCook({ ...cook, [day]: v })} color="var(--accent)" />} />
            );
          })}
        </div>
        <div className="list">
          <ListRow title={t('ob.week.routine')} trailing={<Switch checked={routine} onChange={setRoutine} label={t('ob.week.routine')} />} />
        </div>
      </div>
    </Step>
  );
}
