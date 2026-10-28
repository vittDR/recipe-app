// Grocery list grouping and "what's missing for this recipe". Used by the app;
// merging into the list itself happens in public.add_grocery_items().

import type { Aisle } from './ingredients.ts';

export const DEFAULT_AISLE_ORDER: Aisle[] = [
  'produce', 'meat_fish', 'dairy_eggs', 'bakery', 'pantry', 'spices', 'frozen', 'drinks', 'hygiene', 'household', 'other',
];

/** Section key of a store, next to aisle keys in the list and its order. */
export const storeKey = (storeId: string): string => `store:${storeId}`;

export const AT_HOME_DAYS = 7;

export interface GroceryItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  aisle: Aisle;
  /** A store (Picard...) puts the item in that store's section instead of its aisle. */
  store_id?: string | null;
  /** Catalogue ingredient of the item's product, to match recipe ingredients. */
  ingredient?: string | null;
  recipe_id: string | null;
  checked_at: string | null;
  cleared_at?: string | null;
  sort_key: number;
}

export type GroupMode = 'aisle' | 'recipe' | 'az';

export interface GrocerySection<T extends GroceryItem = GroceryItem> {
  key: string; // aisle key, storeKey(id), recipe id, letter, or '' for "no recipe"
  items: T[];
}

/**
 * Groups the live list; checked items sink to the bottom of their group.
 * `sectionOrder` holds aisle keys and storeKey()s in the household's order.
 */
export function groupGroceries<T extends GroceryItem>(
  items: T[],
  mode: GroupMode,
  sectionOrder: string[] = DEFAULT_AISLE_ORDER,
): GrocerySection<T>[] {
  const live = items.filter((i) => !i.cleared_at);
  const known = new Set(sectionOrder);
  const sectionOf = (i: T): string => (i.store_id && known.has(storeKey(i.store_id)) ? storeKey(i.store_id) : i.aisle);
  const keyOf = (i: T): string =>
    mode === 'aisle' ? sectionOf(i)
      : mode === 'recipe' ? (i.recipe_id ?? '')
        : (i.name.normalize('NFD').replace(/^œ/i, 'o')[0] ?? '#').toUpperCase();

  const groups = new Map<string, T[]>();
  for (const item of live) {
    const k = keyOf(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }

  const rank = (k: string): number => {
    if (mode === 'aisle') {
      const i = sectionOrder.indexOf(k);
      return i === -1 ? sectionOrder.length : i;
    }
    return 0;
  };
  const sectionKeys = [...groups.keys()].sort((a, b) => {
    if (mode === 'recipe') return a === '' ? 1 : b === '' ? -1 : 0; // keep insertion order, loose items last
    return rank(a) - rank(b) || a.localeCompare(b, 'fr');
  });

  return sectionKeys.map((key) => ({
    key,
    items: groups.get(key)!.sort((a, b) => {
      const ca = a.checked_at ? 1 : 0;
      const cb = b.checked_at ? 1 : 0;
      if (ca !== cb) return ca - cb;
      return mode === 'az' ? a.name.localeCompare(b.name, 'fr') : a.sort_key - b.sort_key;
    }),
  }));
}

export interface RecipeIngredientLike {
  name: string;
  quantity: number | null;
  unit: string | null;
  aisle: Aisle;
  is_staple: boolean;
}

export interface ListProposal<T extends RecipeIngredientLike> {
  ingredient: T;
  /** Proposed checked state in the sheet: true = add to list. */
  add: boolean;
  why: 'to_buy' | 'staple' | 'bought_recently' | 'on_list';
}

/**
 * Splits a recipe's ingredients into "to buy" (checked) and "probably at home"
 * (unchecked): staples, things checked off in the last few days, and things
 * already on the list.
 */
export function proposeListItems<T extends RecipeIngredientLike>(
  ingredients: T[],
  list: GroceryItem[],
  staples: string[],
  now: Date = new Date(),
  atHomeDays: number = AT_HOME_DAYS,
): ListProposal<T>[] {
  const since = now.getTime() - atHomeDays * 86_400_000;
  const stapleSet = new Set(staples.map((s) => s.toLowerCase()));
  // Items from products match on the catalogue ingredient; older rows on their name.
  const nameOf = (i: GroceryItem) => (i.ingredient ?? i.name).toLowerCase();
  const onList = new Set(list.filter((i) => !i.checked_at && !i.cleared_at).map(nameOf));
  const bought = new Set(list.filter((i) => i.checked_at && Date.parse(i.checked_at) >= since).map(nameOf));

  return ingredients.map((ingredient) => {
    const n = ingredient.name.toLowerCase();
    if (onList.has(n)) return { ingredient, add: false, why: 'on_list' as const };
    if (ingredient.is_staple || stapleSet.has(n)) return { ingredient, add: false, why: 'staple' as const };
    if (bought.has(n)) return { ingredient, add: false, why: 'bought_recently' as const };
    return { ingredient, add: true, why: 'to_buy' as const };
  });
}

/** Scales recipe quantities to the pot actually being cooked. */
export function scaleQuantity(q: number | null, recipeServings: number, potServings: number): number | null {
  if (q === null || recipeServings <= 0) return q;
  const v = (q * potServings) / recipeServings;
  return v >= 10 ? Math.round(v) : Math.round(v * 4) / 4;
}
