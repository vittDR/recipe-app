// "Toujours à la maison" by category (creator, after the equipment; also
// household settings, `editing`): tiles like the appliances. A ticked tile's
// catalogue ingredients become household staples; unticking removes them.
// Only tiles whose state changed are written, so items added or learned one
// by one (record_list_choices) stay.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '../../components/Icon.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useSetup } from '../../lib/onboarding.ts';
import { PANTRY_GROUPS, PANTRY_ITEMS, PANTRY_PATHS, type PantryGroup } from '../../lib/pantry.ts';
import { useGroceryCatalog } from '../../lib/products.ts';
import { useSession } from '../../lib/session.tsx';
import { must, supabase } from '../../lib/supabase.ts';
import { Step } from './Step.tsx';

export function PantryScreen({ editing }: { editing?: boolean }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { household } = useSession();
  const hid = household!.id;
  const setup = useSetup('pantry');
  const { data: catalog } = useGroceryCatalog(hid);
  const [staples, setStaples] = useState<Set<string> | null>(null);
  const [have, setHave] = useState<Set<PantryGroup> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.from('household_staples').select('product_id').eq('household_id', hid)
      .then((r) => setStaples(new Set((must(r) as { product_id: string }[]).map((x) => x.product_id))));
  }, [hid]);

  /** Each tile's shared catalogue products. */
  const products = useMemo(() => {
    const byIngredient = new Map<string, string[]>();
    for (const p of catalog?.products ?? []) {
      if (p.household_id || !p.ingredient) continue;
      byIngredient.set(p.ingredient, [...(byIngredient.get(p.ingredient) ?? []), p.id]);
    }
    return Object.fromEntries(PANTRY_GROUPS.map((g) => [g, PANTRY_ITEMS[g].flatMap((i) => byIngredient.get(i) ?? [])])) as Record<PantryGroup, string[]>;
  }, [catalog]);

  // A tile starts ticked when the household already keeps all of it.
  const initial = useMemo(() => (staples && catalog
    ? new Set(PANTRY_GROUPS.filter((g) => products[g].length > 0 && products[g].every((id) => staples.has(id))))
    : null), [staples, catalog, products]);
  useEffect(() => {
    if (initial && !have) setHave(new Set(initial));
  }, [initial, have]);

  const toggle = (g: PantryGroup) => setHave((h) => {
    const next = new Set(h);
    if (next.has(g)) next.delete(g);
    else next.add(g);
    return next;
  });

  const next = async () => {
    if (!have || !initial) return;
    setBusy(true);
    const add = PANTRY_GROUPS.filter((g) => have.has(g) && !initial.has(g)).flatMap((g) => products[g]);
    const remove = PANTRY_GROUPS.filter((g) => !have.has(g) && initial.has(g)).flatMap((g) => products[g]);
    await Promise.all([
      add.length ? supabase.from('household_staples').upsert(add.map((product_id) => ({ household_id: hid, product_id }))) : null,
      remove.length ? supabase.from('household_staples').delete().eq('household_id', hid).in('product_id', remove) : null,
    ]);
    setBusy(false);
    if (editing) navigate(-1);
    else setup.next();
  };

  return (
    <Step back progress={editing ? undefined : setup} title={t('ob.pantry.title')} subtitle={t('ob.pantry.subtitle')}
      action={{ label: editing ? t('app.save') : undefined, onClick: () => void next(), disabled: busy || !have }}>
      <div className="appliances">
        {PANTRY_GROUPS.map((g) => {
          const on = !!have?.has(g);
          return (
            <button key={g} type="button" className="appliance" aria-pressed={on} onClick={() => toggle(g)}>
              {on && <span className="appliance__check" aria-hidden><Icon name="check" size={11} strokeWidth={3.6} /></span>}
              <svg width="36" height="36" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.9"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={PANTRY_PATHS[g]} />
              </svg>
              <span className="appliance__name">{t(`ob.pantry.groups.${g}`)}</span>
            </button>
          );
        })}
      </div>
    </Step>
  );
}
