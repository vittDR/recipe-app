// The household's grocery products, stores and section order, live on both phones.

import { storeKey } from '@logic/groceries.ts';
import { ProductIndex, productName, type HouseholdProduct, type Product } from '@logic/products.ts';
import { cachedCatalogue, forgetCatalogueVersions, peekCatalogue, readCache, writeCache } from './cache.ts';
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

/** The shared catalogue: kept on the phone, downloaded again only when it changed. */
function loadSharedProducts(): Promise<Product[]> {
  sharedProducts ??= cachedCatalogue<Product[]>(
    'products',
    async () => must(await supabase.from('products').select('*').is('household_id', null)) as Product[],
    (fresh) => { sharedProducts = Promise.resolve(fresh); },
  ).catch((e) => {
    sharedProducts = null;
    throw e;
  });
  return sharedProducts;
}

/** After editing the shared catalogue: the next load checks for the new version. */
export function forgetSharedProducts(): void {
  sharedProducts = null;
  forgetCatalogueVersions();
}

/** The household's own grocery rows, as stored on the phone between visits. */
interface HouseholdRows {
  own: Product[];
  prefs: HouseholdProduct[];
  stores: Store[];
  aisles: { aisle: Aisle; position: number }[];
}

function buildCatalog(shared: Product[], h: HouseholdRows): GroceryCatalog {
  const products = [...h.own, ...shared];
  const sections = [
    ...h.aisles.map((a) => ({ key: a.aisle as string, position: a.position })),
    ...h.stores.map((s) => ({ key: storeKey(s.id), position: s.position })),
  ].sort((a, b) => a.position - b.position);
  return {
    index: new ProductIndex(products),
    products,
    prefs: new Map(h.prefs.map((p) => [p.product_id, p])),
    stores: [...h.stores].sort((a, b) => a.position - b.position),
    sectionOrder: sections.map((s) => s.key),
  };
}

export async function loadGroceryCatalog(hid: string): Promise<GroceryCatalog> {
  const [shared, own, prefs, stores, aisles] = await Promise.all([
    loadSharedProducts(),
    supabase.from('products').select('*').eq('household_id', hid),
    supabase.from('household_products').select('*').eq('household_id', hid),
    supabase.from('household_stores').select('id, name, position').eq('household_id', hid),
    supabase.from('household_aisle_order').select('aisle, position').eq('household_id', hid),
  ]);
  const rows: HouseholdRows = {
    own: must(own) as Product[],
    prefs: must(prefs) as HouseholdProduct[],
    stores: must(stores) as Store[],
    aisles: must(aisles) as HouseholdRows['aisles'],
  };
  writeCache(`household:${hid}`, rows);
  return buildCatalog(shared, rows);
}

/** Last session's catalogue, to show while the live one loads. */
function storedGroceryCatalog(hid: string): GroceryCatalog | null {
  const shared = peekCatalogue<Product[]>('products');
  const rows = readCache<HouseholdRows>(`household:${hid}`);
  return shared && rows ? buildCatalog(shared, rows) : null;
}

/**
 * The items a typed name matches: the exact one first, then the closest
 * names, the household's most-added first. Every item search uses this.
 */
export function searchProducts(
  catalog: GroceryCatalog | null,
  name: string,
  { limit = 6, index = catalog?.index }: { limit?: number; /** e.g. with items not saved yet */ index?: ProductIndex | null } = {},
): { results: Product[]; exact?: Product } {
  if (!catalog || !index || !name.trim()) return { results: [] };
  const exact = index.find(name);
  const results = index.search(name, limit, (p) => catalog.prefs.get(p.id)?.add_count ?? 0);
  if (exact && !results.some((p) => p.id === exact.id)) results.unshift(exact);
  return { results, exact };
}

export function useGroceryCatalog(hid: string) {
  return useLive<GroceryCatalog>(`grocery-catalog:${hid}`, () => loadGroceryCatalog(hid), [
    { table: 'household_products', filter: `household_id=eq.${hid}` },
    { table: 'household_stores', filter: `household_id=eq.${hid}` },
  ], () => storedGroceryCatalog(hid));
}
