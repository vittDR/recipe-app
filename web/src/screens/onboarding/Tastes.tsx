import { useState } from 'react';
import { useNavigate } from 'react-router';
import { productName, type Product } from '@logic/products.ts';
import { Icon } from '../../components/Icon.tsx';
import { Button, Chip, ListRow, Screen, SearchField, Section, Segmented } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useLive, useSave } from '../../lib/hooks.ts';
import { searchProducts, useGroceryCatalog, type GroceryCatalog } from '../../lib/products.ts';
import { useSession } from '../../lib/session.tsx';
import { must, supabase } from '../../lib/supabase.ts';
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
  const results = searchProducts(catalog, query, { limit: RESULTS }).results.filter((p) => !have.has(p.id));
  const label = t(kind === 'never' ? 'tastes.never' : 'tastes.love');
  const pick = (p: Product) => {
    onAdd(p);
    setQuery('');
  };
  return (
    <Section label={label} flush>
      <div className="stack">
        <div className="chips">
          {mine.map((r) => (
            <Chip key={r.id} onRemove={() => onRemove(r)} removeLabel={`${t('app.delete')} ${nameOf(r)}`}>{nameOf(r)}</Chip>
          ))}
          {suggestions.map((p) => (
            <Chip key={p.id} onClick={() => onAdd(p)}>+ {productName(p, locale)}</Chip>
          ))}
        </div>
        <SearchField value={query} onChange={setQuery} placeholder={t('tastes.addPlaceholder')} label={label}
          onEnter={() => results[0] && pick(results[0])} />
        {query.trim() && (results.length === 0 ? (
          <p className="muted small m-0">{t('groceries.noMatch', { query: query.trim() })}</p>
        ) : (
          <div className="list" role="listbox" aria-label={label}>
            {results.map((p) => (
              <ListRow key={p.id} role="option" title={productName(p, locale)} trailing={<Icon name="plus" size={20} />}
                onClick={() => pick(p)} />
            ))}
          </div>
        ))}
      </div>
    </Section>
  );
}

export function TastesScreen({ editing }: { editing?: boolean }) {
  const { t } = useI18n();
  const { userId, household } = useSession();
  const navigate = useNavigate();
  const save = useSave();
  const { data: catalog } = useGroceryCatalog(household!.id);
  const { data, reload } = useLive<TasteRule[]>(`tastes:${userId}`, async () =>
    must(await supabase.from('taste_rules').select('*').eq('user_id', userId!).order('created_at')) as TasteRule[]);
  const rules = data ?? [];

  const diet = (rules.find((r) => r.kind === 'diet')?.value ?? 'everything') as Diet;
  const setDiet = async (d: Diet) => {
    await save(supabase.from('taste_rules').delete().eq('user_id', userId!).eq('kind', 'diet'));
    if (d !== 'everything') await save(supabase.from('taste_rules').insert({ user_id: userId, kind: 'diet', value: d }));
    await reload();
  };
  const add = async (kind: 'never' | 'love', p: Product) => {
    await save(supabase.from('taste_rules').upsert({ user_id: userId, kind, value: p.name_fr, product_id: p.id }, { onConflict: 'user_id,kind,value' }));
    await reload();
  };
  const remove = async (r: TasteRule) => {
    await save(supabase.from('taste_rules').delete().eq('id', r.id));
    await reload();
  };

  return (
    <Screen back={editing} title={t('tastes.title')} subtitle={t('tastes.subtitle')} plain>
      <div className="stack stack--lg">
        <Section label={t('tastes.diet')} flush>
          <Segmented<Diet> label={t('tastes.diet')} value={diet} onChange={(d) => void setDiet(d)} options={[
            { value: 'everything', label: t('tastes.everything') },
            { value: 'pescatarian', label: t('tastes.pescatarian') },
            { value: 'vegetarian', label: t('tastes.vegetarian') },
          ]} />
        </Section>
        <RuleList kind="never" rules={rules} catalog={catalog}
          onAdd={(p) => void add('never', p)} onRemove={(r) => void remove(r)} />
        <RuleList kind="love" rules={rules} catalog={catalog}
          onAdd={(p) => void add('love', p)} onRemove={(r) => void remove(r)} />
      </div>
      <div className="spacer spacer--gap" />
      <Button block onClick={() => (editing ? navigate(-1) : navigate('/', { replace: true }))}>
        {editing ? t('app.done') : t('app.continue')}
      </Button>
    </Screen>
  );
}
