import { useEffect, useMemo, useState } from 'react';
import { AT_HOME_DAYS, mergeTarget, proposeListItems, scaleQuantity, type ListProposal } from '@logic/groceries.ts';
import { sectionOf } from '@logic/products.ts';
import { useI18n } from '../i18n/index.tsx';
import { listQueue, withQueue } from '../lib/listQueue.ts';
import { recipeTitle } from '../lib/recipeText.ts';
import { ingredientName, useGroceryCatalog } from '../lib/products.ts';
import { useSession } from '../lib/session.tsx';
import { useAmount } from '../lib/units.ts';
import { must, supabase } from '../lib/supabase.ts';
import type { GroceryRow, Recipe, RecipeIngredient } from '../lib/types.ts';
import { Button, Checkbox, ListRow, Section, Sheet, SheetHeader, toast } from './ui.tsx';

/** Missing ingredients for a recipe given the live list and staples. */
export async function loadProposals(
  householdId: string,
  ingredients: RecipeIngredient[],
): Promise<ListProposal<RecipeIngredient>[]> {
  const since = new Date(Date.now() - AT_HOME_DAYS * 86_400_000).toISOString();
  const [items, staples] = await Promise.all([
    supabase.from('grocery_items').select('*, product:products(ingredient)').eq('household_id', householdId)
      .or(`cleared_at.is.null,checked_at.gte.${since}`),
    supabase.from('household_staples').select('product_id').eq('household_id', householdId),
  ]);
  return proposeListItems(
    ingredients,
    (must(items) as (GroceryRow & { product: { ingredient: string | null } | null })[])
      .map(({ product, ...i }) => ({ ...i, ingredient: product?.ingredient ?? null })),
    (must(staples) as { product_id: string }[]).map((s) => s.product_id),
  );
}

/** One planned meal whose ingredients may go to the list. */
export interface MealForList {
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  /** Servings in the pot, when the deck worked it out; else the recipe's. */
  potServings?: number | null;
  /** A heading when there are several meals ("Jeudi 30 · Poke bowl"). */
  label?: string;
}

/**
 * "What do you already have?": every ingredient of the meals, the ones
 * probably at home (staples, bought recently, already on the list) ticked.
 * Everything left unticked goes to the list.
 */
export function AddToListSheet({ open, onClose, meals }: { open: boolean; onClose: () => void; meals: MealForList[] }) {
  const { t, tn, locale } = useI18n();
  const { recipeAmount } = useAmount();
  const { userId, household } = useSession();
  const hid = household!.id;
  const { data: catalog } = useGroceryCatalog(hid);
  const [proposals, setProposals] = useState<ListProposal<RecipeIngredient>[][] | null>(null);
  /** Ingredient ids ticked as already at home. */
  const [have, setHave] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void Promise.all(meals.map((m) => loadProposals(hid, m.ingredients))).then((all) => {
      setProposals(all);
      setHave(new Set(all.flat().filter((x) => !x.add).map((x) => x.ingredient.id)));
    });
  }, [open, hid, meals]);

  const scaled = (m: MealForList, i: RecipeIngredient) => scaleQuantity(i.quantity, m.recipe.servings, m.potServings ?? m.recipe.servings);
  const toAdd = useMemo(() => (proposals ?? []).flatMap((ps, k) => ps.filter((p) => !have.has(p.ingredient.id)).map((p) => ({ p, meal: meals[k] }))),
    [proposals, have, meals]);

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
    for (const { p, meal } of toAdd) {
      const i = p.ingredient;
      const quantity = scaled(meal, i);
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
        quantity, unit, aisle: place.aisle, store_id: place.store_id, recipe_id: meal.recipe.id, added_by: userId!, at,
      };
      queue.push(op);
      rows.push({ ...op, household_id: hid, checked_at: null, checked_by: null, cleared_at: null, sort_key: 0, created_at: at });
    }
    // Usually a moment, so what the recipe still needs is right when the sheet closes.
    await queue.settled(3000);
    setBusy(false);
    toast(t('addToList.added'));
    onClose();
  };

  const row = (m: MealForList, p: ListProposal<RecipeIngredient>) => {
    const i = p.ingredient;
    const name = ingredientName(i, locale);
    const owned = have.has(i.id);
    return (
      <ListRow key={i.id} className={owned ? 'list-row--owned' : undefined} title={name}
        icon={(
          <Checkbox checked={owned} label={name} onChange={(v) => {
            const next = new Set(have);
            if (v) next.add(i.id);
            else next.delete(i.id);
            setHave(next);
          }} />
        )}
        value={recipeAmount(scaled(m, i), i.unit) || undefined} />
    );
  };

  const several = meals.length > 1;
  return (
    <Sheet open={open} onClose={onClose} label={t('addToList.title')}>
      <SheetHeader title={t('addToList.title')} subtitle={t('addToList.subtitle')} />
      {proposals && meals.map((m, k) => (
        several ? (
          <Section key={m.recipe.id} label={m.label ?? recipeTitle(m.recipe, locale)} flush={k === 0}>
            <div className="list">{proposals[k].map((p) => row(m, p))}</div>
          </Section>
        ) : <div key={m.recipe.id} className="list">{proposals[k].map((p) => row(m, p))}</div>
      ))}
      <Button className="sheet__actions" block disabled={busy || !proposals || toAdd.length === 0} onClick={() => void add()}>
        {toAdd.length === 0 && proposals ? t('addToList.nothing') : tn('addToList.add', toAdd.length)}
      </Button>
    </Sheet>
  );
}
