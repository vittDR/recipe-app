import { useEffect, useMemo, useState } from 'react';
import { mergeTarget, proposeListItems, scaleQuantity, type ListProposal } from '@logic/groceries.ts';
import { sectionOf } from '@logic/products.ts';
import { useI18n } from '../i18n/index.tsx';
import { listQueue, withQueue } from '../lib/listQueue.ts';
import { recipeTitle } from '../lib/recipeText.ts';
import { ingredientName, useGroceryCatalog } from '../lib/products.ts';
import { useSession } from '../lib/session.tsx';
import { must, supabase } from '../lib/supabase.ts';
import type { GroceryRow, Recipe, RecipeIngredient } from '../lib/types.ts';
import { Button, Checkbox, ListRow, Section, Sheet, SheetHeader, toast } from './ui.tsx';

/** Missing ingredients for a recipe given the live list and staples. */
export async function loadProposals(
  householdId: string,
  ingredients: RecipeIngredient[],
): Promise<ListProposal<RecipeIngredient>[]> {
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const [items, staples] = await Promise.all([
    supabase.from('grocery_items').select('*, product:products(ingredient)').eq('household_id', householdId)
      .or(`cleared_at.is.null,checked_at.gte.${since}`),
    supabase.from('household_staples').select('name').eq('household_id', householdId),
  ]);
  return proposeListItems(
    ingredients,
    (must(items) as (GroceryRow & { product: { ingredient: string | null } | null })[])
      .map(({ product, ...i }) => ({ ...i, ingredient: product?.ingredient ?? null })),
    (must(staples) as { name: string }[]).map((s) => s.name),
  );
}

export function formatQuantity(q: number | null, unit: string | null): string {
  if (q === null) return '';
  const n = Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, '');
  return unit && unit !== 'piece' ? `${n} ${unit}` : n;
}

export function AddToListSheet({
  open,
  onClose,
  recipe,
  ingredients,
  potServings,
}: {
  open: boolean;
  onClose: () => void;
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  potServings?: number | null;
}) {
  const { t, tn, locale } = useI18n();
  const { userId, household } = useSession();
  const hid = household!.id;
  const { data: catalog } = useGroceryCatalog(hid);
  const [proposals, setProposals] = useState<ListProposal<RecipeIngredient>[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void loadProposals(household!.id, ingredients).then((p) => {
      setProposals(p);
      setSelected(new Set(p.filter((x) => x.add).map((x) => x.ingredient.id)));
    });
  }, [open, household, ingredients]);

  const servings = potServings ?? recipe.servings;
  const scaled = (i: RecipeIngredient) => scaleQuantity(i.quantity, recipe.servings, servings);
  const toBuy = useMemo(() => proposals?.filter((p) => p.add) ?? [], [proposals]);
  const atHome = useMemo(() => proposals?.filter((p) => !p.add) ?? [], [proposals]);

  // Through the list's queue, like every other list change: shown at once,
  // saved in the background. A line already on the list (same item and
  // unit, not ticked) gets the amount added to it instead of a second line.
  const add = async () => {
    setBusy(true);
    const queue = listQueue(hid);
    let rows: GroceryRow[];
    try {
      const server = must(await supabase.from('grocery_items').select('*').eq('household_id', hid).is('cleared_at', null)) as GroceryRow[];
      rows = withQueue(server, queue.getSnapshot().ops, hid).rows;
    } catch {
      setBusy(false);
      toast(t('app.error'));
      return;
    }
    const at = new Date().toISOString();
    for (const p of (proposals ?? []).filter((x) => selected.has(x.ingredient.id))) {
      const i = p.ingredient;
      const quantity = scaled(i);
      const unit = i.unit?.trim().toLowerCase() || null;
      const same = mergeTarget(rows, i.product_id, unit);
      if (same) {
        if (quantity !== null) {
          const total = same.quantity === null ? quantity : same.quantity + quantity;
          queue.push({ kind: 'patch', id: same.id, fields: { quantity: total, unit } });
          same.quantity = total;
        }
        continue;
      }
      const product = i.product_id ? catalog?.index.get(i.product_id) : undefined;
      const place = product ? sectionOf(product, catalog?.prefs.get(product.id)) : { aisle: i.aisle, store_id: null };
      const op = {
        kind: 'add' as const, id: crypto.randomUUID(), product_id: product?.id ?? i.product_id, name: product?.name_fr ?? i.name,
        quantity, unit, aisle: place.aisle, store_id: place.store_id, recipe_id: recipe.id, added_by: userId!, at,
      };
      queue.push(op);
      rows.push({ ...op, household_id: hid, checked_at: null, checked_by: null, cleared_at: null, sort_key: 0, created_at: at });
    }
    setBusy(false);
    toast(t('addToList.added'));
    onClose();
  };

  const nameOf = (i: RecipeIngredient) => ingredientName(i, locale);

  const row = (p: ListProposal<RecipeIngredient>) => {
    const why = p.why === 'staple' ? t('addToList.staple')
      : p.why === 'bought_recently' ? t('addToList.boughtRecently')
        : p.why === 'on_list' ? t('addToList.onList') : null;
    const checked = selected.has(p.ingredient.id);
    return (
      <ListRow key={p.ingredient.id} title={nameOf(p.ingredient)} meta={why ?? undefined}
        icon={(
          <Checkbox checked={checked} label={nameOf(p.ingredient)} onChange={(v) => {
            const next = new Set(selected);
            if (v) next.add(p.ingredient.id);
            else next.delete(p.ingredient.id);
            setSelected(next);
          }} />
        )}
        trailing={<span className="muted small">{formatQuantity(scaled(p.ingredient), p.ingredient.unit)}</span>} />
    );
  };

  return (
    <Sheet open={open} onClose={onClose} label={t('addToList.title')}>
      <SheetHeader title={t('addToList.title')} subtitle={recipeTitle(recipe, locale)} />
      {toBuy.length > 0 && (
        <Section label={t('addToList.toBuy')} flush>
          <div className="list">{toBuy.map(row)}</div>
        </Section>
      )}
      {atHome.length > 0 && (
        <Section label={t('addToList.atHome')}>
          <div className="list">{atHome.map(row)}</div>
        </Section>
      )}
      <Button className="sheet__actions" block disabled={busy || selected.size === 0} onClick={() => void add()}>
        {tn('addToList.add', selected.size)}
      </Button>
    </Sheet>
  );
}
