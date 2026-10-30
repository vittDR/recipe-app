// Notifications: one switch for all of them (this phone's permission plus the
// person's choice, which the server checks for every push), then one switch
// per kind. Muted kinds are stored on the profile; enqueue_push skips them.

import { useEffect, useState } from 'react';
import { ListRow, Screen, Section, Spinner, Switch } from '../components/ui.tsx';
import { useI18n, type MessageKey } from '../i18n/index.tsx';
import { useLive, useSave } from '../lib/hooks.ts';
import { enablePush, pushState, type PushState } from '../lib/push.ts';
import { useSession } from '../lib/session.tsx';
import { must, supabase } from '../lib/supabase.ts';

/** What people switch, and the outbox kinds each switch covers. */
const KINDS: { key: 'prompt' | 'reminder' | 'deck' | 'waiting' | 'result' | 'joined' | 'groceries'; kinds: string[] }[] = [
  { key: 'prompt', kinds: ['prompt'] },
  { key: 'reminder', kinds: ['reminder'] },
  { key: 'deck', kinds: ['deck_dealt'] },
  { key: 'waiting', kinds: ['partner_finished', 'nudge'] },
  { key: 'result', kinds: ['match', 'tiebreak'] },
  { key: 'joined', kinds: ['partner_joined'] },
  { key: 'groceries', kinds: ['groceries_added'] },
];

interface Prefs {
  push_enabled: boolean;
  push_muted: string[];
}

export function NotificationsScreen() {
  const { t } = useI18n();
  const { userId } = useSession();
  const write = useSave();
  const [push, setPush] = useState<PushState | null>(null);
  const { data: prefs, set: setPrefs, reload } = useLive<Prefs>(`notifications:${userId}`, async () =>
    must(await supabase.from('profiles').select('push_enabled, push_muted').eq('id', userId!).single()) as Prefs);

  useEffect(() => {
    void pushState().then(setPush).catch(() => setPush('unsupported'));
  }, []);

  const save = async (next: Prefs) => {
    setPrefs(() => next);
    if (!(await write(supabase.from('profiles').update(next).eq('id', userId!)))) await reload();
  };

  const setAllowed = async (on: boolean) => {
    if (!prefs) return;
    if (on && push !== 'on') {
      const state = await enablePush(userId!).catch(() => 'off' as const);
      setPush(state);
      if (state !== 'on') return;
    }
    await save({ ...prefs, push_enabled: on });
  };

  const setKind = (kinds: string[], on: boolean) => {
    if (!prefs) return;
    const muted = new Set(prefs.push_muted);
    for (const k of kinds) {
      if (on) muted.delete(k);
      else muted.add(k);
    }
    void save({ ...prefs, push_muted: [...muted] });
  };

  const allowed = push === 'on' && !!prefs?.push_enabled;
  const blocked = push === 'unsupported' || push === 'denied';

  return (
    <Screen back="/us" title={t('notifications.title')}>
      {push === null || prefs === null ? <Spinner /> : (
        <>
          <div className="list">
            <ListRow title={t('notifications.allow')}
              meta={push === 'unsupported' ? t('notifications.unsupported')
                : push === 'denied' ? t('notifications.denied') : t('notifications.allowHint')}
              trailing={<Switch checked={allowed} disabled={blocked} label={t('notifications.allow')} onChange={(v) => void setAllowed(v)} />} />
          </div>

          {allowed && (
            <Section label={t('notifications.kinds')}>
              <div className="list">
                {KINDS.map(({ key, kinds }) => {
                  const on = !kinds.some((k) => prefs.push_muted.includes(k));
                  const label = t(`notifications.${key}` as MessageKey);
                  return (
                    <ListRow key={key} title={label} meta={t(`notifications.${key}Hint` as MessageKey)}
                      trailing={<Switch checked={on} label={label} onChange={(v) => setKind(kinds, v)} />} />
                  );
                })}
              </div>
            </Section>
          )}
        </>
      )}
    </Screen>
  );
}
