// Kitchen equipment (creator, before the taste test; also Us > Préférences,
// `editing`): twelve appliances, as designed. Saved on the household
// (households.equipment); the deck never deals a recipe needing one it lacks
// (logic/facets.ts missingAppliances): today the oven, air fryer or blender.
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { APPLIANCES, type Appliance } from '@logic/facets.ts';
import { Icon } from '../../components/Icon.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useSetup } from '../../lib/onboarding.ts';
import { useSession } from '../../lib/session.tsx';
import { supabase } from '../../lib/supabase.ts';
import { Step } from './Step.tsx';

/** The design's drawings (32 px grid), one path each. */
const PATHS: Record<Appliance, string> = {
  oven: 'M7 5h18a3 3 0 0 1 3 3v16a3 3 0 0 1 -3 3h-18a3 3 0 0 1 -3 -3v-16a3 3 0 0 1 3 -3zM4 11h24M9.5 14h13.0a1.5 1.5 0 0 1 1.5 1.5v6.0a1.5 1.5 0 0 1 -1.5 1.5h-13.0a1.5 1.5 0 0 1 -1.5 -1.5v-6.0a1.5 1.5 0 0 1 1.5 -1.5zM9 8h.01M13 8h.01',
  'air fryer': 'M9 6h14a3 3 0 0 1 3 3v15a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3zM6 16h20M13 21h6M13.8 11a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0',
  microwave: 'M5.5 7h21.0a2.5 2.5 0 0 1 2.5 2.5v13.0a2.5 2.5 0 0 1 -2.5 2.5h-21.0a2.5 2.5 0 0 1 -2.5 -2.5v-13.0a2.5 2.5 0 0 1 2.5 -2.5zM8.0 10.5h11.0a1.5 1.5 0 0 1 1.5 1.5v8.0a1.5 1.5 0 0 1 -1.5 1.5h-11.0a1.5 1.5 0 0 1 -1.5 -1.5v-8.0a1.5 1.5 0 0 1 1.5 -1.5zM24.5 11v1M24.5 15v1M24.5 19v2',
  multicooker: 'M8 13h16l-1.5 12a2 2 0 0 1-2 1.8h-9a2 2 0 0 1-2-1.8zM7 13h18M12 13V9.5a4 4 0 0 1 8 0V13M13 20h6',
  blender: 'M10 4h12l-2 15h-8zM10 19h12v3a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3zM14 27h4M13 9h6',
  'hand blender': 'M15.5 3h1.0a2.5 2.5 0 0 1 2.5 2.5v7.0a2.5 2.5 0 0 1 -2.5 2.5h-1.0a2.5 2.5 0 0 1 -2.5 -2.5v-7.0a2.5 2.5 0 0 1 2.5 -2.5zM14.5 15v8M17.5 15v8M12 23h8l-1.5 4h-5z',
  'stand mixer': 'M7 14c0-5 4-9 10-9h3a5 5 0 0 1 5 5v1H11M15 11v6M9 20h14l-1.5 6.5h-11zM7 20h18',
  steamer: 'M7 12h18v5H7zM7 17h18v5a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3zM5 12h22M12 8c0-1.5 1.2-1.5 1.2-3M18 8c0-1.5 1.2-1.5 1.2-3',
  'pressure cooker': 'M6 14h20v8a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5zM4 14h24M10 14a6 6 0 0 1 12 0M16 5v3M26 18h3',
  'slow cooker': 'M5 12a11 3.5 0 1 0 22 0a11 3.5 0 1 0 -22 0M5 12v9a5 5 0 0 0 5 5h12a5 5 0 0 0 5-5v-9M14 8.5h4M13 20h6',
  'rice cooker': 'M6 13h20v9a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5zM8 13a8 6 0 0 1 16 0M16 7V5M14.4 20a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0',
  barbecue: 'M5 13h22a11 11 0 0 1-22 0zM5 13h22M10 23l-3 6M22 23l3 6M16 24v5M11 6c0 2 1.5 2 1.5 4M17 6c0 2 1.5 2 1.5 4',
};

/** Its name's key under ob.equipment.items. */
export const APPLIANCE_LABEL = {
  oven: 'oven',
  'air fryer': 'airFryer',
  microwave: 'microwave',
  multicooker: 'multicooker',
  blender: 'blender',
  'hand blender': 'handBlender',
  'stand mixer': 'standMixer',
  steamer: 'steamer',
  'pressure cooker': 'pressureCooker',
  'slow cooker': 'slowCooker',
  'rice cooker': 'riceCooker',
  barbecue: 'barbecue',
} as const satisfies Record<Appliance, string>;

/** As in the design: the oven, air fryer, microwave and hand blender start ticked. */
const DEFAULTS: Appliance[] = ['oven', 'air fryer', 'microwave', 'hand blender'];

export function EquipmentScreen({ editing }: { editing?: boolean }) {
  const { t } = useI18n();
  const navigate = useNavigate();
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
    if (editing) navigate(-1);
    else setup.next();
  };

  return (
    <Step back progress={editing ? undefined : setup} title={t('ob.equipment.title')} subtitle={t('ob.equipment.subtitle')}
      action={{ label: editing ? t('app.save') : undefined, onClick: () => void next(), disabled: busy }}>
      <div className="appliances">
        {APPLIANCES.map((a) => (
          <button key={a} type="button" className="appliance" aria-pressed={have.has(a)} onClick={() => toggle(a)}>
            {have.has(a) && <span className="appliance__check" aria-hidden><Icon name="check" size={11} strokeWidth={3.6} /></span>}
            <svg width="36" height="36" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.9"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={PATHS[a]} />
            </svg>
            <span className="appliance__name">{t(`ob.equipment.items.${APPLIANCE_LABEL[a]}`)}</span>
          </button>
        ))}
      </div>
    </Step>
  );
}
