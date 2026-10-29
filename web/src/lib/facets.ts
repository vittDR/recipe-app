// Recipe facets on the client: diet class and exotic ingredients come from the
// catalogue, the rest from the recipe row. Rules live in @logic/facets.ts.
import { type Equipment, type FacetRecipe, MANY_POTS, SPECIAL_EQUIPMENT } from '@logic/facets.ts';
import { type Catalog, dietClassOf } from '@logic/ingredients.ts';
import type { MessageKey, useI18n } from '../i18n/index.tsx';
import type { Recipe } from './types.ts';

/** Names of the ingredients not sold in most French supermarkets. */
export function exoticIngredients(names: string[], catalog: Catalog): string[] {
  return names.filter((n) => catalog.find(n)?.exotic);
}

export function facetsOf(r: Recipe, ingredientNames: string[], catalog: Catalog): FacetRecipe {
  return {
    tags: r.tags,
    totalMin: r.total_min,
    kcalPerServing: r.kcal_per_serving,
    proteinGPerServing: r.protein_g_per_serving,
    dietClass: dietClassOf(ingredientNames.map((n) => catalog.find(n))),
    difficulty: r.difficulty,
    equipment: r.equipment,
    exoticIngredients: exoticIngredients(ingredientNames, catalog),
  };
}

/** "2 pots and pans", "Oven", "Blender"…, each flagged when it makes the recipe tedious:
 *  many pots and pans, or equipment a lot of kitchens don't have. Special items people typed are shown as written. */
export function equipmentLabels(eq: Equipment | null, { t, tn }: ReturnType<typeof useI18n>): { label: string; tedious: boolean }[] {
  if (!eq) return [];
  const known = SPECIAL_EQUIPMENT as readonly string[];
  return [
    ...(eq.pots > 0 ? [{ label: tn('equipment.pots', eq.pots), tedious: eq.pots >= MANY_POTS }] : []),
    ...(eq.oven ? [{ label: t('equipment.oven'), tedious: false }] : []),
    ...eq.special.map((s) => ({ label: known.includes(s) ? t(`equipment.${s}` as MessageKey) : s, tedious: true })),
  ];
}

/** Only the tedious bits, for recipe tiles. */
export function effortLabels(eq: Equipment | null, i18n: ReturnType<typeof useI18n>): string[] {
  return equipmentLabels(eq, i18n).filter((e) => e.tedious).map((e) => e.label);
}
