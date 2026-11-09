// Ingredient lines -> quantity + unit + name, matched to the catalogue for
// aisle grouping, staple detection, list merging and macro estimates.
// Handles common English, French and Italian recipe phrasing.

export type Aisle =
  | 'produce' | 'meat_fish' | 'dairy_eggs' | 'bakery' | 'pantry' | 'spices'
  | 'frozen' | 'drinks' | 'hygiene' | 'household' | 'other';

export interface CatalogEntry {
  name: string;
  name_fr?: string | null;
  name_it?: string | null;
  aliases?: string[] | null;
  default_aisle: Aisle;
  is_staple: boolean;
  kcal_100g?: number | null;
  protein_100g?: number | null;
  fat_100g?: number | null;
  carbs_100g?: number | null;
  fiber_100g?: number | null;
  /** Classification traits (protein:fish, starch:rice, sauce:coconut, heat:1.5, liquid): see classify.ts. */
  traits?: string[] | null;
  grams_per_unit?: number | null;
  diet_class?: 'veg' | 'fish' | 'meat';
  /** Not sold in most French supermarkets. */
  exotic?: boolean;
  /** Months (1 = January) it's in season in France; null or empty = all year. */
  season_months?: number[] | null;
}

export interface ParsedIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  raw_text: string;
}

export interface NormalisedIngredient extends ParsedIngredient {
  aisle: Aisle;
  is_staple: boolean;
  /** Catalogue entry the name resolved to, if any. */
  catalog?: CatalogEntry;
}

// Canonical unit -> spellings (lowercase, without trailing dot).
const UNIT_SPELLINGS: Record<string, string[]> = {
  g: ['g', 'gr', 'gram', 'grams', 'gramme', 'grammes'],
  kg: ['kg', 'kilo', 'kilos', 'kilogram', 'kilograms', 'kilogramme', 'kilogrammes'],
  ml: ['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters'],
  cl: ['cl', 'centilitre', 'centilitres'],
  l: ['l', 'litre', 'litres', 'liter', 'liters'],
  tbsp: ['tbsp', 'tbs', 'tablespoon', 'tablespoons', 'cs', 'c.s', 'c. à soupe', 'c.à.s', 'cuillère à soupe', 'cuillères à soupe', 'cas', 'cucchiaio', 'cucchiai'],
  tsp: ['tsp', 'teaspoon', 'teaspoons', 'cc', 'c.c', 'c. à café', 'c.à.c', 'cuillère à café', 'cuillères à café', 'cac', 'cucchiaino', 'cucchiaini'],
  cup: ['cup', 'cups', 'tasse', 'tasses'],
  oz: ['oz', 'ounce', 'ounces'],
  lb: ['lb', 'lbs', 'pound', 'pounds'],
  clove: ['clove', 'cloves', 'gousse', 'gousses', 'spicchio', 'spicchi'],
  pinch: ['pinch', 'pinches', 'pincée', 'pincées', 'pizzico', 'pizzichi'],
  can: ['can', 'cans', 'tin', 'tins', 'boîte', 'boîtes', 'conserve', 'scatola', 'scatole'],
  bunch: ['bunch', 'bunches', 'botte', 'bottes', 'bouquet', 'mazzetto', 'mazzetti'],
  slice: ['slice', 'slices', 'tranche', 'tranches', 'fetta', 'fette'],
  piece: ['piece', 'pieces', 'pièce', 'pièces', 'pc', 'pcs', 'pezzo', 'pezzi'],
  pack: ['pack', 'packs', 'packet', 'packets', 'paquet', 'paquets', 'pacchetto', 'pacchetti', 'confezione', 'confezioni'],
};

const UNIT_LOOKUP = new Map<string, string>();
for (const [unit, spellings] of Object.entries(UNIT_SPELLINGS)) {
  for (const s of spellings) UNIT_LOOKUP.set(s, unit);
}
// Longest first so "c. à soupe" wins over "c".
const UNIT_PATTERNS = [...UNIT_LOOKUP.keys()].sort((a, b) => b.length - a.length);

// Grams per unit for weight/volume units (volume assumes water density).
const GRAMS_PER_UNIT: Record<string, number> = {
  g: 1, kg: 1000, ml: 1, cl: 10, l: 1000, tbsp: 15, tsp: 5, cup: 240, oz: 28.35, lb: 453.6, pinch: 0.5,
};

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125,
};

