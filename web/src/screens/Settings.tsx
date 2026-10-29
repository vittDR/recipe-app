import { useEffect, useState } from 'react';
import { storeKey } from '@logic/groceries.ts';
import { Link, useNavigate } from 'react-router';
import { Icon } from '../components/Icon.tsx';
import { Avatar, Button, Chip, Field, Screen } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import { useSession } from '../lib/session.tsx';
import { supabase } from '../lib/supabase.ts';
import type { Aisle, Store } from '../lib/types.ts';

/** A row of the "Aisles and stores" order: an aisle or a store. */
type Section = { kind: 'aisle'; aisle: Aisle } | { kind: 'store'; store: Store };
const sectionKey = (s: Section) => (s.kind === 'aisle' ? s.aisle : storeKey(s.store.id));

export function SettingsScreen() {
  const { t } = useI18n();
  const { userId, household, members, refresh } = useSession();
  const navigate = useNavigate();
  const hid = household!.id;
  const isOwner = household!.owner_id === userId;
  const [sections, setSections] = useState<Section[]>([]);
  const [newStore, setNewStore] = useState('');
  const [staples, setStaples] = useState<string[]>([]);
  const [newStaple, setNewStaple] = useState('');
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [household!.timezone];

  const loadLists = async () => {
    const [a, st, s] = await Promise.all([
      supabase.from('household_aisle_order').select('aisle, position').eq('household_id', hid),
      supabase.from('household_stores').select('id, name, position').eq('household_id', hid),
      supabase.from('household_staples').select('name').eq('household_id', hid).order('name'),
    ]);
    setSections([
      ...((a.data ?? []) as { aisle: Aisle; position: number }[]).map((x) => ({ s: { kind: 'aisle', aisle: x.aisle } as Section, position: x.position })),
      ...((st.data ?? []) as Store[]).map((x) => ({ s: { kind: 'store', store: x } as Section, position: x.position })),
    ].sort((x, y) => x.position - y.position).map((x) => x.s));
    setStaples(((s.data ?? []) as { name: string }[]).map((x) => x.name));
  };
  useEffect(() => {
    void loadLists();
  }, [hid]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = async (fields: Record<string, string | null>) => {
    await supabase.from('households').update(fields).eq('id', hid);
    await refresh();
  };

  const move = async (i: number, dir: -1 | 1) => {
    const next = [...sections];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setSections(next);
    // Aisles and stores share one position space.
    const placed = next.map((s, position) => ({ s, position }));
    await Promise.all([
      supabase.from('household_aisle_order').upsert(placed.flatMap(({ s, position }) =>
        s.kind === 'aisle' ? [{ household_id: hid, aisle: s.aisle, position }] : [])),
      ...placed.flatMap(({ s, position }) => s.kind === 'store' && s.store.position !== position
        ? [supabase.from('household_stores').update({ position }).eq('id', s.store.id)] : []),
    ]);
    await loadLists();
  };

  const addStore = async () => {
    const name = newStore.trim();
    if (!name) return;
    setNewStore('');
    await supabase.rpc('add_store', { p_name: name });
    await loadLists();
  };

  const removeStore = async (store: Store) => {
    if (!confirm(t('settings.removeStoreConfirm', { name: store.name }))) return;
    await supabase.from('household_stores').delete().eq('id', store.id);
    await loadLists();
  };

  const sectionName = (s: Section) => (s.kind === 'aisle' ? t(`groceries.aisles.${s.aisle}`) : s.store.name);

  const addStaple = async () => {
    const name = newStaple.trim().toLowerCase();
    if (!name) return;
    setNewStaple('');
    await supabase.from('household_staples').upsert({ household_id: hid, name });
    await loadLists();
  };

  const removeStaple = async (name: string) => {
    await supabase.from('household_staples').delete().eq('household_id', hid).eq('name', name);
    await loadLists();
  };

  const removeMember = async (id: string, name: string) => {
    if (!confirm(t('settings.removeConfirm', { name }))) return;
    await supabase.rpc('remove_member', { p_user: id });
    await refresh();
  };

  const leave = async () => {
    if (!confirm(t('settings.leaveConfirm'))) return;
    await supabase.rpc('leave_household');
    await refresh();
    navigate('/onboarding/household', { replace: true });
  };

  return (
    <Screen back title={t('settings.title')}>
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

      <h2 className="section-label">{t('settings.members')}</h2>
      <div className="list">
        {members.map((m) => (
          <div key={m.user_id} className="list-row">
            <Avatar name={m.profile.first_name} color={m.profile.color} />
            <span className="list-row__main">
              <span className="list-row__title">{m.profile.first_name}</span>
              {m.user_id === household!.owner_id && <span className="list-row__meta"> · {t('settings.owner')}</span>}
            </span>
            {isOwner && m.user_id !== userId && (
              <Button small variant="text" onClick={() => void removeMember(m.user_id, m.profile.first_name)}>{t('settings.remove')}</Button>
            )}
          </div>
        ))}
        <Link to="/invite" className="list-row" style={{ color: 'var(--c-accent)' }}>
          <Icon name="plus" /> <span className="list-row__main">{t('settings.invite')}</span>
        </Link>
      </div>

      <h2 className="section-label">{t('settings.aisleOrder')}</h2>
      <p className="small muted" style={{ marginTop: 0 }}>{t('settings.aisleOrderHint')}</p>
      <div className="list">
        {sections.map((s, i) => (
          <div key={sectionKey(s)} className="list-row">
            <span className="list-row__main">
              {s.kind === 'store' && <Icon name="cart" size={16} />} {sectionName(s)}
            </span>
            {s.kind === 'store' && (
              <button type="button" className="icon-btn" aria-label={`${t('app.delete')} ${s.store.name}`}
                onClick={() => void removeStore(s.store)}><Icon name="trash" size={18} /></button>
            )}
            <button type="button" className="icon-btn" aria-label={`${t('settings.moveUp')} ${sectionName(s)}`}
              disabled={i === 0} onClick={() => void move(i, -1)}><Icon name="up" size={18} /></button>
            <button type="button" className="icon-btn" aria-label={`${t('settings.moveDown')} ${sectionName(s)}`}
              disabled={i === sections.length - 1} onClick={() => void move(i, 1)}><Icon name="down" size={18} /></button>
          </div>
        ))}
      </div>
      <form className="row" style={{ marginTop: 'var(--s-3)' }} onSubmit={(e) => { e.preventDefault(); void addStore(); }}>
        <input className="input" value={newStore} maxLength={40} placeholder={t('settings.storeNamePlaceholder')}
          onChange={(e) => setNewStore(e.target.value)} aria-label={t('settings.addStore')} />
        <Button small variant="secondary" type="submit" disabled={!newStore.trim()}>{t('settings.addStore')}</Button>
      </form>

      <h2 className="section-label">{t('settings.staples')}</h2>
      <p className="small muted" style={{ marginTop: 0 }}>{t('settings.staplesHint')}</p>
      <div className="chips">
        {staples.map((s) => <Chip key={s} onRemove={() => void removeStaple(s)} removeLabel={`${t('app.delete')} ${s}`}>{s}</Chip>)}
      </div>
      <form className="row" style={{ marginTop: 'var(--s-3)' }} onSubmit={(e) => { e.preventDefault(); void addStaple(); }}>
        <input className="input" value={newStaple} onChange={(e) => setNewStaple(e.target.value)} aria-label={t('settings.staples')} />
        <Button small variant="secondary" type="submit" disabled={!newStaple.trim()}>{t('tastes.add')}</Button>
      </form>

      <Button block variant="text" style={{ color: 'var(--c-danger)', marginTop: 'var(--s-8)' }} onClick={() => void leave()}>
        {t('settings.leave')}
      </Button>
    </Screen>
  );
}
