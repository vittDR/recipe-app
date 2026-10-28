import { useState } from 'react';
import { groupGroceries, storeKey, type GroupMode } from '@logic/groceries.ts';
import type { ParsedIngredient } from '@logic/ingredients.ts';
import { productName, sectionOf, type Product } from '@logic/products.ts';
import { formatQuantity } from '../components/AddToListSheet.tsx';
import { FrequentSheet, ItemSheet, useSectionTitle } from '../components/GrocerySheets.tsx';
import { Icon } from '../components/Icon.tsx';
import { ProductPicker } from '../components/ProductPicker.tsx';
import { Avatar, Button, Checkbox, Screen, Segmented, Spinner } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import { useLive } from '../lib/hooks.ts';
import { useGroceryCatalog } from '../lib/products.ts';
import { useSession } from '../lib/session.tsx';
import { must, supabase } from '../lib/supabase.ts';
import type { GroceryRow } from '../lib/types.ts';

const MODE_KEY = 'dineamite.groceryMode';
const SHOPPING_WINDOW_MS = 10 * 60_000;

interface ListData {
  items: GroceryRow[];
  recipes: Map<string, string>;
}

export function GroceriesScreen() {
  const { t, locale } = useI18n();
  const { userId, household, partners, memberName, memberColor } = useSession();
  const [mode, setModeState] = useState<GroupMode>(() => {
    try {
      return (localStorage.getItem(MODE_KEY) as GroupMode) || 'aisle';
    } catch {
      return 'aisle';
    }
  });
  const [draft, setDraft] = useState('');
  const [frequentOpen, setFrequentOpen] = useState(false);
  const [openItem, setOpenItem] = useState<GroceryRow | null>(null);

  const setMode = (m: GroupMode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      // storage unavailable
    }
  };

  const hid = household!.id;
  const { data: catalog, reload: reloadCatalog } = useGroceryCatalog(hid);
  const sectionTitleOf = useSectionTitle(catalog);
  const { data, loading, reload } = useLive<ListData>(
    `groceries:${hid}`,
    async () => {
      const rows = must(await supabase.from('grocery_items').select('*').eq('household_id', hid).is('cleared_at', null)) as GroceryRow[];
      const recipeIds = [...new Set(rows.map((r) => r.recipe_id).filter(Boolean))] as string[];
      const recipes = recipeIds.length
        ? (must(await supabase.from('recipes').select('id, title').in('id', recipeIds)) as { id: string; title: string }[])
        : [];
      return { items: rows, recipes: new Map(recipes.map((r) => [r.id, r.title])) };
    },
    [{ table: 'grocery_items', filter: `household_id=eq.${hid}` }],
  );

  const [optimistic, setOptimistic] = useState<Map<string, boolean>>(new Map());
  const displayName = (i: GroceryRow) => {
    const p = i.product_id ? catalog?.index.get(i.product_id) : undefined;
    return p ? productName(p, locale) : productName({ name_fr: i.name, name_en: null });
  };
  const items = (data?.items ?? []).map((i) => ({
    ...(optimistic.has(i.id)
      ? { ...i, checked_at: optimistic.get(i.id) ? i.checked_at ?? new Date().toISOString() : null, checked_by: optimistic.get(i.id) ? i.checked_by ?? userId : null }
      : i),
    name: displayName(i),
  }));
  const onList = new Set(items.filter((i) => !i.checked_at && i.product_id).map((i) => i.product_id!));

  const toggle = async (item: GroceryRow, checked: boolean) => {
    setOptimistic((m) => new Map(m).set(item.id, checked));
    navigator.vibrate?.(8);
    await supabase.from('grocery_items').update({
      checked_at: checked ? new Date().toISOString() : null,
      checked_by: checked ? userId : null,
    }).eq('id', item.id);
    await reload();
    setOptimistic((m) => {
      const next = new Map(m);
      next.delete(item.id);
      return next;
    });
  };

  const addProduct = async (product: Product | null, text: ParsedIngredient) => {
    const amount = { quantity: text.quantity, unit: text.unit === 'piece' ? null : text.unit };
    setDraft('');
    await supabase.rpc('add_grocery_items', {
      p_items: [product ? { product_id: product.id, ...amount } : { name: text.name, ...amount }],
    });
    await Promise.all([reload(), product ? null : reloadCatalog()]);
  };

  const clearChecked = async () => {
    await supabase.rpc('clear_checked_items');
    await reload();
  };

  const sections = groupGroceries(items, mode, catalog?.sectionOrder.length ? catalog.sectionOrder : undefined);
  const anyChecked = items.some((i) => i.checked_at);
  const shopper = partners.find((p) =>
    items.some((i) => i.checked_by === p.user_id && i.checked_at && Date.now() - Date.parse(i.checked_at) < SHOPPING_WINDOW_MS));

  const sectionTitle = (key: string) =>
    mode === 'aisle' ? sectionTitleOf(key)
      : mode === 'recipe' ? (key ? data?.recipes.get(key) ?? '' : t('groceries.noRecipe'))
        : key;

  const suggestionMeta = (p: Product) => {
    const s = sectionOf(p, catalog?.prefs.get(p.id));
    return sectionTitleOf(s.store_id ? storeKey(s.store_id) : s.aisle);
  };

  return (
    <Screen>
      <div className="screen__bar">
        <span className="muted">{household?.store_name ?? ''}</span>
        {anyChecked && <Button small variant="text" onClick={() => void clearChecked()}>{t('groceries.clearChecked')}</Button>}
      </div>
      <h1 className="screen__title">{t('groceries.title')}</h1>

      {shopper && (
        <p className="notice notice--success row">
          <Avatar name={shopper.profile.first_name} color={shopper.profile.color} size="sm" />
          {t('groceries.shopping', { name: shopper.profile.first_name })}
        </p>
      )}

      <ProductPicker catalog={catalog} value={draft} onChange={setDraft} onPick={(p, parsed) => void addProduct(p, parsed)}
        placeholder={t('groceries.addPlaceholder')} label={t('groceries.add')}
        metaOf={(p) => `${suggestionMeta(p)}${onList.has(p.id) ? ` · ${t('groceries.onList')}` : ''}`} />

      <div className="row" style={{ margin: 'var(--s-4) 0' }}>
        <Button small variant="secondary" onClick={() => setFrequentOpen(true)}>
          <Icon name="star" size={18} /> {t('groceries.frequent')}
        </Button>
      </div>

      <Segmented<GroupMode> label={t('groceries.by')} value={mode} onChange={setMode} options={[
        { value: 'aisle', label: t('groceries.aisle') },
        { value: 'recipe', label: t('groceries.recipe') },
        { value: 'az', label: t('groceries.az') },
      ]} />

      {loading && !data ? <Spinner /> : sections.length === 0 ? (
        <p className="muted center" style={{ marginTop: 'var(--s-8)' }}>🧺 {t('groceries.empty')}</p>
      ) : sections.map((section) => (
        <section key={section.key || 'none'}>
          <h2 className="section-label">{sectionTitle(section.key)}</h2>
          <div className="list">
            {section.items.map((item) => {
              const checked = !!item.checked_at;
              return (
                <div key={item.id} className={`list-row${checked ? ' list-row--checked' : ''}`}>
                  <Checkbox checked={checked} label={item.name} color={checked ? memberColor(item.checked_by) : undefined}
                    onChange={(v) => void toggle(item, v)} />
                  <button type="button" className="list-row__main list-row__tap"
                    onClick={() => setOpenItem(data?.items.find((i) => i.id === item.id) ?? null)}>
                    <span className="list-row__title">{item.name}</span>
                    {checked && item.checked_by && item.checked_by !== userId && (
                      <span className="list-row__meta">{t('groceries.checkedBy', { name: memberName(item.checked_by) })}</span>
                    )}
                  </button>
                  <span className="muted small">{formatQuantity(item.quantity, item.unit)}</span>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <FrequentSheet open={frequentOpen} onClose={() => setFrequentOpen(false)} catalog={catalog} onList={onList}
        onAdd={(p) => addProduct(p, { name: '', quantity: null, unit: null, raw_text: '' })} />
      <ItemSheet item={openItem} catalog={catalog} onClose={() => setOpenItem(null)}
        onChanged={() => void Promise.all([reload(), reloadCatalog()])} />
    </Screen>
  );
}
