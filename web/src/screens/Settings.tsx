import { useState } from 'react';
import { storeKey } from '@logic/groceries.ts';
import { useNavigate } from 'react-router';
import { Icon } from '../components/Icon.tsx';
import { MemberList } from '../components/Members.tsx';
import { Button, Chip, confirmSheet, Field, ListRow, Screen, Section, Spinner } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import { useLive, useSave } from '../lib/hooks.ts';
import { useSession } from '../lib/session.tsx';
import { must, supabase } from '../lib/supabase.ts';
import type { Aisle, Store } from '../lib/types.ts';

/** A row of the "Aisles and stores" order: an aisle or a store. */
type ListSection = { kind: 'aisle'; aisle: Aisle } | { kind: 'store'; store: Store };
const sectionKey = (s: ListSection) => (s.kind === 'aisle' ? s.aisle : storeKey(s.store.id));

interface SettingsData {
  sections: ListSection[];
  staples: string[];
}

export function SettingsScreen() {
  const { t } = useI18n();
  const { household, refresh } = useSession();
  const navigate = useNavigate();
  const save = useSave();
  const hid = household!.id;
  const [newStore, setNewStore] = useState('');
  const [newStaple, setNewStaple] = useState('');
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [household!.timezone];

  const { data, reload } = useLive<SettingsData>(`settings:${hid}`, async () => {
    const [aisles, stores, staples] = await Promise.all([
      supabase.from('household_aisle_order').select('aisle, position').eq('household_id', hid),
      supabase.from('household_stores').select('id, name, position').eq('household_id', hid),
      supabase.from('household_staples').select('name').eq('household_id', hid).order('name'),
    ]);
    return {
      sections: [
        ...(must(aisles) as { aisle: Aisle; position: number }[]).map((x) => ({ s: { kind: 'aisle', aisle: x.aisle } as ListSection, position: x.position })),
        ...(must(stores) as Store[]).map((x) => ({ s: { kind: 'store', store: x } as ListSection, position: x.position })),
      ].sort((x, y) => x.position - y.position).map((x) => x.s),
      staples: (must(staples) as { name: string }[]).map((x) => x.name),
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

  const addStaple = async () => {
    const name = newStaple.trim().toLowerCase();
    if (!name) return;
    setNewStaple('');
    await save(supabase.from('household_staples').upsert({ household_id: hid, name }));
    await reload();
  };

  const removeStaple = async (name: string) => {
    await save(supabase.from('household_staples').delete().eq('household_id', hid).eq('name', name));
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

  return (
    <Screen back="/us" title={t('settings.title')}>
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

      <Section label={t('settings.members')}>
        <MemberList onRemove={(id, name) => void removeMember(id, name)} />
      </Section>

      <Section label={t('settings.aisleOrder')} hint={t('settings.aisleOrderHint')}>
        {!data ? <Spinner /> : (
          <div className="list">
            {sections.map((s, i) => (
              <ListRow key={sectionKey(s)}
                // Aisles keep the icon column empty, so their names line up with the stores'.
                icon={s.kind === 'store' ? <Icon name="cart" size={18} /> : <span aria-hidden />}
                title={sectionName(s)}
                trailing={(
                  <>
                    {s.kind === 'store' && (
                      <button type="button" className="icon-btn" aria-label={`${t('app.delete')} ${s.store.name}`}
                        onClick={() => void removeStore(s.store)}><Icon name="trash" size={18} /></button>
                    )}
                    <button type="button" className="icon-btn" aria-label={`${t('settings.moveUp')} ${sectionName(s)}`}
                      disabled={i === 0} onClick={() => void move(i, -1)}><Icon name="up" size={18} /></button>
                    <button type="button" className="icon-btn" aria-label={`${t('settings.moveDown')} ${sectionName(s)}`}
                      disabled={i === sections.length - 1} onClick={() => void move(i, 1)}><Icon name="down" size={18} /></button>
                  </>
                )} />
            ))}
          </div>
        )}
        <form className="row mt-3" onSubmit={(e) => { e.preventDefault(); void addStore(); }}>
          <input className="input" value={newStore} maxLength={40} placeholder={t('settings.storeNamePlaceholder')}
            onChange={(e) => setNewStore(e.target.value)} aria-label={t('settings.addStore')} />
          <Button small variant="secondary" type="submit" disabled={!newStore.trim()}>{t('settings.addStore')}</Button>
        </form>
      </Section>

      <Section label={t('settings.staples')} hint={t('settings.staplesHint')}>
        <div className="chips">
          {(data?.staples ?? []).map((s) => <Chip key={s} onRemove={() => void removeStaple(s)} removeLabel={`${t('app.delete')} ${s}`}>{s}</Chip>)}
        </div>
        <form className="row mt-3" onSubmit={(e) => { e.preventDefault(); void addStaple(); }}>
          <input className="input" value={newStaple} onChange={(e) => setNewStaple(e.target.value)} aria-label={t('settings.staples')} />
          <Button small variant="secondary" type="submit" disabled={!newStaple.trim()}>{t('tastes.add')}</Button>
        </form>
      </Section>

      <Button block variant="danger" className="mt-8" onClick={() => void leave()}>{t('settings.leave')}</Button>
    </Screen>
  );
}
