import { Icon } from '../components/Icon.tsx';
import { Checkbox, ListRow, Screen, Section } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import { useLive, useSave } from '../lib/hooks.ts';
import { useSession } from '../lib/session.tsx';
import { must, supabase } from '../lib/supabase.ts';
import type { PlanDay } from '../lib/types.ts';

export function PlanScreen() {
  const { t, list } = useI18n();
  const { household, refresh } = useSession();
  const save = useSave();
  const hid = household!.id;
  const { data: days, reload, set } = useLive<PlanDay[]>(`plan:${hid}`, async () =>
    must(await supabase.from('plan_days').select('*').eq('household_id', hid).order('weekday')) as PlanDay[]);

  const toggle = async (weekday: number, cook: boolean) => {
    set((ds) => ds && ds.map((d) => (d.weekday === weekday ? { ...d, cook_at_home: cook } : d)));
    await save(supabase.from('plan_days').upsert({ household_id: hid, weekday, cook_at_home: cook }));
    await reload();
  };

  const setTime = async (field: 'prompt_time' | 'reminder_time', value: string) => {
    if (!value) return;
    if (await save(supabase.from('households').update({ [field]: value }).eq('id', hid))) await refresh();
  };

  const names = list('plan.daysLong');
  return (
    <Screen back="/us" title={t('plan.title')} subtitle={t('plan.subtitle')}>
      <div className="list">
        {names.map((name, i) => {
          const cook = days?.find((x) => x.weekday === i + 1)?.cook_at_home ?? true;
          return (
            <ListRow key={name} title={<span className={cook ? 'headline' : 'muted'}>{name}</span>}
              trailing={<Checkbox checked={cook} label={name} onChange={(v) => void toggle(i + 1, v)} color="var(--accent)" />} />
          );
        })}
      </div>
      <Section label={t('notifications.title')}>
        <div className="list">
          <ListRow tile="accent" icon={<Icon name="bell" size={18} />} title={t('settings.promptRow')} trailing={(
            <input className="time-input" type="time" aria-label={t('plan.prompt')} defaultValue={household!.prompt_time.slice(0, 5)}
              onChange={(e) => void setTime('prompt_time', e.target.value)} />
          )} />
          <ListRow tile="accent" icon={<Icon name="clock" size={18} />} title={t('plan.reminder')} trailing={(
            <input className="time-input" type="time" aria-label={t('plan.reminder')} defaultValue={household!.reminder_time.slice(0, 5)}
              onChange={(e) => void setTime('reminder_time', e.target.value)} />
          )} />
        </div>
      </Section>
    </Screen>
  );
}
