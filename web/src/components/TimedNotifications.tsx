// The two scheduled notifications, the evening question and the follow-up:
// a switch each (this person's choice, stored in push_muted) and the
// household's time, shown only while the switch is on.
import { useI18n } from '../i18n/index.tsx';
import { useLive, useSave } from '../lib/hooks.ts';
import { useSession } from '../lib/session.tsx';
import { must, supabase } from '../lib/supabase.ts';
import { Icon } from './Icon.tsx';
import { ListRow, Switch } from './ui.tsx';

interface Prefs {
  push_muted: string[];
}

export function TimedNotifications() {
  const { t } = useI18n();
  const { userId, household, refresh } = useSession();
  const save = useSave();
  const { data: prefs, set, reload } = useLive<Prefs>(`push-muted:${userId}`, async () =>
    must(await supabase.from('profiles').select('push_muted').eq('id', userId!).single()) as Prefs);

  const toggle = async (kind: 'prompt' | 'reminder', on: boolean) => {
    if (!prefs) return;
    // Read again: the other switches on Notifications save push_muted too.
    const { data: now } = await supabase.from('profiles').select('push_muted').eq('id', userId!).single();
    const muted = new Set((now?.push_muted as string[] | undefined) ?? prefs.push_muted);
    if (on) muted.delete(kind);
    else muted.add(kind);
    set(() => ({ push_muted: [...muted] }));
    if (!(await save(supabase.from('profiles').update({ push_muted: [...muted] }).eq('id', userId!)))) await reload();
  };
  const setTime = async (field: 'prompt_time' | 'reminder_time', value: string) => {
    if (!value) return;
    if (await save(supabase.from('households').update({ [field]: value }).eq('id', household!.id))) await refresh();
  };

  const rows = [
    { kind: 'prompt' as const, field: 'prompt_time' as const, icon: 'bell' as const, title: t('settings.promptRow'), time: household!.prompt_time },
    { kind: 'reminder' as const, field: 'reminder_time' as const, icon: 'clock' as const, title: t('plan.reminder'), time: household!.reminder_time },
  ];
  return (
    <div className="list">
      {rows.map((r) => {
        const on = !!prefs && !prefs.push_muted.includes(r.kind);
        return (
          <ListRow key={r.kind} tile="accent" icon={<Icon name={r.icon} size={18} />} title={r.title} trailing={(
            <>
              {on && (
                <input className="time-input" type="time" aria-label={r.title} defaultValue={r.time.slice(0, 5)}
                  onChange={(e) => void setTime(r.field, e.target.value)} />
              )}
              <Switch checked={on} disabled={!prefs} label={r.title} onChange={(v) => void toggle(r.kind, v)} />
            </>
          )} />
        );
      })}
    </div>
  );
}
