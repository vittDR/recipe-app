// Grocery products: the real items behind list lines. Matching and
// autocomplete for what people type ("2 blancs de poulet", "sopalin"), and
// what to prefill when one is added (2 lemons, 2 l of milk). Merging recipe
// adds happens in public.add_grocery_items().

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
  /** What one usually buys: unit (free text, see GROCERY_UNITS) and amount. */
  default_unit?: string | null;
  default_qty?: number | null;
  /** Units that make sense for it, the default first. */
  suggested_units?: string[];
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
  private byIngredient = new Map<string, Product>();
  /** Main-name keys, longest first, for "a name inside the line" matches. */
  private mainKeys: [string, Product][] = [];

  constructor(products: Product[]) {
    // Household items first, so they win exact matches over shared ones.
    const sorted = [...products].sort((a, b) => Number(!a.household_id) - Number(!b.household_id));
    this.entries = sorted.map((product) => ({ product, keys: namesOf(product).map(productKey) }));
    for (const { product, keys } of this.entries) {
      if (product.ingredient) this.byIngredient.set(product.ingredient, product);
      for (const k of keys) if (k) this.mainKeys.push([k, product]);
    }
    this.mainKeys.sort((a, b) => b[0].length - a[0].length);
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

  /** The product of a catalogue ingredient (its lowercase English name). */
  ofIngredient(name: string): Product | undefined {
    return this.byIngredient.get(name);
  }

  /** The product this exact name (any language, alias, plural) stands for. */
  find(name: string): Product | undefined {
    return this.byKey.get(productKey(name));
  }

  /** The longest product name that appears as whole words in the text. */
  contained(text: string): Product | undefined {
    const padded = ` ${productKey(text)} `;
    for (const [k, p] of this.mainKeys) if (k.length > 2 && padded.includes(` ${k} `)) return p;
    return undefined;
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

export interface ProductMatch {
  product: Product;
  /** exact: same name or alias. close: likely, worth a look. weak: only a guess. */
  confidence: 'exact' | 'close' | 'weak';
}

// Words that describe a thing rather than name it, as productKey() spells them
// ("fraîches" -> "fraiche", "frais" -> "frai"). Dropped when the full name has
// no exact match: "framboises fraîches" is Framboises.
const QUALIFIERS = new Set([
  'frai', 'fraiche', 'fresh', 'bio', 'organic', 'canned', 'surgele', 'surgelee', 'frozen',
  'entier', 'entiere', 'whole', 'moyen', 'moyenne', 'medium', 'gro', 'grosse', 'large', 'small',
]);

export function withoutQualifiers(name: string): string {
  return productKey(name).replace(/\ben conserve\b|\bde saison\b/g, ' ')
    .split(' ').filter((w) => w && !QUALIFIERS.has(w)).join(' ');
}

/**
 * What a recipe line's name most likely is. `ingredient` is the catalogue
 * ingredient the parser matched, if any. Exact names (also without words like
 * "fraîches") are exact; the catalogue's guess or a product name inside the
 * line ("citron confit" -> citron) are close; the best autocomplete hit for the
 * name or one of its words is weak. Null: nothing like it.
 */
export function matchProduct(index: ProductIndex, name: string, ingredient?: string | null): ProductMatch | null {
  const exact = index.find(name) ?? index.find(withoutQualifiers(name));
  if (exact) return { product: exact, confidence: 'exact' };
  const words = withoutQualifiers(name).split(' ').filter((w) => w.length >= 4).sort((a, b) => b.length - a.length);
  const close = (ingredient ? index.ofIngredient(ingredient) : undefined) ?? index.contained(name);
  if (close) return { product: close, confidence: 'close' };
  const weak = index.search(name, 1)[0] ?? words.map((w) => index.search(w, 1)[0]).find(Boolean);
  return weak ? { product: weak, confidence: 'weak' } : null;
}

/** Where a product goes for a household: its store, else its aisle. */
export function sectionOf(product: Product, hp?: HouseholdProduct): { aisle: Aisle; store_id: string | null } {
  return { aisle: hp?.aisle ?? product.default_aisle, store_id: hp?.store_id ?? null };
}

/** Shopping units the app names in both languages; anything else shows as typed. */
export const GROCERY_UNITS = ['piece', 'g', 'kg', 'ml', 'cl', 'l', 'pack', 'jar', 'bottle', 'can', 'bunch', 'bag', 'stalk'] as const;

// Same as the aisle defaults in public.apply_product_defaults().
const AISLE_UNITS: Record<Aisle, string[]> = {
  produce: ['piece', 'g', 'kg', 'bunch', 'bag', 'pack'],
  meat_fish: ['g', 'kg', 'piece', 'pack'],
  dairy_eggs: ['pack', 'piece', 'g', 'jar', 'l'],
  bakery: ['piece', 'pack'],
  pantry: ['pack', 'jar', 'can', 'bottle', 'g', 'kg'],
  spices: ['jar', 'pack', 'g'],
  frozen: ['pack', 'g', 'kg'],
  drinks: ['bottle', 'pack', 'l'],
  hygiene: ['piece', 'pack', 'bottle'],
  household: ['pack', 'piece', 'bottle'],
  other: ['piece', 'pack', 'g', 'kg'],
};

/** Units to offer first for a product: its own, else its aisle's. */
export function unitsFor(p: Pick<Product, 'default_aisle' | 'default_unit' | 'suggested_units'>): string[] {
  const own = p.suggested_units?.length ? p.suggested_units : AISLE_UNITS[p.default_aisle];
  return p.default_unit && !own.includes(p.default_unit) ? [p.default_unit, ...own] : own;
}

/** What + adds: the product's usual amount, else no quantity in its first unit. */
export function defaultAmount(p: Pick<Product, 'default_aisle' | 'default_unit' | 'default_qty' | 'suggested_units'>):
  { quantity: number | null; unit: string | null } {
  return { quantity: p.default_qty ?? null, unit: p.default_unit ?? unitsFor(p)[0] ?? null };
}

/**
 * The aisle a new item's name suggests: a product with that name, else one
 * named inside it ("jus de citron" -> citron). Null: no idea.
 */
export function suggestAisle(index: ProductIndex, name: string): Aisle | null {
  return (index.find(name) ?? index.find(withoutQualifiers(name)) ?? index.contained(name))?.default_aisle ?? null;
}
