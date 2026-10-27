import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Chip, Screen, Segmented } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useSession } from '../../lib/session.tsx';
import { supabase } from '../../lib/supabase.ts';
import type { Diet, TasteRule } from '../../lib/types.ts';

function RuleList({
  kind,
  rules,
  suggestions,
  onAdd,
  onRemove,
}: {
  kind: 'never' | 'love';
  rules: TasteRule[];
  suggestions: string[];
  onAdd: (value: string) => void;
  onRemove: (rule: TasteRule) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const mine = rules.filter((r) => r.kind === kind);
  const have = new Set(mine.map((r) => r.value));
  return (
    <section className="stack">
      <h2 className="section-label" style={{ margin: 0 }}>{t(kind === 'never' ? 'tastes.never' : 'tastes.love')}</h2>
      <div className="chips">
        {mine.map((r) => (
          <Chip key={r.id} onRemove={() => onRemove(r)} removeLabel={`${t('app.delete')} ${r.value}`}>{r.value}</Chip>
        ))}
        {suggestions.filter((s) => !have.has(s)).map((s) => (
          <Chip key={s} onClick={() => onAdd(s)}>+ {s}</Chip>
        ))}
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { onAdd(draft.trim().toLowerCase()); setDraft(''); } }}>
        <input className="input" value={draft} placeholder={t('tastes.addPlaceholder')} onChange={(e) => setDraft(e.target.value)}
          aria-label={t(kind === 'never' ? 'tastes.never' : 'tastes.love')} />
        <Button small variant="secondary" type="submit" disabled={!draft.trim()}>{t('tastes.add')}</Button>
      </form>
    </section>
  );
}

export function TastesScreen({ editing }: { editing?: boolean }) {
  const { t } = useI18n();
  const { userId } = useSession();
  const navigate = useNavigate();
  const [rules, setRules] = useState<TasteRule[]>([]);

  const load = async () => {
    const { data } = await supabase.from('taste_rules').select('*').eq('user_id', userId!).order('created_at');
    setRules((data ?? []) as TasteRule[]);
  };
  useEffect(() => {
    void load();
  }, [userId]);

  const diet = (rules.find((r) => r.kind === 'diet')?.value ?? 'everything') as Diet;
  const setDiet = async (d: Diet) => {
    await supabase.from('taste_rules').delete().eq('user_id', userId!).eq('kind', 'diet');
    if (d !== 'everything') await supabase.from('taste_rules').insert({ user_id: userId, kind: 'diet', value: d });
    await load();
  };
  const add = async (kind: 'never' | 'love', value: string) => {
    await supabase.from('taste_rules').upsert({ user_id: userId, kind, value }, { onConflict: 'user_id,kind,value' });
    await load();
  };
  const remove = async (r: TasteRule) => {
    await supabase.from('taste_rules').delete().eq('id', r.id);
    await load();
  };

  return (
    <Screen back={editing} title={t('tastes.title')} subtitle={t('tastes.subtitle')} plain>
      <div className="stack stack--lg">
        <section className="stack">
          <h2 className="section-label" style={{ margin: 0 }}>{t('tastes.diet')}</h2>
          <Segmented<Diet> label={t('tastes.diet')} value={diet} onChange={(d) => void setDiet(d)} options={[
            { value: 'everything', label: t('tastes.everything') },
            { value: 'pescatarian', label: t('tastes.pescatarian') },
            { value: 'vegetarian', label: t('tastes.vegetarian') },
          ]} />
        </section>
        <RuleList kind="never" rules={rules} suggestions={t('tastes.suggestionsNever').split(',')}
          onAdd={(v) => void add('never', v)} onRemove={(r) => void remove(r)} />
        <RuleList kind="love" rules={rules} suggestions={t('tastes.suggestionsLove').split(',')}
          onAdd={(v) => void add('love', v)} onRemove={(r) => void remove(r)} />
      </div>
      <div className="spacer" style={{ minHeight: 24 }} />
      <Button block onClick={() => (editing ? navigate(-1) : navigate('/', { replace: true }))}>
        {editing ? t('app.done') : t('app.continue')}
      </Button>
    </Screen>
  );
}
