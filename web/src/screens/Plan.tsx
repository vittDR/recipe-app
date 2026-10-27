import { useEffect, useState } from 'react';
import { Checkbox, Field, Screen } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import { useSession } from '../lib/session.tsx';
import { supabase } from '../lib/supabase.ts';
import type { PlanDay } from '../lib/types.ts';

export function PlanScreen() {
  const { t, list } = useI18n();
  const { household, refresh } = useSession();
  const [days, setDays] = useState<PlanDay[]>([]);
  const hid = household!.id;

  useEffect(() => {
    void supabase.from('plan_days').select('*').eq('household_id', hid).order('weekday')
      .then(({ data }) => setDays((data ?? []) as PlanDay[]));
  }, [hid]);

  const toggle = async (weekday: number, cook: boolean) => {
    setDays((ds) => ds.map((d) => (d.weekday === weekday ? { ...d, cook_at_home: cook } : d)));
    await supabase.from('plan_days').upsert({ household_id: hid, weekday, cook_at_home: cook });
  };

  const setTime = async (field: 'prompt_time' | 'reminder_time', value: string) => {
    if (!value) return;
    await supabase.from('households').update({ [field]: value }).eq('id', hid);
    await refresh();
  };

  const names = list('plan.daysLong');
  return (
    <Screen back title={t('plan.title')} subtitle={t('plan.subtitle')}>
      <div className="list">
        {names.map((name, i) => {
          const d = days.find((x) => x.weekday === i + 1);
          const cook = d?.cook_at_home ?? true;
          return (
            <div key={name} className="list-row">
              <span className="list-row__main">{name}</span>
              <Checkbox checked={cook} label={name} onChange={(v) => void toggle(i + 1, v)} color="var(--c-accent)" />
            </div>
          );
        })}
      </div>
      <div className="row" style={{ marginTop: 'var(--s-6)' }}>
        <Field label={t('plan.prompt')}>
          <input className="input" type="time" defaultValue={household!.prompt_time.slice(0, 5)}
            onChange={(e) => void setTime('prompt_time', e.target.value)} />
        </Field>
        <Field label={t('plan.reminder')}>
          <input className="input" type="time" defaultValue={household!.reminder_time.slice(0, 5)}
            onChange={(e) => void setTime('reminder_time', e.target.value)} />
        </Field>
      </div>
    </Screen>
  );
}
