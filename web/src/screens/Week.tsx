import { Icon } from '../components/Icon.tsx';
import { Checkbox, ListRow, Screen } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import { isoWeekday, useLive, useSave } from '../lib/hooks.ts';
import { comingDays, cooksOn } from '../lib/plan.ts';
import { useSession } from '../lib/session.tsx';
import { must, supabase } from '../lib/supabase.ts';
import type { PlanDate, PlanDay } from '../lib/types.ts';

interface WeekData {
  usual: PlanDay[];
  dates: PlanDate[];
}

/** The next seven evenings, each switched on or off for that date only. */
export function WeekScreen() {
  const { t, list, locale } = useI18n();
  const { household } = useSession();
  const save = useSave();
  const hid = household!.id;
  const days = comingDays(household!.timezone);

  const { data, reload, set } = useLive<WeekData>(
    `week:${hid}:${days[0]}`,
    async () => {
      const [usual, dates] = await Promise.all([
        supabase.from('plan_days').select('*').eq('household_id', hid),
        supabase.from('plan_dates').select('*').eq('household_id', hid).gte('for_date', days[0]).lte('for_date', days[6]),
      ]);
      return { usual: must(usual) as PlanDay[], dates: must(dates) as PlanDate[] };
    },
    [{ table: 'plan_dates', filter: `household_id=eq.${hid}` }],
  );

  const toggle = async (date: string, cook: boolean) => {
    set((d) => d && { ...d, dates: [...d.dates.filter((x) => x.for_date !== date), { household_id: hid, for_date: date, cook_at_home: cook }] });
    await save(supabase.from('plan_dates').upsert({ household_id: hid, for_date: date, cook_at_home: cook }));
    await reload();
  };

  const names = list('plan.daysLong');
  const dayMonth = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' });
  return (
    <Screen back="/us" title={t('week.title')} subtitle={t('week.subtitle')}>
      <div className="list">
        {days.map((date, i) => {
          const name = names[isoWeekday(date) - 1];
          const cook = cooksOn(date, data?.usual, data?.dates);
          const when = dayMonth.format(new Date(`${date}T12:00:00Z`));
          return (
            <ListRow key={date} title={name}
              meta={i === 0 ? `${t('week.today')} · ${when}` : i === 1 ? `${t('week.tomorrow')} · ${when}` : when}
              trailing={<Checkbox checked={cook} label={`${name} ${when}`} onChange={(v) => void toggle(date, v)} color="var(--c-accent)" />} />
          );
        })}
      </div>
      <div className="list mt-6">
        <ListRow to="/us/plan" state={{ back: '/us/week' }} icon={<Icon name="calendar" />} title={t('week.usual')} meta={t('week.usualHint')} />
      </div>
    </Screen>
  );
}
