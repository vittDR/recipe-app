import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Icon } from '../components/Icon.tsx';
import { Avatar, Button, Chip, Field, Screen } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import { useSession } from '../lib/session.tsx';
import { supabase } from '../lib/supabase.ts';
import type { Aisle } from '../lib/types.ts';

export function SettingsScreen() {
  const { t } = useI18n();
  const { userId, household, members, refresh } = useSession();
  const navigate = useNavigate();
  const hid = household!.id;
  const isOwner = household!.owner_id === userId;
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [staples, setStaples] = useState<string[]>([]);
  const [newStaple, setNewStaple] = useState('');
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [household!.timezone];

  const loadLists = async () => {
    const [a, s] = await Promise.all([
      supabase.from('household_aisle_order').select('aisle').eq('household_id', hid).order('position'),
      supabase.from('household_staples').select('name').eq('household_id', hid).order('name'),
    ]);
    setAisles(((a.data ?? []) as { aisle: Aisle }[]).map((x) => x.aisle));
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
    const next = [...aisles];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setAisles(next);
    await supabase.from('household_aisle_order').upsert(next.map((aisle, position) => ({ household_id: hid, aisle, position })));
  };

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
        <Field label={t('settings.store')}>
          <input className="input" defaultValue={household!.store_name ?? ''} placeholder={t('settings.storePlaceholder')}
            onBlur={(e) => void update({ store_name: e.target.value.trim() || null })} />
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
              {m.role === 'owner' && <span className="list-row__meta"> · {t('settings.owner')}</span>}
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
      <div className="list">
        {aisles.map((a, i) => (
          <div key={a} className="list-row">
            <span className="list-row__main">{t(`groceries.aisles.${a}`)}</span>
            <button type="button" className="icon-btn" aria-label={`${t('settings.moveUp')} ${t(`groceries.aisles.${a}`)}`}
              disabled={i === 0} onClick={() => void move(i, -1)}><Icon name="up" size={18} /></button>
            <button type="button" className="icon-btn" aria-label={`${t('settings.moveDown')} ${t(`groceries.aisles.${a}`)}`}
              disabled={i === aisles.length - 1} onClick={() => void move(i, 1)}><Icon name="down" size={18} /></button>
          </div>
        ))}
      </div>

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
