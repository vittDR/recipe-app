// 06 Je ne mange pas: allergies (member_allergies, each allergen standing for
// its linked ingredients; never explained) and other foods ("never" taste
// rules, on one item or a whole group: "Pork (all)"). Both are this person's
// but filter every deck they eat from.
import { useState } from 'react';
import { productName, searchGroups, type IngredientGroup, type Product } from '@logic/products.ts';
import { useAllergies } from '../../components/Allergies.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Chip, ListRow, SearchField, toast } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useLive } from '../../lib/hooks.ts';
import { useSetup } from '../../lib/onboarding.ts';
import { avoidsGarlic, groupName, searchProducts, useGroceryCatalog, useIngredientGroups } from '../../lib/products.ts';
import { useSession } from '../../lib/session.tsx';
import { must, supabase } from '../../lib/supabase.ts';
import type { TasteRule } from '../../lib/types.ts';
import { Step } from './Step.tsx';

/** The allergens offered, in this order (the EU's 14 minus the rare ones). */
export const ALLERGENS = ['nuts', 'peanuts', 'milk', 'gluten', 'eggs', 'fish', 'crustaceans', 'soy', 'sesame'];
/** Groups offered as one-tap suggestions, before the items. */
const SUGGESTED_GROUPS = ['pork', 'red_meat', 'cheese', 'cow_milk', 'fish', 'seafood', 'mushrooms', 'chilli'];
/** One-tap suggestions; only those in the catalogue show. */
const SUGGESTED = ['coriandre', 'olives', 'abats', 'chou-fleur', 'betterave'];

