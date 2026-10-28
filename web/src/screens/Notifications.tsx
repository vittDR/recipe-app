// Notifications: one switch for all of them (this phone's permission plus the
// person's choice, which the server checks for every push), then one switch
// per kind. Muted kinds are stored on the profile; enqueue_push skips them.

import { useEffect, useState } from 'react';
import { Screen, Spinner, Switch } from '../components/ui.tsx';
import { useI18n, type MessageKey } from '../i18n/index.tsx';
import { enablePush, pushState, type PushState } from '../lib/push.ts';
import { useSession } from '../lib/session.tsx';
import { supabase } from '../lib/supabase.ts';

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
  const [push, setPush] = useState<PushState | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);

  useEffect(() => {
    void pushState().then(setPush).catch(() => setPush('unsupported'));
    void supabase.from('profiles').select('push_enabled, push_muted').eq('id', userId!).single()
      .then(({ data }) => setPrefs((data as Prefs | null) ?? { push_enabled: true, push_muted: [] }));
  }, [userId]);

  const save = async (next: Prefs) => {
    const before = prefs;
    setPrefs(next);
    const { error } = await supabase.from('profiles').update(next).eq('id', userId!);
    if (error) setPrefs(before);
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
            <div className="list-row">
              <span className="list-row__main">
                <span className="list-row__title">{t('notifications.allow')}</span>
                <span className="list-row__meta">
                  {push === 'unsupported' ? t('notifications.unsupported')
                    : push === 'denied' ? t('notifications.denied') : t('notifications.allowHint')}
                </span>
              </span>
              <Switch checked={allowed} disabled={blocked} label={t('notifications.allow')} onChange={(v) => void setAllowed(v)} />
            </div>
          </div>

          {allowed && (
            <>
              <h2 className="section-label">{t('notifications.kinds')}</h2>
              <div className="list">
                {KINDS.map(({ key, kinds }) => {
                  const on = !kinds.some((k) => prefs.push_muted.includes(k));
                  const label = t(`notifications.${key}` as MessageKey);
                  return (
                    <div key={key} className="list-row">
                      <span className="list-row__main">
                        <span className="list-row__title">{label}</span>
                        <span className="list-row__meta">{t(`notifications.${key}Hint` as MessageKey)}</span>
                      </span>
                      <Switch checked={on} label={label} onChange={(v) => setKind(kinds, v)} />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
