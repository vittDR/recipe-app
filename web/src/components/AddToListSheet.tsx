import { useEffect, useMemo, useState } from 'react';
import { AT_HOME_DAYS, combineProposals, mergeTarget, proposeListItems, scaleQuantity, type ListProposal } from '@logic/groceries.ts';
import { sectionOf } from '@logic/products.ts';
import { useI18n } from '../i18n/index.tsx';
import { listQueue, withQueue } from '../lib/listQueue.ts';
import { ingredientName, useGroceryCatalog } from '../lib/products.ts';
import { useSession } from '../lib/session.tsx';
import { useAmount } from '../lib/units.ts';
import { must, supabase } from '../lib/supabase.ts';
import type { GroceryRow, Recipe, RecipeIngredient } from '../lib/types.ts';
import { Button, Checkbox, ListRow, Sheet, SheetHeader, toast } from './ui.tsx';

/** Missing ingredients for a recipe given the live list and staples. */
export async function loadProposals(
  householdId: string,
  ingredients: RecipeIngredient[],
): Promise<ListProposal<RecipeIngredient>[]> {
  return (await loadProposalsMany(householdId, [ingredients]))[0];
}

/** The same for several recipes at once, reading the list and staples once. */
export async function loadProposalsMany(
  householdId: string,
  recipes: RecipeIngredient[][],
): Promise<ListProposal<RecipeIngredient>[][]> {
  const since = new Date(Date.now() - AT_HOME_DAYS * 86_400_000).toISOString();
  const [items, staples] = await Promise.all([
    supabase.from('grocery_items').select('*, product:products(ingredient)').eq('household_id', householdId)
      .or(`cleared_at.is.null,checked_at.gte.${since}`),
    supabase.from('household_staples').select('product_id').eq('household_id', householdId),
  ]);
  const list = (must(items) as (GroceryRow & { product: { ingredient: string | null } | null })[])
    .map(({ product, ...i }) => ({ ...i, ingredient: product?.ingredient ?? null }));
  const stapleIds = (must(staples) as { product_id: string }[]).map((s) => s.product_id);
  return recipes.map((ingredients) => proposeListItems(ingredients, list, stapleIds));
}

/** One planned meal whose ingredients may go to the list. */
export interface MealForList {
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  /** Servings in the pot, when the deck worked it out; else the recipe's. */
  potServings?: number | null;
  /** The planned meal, marked as listed once its ingredients went to the list. */
  mealId?: string;
  /** Its evening, short, to say which meals need a line ("Wed, Thu"). */
  day?: string;
}

/**
 * "What do you need to buy?": every ingredient of the meals, one line per
 * product and unit however many meals need it, the ones probably missing
 * ticked (not a staple, not bought recently, not already on the list). Every
 * ticked line goes to the list, and the meals are remembered as listed.
 */
export function AddToListSheet({ open, onClose, onAdded, meals }: {
  open: boolean;
  onClose: () => void;
  /** After the items went to the list (the sheet closes too). */
  onAdded?: () => void;
  meals: MealForList[];
}) {
  const { t, tn, locale } = useI18n();
  const { recipeAmount } = useAmount();
  const { userId, household } = useSession();
  const hid = household!.id;
  const { data: catalog } = useGroceryCatalog(hid);
  const [proposals, setProposals] = useState<ListProposal<RecipeIngredient>[][] | null>(null);
  /** Lines (product + unit) ticked to go on the list. */
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const linesOf = (all: ListProposal<RecipeIngredient>[][]) => combineProposals(all,
    (k, i) => scaleQuantity(i.quantity, meals[k].recipe.servings, meals[k].potServings ?? meals[k].recipe.servings));

  useEffect(() => {
    if (!open) return;
    void loadProposalsMany(hid, meals.map((m) => m.ingredients)).then((all) => {
      setProposals(all);
      setPicked(new Set(linesOf(all).filter((l) => l.add).map((l) => l.key)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hid, meals]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lines = useMemo(() => (proposals ? linesOf(proposals) : []), [proposals, meals]);
  const toAdd = useMemo(() => lines.filter((l) => picked.has(l.key)), [lines, picked]);

  // Through the list's queue, like every other list change: shown at once,
  // saved in the background. A line already on the list (same item and
  // unit, not checked off) gets the amount added to it instead of a second line.
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
    for (const line of toAdd) {
      const i = line.ingredient;
      const { quantity, unit } = line;
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
        quantity, unit, aisle: place.aisle, store_id: place.store_id, recipe_id: meals[line.meals[0]].recipe.id, added_by: userId!, at,
      };
      queue.push(op);
      rows.push({ ...op, household_id: hid, checked_at: null, checked_by: null, cleared_at: null, sort_key: 0, created_at: at });
    }
    // These meals' groceries are done: Ce soir's card stops counting them.
    const mealIds = meals.flatMap((m) => (m.mealId ? [m.mealId] : []));
    const [, listed] = await Promise.all([
      // Usually a moment, so what the recipe still needs is right when the sheet closes.
      toAdd.length > 0 ? queue.settled(3000) : Promise.resolve(),
      mealIds.length > 0 ? supabase.from('meals').update({ listed_at: at }).in('id', mealIds) : Promise.resolve({ error: null }),
    ]);
    setBusy(false);
    if (listed.error && toAdd.length === 0) {
      toast(t('app.error'));
      return;
    }
    if (toAdd.length > 0) toast(t('addToList.added'));
    onClose();
    onAdded?.();
  };

  const several = meals.length > 1;
  return (
    <Sheet open={open} onClose={onClose} label={t('addToList.title')}>
      <SheetHeader title={t('addToList.title')} subtitle={t('addToList.subtitle')} />
      {proposals && (
        <div className="list">
          {lines.map((l) => {
            const name = ingredientName(l.ingredient, locale);
            const on = picked.has(l.key);
            return (
              <ListRow key={l.key} className={on ? undefined : 'list-row--owned'} title={name}
                meta={several ? l.meals.map((k) => meals[k].day).filter(Boolean).join(', ') || undefined : undefined}
                icon={(
                  <Checkbox checked={on} label={name} onChange={(v) => {
                    const next = new Set(picked);
                    if (v) next.add(l.key);
                    else next.delete(l.key);
                    setPicked(next);
                  }} />
                )}
                value={recipeAmount(l.quantity, l.ingredient.unit) || undefined} />
            );
          })}
        </div>
      )}
      <Button className="sheet__actions" block disabled={busy || !proposals} onClick={() => void add()}>
        {toAdd.length === 0 && proposals ? t('addToList.nothing') : tn('addToList.add', toAdd.length)}
      </Button>
    </Sheet>
  );
}
