import { useState } from 'react';
import { groupGroceries, type GroupMode } from '@logic/groceries.ts';
import { parseIngredientLine } from '@logic/ingredients.ts';
import { formatQuantity } from '../components/AddToListSheet.tsx';
import { Icon } from '../components/Icon.tsx';
import { Avatar, Button, Checkbox, Screen, Segmented, Spinner } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import { useCatalog, useLive } from '../lib/hooks.ts';
import { useSession } from '../lib/session.tsx';
import { must, supabase } from '../lib/supabase.ts';
import type { Aisle, GroceryRow } from '../lib/types.ts';

const MODE_KEY = 'dineamite.groceryMode';
const SHOPPING_WINDOW_MS = 10 * 60_000;

interface ListData {
  items: GroceryRow[];
  aisleOrder: Aisle[];
  recipes: Map<string, string>;
}

export function GroceriesScreen() {
  const { t } = useI18n();
  const { userId, household, partners, memberName, memberColor } = useSession();
  const catalog = useCatalog();
  const [mode, setModeState] = useState<GroupMode>(() => {
    try {
      return (localStorage.getItem(MODE_KEY) as GroupMode) || 'aisle';
    } catch {
      return 'aisle';
    }
  });
  const [draft, setDraft] = useState('');

  const setMode = (m: GroupMode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      // storage unavailable
    }
  };

  const hid = household!.id;
  const { data, loading, reload } = useLive<ListData>(
    `groceries:${hid}`,
    async () => {
      const [items, order] = await Promise.all([
        supabase.from('grocery_items').select('*').eq('household_id', hid).is('cleared_at', null),
        supabase.from('household_aisle_order').select('aisle, position').eq('household_id', hid).order('position'),
      ]);
      const rows = must(items) as GroceryRow[];
      const recipeIds = [...new Set(rows.map((r) => r.recipe_id).filter(Boolean))] as string[];
      const recipes = recipeIds.length
        ? (must(await supabase.from('recipes').select('id, title').in('id', recipeIds)) as { id: string; title: string }[])
        : [];
      return {
        items: rows,
        aisleOrder: (must(order) as { aisle: Aisle }[]).map((o) => o.aisle),
        recipes: new Map(recipes.map((r) => [r.id, r.title])),
      };
    },
    [{ table: 'grocery_items', filter: `household_id=eq.${hid}` }],
  );

  const [optimistic, setOptimistic] = useState<Map<string, boolean>>(new Map());
  const items = (data?.items ?? []).map((i) =>
    optimistic.has(i.id)
      ? { ...i, checked_at: optimistic.get(i.id) ? i.checked_at ?? new Date().toISOString() : null, checked_by: optimistic.get(i.id) ? i.checked_by ?? userId : null }
      : i,
  );

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

  const add = async () => {
    const parsed = parseIngredientLine(draft);
    if (!parsed.name) return;
    const entry = catalog?.find(parsed.name);
    setDraft('');
    await supabase.rpc('add_grocery_items', {
      p_items: [{ name: entry?.name ?? parsed.name, quantity: parsed.quantity, unit: parsed.unit === 'piece' ? null : parsed.unit, aisle: entry?.default_aisle }],
    });
    await reload();
  };

  const clearChecked = async () => {
    await supabase.rpc('clear_checked_items');
    await reload();
  };

  const sections = groupGroceries(items, mode, data?.aisleOrder.length ? data.aisleOrder : undefined);
  const anyChecked = items.some((i) => i.checked_at);
  const shopper = partners.find((p) =>
    items.some((i) => i.checked_by === p.user_id && i.checked_at && Date.now() - Date.parse(i.checked_at) < SHOPPING_WINDOW_MS));

  const sectionTitle = (key: string) =>
    mode === 'aisle' ? t(`groceries.aisles.${key as Aisle}`)
      : mode === 'recipe' ? (key ? data?.recipes.get(key) ?? '' : t('groceries.noRecipe'))
        : key;

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

      <form className="row" style={{ marginBottom: 'var(--s-4)' }} onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <input className="input" value={draft} placeholder={t('groceries.addPlaceholder')} aria-label={t('groceries.add')}
          onChange={(e) => setDraft(e.target.value)} enterKeyHint="done" />
        <button type="submit" className="icon-btn icon-btn--filled" aria-label={t('groceries.add')} disabled={!draft.trim()}>
          <Icon name="plus" />
        </button>
      </form>

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
                  <div className="list-row__main">
                    <div className="list-row__title">{item.name}</div>
                    {checked && item.checked_by && item.checked_by !== userId && (
                      <div className="list-row__meta">{t('groceries.checkedBy', { name: memberName(item.checked_by) })}</div>
                    )}
                  </div>
                  <span className="muted small">{formatQuantity(item.quantity, item.unit)}</span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </Screen>
  );
}
