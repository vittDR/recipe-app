// Grocery products: the real items behind list lines. Matching and
// autocomplete for what people type ("2 blancs de poulet", "sopalin"), and the
// "Frequently bought" selection. Merging happens in public.add_grocery_items().

import type { Aisle } from './ingredients.ts';

export interface Product {
  id: string;
  /** Null for the shared catalogue; set for an item a household created. */
  household_id: string | null;
  name_fr: string;
  name_en: string | null;
  aliases: string[];
  ingredient: string | null;
  default_aisle: Aisle;
}

/** What a household remembers about a product. */
export interface HouseholdProduct {
  product_id: string;
  aisle: Aisle | null;
  store_id: string | null;
  add_count: number;
  last_added_at: string | null;
  pinned: boolean;
  hidden: boolean;
}

function singular(word: string): string {
  if (word.length > 3 && /[sx]$/.test(word) && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/**
 * Lowercase, no accents, punctuation as spaces, no plural s/x. Same as
 * public.product_key() in SQL, plus the plural folding.
 */
export function productKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map(singular)
    .join(' ');
}

/** Display name: French first, English when asked and known; capitalised. */
export function productName(p: Pick<Product, 'name_fr' | 'name_en'>, locale: string = 'fr'): string {
  const n = locale === 'en' && p.name_en ? p.name_en : p.name_fr;
  return n.charAt(0).toLocaleUpperCase(locale) + n.slice(1);
}

/** French name, English name ('' when none), then aliases: the first two are main names. */
function namesOf(p: Product): string[] {
  return [p.name_fr, p.name_en ?? '', ...p.aliases];
}

export class ProductIndex {
  private entries: { product: Product; keys: string[] }[];
  private byKey = new Map<string, Product>();

  constructor(products: Product[]) {
    // Household items first, so they win exact matches over shared ones.
    const sorted = [...products].sort((a, b) => Number(!a.household_id) - Number(!b.household_id));
    this.entries = sorted.map((product) => ({ product, keys: namesOf(product).map(productKey) }));
    // Main names before aliases: "lentilles" is Lentilles, not the alias on lentilles corail.
    for (const pass of [0, 1]) {
      for (const { product, keys } of this.entries) {
        for (const k of pass === 0 ? keys.slice(0, 2) : keys.slice(2)) {
          if (k && !this.byKey.has(k)) this.byKey.set(k, product);
        }
      }
    }
  }

  get(id: string): Product | undefined {
    return this.entries.find((e) => e.product.id === id)?.product;
  }

  /** The product this exact name (any language, alias, plural) stands for. */
  find(name: string): Product | undefined {
    return this.byKey.get(productKey(name));
  }

  /**
   * Autocomplete: names that start with the query beat names with a word that
   * does, which beat names containing it. `boost` (e.g. times bought) breaks ties.
   */
  search(query: string, limit = 6, boost: (p: Product) => number = () => 0): Product[] {
    const q = productKey(query);
    if (!q) return [];
    const scored: { product: Product; score: number }[] = [];
    for (const { product, keys } of this.entries) {
      let best = 0;
      keys.forEach((k, i) => {
        if (!k) return;
        const main = i < 2 ? 1 : 0;
        const s = k === q ? 4 : k.startsWith(q) ? 3 : k.includes(` ${q}`) ? 2 : k.includes(q) ? 1 : 0;
        if (s) best = Math.max(best, s * 2 + main);
      });
      if (best) scored.push({ product, score: best * 1000 + Math.min(boost(product), 999) });
    }
    return scored
      .sort((a, b) => b.score - a.score || a.product.name_fr.localeCompare(b.product.name_fr, 'fr'))
      .slice(0, limit)
      .map((s) => s.product);
  }
}

export const FREQUENT_MIN_ADDS = 2;

/** "Frequently bought": pinned, or added at least twice, unless hidden. */
export function isFrequent(hp: HouseholdProduct): boolean {
  return !hp.hidden && (hp.pinned || hp.add_count >= FREQUENT_MIN_ADDS);
}

/** Where a product goes for a household: its store, else its aisle. */
export function sectionOf(product: Product, hp?: HouseholdProduct): { aisle: Aisle; store_id: string | null } {
  return { aisle: hp?.aisle ?? product.default_aisle, store_id: hp?.store_id ?? null };
}
