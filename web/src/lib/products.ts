// The household's grocery products, stores and section order, live on both phones.

import { storeKey } from '@logic/groceries.ts';
import { ProductIndex, productName, type HouseholdProduct, type Product } from '@logic/products.ts';
import { useLive } from './hooks.ts';
import { must, supabase } from './supabase.ts';
import type { Aisle, RecipeIngredient, Store } from './types.ts';

/** Recipe ingredient columns plus its product's names, for display. */
export const INGREDIENT_SELECT = '*, product:products(name_fr, name_en)';

/** A recipe line's name in the shopping language: its product's, else as saved. */
export function ingredientName(i: Pick<RecipeIngredient, 'name' | 'product'>, locale: string): string {
  return i.product ? productName(i.product, locale) : i.name;
}

export interface GroceryCatalog {
  index: ProductIndex;
  products: Product[];
  prefs: Map<string, HouseholdProduct>;
  stores: Store[];
  /** Aisle keys and storeKey()s, in the household's order. */
  sectionOrder: string[];
}

let sharedProducts: Promise<Product[]> | null = null;

/** The shared catalogue never changes while the app runs: load it once. */
function loadSharedProducts(): Promise<Product[]> {
  sharedProducts ??= (async () => {
    try {
      return must(await supabase.from('products').select('*').is('household_id', null)) as Product[];
    } catch (e) {
      sharedProducts = null;
      throw e;
    }
  })();
  return sharedProducts;
}

export async function loadGroceryCatalog(hid: string): Promise<GroceryCatalog> {
  const [shared, own, prefs, stores, aisles] = await Promise.all([
    loadSharedProducts(),
    supabase.from('products').select('*').eq('household_id', hid),
    supabase.from('household_products').select('*').eq('household_id', hid),
    supabase.from('household_stores').select('id, name, position').eq('household_id', hid),
    supabase.from('household_aisle_order').select('aisle, position').eq('household_id', hid),
  ]);
  const products = [...(must(own) as Product[]), ...shared];
  const storeRows = must(stores) as Store[];
  const sections = [
    ...(must(aisles) as { aisle: Aisle; position: number }[]).map((a) => ({ key: a.aisle as string, position: a.position })),
    ...storeRows.map((s) => ({ key: storeKey(s.id), position: s.position })),
  ].sort((a, b) => a.position - b.position);
  return {
    index: new ProductIndex(products),
    products,
    prefs: new Map((must(prefs) as HouseholdProduct[]).map((p) => [p.product_id, p])),
    stores: storeRows.sort((a, b) => a.position - b.position),
    sectionOrder: sections.map((s) => s.key),
  };
}

export function useGroceryCatalog(hid: string) {
  return useLive<GroceryCatalog>(`grocery-catalog:${hid}`, () => loadGroceryCatalog(hid), [
    { table: 'household_products', filter: `household_id=eq.${hid}` },
    { table: 'household_stores', filter: `household_id=eq.${hid}` },
  ]);
}
