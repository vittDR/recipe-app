// 07 Weeknight (creator): the household's deck defaults, time, effort and
// envie. They prefill Ce soir's deck settings and can change for every deck
// (households.deck_defaults, lib/deckSettings.ts).
import { useState } from 'react';
import { FILTER_CUISINES, type DeckFilters } from '@logic/deckFilters.ts';
import { EFFORTS, MOODS, TIMES, useDeckLabels } from '../../components/DeckSettings.tsx';
import { Chip } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { householdDefaults, type HouseholdDefaults } from '../../lib/deckSettings.ts';
import { useSetup } from '../../lib/onboarding.ts';
import { useSession } from '../../lib/session.tsx';
import { supabase } from '../../lib/supabase.ts';
import type { Mood } from '../../lib/types.ts';
import { Step } from './Step.tsx';

const ENVIES = MOODS.filter((m) => m !== 'any' && m !== 'quick');

/** Adds or removes `v`; an emptied list is no filter. */
const toggle = <T,>(list: T[] | undefined, v: T): T[] | undefined => {
  const next = list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v];
  return next.length ? next : undefined;
};

export function WeeknightScreen() {
  const { t } = useI18n();
  const { household, refresh } = useSession();
  const setup = useSetup('weeknight');
  const labels = useDeckLabels();
  const [d, setD] = useState<HouseholdDefaults>(() => householdDefaults(household));
  const [more, setMore] = useState(() => !!d.filters.cuisines?.length);
  const [busy, setBusy] = useState(false);
  const f = d.filters;
  const setFilters = (filters: DeckFilters) => setD({ ...d, filters });

  const next = async () => {
    setBusy(true);
    await supabase.from('households').update({ deck_defaults: d }).eq('id', household!.id);
    await refresh();
    setBusy(false);
    setup.next();
  };

  const nothing = d.mood === 'any' && !f.spice && !f.cuisines?.length;
  return (
    <Step back progress={setup} title={t('ob.weeknight.title')} subtitle={t('ob.weeknight.subtitle')}
      action={{ onClick: () => void next(), disabled: busy }}>
      <div className="stack">
        <section className="ob-group">
          <h2 className="ob-group__label">{t('tonight.timeLabel')}</h2>
          <div className="chips">
            {TIMES.map((m) => (
              <Chip key={m ?? 'any'} pressed={d.maxMinutes === m} onClick={() => setD({ ...d, maxMinutes: m })}>
                {m === null ? t('ob.weeknight.anyTime') : m >= 60 ? labels.time(m) : t('ob.weeknight.upTo', { n: m })}
              </Chip>
            ))}
          </div>
        </section>
        <section className="ob-group">
          <h2 className="ob-group__label">{t('tonight.effortLabel')}</h2>
          <div className="chips">
            {EFFORTS.map((e) => (
              <Chip key={e} pressed={(f.effort ?? 'any') === e} onClick={() => setFilters({ ...f, effort: e === 'any' ? undefined : e })}>
                {t(`tonight.efforts.${e}`)}
              </Chip>
            ))}
          </div>
        </section>
        <section className="ob-group">
          <h2 className="ob-group__label">{t('ob.weeknight.envie')}</h2>
          <div className="chips">
            <Chip pressed={nothing} onClick={() => setD({ ...d, mood: 'any', filters: { ...f, spice: undefined, cuisines: undefined } })}>
              {labels.mood('any')}
            </Chip>
            {ENVIES.map((m: Mood) => (
              <Chip key={m} pressed={d.mood === m} onClick={() => setD({ ...d, mood: d.mood === m ? 'any' : m })}>{labels.mood(m)}</Chip>
            ))}
            <Chip pressed={f.spice === 'spicy'} onClick={() => setFilters({ ...f, spice: f.spice === 'spicy' ? undefined : 'spicy' })}>
              {t('tonight.filters.spices.spicy')}
            </Chip>
            {!more && <Chip variant="dashed" onClick={() => setMore(true)}>+ {t('ob.weeknight.others')}</Chip>}
            {more && FILTER_CUISINES.map((c) => (
              <Chip key={c} pressed={!!f.cuisines?.includes(c)} onClick={() => setFilters({ ...f, cuisines: toggle(f.cuisines, c) })}>
                {t(`tonight.filters.cuisines.${c}`)}
              </Chip>
            ))}
          </div>
        </section>
      </div>
    </Step>
  );
}