const FILLER_WORDS = /^(?:(?:of|de|du|des|la|le|les|di|del|della|dello|dei|degli|delle)\s+|[dl]['’]\s*)/i;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Parses the leading quantity: "1 1/2", "1.5", "1,5", "½", "2-3" (takes the upper bound). */
function parseQuantity(text: string): { quantity: number | null; rest: string } {
  let s = text.trim();
  for (const [ch, v] of Object.entries(UNICODE_FRACTIONS)) {
    s = s.replace(new RegExp(`(\\d)?\\s*${ch}`), (_m, d) => ` ${(d ? Number(d) : 0) + v} `).trim();
  }
  const m = s.match(/^(\d+(?:[.,]\d+)?)(?:\s+(\d+)\/(\d+)|\/(\d+))?(?:\s*(?:-|–|to|à)\s*(\d+(?:[.,]\d+)?))?/i);
  if (!m) return { quantity: null, rest: s };
  let q = Number(m[1].replace(',', '.'));
  if (m[2] && m[3]) q += Number(m[2]) / Number(m[3]);
  if (m[4]) q = q / Number(m[4]);
  if (m[5]) q = Number(m[5].replace(',', '.'));
  return { quantity: q, rest: s.slice(m[0].length).trim() };
}

/** `units: false` reads the whole text after the quantity as the name ("1 bouquet garni"). */
export function parseIngredientLine(line: string, { units = true } = {}): ParsedIngredient {
  const raw_text = line.trim().replace(/\s+/g, ' ');
  // Drop bullets and parenthetical notes: "(about 2 cups)".
  let s = raw_text.replace(/^[-•*·]\s*/, '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

  const { quantity, rest } = parseQuantity(s);
  s = rest;

  let unit: string | null = null;
  const lower = s.toLowerCase();
  for (const spelling of units ? UNIT_PATTERNS : []) {
    const re = new RegExp(`^${escapeRegExp(spelling)}\\.?(?=\\s|$|\\b)`, 'i');
    if (re.test(lower)) {
      // Single letters are units only when a quantity precedes them ("2 l", not "l'ail").
      if (spelling.length === 1 && quantity === null) break;
      unit = UNIT_LOOKUP.get(spelling)!;
      s = s.slice(lower.match(re)![0].length).trim();
      break;
    }
  }

  // Strip filler and preparation notes after a comma: "spinach, chopped".
  s = s.replace(FILLER_WORDS, '').split(/,|;| - /)[0].trim();
  const name = s.toLowerCase().replace(/[.]+$/, '').trim();
  return { name, quantity, unit: unit ?? (quantity !== null ? 'piece' : null), raw_text };
}

function singular(word: string): string {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  if (word.endsWith('x') && word.length > 3) return word.slice(0, -1); // poireaux -> poireau
  return word;
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function keyOf(s: string): string {
  return stripAccents(s.toLowerCase()).split(/\s+/).map(singular).join(' ').trim();
}

export class Catalog {
  private byKey = new Map<string, CatalogEntry>();
  private keys: string[] = [];

  /**
   * The catalogue's version (catalog_version()->>'ingredients') when known:
   * a recipe's stored classification is used only if it was worked out with it.
   */
  version: string | null = null;

  constructor(entries: CatalogEntry[], version: string | null = null) {
    this.version = version;
    for (const e of entries) {
      for (const n of [e.name, e.name_fr, e.name_it, ...(e.aliases ?? [])]) {
        if (!n) continue;
        const k = keyOf(n);
        if (!this.byKey.has(k)) this.byKey.set(k, e);
      }
    }
    // Longest names first so "chicken thigh" beats "chicken".
    this.keys = [...this.byKey.keys()].sort((a, b) => b.length - a.length);
  }

  /** Exact match on name/alias, else the longest catalogue name contained in the text. */
  find(name: string): CatalogEntry | undefined {
    const k = keyOf(name);
    const exact = this.byKey.get(k);
    if (exact) return exact;
    const padded = ` ${k} `;
    for (const key of this.keys) {
      if (padded.includes(` ${key} `)) return this.byKey.get(key);
    }
    return undefined;
  }

  normalise(p: ParsedIngredient): NormalisedIngredient {
    let entry = this.find(p.name);
    if (!entry && p.unit && p.unit !== 'piece') {
      // A unit word can start a name: "bouquet garni", "mazzetto aromatico".
      const whole = parseIngredientLine(p.raw_text, { units: false });
      entry = this.find(whole.name);
      if (entry) p = whole;
    }
    return {
      ...p,
      name: entry?.name ?? p.name,
      aisle: entry?.default_aisle ?? 'other',
      is_staple: entry?.is_staple ?? false,
      catalog: entry,
    };
  }
}

export function gramsOf(ing: { quantity: number | null; unit: string | null }, entry?: CatalogEntry): number | null {
  if (ing.quantity === null) return null;
  const unit = ing.unit ?? 'piece';
  if (unit in GRAMS_PER_UNIT) return ing.quantity * GRAMS_PER_UNIT[unit];
  if (entry?.grams_per_unit) return ing.quantity * entry.grams_per_unit;
  return null;
}

const METRIC_UNITS = new Set(['g', 'kg', 'ml', 'cl', 'l']);

/**
 * Several lines of one item as a single amount in a single unit: "1.5 clove"
 * + "1 tsp" + "0.5 clove" of garlic is 3 cloves. Everything is converted
 * through grams into the unit of the heaviest line. Lines without a quantity
 * ("salt", "oil for frying") don't count; null when none has one. Lines that
 * can't be converted (a unit with no weight for this item) are left out
 * rather than shown in a second unit.
 */
export function combineAmounts(
  lines: { quantity: number | null; unit: string | null }[],
  entry?: CatalogEntry,
): { quantity: number; unit: string | null } | null {
  const counted = lines.filter((l) => l.quantity !== null && l.quantity > 0)
    .map((l) => ({ quantity: l.quantity!, unit: l.unit?.trim().toLowerCase() || null }));
  if (counted.length === 0) return null;
  const units = new Set(counted.map((l) => l.unit));
  let quantity: number;
  let unit: string | null;
  if (units.size === 1) {
    return { quantity: Math.round(counted.reduce((s, l) => s + l.quantity, 0) * 100) / 100, unit: counted[0].unit };
  } else {
    const weighed = counted.map((l) => ({ ...l, grams: gramsOf(l, entry) }));
    const known = weighed.filter((l) => l.grams !== null);
    if (known.length === 0) {
      // Nothing to convert through: the first line's unit, its lines added up.
      unit = counted[0].unit;
      quantity = counted.filter((l) => l.unit === unit).reduce((s, l) => s + l.quantity, 0);
    } else {
      const main = known.reduce((a, b) => (b.grams! > a.grams! ? b : a));
      unit = main.unit;
      const perUnit = main.grams! / main.quantity;
      quantity = known.reduce((s, l) => s + l.grams!, 0) / perUnit;
    }
  }
  // Converted: grams and millilitres to the unit; spoons, cloves and pieces to the quarter.
  const step = unit && METRIC_UNITS.has(unit) && quantity >= 10 ? 1 : 0.25;
  return { quantity: Math.max(step, Math.round(quantity / step) * step), unit };
}

export interface MacroEstimate {
  kcalPerServing: number | null;
  proteinGPerServing: number | null;
  /** Null when ingredients without that value make up over a tenth of the calories. */
  fatGPerServing: number | null;
  carbsGPerServing: number | null;
  fiberGPerServing: number | null;
  /** True when any amount was guessed or an ingredient had no nutrition data. */
  estimated: boolean;
  /** Ingredients that could not be counted. */
  unknown: string[];
}

/** Macros from ingredients against the catalogue, never from the source's claims. */
export function estimateMacros(
  ingredients: (NormalisedIngredient & { guessed?: boolean })[],
  servings: number,
): MacroEstimate {
  let kcal = 0;
  let protein = 0;
  const other = { fat: 0, carbs: 0, fiber: 0 };
  // Calories from ingredients that don't have each value, to tell a small gap from an unknown.
  const missing = { fat: 0, carbs: 0, fiber: 0 };
  let estimated = false;
  const unknown: string[] = [];
  for (const ing of ingredients) {
    if (ing.guessed) estimated = true;
    const entry = ing.catalog;
    const grams = gramsOf(ing, entry);
    if (!entry || entry.kcal_100g == null || grams === null) {
      // Seasoning without an amount does not move the totals.
      if (!(entry?.is_staple && grams === null)) {
        unknown.push(ing.name);
        estimated = true;
      }
      continue;
    }
    const k = (entry.kcal_100g * grams) / 100;
    kcal += k;
    protein += ((entry.protein_100g ?? 0) * grams) / 100;
    for (const n of ['fat', 'carbs', 'fiber'] as const) {
      const v = entry[`${n}_100g`];
      if (v == null) missing[n] += k;
      else other[n] += (v * grams) / 100;
    }
  }
  const s = servings > 0 ? servings : 1;
  const counted = ingredients.length - unknown.length;
  if (counted === 0) {
    return {
      kcalPerServing: null, proteinGPerServing: null, fatGPerServing: null, carbsGPerServing: null, fiberGPerServing: null,
      estimated: true, unknown,
    };
  }
  const per = (n: 'fat' | 'carbs' | 'fiber') =>
    missing[n] > kcal * 0.1 ? null : Math.round((other[n] / s) * 10) / 10;
  return {
    kcalPerServing: Math.round(kcal / s),
    proteinGPerServing: Math.round((protein / s) * 10) / 10,
    fatGPerServing: per('fat'),
    carbsGPerServing: per('carbs'),
    fiberGPerServing: per('fiber'),
    estimated,
    unknown,
  };
}

/** Meat beats fish beats veg: the diet class of a whole recipe. */
export function dietClassOf(entries: (CatalogEntry | undefined)[]): 'veg' | 'fish' | 'meat' {
  let cls: 'veg' | 'fish' | 'meat' = 'veg';
  for (const e of entries) {
    if (e?.diet_class === 'meat') return 'meat';
    if (e?.diet_class === 'fish') cls = 'fish';
  }
  return cls;
}
