// Kitchen equipment (creator, before the taste test): the appliances our
// recipes call for. Saved on the household (households.equipment); the deck
// never deals a recipe needing one it lacks (logic/facets.ts missingAppliances).
import { useState } from 'react';
import { APPLIANCES, type Appliance } from '@logic/facets.ts';
import { Icon } from '../../components/Icon.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useSetup } from '../../lib/onboarding.ts';
import { useSession } from '../../lib/session.tsx';
import { supabase } from '../../lib/supabase.ts';
import { Step } from './Step.tsx';

/** Drawn for these tiles (32 px grid), as in the design. */
const PATHS: Record<Appliance, string> = {
  oven: 'M7 5h18a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3zM4 11h24M9.5 14h13a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 8 21.5v-6A1.5 1.5 0 0 1 9.5 14zM9 8h.01M13 8h.01',
  'air fryer': 'M9 6h14a3 3 0 0 1 3 3v15a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3zM6 16h20M13 21h6M16 13.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z',
  blender: 'M10 4h12l-2 15h-8zM10 19h12v3a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3zM14 27h4M13 9h6',
};

/** Most kitchens have an oven, and many an air fryer: those start ticked. */
const DEFAULTS: Appliance[] = ['oven', 'air fryer'];

export function EquipmentScreen() {
  const { t } = useI18n();
  const { household, refresh } = useSession();
  const setup = useSetup('equipment');
  const saved = household?.equipment as Appliance[] | null | undefined;
  const [have, setHave] = useState<Set<Appliance>>(() => new Set(saved ?? DEFAULTS));
  const [busy, setBusy] = useState(false);

  const toggle = (a: Appliance) => setHave((h) => {
    const next = new Set(h);
    if (next.has(a)) next.delete(a);
    else next.add(a);
    return next;
  });

  const next = async () => {
    setBusy(true);
    await supabase.from('households').update({ equipment: APPLIANCES.filter((a) => have.has(a)) }).eq('id', household!.id);
    await refresh();
    setBusy(false);
    setup.next();
  };

  return (
    <Step back progress={setup} title={t('ob.equipment.title')} subtitle={t('ob.equipment.subtitle')}
      action={{ onClick: () => void next(), disabled: busy }}>
      <div className="appliances">
        {APPLIANCES.map((a) => (
          <button key={a} type="button" className="appliance" aria-pressed={have.has(a)} onClick={() => toggle(a)}>
            {have.has(a) && <span className="appliance__check" aria-hidden><Icon name="check" size={11} strokeWidth={3.6} /></span>}
            <svg width="36" height="36" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.9"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={PATHS[a]} />
            </svg>
            <span className="appliance__name">{t(`ob.equipment.items.${a === 'air fryer' ? 'airFryer' : a}`)}</span>
          </button>
        ))}
      </div>
    </Step>
  );
}
