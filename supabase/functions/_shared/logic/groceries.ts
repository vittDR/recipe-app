// Grocery list grouping, "what's missing for this recipe" and where a recipe
// line lands on the list. Used by the app.

import type { Aisle } from './ingredients.ts';

export const DEFAULT_AISLE_ORDER: Aisle[] = [
  'produce', 'meat_fish', 'dairy_eggs', 'bakery', 'pantry', 'spices', 'frozen', 'drinks', 'hygiene', 'household', 'other',
];

/** Section key of a store, next to aisle keys in the list and its order. */
export const storeKey = (storeId: string): string => `store:${storeId}`;

export const AT_HOME_DAYS = 7;

/**
 * The line a recipe ingredient adds to instead of starting a new one: the
 * same item in the same unit, not ticked yet. Lines without an item never merge.
 */
export function mergeTarget<T extends { product_id: string | null; unit: string | null; checked_at: string | null; cleared_at?: string | null }>(
  lines: T[],
  productId: string | null,
  unit: string | null,
): T | undefined {
  if (!productId) return undefined;
  const u = unit?.trim().toLowerCase() || null;
  return lines.find((l) => l.product_id === productId && (l.unit?.toLowerCase() || null) === u && !l.checked_at && !l.cleared_at);
}

export interface GroceryItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  aisle: Aisle;
  /** A store (Picard...) puts the item in that store's section instead of its aisle. */
  store_id?: string | null;
  product_id?: string | null;
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

/**
 * Splits the live list into what's left to buy and "In the cart": checked
 * items leave their group for one flat section, last checked first.
 */
export function splitCart<T extends GroceryItem>(items: T[]): { toBuy: T[]; cart: T[] } {
  const live = items.filter((i) => !i.cleared_at);
  return {
    toBuy: live.filter((i) => !i.checked_at),
    cart: live.filter((i) => i.checked_at).sort((a, b) => Date.parse(b.checked_at!) - Date.parse(a.checked_at!)),
  };
}

export interface RecipeIngredientLike {
  name: string;
  product_id?: string | null;
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
  // Same product, or for older rows the same catalogue ingredient or name.
  const keysOf = (i: GroceryItem) => [i.product_id, (i.ingredient ?? i.name).toLowerCase()].filter(Boolean) as string[];
  const onList = new Set(list.filter((i) => !i.checked_at && !i.cleared_at).flatMap(keysOf));
  const bought = new Set(list.filter((i) => i.checked_at && Date.parse(i.checked_at) >= since).flatMap(keysOf));

  return ingredients.map((ingredient) => {
    const n = ingredient.name.toLowerCase();
    const has = (set: Set<string>) => set.has(n) || (!!ingredient.product_id && set.has(ingredient.product_id));
    if (has(onList)) return { ingredient, add: false, why: 'on_list' as const };
    if (ingredient.is_staple || stapleSet.has(n)) return { ingredient, add: false, why: 'staple' as const };
    if (has(bought)) return { ingredient, add: false, why: 'bought_recently' as const };
    return { ingredient, add: true, why: 'to_buy' as const };
  });
}

/** Scales recipe quantities to the pot actually being cooked. */
export function scaleQuantity(q: number | null, recipeServings: number, potServings: number): number | null {
  if (q === null || recipeServings <= 0) return q;
  const v = (q * potServings) / recipeServings;
  return v >= 10 ? Math.round(v) : Math.round(v * 4) / 4;
}