export function NoEatScreen() {
  const { t, locale } = useI18n();
  const { userId, household } = useSession();
  const setup = useSetup('no-eat');
  const { data: catalog } = useGroceryCatalog(household!.id);
  const { data: allergies, set: setAllergies } = useAllergies();
  const { data: groups } = useIngredientGroups();
  const { data: rules, set: setRules } = useLive<TasteRule[]>(`tastes:${userId}`, async () =>
    must(await supabase.from('taste_rules').select('*').eq('user_id', userId!).order('created_at')) as TasteRule[]);
  const [query, setQuery] = useState('');

  const mine = (allergies?.mine ?? []).filter((a) => a.user_id === userId);
  const never = (rules ?? []).filter((r) => r.kind === 'never');

  const toggleAllergen = async (key: string) => {
    const chosen = mine.find((a) => a.allergen === key);
    if (chosen) {
      setAllergies((d) => d && { ...d, mine: d.mine.filter((x) => x.id !== chosen.id) });
      await supabase.from('member_allergies').delete().eq('id', chosen.id);
      return;
    }
    const { data: row, error } = await supabase.from('member_allergies').insert({ allergen: key })
      .select('id, user_id, allergen, ingredient').single();
    if (error || !row) toast(t('app.error'));
    else setAllergies((d) => d && { ...d, mine: [...d.mine, row] });
  };

  const addNever = async (p: Product) => {
    setQuery('');
    if (never.some((r) => r.product_id === p.id)) return;
    const { data: row, error } = await supabase.from('taste_rules')
      .upsert({ user_id: userId, kind: 'never', value: p.name_fr, product_id: p.id }, { onConflict: 'user_id,kind,value' })
      .select('*').single();
    if (error || !row) toast(t('app.error'));
    else setRules((rs) => [...(rs ?? []).filter((r) => r.id !== row.id), row as TasteRule]);
  };
  const addGroup = async (g: IngredientGroup) => {
    setQuery('');
    if (never.some((r) => r.group_key === g.key)) return;
    const { data: row, error } = await supabase.from('taste_rules')
      .upsert({ user_id: userId, kind: 'never', value: g.name_fr, group_key: g.key }, { onConflict: 'user_id,kind,value' })
      .select('*').single();
    if (error || !row) toast(t('app.error'));
    else setRules((rs) => [...(rs ?? []).filter((r) => r.id !== row.id), row as TasteRule]);
  };
  const removeNever = async (r: TasteRule) => {
    setRules((rs) => rs && rs.filter((x) => x.id !== r.id));
    await supabase.from('taste_rules').delete().eq('id', r.id);
  };

  const nameOf = (r: TasteRule) => {
    const g = r.group_key ? groups?.find((x) => x.key === r.group_key) : undefined;
    if (g) return groupName(g, locale);
    const p = r.product_id ? catalog?.index.get(r.product_id) : undefined;
    return p ? productName(p, locale) : r.value;
  };
  const taken = new Set(never.map((r) => r.product_id));
  const suggestions = catalog
    ? SUGGESTED.map((n) => catalog.index.find(n)).filter((p): p is Product => !!p && !taken.has(p.id))
    : [];
  const results = searchProducts(catalog, query, { limit: 6 }).results.filter((p) => !taken.has(p.id));
  const takenGroups = new Set(never.map((r) => r.group_key));
  const groupResults = searchGroups(groups ?? [], query).filter((g) => !takenGroups.has(g.key));
  const groupSuggestions = (groups ?? []).filter((g) => SUGGESTED_GROUPS.includes(g.key) && !takenGroups.has(g.key));
  const allergenName = (key: string) => {
    const a = allergies?.allergens.find((x) => x.key === key);
    return a ? (locale === 'fr' ? a.name_fr : a.name_en) : key;
  };

  return (
    <Step back progress={setup} onSkip={setup.next} title={t('ob.noEat.title')} action={{ onClick: setup.next }}>
      <div className="stack">
        <SearchField value={query} onChange={setQuery} placeholder={t('ob.noEat.search')} label={t('ob.noEat.search')}
          onEnter={() => (groupResults[0] ? void addGroup(groupResults[0]) : results[0] && void addNever(results[0]))} />
        {query.trim() && (
          results.length + groupResults.length > 0 ? (
            <div className="list" role="listbox" aria-label={t('ob.noEat.search')}>
              {groupResults.map((g) => (
                <ListRow key={g.key} role="option" title={groupName(g, locale)} meta={t('tastes.groupMeta', { n: g.ingredients.length })}
                  trailing={<Icon name="plus" size={20} />} onClick={() => void addGroup(g)} />
              ))}
              {results.map((p) => (
                <ListRow key={p.id} role="option" title={productName(p, locale)} trailing={<Icon name="plus" size={20} />}
                  onClick={() => void addNever(p)} />
              ))}
            </div>
          ) : <p className="small muted">{t('ob.noEat.noResult')}</p>
        )}
        <section className="ob-group">
          <h2 className="ob-group__label">{t('ob.noEat.allergies')}</h2>
          <div className="chips">
            {ALLERGENS.map((key) => (
              <Chip key={key} pressed={mine.some((a) => a.allergen === key)} onClick={() => void toggleAllergen(key)}>
                {allergenName(key)}
              </Chip>
            ))}
          </div>
        </section>
        <section className="ob-group">
          <h2 className="ob-group__label">{t('ob.noEat.also')}</h2>
          <div className="chips">
            {never.map((r) => (
              <Chip key={r.id} pressed onRemove={() => void removeNever(r)} removeLabel={`${t('app.delete')} ${nameOf(r)}`}>{nameOf(r)}</Chip>
            ))}
            {groupSuggestions.map((g) => (
              <Chip key={g.key} variant="dashed" onClick={() => void addGroup(g)}>+ {groupName(g, locale)}</Chip>
            ))}
            {suggestions.map((p) => (
              <Chip key={p.id} variant="dashed" onClick={() => void addNever(p)}>+ {productName(p, locale)}</Chip>
            ))}
          </div>
          {avoidsGarlic(never, catalog ?? null) && <p className="small muted" role="status">{t('tastes.garlicWarning')}</p>}
        </section>
      </div>
    </Step>
  );
}
