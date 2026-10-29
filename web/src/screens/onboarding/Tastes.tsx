import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { productName, type Product } from '@logic/products.ts';
import { Icon } from '../../components/Icon.tsx';
import { Button, Chip, Screen, Segmented } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useGroceryCatalog, type GroceryCatalog } from '../../lib/products.ts';
import { useSession } from '../../lib/session.tsx';
import { supabase } from '../../lib/supabase.ts';
import type { Diet, TasteRule } from '../../lib/types.ts';

// Offered as one-tap chips: catalogue items people often feel strongly about.
const SUGGESTED = {
  never: ['champignons', 'olives', 'coriandre', 'aubergine', 'céleri', 'fenouil', 'piment'],
  love: ['pavé de saumon', 'avocat', 'œufs', 'crevettes', 'feta', 'pois chiches', 'pâtes'],
} as const;
const RESULTS = 5;

/** A rule's name: its catalogue item in the app's language, else the text it was saved with. */
function useRuleName() {
  const { locale } = useI18n();
  const { household } = useSession();
  const { data: catalog } = useGroceryCatalog(household!.id);
  return (r: TasteRule) => {
    const p = r.product_id ? catalog?.index.get(r.product_id) : undefined;
    return p ? productName(p, locale) : r.value;
  };
}

function RuleList({
  kind,
  rules,
  catalog,
  onAdd,
  onRemove,
}: {
  kind: 'never' | 'love';
  rules: TasteRule[];
  catalog: GroceryCatalog | null;
  onAdd: (p: Product) => void;
  onRemove: (rule: TasteRule) => void;
}) {
  const { t, locale } = useI18n();
  const nameOf = useRuleName();
  const [query, setQuery] = useState('');
  const mine = rules.filter((r) => r.kind === kind);
  const have = new Set(mine.map((r) => r.product_id));
  const suggestions = catalog
    ? SUGGESTED[kind].map((n) => catalog.index.find(n)).filter((p): p is Product => !!p && !have.has(p.id))
    : [];
  const results = query.trim() && catalog ? catalog.index.search(query, RESULTS).filter((p) => !have.has(p.id)) : [];
  const label = t(kind === 'never' ? 'tastes.never' : 'tastes.love');
  const pick = (p: Product) => {
    onAdd(p);
    setQuery('');
  };
  return (
    <section className="stack">
      <h2 className="section-label" style={{ margin: 0 }}>{label}</h2>
      <div className="chips">
        {mine.map((r) => (
          <Chip key={r.id} onRemove={() => onRemove(r)} removeLabel={`${t('app.delete')} ${nameOf(r)}`}>{nameOf(r)}</Chip>
        ))}
        {suggestions.map((p) => (
          <Chip key={p.id} onClick={() => onAdd(p)}>+ {productName(p, locale)}</Chip>
        ))}
      </div>
      <input className="input" type="search" value={query} placeholder={t('tastes.addPlaceholder')} aria-label={label}
        autoComplete="off" enterKeyHint="done" onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) { e.preventDefault(); pick(results[0]); } }} />
      {query.trim() && (results.length === 0 ? (
        <p className="muted small" style={{ margin: 0 }}>{t('groceries.noMatch', { query: query.trim() })}</p>
      ) : (
        <div className="list" role="listbox" aria-label={label}>
          {results.map((p) => (
            <button key={p.id} type="button" role="option" aria-selected={false} className="list-row" onClick={() => pick(p)}>
              <span className="list-row__main list-row__title">{productName(p, locale)}</span>
              <Icon name="plus" size={20} />
            </button>
          ))}
        </div>
      ))}
    </section>
  );
}

export function TastesScreen({ editing }: { editing?: boolean }) {
  const { t } = useI18n();
  const { userId, household } = useSession();
  const navigate = useNavigate();
  const { data: catalog } = useGroceryCatalog(household!.id);
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
  const add = async (kind: 'never' | 'love', p: Product) => {
    await supabase.from('taste_rules').upsert({ user_id: userId, kind, value: p.name_fr, product_id: p.id }, { onConflict: 'user_id,kind,value' });
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
        <RuleList kind="never" rules={rules} catalog={catalog}
          onAdd={(p) => void add('never', p)} onRemove={(r) => void remove(r)} />
        <RuleList kind="love" rules={rules} catalog={catalog}
          onAdd={(p) => void add('love', p)} onRemove={(r) => void remove(r)} />
      </div>
      <div className="spacer" style={{ minHeight: 24 }} />
      <Button block onClick={() => (editing ? navigate(-1) : navigate('/', { replace: true }))}>
        {editing ? t('app.done') : t('app.continue')}
      </Button>
    </Screen>
  );
}
