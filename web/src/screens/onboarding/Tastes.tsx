import { useState } from 'react';
import { useNavigate } from 'react-router';
import { productName, type Product } from '@logic/products.ts';
import { CreateItemSheet } from '../../components/GrocerySheets.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Button, Chip, CreateRow, ListRow, Screen, SearchField, Section, Segmented, toast } from '../../components/ui.tsx';
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
  onCreate,
  onRemove,
}: {
  kind: 'never' | 'love';
  rules: TasteRule[];
  catalog: GroceryCatalog | null;
  onAdd: (p: Product) => void;
  /** Not in the catalog yet: open the New catalog item sheet with this name. */
  onCreate: (name: string) => void;
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
  const typed = query.trim();
  const { results: found, exact } = searchProducts(catalog, typed, { limit: RESULTS });
  const results = found.filter((p) => !have.has(p.id));
  const label = t(kind === 'never' ? 'tastes.never' : 'tastes.love');
  const pick = (p: Product) => {
    onAdd(p);
    setQuery('');
  };
  const create = () => {
    onCreate(typed);
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
          onEnter={() => (results[0] ? pick(results[0]) : typed && !exact && create())} />
        {typed && (results.length > 0 || !exact) && (
          <div className="list" role="listbox" aria-label={label}>
            {results.map((p) => (
              <ListRow key={p.id} role="option" title={productName(p, locale)} trailing={<Icon name="plus" size={20} />}
                onClick={() => pick(p)} />
            ))}
            {!exact && (
              <CreateRow role="option" title={t('groceries.createRow', { name: typed })} meta={t('groceries.createRowHint')} chevron
                onClick={create} />
            )}
          </div>
        )}
      </div>
    </Section>
  );
}

export function TastesScreen({ editing }: { editing?: boolean }) {
  const { t } = useI18n();
  const { userId, household, isCatalogAdmin } = useSession();
  const navigate = useNavigate();
  const save = useSave();
  const { data: catalog, reload: reloadCatalog } = useGroceryCatalog(household!.id);
  const [creating, setCreating] = useState<{ kind: 'never' | 'love'; name: string } | null>(null);
  const { data, reload } = useLive<TasteRule[]>(`tastes:${userId}`, async () =>
    must(await supabase.from('taste_rules').select('*').eq('user_id', userId!).order('created_at')) as TasteRule[]);
  const rules = data ?? [];

  const diet = (rules.find((r) => r.kind === 'diet')?.value ?? 'everything') as Diet;
  const setDiet = async (d: Diet) => {
    await save(supabase.from('taste_rules').delete().eq('user_id', userId!).eq('kind', 'diet'));
    if (d !== 'everything') await save(supabase.from('taste_rules').insert({ user_id: userId, kind: 'diet', value: d }));
    await reload();
  };
  const addRule = async (kind: 'never' | 'love', value: string, productId: string) => {
    await save(supabase.from('taste_rules').upsert({ user_id: userId, kind, value, product_id: productId }, { onConflict: 'user_id,kind,value' }));
    await reload();
  };
  const add = (kind: 'never' | 'love', p: Product) => addRule(kind, p.name_fr, p.id);
  // A new household item, as from the groceries search, then the rule on it.
  const create = async (kind: 'never' | 'love', { name, section, unit }: { name: string; section: string; unit: string | null }) => {
    setCreating(null);
    const store = section.startsWith('store:') ? section.slice('store:'.length) : null;
    const { data: id, error } = await supabase.rpc('create_household_product', {
      p_id: crypto.randomUUID(), p_name: name, p_aisle: store ? 'other' : section, p_unit: unit, p_store: store,
    });
    if (error || !id) {
      toast(t('app.error'));
      return;
    }
    await Promise.all([addRule(kind, name, id as string), reloadCatalog()]);
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
          onAdd={(p) => void add('never', p)} onCreate={(name) => setCreating({ kind: 'never', name })} onRemove={(r) => void remove(r)} />
        <RuleList kind="love" rules={rules} catalog={catalog}
          onAdd={(p) => void add('love', p)} onCreate={(name) => setCreating({ kind: 'love', name })} onRemove={(r) => void remove(r)} />
      </div>
      <div className="spacer spacer--gap" />
      <Button block onClick={() => (editing ? navigate(-1) : navigate('/', { replace: true }))}>
        {editing ? t('app.done') : t('app.continue')}
      </Button>
      <CreateItemSheet name={creating?.name ?? null} catalog={catalog} isAdmin={isCatalogAdmin} onClose={() => setCreating(null)}
        createLabel={t(creating?.kind === 'never' ? 'tastes.createAndNever' : 'tastes.createAndLove')}
        onCreate={(item) => creating && void create(creating.kind, item)}
        onUseExisting={(p) => { if (creating) void add(creating.kind, p); setCreating(null); }} />
    </Screen>
  );
}
