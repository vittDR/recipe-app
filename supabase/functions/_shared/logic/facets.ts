// Recipe facets: the equipment vocabulary, difficulty, and the Recipes tab's
// filters (healthy, comfort, high protein, diet, veggie…). Pure, shared by the
// web app, the import function and the seed build script.

import { MOOD_TAGS } from './deck.ts';

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

/**
 * Kept deliberately coarse: just enough to tell an easy cook from a tedious one.
 * `pots` is every pot, pan and oven dish that gets dirty (1 = one pot), `oven`
 * whether the oven is on, and `special` only equipment many kitchens lack.
 * Basics (baking tray, sieve, grater, string…) are never listed.
 */
export interface Equipment {
  pots: number;
  oven: boolean;
  special: string[];
}

/** Uncommon equipment, in display order. Other values (typed by people) are kept and shown as written. */
export const SPECIAL_EQUIPMENT = [
  'blender', 'food processor', 'stand mixer', 'thermometer', 'mortar and pestle', 'barbecue', 'mandoline',
  'rolling pin', 'steamer', 'rice cooker', 'slow cooker', 'pressure cooker', 'air fryer',
] as const;

/** From this many pots and pans on, a recipe is flagged as a lot of washing up. */
export const MANY_POTS = 3;

/** Cleans equipment from an untrusted source; anything malformed becomes "unknown" (0 pots). */
export function normaliseEquipment(raw: unknown): Equipment {
  const r = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const pots = Math.round(Number(r.pots));
  const special = Array.isArray(r.special)
    ? [...new Set(r.special.map((x) => String(x).toLowerCase().trim().slice(0, 40)).filter(Boolean))]
    : [];
  const rank = (k: string) => {
    const i = (SPECIAL_EQUIPMENT as readonly string[]).indexOf(k);
    return i < 0 ? SPECIAL_EQUIPMENT.length : i;
  };
  return {
    pots: pots > 0 ? Math.min(pots, 9) : 0,
    oven: r.oven === true,
    special: special.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)),
  };
}

export interface FacetRecipe {
  tags: string[];
  totalMin: number | null;
  kcalPerServing: number | null;
  proteinGPerServing: number | null;
  dietClass: 'veg' | 'fish' | 'meat';
  difficulty: Difficulty | null;
  equipment: Equipment | null;
  /** Ingredients not sold in most French supermarkets. */
  exoticIngredients: string[];
}

export type RecipeFilter =
  | 'healthy' | 'comfort' | 'high_protein' | 'diet' | 'veggie' | 'fish'
  | 'quick' | 'one_pot' | 'easy' | 'everyday';
export const RECIPE_FILTERS: RecipeFilter[] = [
  'healthy', 'comfort', 'high_protein', 'diet', 'veggie', 'fish', 'quick', 'one_pot', 'easy', 'everyday',
];

export const HIGH_PROTEIN_G = 35;
export const DIET_MAX_KCAL = 500;
export const HEALTHY_MAX_KCAL = 650;
export const HEALTHY_MIN_PROTEIN_G = 25;
export const QUICK_MAX_MIN = 25;

const has = (r: FacetRecipe, tag: string) => r.tags.some((t) => t.toLowerCase() === tag);

export function matchesFilter(r: FacetRecipe, f: RecipeFilter): boolean {
  switch (f) {
    case 'healthy':
      // The seed library's brief: real meals, reasonable calories, enough protein, not a treat.
      return !has(r, 'treat') && r.kcalPerServing != null && r.kcalPerServing <= HEALTHY_MAX_KCAL
        && (r.proteinGPerServing ?? 0) >= HEALTHY_MIN_PROTEIN_G;
    case 'comfort':
      return MOOD_TAGS.comfort.some((t) => has(r, t));
    case 'high_protein':
      return (r.proteinGPerServing ?? 0) >= HIGH_PROTEIN_G;
    case 'diet':
      return r.kcalPerServing != null && r.kcalPerServing <= DIET_MAX_KCAL;
    case 'veggie':
      return r.dietClass === 'veg';
    case 'fish':
      return r.dietClass === 'fish';
    case 'quick':
      return (r.totalMin != null && r.totalMin <= QUICK_MAX_MIN) || MOOD_TAGS.quick.some((t) => has(r, t));
    case 'one_pot':
      return r.equipment?.pots === 1;
    case 'easy':
      return r.difficulty === 'easy';
    case 'everyday':
      return r.exoticIngredients.length === 0;
  }
}

/** Every selected filter must match. */
export function matchesFilters(r: FacetRecipe, filters: Iterable<RecipeFilter>): boolean {
  for (const f of filters) if (!matchesFilter(r, f)) return false;
  return true;
}
