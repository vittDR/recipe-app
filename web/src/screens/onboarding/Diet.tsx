// 05 Diet: one of four, each with an icon. Saved as the taste rule 'diet'
// (no rule = eats everything); filters every deck this person eats from.
import { useEffect, useState } from 'react';
import { Icon, type IconName } from '../../components/Icon.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useSetup } from '../../lib/onboarding.ts';
import { useSession } from '../../lib/session.tsx';
import { supabase } from '../../lib/supabase.ts';
import { DIETS, type Diet } from '../../lib/types.ts';
import { Step } from './Step.tsx';

/** Each diet's icon, in a tile tinted by meaning: sage for the plant-based ones. */
const DIET_ICONS: Record<Diet, { icon: IconName; tile: 'accent' | 'sage' | 'iris' }> = {
  everything: { icon: 'utensils', tile: 'accent' },
  flexitarian: { icon: 'sprout', tile: 'sage' },
  pescatarian: { icon: 'fish', tile: 'iris' },
  vegetarian: { icon: 'leaf', tile: 'sage' },
};

/** The four diets as radio cards; shared with Us > Tastes. */
export function DietOptions({ value, onChange }: { value: Diet; onChange: (d: Diet) => void }) {
  const { t } = useI18n();
  return (
    <div className="stack stack--sm" role="radiogroup" aria-label={t('tastes.diet')}>
      {DIETS.map((d) => (
        <button key={d} type="button" role="radio" aria-checked={value === d} className="card option" onClick={() => onChange(d)}>
          <span className={`icon-tile icon-tile--${DIET_ICONS[d].tile}`}><Icon name={DIET_ICONS[d].icon} size={22} /></span>
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
