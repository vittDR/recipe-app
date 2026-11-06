import { useState } from 'react';
import { storeKey } from '@logic/groceries.ts';
import { productName, type Product } from '@logic/products.ts';
import { useNavigate } from 'react-router';
import { Icon } from '../components/Icon.tsx';
import { MemberList } from '../components/Members.tsx';
import { Button, Chip, confirmSheet, Field, ListRow, Screen, SearchField, Section, Sheet, SheetHeader, Spinner } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import { useLive, useSave } from '../lib/hooks.ts';
import { searchProducts, useGroceryCatalog } from '../lib/products.ts';
import { useSession } from '../lib/session.tsx';
import { must, supabase } from '../lib/supabase.ts';
import type { Aisle, PlanDay, Store } from '../lib/types.ts';

/** A row of the "Aisles and stores" order: an aisle or a store. */
type ListSection = { kind: 'aisle'; aisle: Aisle } | { kind: 'store'; store: Store };
const sectionKey = (s: ListSection) => (s.kind === 'aisle' ? s.aisle : storeKey(s.store.id));

interface SettingsData {
  sections: ListSection[];
  staples: string[];
  plan: PlanDay[];
}

export function SettingsScreen() {
  const { t, tn, list, locale } = useI18n();
  const { household, refresh } = useSession();
  const navigate = useNavigate();
  const save = useSave();
  const hid = household!.id;
  const [newStore, setNewStore] = useState('');
  const [stapleQuery, setStapleQuery] = useState('');
  const [open, setOpen] = useState<'staples' | 'aisles' | null>(null);
  const { data: catalog } = useGroceryCatalog(hid);
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [household!.timezone];

  const { data, reload } = useLive<SettingsData>(`settings:${hid}`, async () => {
    const [aisles, stores, staples, plan] = await Promise.all([
      supabase.from('household_aisle_order').select('aisle, position').eq('household_id', hid),
      supabase.from('household_stores').select('id, name, position').eq('household_id', hid),
      supabase.from('household_staples').select('product_id').eq('household_id', hid),
      supabase.from('plan_days').select('*').eq('household_id', hid).order('weekday'),
    ]);
    return {
      sections: [
        ...(must(aisles) as { aisle: Aisle; position: number }[]).map((x) => ({ s: { kind: 'aisle', aisle: x.aisle } as ListSection, position: x.position })),
        ...(must(stores) as Store[]).map((x) => ({ s: { kind: 'store', store: x } as ListSection, position: x.position })),
      ].sort((x, y) => x.position - y.position).map((x) => x.s),
      staples: (must(staples) as { product_id: string }[]).map((x) => x.product_id),
      plan: must(plan) as PlanDay[],
    };
  });
  const sections = data?.sections ?? [];

  const update = async (fields: Record<string, string>) => {
    if (await save(supabase.from('households').update(fields).eq('id', hid), t('app.saved'))) await refresh();
  };

  const move = async (i: number, dir: -1 | 1) => {
    const next = [...sections];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    // Aisles and stores share one position space.
    const placed = next.map((s, position) => ({ s, position }));
    await Promise.all([
      save(supabase.from('household_aisle_order').upsert(placed.flatMap(({ s, position }) =>
        s.kind === 'aisle' ? [{ household_id: hid, aisle: s.aisle, position }] : []))),
      ...placed.flatMap(({ s, position }) => s.kind === 'store' && s.store.position !== position
        ? [save(supabase.from('household_stores').update({ position }).eq('id', s.store.id))] : []),
    ]);
    await reload();
  };

  const addStore = async () => {
    const name = newStore.trim();
    if (!name) return;
    setNewStore('');
    await save(supabase.rpc('add_store', { p_name: name }));
    await reload();
  };

  const removeStore = async (store: Store) => {
    if (!(await confirmSheet(t('settings.removeStoreConfirm', { name: store.name }), { confirmLabel: t('app.delete') }))) return;
    await save(supabase.from('household_stores').delete().eq('id', store.id));
    await reload();
  };

  const sectionName = (s: ListSection) => (s.kind === 'aisle' ? t(`groceries.aisles.${s.aisle}`) : s.store.name);

  // Staples are catalogue items, matched on recipe lines' items.
  const staples = (data?.staples ?? [])
    .map((id) => catalog?.index.get(id))
    .filter((p): p is Product => !!p)
    .map((p) => ({ id: p.id, label: productName(p, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
  const haveStaple = new Set(data?.staples ?? []);
  const stapleResults = searchProducts(catalog, stapleQuery, { limit: 5 }).results.filter((p) => !haveStaple.has(p.id));

  const addStaple = async (p: Product) => {
    setStapleQuery('');
    await save(supabase.from('household_staples').upsert({ household_id: hid, product_id: p.id }));
    await reload();
  };

  const removeStaple = async (id: string) => {
    await save(supabase.from('household_staples').delete().eq('household_id', hid).eq('product_id', id));
    await reload();
  };

  const removeMember = async (id: string, name: string) => {
    if (!(await confirmSheet(t('settings.removeConfirm', { name }), { confirmLabel: t('settings.remove') }))) return;
    if (await save(supabase.rpc('remove_member', { p_user: id }))) await refresh();
  };

  const leave = async () => {
    if (!(await confirmSheet(t('settings.leaveConfirm'), { confirmLabel: t('settings.leave') }))) return;
    if (!(await save(supabase.rpc('leave_household')))) return;
    await refresh();
    navigate('/onboarding/household', { replace: true });
  };

  const days = list('plan.days');
  const together = (data?.plan ?? []).filter((d) => d.cook_at_home).map((d) => days[d.weekday - 1]);

  return (
    <Screen back="/us">
      <span className="t-label muted">{t('settings.overline')}</span>
      <h1 className="screen__title mt-1">{household!.name}</h1>

      <Section label={t('settings.members')} flush>
        <MemberList onRemove={(id, name) => void removeMember(id, name)} />
      </Section>

      <Section label={t('settings.groceries')}>
        <div className="list">
          <ListRow tile="sage" icon={<Icon name="home" size={18} />} title={t('settings.staplesRow')}
            value={tn('settings.items', staples.length)} chevron onClick={() => setOpen('staples')} />
          <ListRow tile="sage" icon={<Icon name="basket" size={18} />} title={t('settings.aisleOrder')}
            value={sections.length || undefined} chevron onClick={() => setOpen('aisles')} />
        </div>
      </Section>

      <Section label={t('settings.programme')}>
        <div className="list">
          <ListRow to="/us/plan" tile="accent" icon={<Icon name="calendar" size={18} />} title={t('plan.title')}
            meta={together.length ? together.join(', ') : undefined} />
        </div>
      </Section>

      <Section label={t('settings.household')}>
        <div className="stack">
          <Field label={t('settings.name')}>
            <input className="input" defaultValue={household!.name} maxLength={60}
              onBlur={(e) => e.target.value.trim() && e.target.value !== household!.name && void update({ name: e.target.value.trim() })} />
          </Field>
          <Field label={t('settings.timezone')}>
            <select className="input" value={household!.timezone} onChange={(e) => void update({ timezone: e.target.value })}>
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <Button block variant="danger" className="mt-8" onClick={() => void leave()}>{t('settings.leave')}</Button>

      <Sheet open={open === 'staples'} onClose={() => setOpen(null)} label={t('settings.staplesRow')} className="sheet--fixed">
        <SheetHeader title={t('settings.staplesRow')} subtitle={t('settings.staplesHint')}
          action={<Button small variant="text" onClick={() => setOpen(null)}>{t('app.done')}</Button>} />
        <div className="stack">
          <SearchField value={stapleQuery} onChange={setStapleQuery} placeholder={t('tastes.addPlaceholder')} label={t('settings.staples')}
            onEnter={() => stapleResults[0] && void addStaple(stapleResults[0])} />
          {stapleQuery.trim() && stapleResults.length > 0 && (
            <div className="list" role="listbox" aria-label={t('settings.staples')}>
              {stapleResults.map((p) => (
                <ListRow key={p.id} role="option" title={productName(p, locale)} trailing={<Icon name="plus" size={20} />}
                  onClick={() => void addStaple(p)} />
              ))}
            </div>
          )}
          <div className="chips">
            {staples.map((x) => (
              <Chip key={x.id} onRemove={() => void removeStaple(x.id)} removeLabel={`${t('app.delete')} ${x.label}`}>{x.label}</Chip>
            ))}
          </div>
        </div>
      </Sheet>

      <Sheet open={open === 'aisles'} onClose={() => setOpen(null)} label={t('settings.aisleOrder')}>
        <SheetHeader title={t('settings.aisleOrder')} action={<Button small variant="text" onClick={() => setOpen(null)}>{t('app.done')}</Button>} />
        {!data ? <Spinner /> : (
          <div className="list">
            {sections.map((x, i) => (
              <ListRow key={sectionKey(x)}
                // Aisles keep the icon column empty, so their names line up with the stores'.
                icon={x.kind === 'store' ? <Icon name="basket" size={18} /> : <span aria-hidden />}
                title={sectionName(x)}
                trailing={(
                  <>
                    {x.kind === 'store' && (
                      <button type="button" className="icon-btn" aria-label={`${t('app.delete')} ${x.store.name}`}
                        onClick={() => void removeStore(x.store)}><Icon name="trash" size={18} /></button>
                    )}
                    <button type="button" className="icon-btn" aria-label={`${t('settings.moveUp')} ${sectionName(x)}`}
                      disabled={i === 0} onClick={() => void move(i, -1)}><Icon name="up" size={18} /></button>
                    <button type="button" className="icon-btn" aria-label={`${t('settings.moveDown')} ${sectionName(x)}`}
                      disabled={i === sections.length - 1} onClick={() => void move(i, 1)}><Icon name="down" size={18} /></button>
                  </>
                )} />
            ))}
          </div>
        )}
        <form className="row mt-4" onSubmit={(e) => { e.preventDefault(); void addStore(); }}>
          <input className="input" value={newStore} maxLength={40} placeholder={t('settings.storeNamePlaceholder')}
            onChange={(e) => setNewStore(e.target.value)} aria-label={t('settings.addStore')} />
          <Button small variant="secondary" type="submit" disabled={!newStore.trim()}>{t('settings.addStore')}</Button>
        </form>
      </Sheet>
    </Screen>
  );
}
