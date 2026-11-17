// Plate space (docs/taste-profiles.md): what a dish is as a plate, in four
// numbers in [0, 1], from its classification. Style (how often someone wants
// a plate like this) is learned over this space; taste (what's in it) is the
// features of profile.ts. Portion size isn't an axis: portions are scaled to
// each eater (portions.ts).
//
// Each axis runs from about the library's 5th percentile (0) to its 95th (1),
// so the space is used evenly; values outside are clamped.

import { type ClassifiableRow, classifyRow, type DishFamily, type RecipeClassification, type SauceFamily } from './classify.ts';
import type { Catalog } from './ingredients.ts';

export const PLATE_AXES = ['protein', 'rich', 'veg', 'carb'] as const;
export type PlateAxis = (typeof PLATE_AXES)[number];
export type Plate = Record<PlateAxis, number>;

/** Raw value at 0 and at 1 for each axis. */
export const PLATE_RANGE = {
  /** Share of calories from protein. */
  protein: [0.12, 0.38],
  /** Share of calories from fat, before the rich bonuses. */
  rich: [0.2, 0.55],
  /** Grams of vegetables per serving. */
  veg: [0, 300],
  /** Share of calories from carbohydrates. */
  carb: [0.1, 0.58],
} as const satisfies Record<PlateAxis, readonly [number, number]>;

/**
 * Richness is how a plate eats, not only its fat: olive oil on a Niçoise is
 * as much fat as cream in a gratin but reads lighter. The fat share counts
 * RICH_FAT_SHARE of the axis; cream, cheese, frying and baked cheesy dishes
 * the rest.
 */
export const RICH_FAT_SHARE = 0.6;
export const RICH_SAUCE_BONUS: Partial<Record<SauceFamily, number>> = { cream: 0.3, cheese: 0.3, mayonnaise: 0.2, coconut: 0.1 };
export const RICH_DISH_BONUS: Partial<Record<DishFamily, number>> = { gratin: 0.15, pie: 0.15, pizza: 0.15 };
export const DEEP_FRIED_BONUS = 0.35;

/** How much each axis counts in plate distance: richness is where people differ most. */
export const PLATE_WEIGHT: Plate = { protein: 1, rich: 1.5, veg: 1, carb: 0.8 };

const scale = (axis: PlateAxis, v: number) => {
  const [lo, hi] = PLATE_RANGE[axis];
  return Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
};
const round = (v: number) => Math.round(v * 1000) / 1000;

type PlateFields = 'nutrition' | 'veg_g' | 'sauce_families' | 'dish_families' | 'cooking_methods';

/** The dish's plate vector; null when its nutrition can't be read. */
export function plateVector(c: Pick<RecipeClassification, PlateFields> | null | undefined): Plate | null {
  if (!c) return null;
  const { kcal, protein_g, fat_g, carbs_g } = c.nutrition;
  if (!kcal || protein_g === null || fat_g === null || carbs_g === null || c.veg_g === null) return null;
  // Cream and cheese together are one rich sauce, not two.
  const bonus = Math.max(0, ...(c.sauce_families ?? []).map((f) => RICH_SAUCE_BONUS[f] ?? 0))
    + Math.max(0, ...c.dish_families.map((d) => RICH_DISH_BONUS[d] ?? 0))
    + (c.cooking_methods.includes('deep_fried') ? DEEP_FRIED_BONUS : 0);
  // Carbs by the numbers, not the starch_bases list: a base the catalogue doesn't
  // name (lasagne sheets) still counts, and vegetables add few calories of carbs.
  return {
    protein: round(scale('protein', (4 * protein_g) / kcal)),
    rich: round(Math.min(1, RICH_FAT_SHARE * scale('rich', (9 * fat_g) / kcal) + bonus)),
    veg: round(scale('veg', c.veg_g)),
    carb: round(scale('carb', (4 * carbs_g) / kcal)),
  };
}

/** Weighted Euclidean distance between two plates, normalised so the far corners are 1 apart. */
export function plateDistance(a: Plate, b: Plate): number {
  let sum = 0;
  let norm = 0;
  for (const axis of PLATE_AXES) {
    sum += PLATE_WEIGHT[axis] * (a[axis] - b[axis]) ** 2;
    norm += PLATE_WEIGHT[axis];
  }
  return Math.sqrt(sum / norm);
}

/** Below this distance, the dish without its optional lines is the same plate. */
export const ADJUSTABLE_MIN_DISTANCE = 0.08;

/**
 * The dish's plates: as written, and without its optional lines when that
 * makes a different plate (parmesan to serve, cream to finish). Each eater is
 * scored on the one that suits them.
 */
export function platesOf(
  c: Pick<RecipeClassification, PlateFields> | null | undefined,
  withoutOptional?: Pick<RecipeClassification, PlateFields> | null,
): Plate[] {
  const full = plateVector(c);
  if (!full) return [];
  const lean = plateVector(withoutOptional);
  return lean && plateDistance(full, lean) >= ADJUSTABLE_MIN_DISTANCE ? [full, lean] : [full];
}

/**
 * A stored recipe's plates (platesOf), classified against the catalogue: its
 * classification as written (the stored one when fresh, or `classification`
 * when the caller already has it), and, when it has optional lines, the dish
 * without them, worked out here (that one is never stored).
 */
export function rowPlates(row: ClassifiableRow, catalog: Catalog, classification?: RecipeClassification): Plate[] {
  const full = classification ?? classifyRow(row, catalog);
  const required = row.recipe_ingredients.filter((i) => !i.optional);
  const without = required.length < row.recipe_ingredients.length && required.length > 0
    ? classifyRow({ ...row, recipe_ingredients: required, classification: null, classified_with: null }, catalog)
    : null;
  return platesOf(full, without);
}
