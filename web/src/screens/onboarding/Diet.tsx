// 05 Diet: one of four, each with a plate. Saved as the taste rule 'diet'
// (no rule = eats everything); filters every deck this person eats from.
import { useEffect, useState } from 'react';
import mushroomRisotto from '../../assets/deck/mushroom-risotto.webp';
import pokeBowl from '../../assets/deck/poke-bowl.webp';
import roastChicken from '../../assets/deck/roast-chicken.webp';
import steak from '../../assets/deck/steak.webp';
import { Icon } from '../../components/Icon.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useSetup } from '../../lib/onboarding.ts';
import { useSession } from '../../lib/session.tsx';
import { supabase } from '../../lib/supabase.ts';
import { DIETS, type Diet } from '../../lib/types.ts';
import { Step } from './Step.tsx';

export const DIET_PLATES: Record<Diet, { img: string; bg: string }> = {
  everything: { img: steak, bg: '#d9a19b' },
  flexitarian: { img: roastChicken, bg: '#fae1ce' },
  pescatarian: { img: pokeBowl, bg: '#e7d9f7' },
  vegetarian: { img: mushroomRisotto, bg: '#d9aebb' },
};

/** The four diets as radio cards; shared with Us > Tastes. */
export function DietOptions({ value, onChange }: { value: Diet; onChange: (d: Diet) => void }) {
  const { t } = useI18n();
  return (
    <div className="stack stack--sm" role="radiogroup" aria-label={t('tastes.diet')}>
      {DIETS.map((d) => (
        <button key={d} type="button" role="radio" aria-checked={value === d} className="card option" onClick={() => onChange(d)}>
          <span className="option__plate" style={{ background: DIET_PLATES[d].bg }}><img src={DIET_PLATES[d].img} alt="" /></span>
          <span className="option__text">
            <span className="option__title">{t(`tastes.diets.${d}`)}</span>
            <span className="option__meta">{t(`tastes.dietMeta.${d}`)}</span>
          </span>
          <span className="option__radio">{value === d && <Icon name="check" size={14} strokeWidth={3} />}</span>
        </button>
      ))}
    </div>
  );
}

/** Saves a diet: one rule per person, none for "everything". */
export async function saveDiet(userId: string, d: Diet) {
  await supabase.from('taste_rules').delete().eq('user_id', userId).eq('kind', 'diet');
  if (d !== 'everything') await supabase.from('taste_rules').insert({ user_id: userId, kind: 'diet', value: d });
}

export function DietScreen() {
  const { t } = useI18n();
  const { userId } = useSession();
  const setup = useSetup('diet');
  const [diet, setDiet] = useState<Diet>('everything');
  const [busy, setBusy] = useState(false);

  // Back from a later step: show what was saved.
  useEffect(() => {
    void supabase.from('taste_rules').select('value').eq('user_id', userId!).eq('kind', 'diet').maybeSingle()
      .then(({ data }) => { if (data && DIETS.includes(data.value as Diet)) setDiet(data.value as Diet); });
  }, [userId]);

  const next = async () => {
    setBusy(true);
    await saveDiet(userId!, diet);
    setBusy(false);
    setup.next();
  };

  return (
    <Step back={false} progress={setup} title={t('ob.diet.title')} action={{ onClick: () => void next(), disabled: busy }}>
      <DietOptions value={diet} onChange={setDiet} />
    </Step>
  );
}
