// Learning features of a recipe. How choices about them turn into a taste
// profile is profile.ts; nothing here is locked in as a rule.
//
// Features are tags, non-staple ingredient names and the recipe's
// classification (classify.ts), namespaced: "dish:curry", "sauce:coconut",
// "heat:2+", "intent:comfort". A pass in a deck dealt for a mood (light,
// comfort…) is partly about tonight, not taste: it counts half, and says
// nothing about the dish's own mood.

import { canonicalFeature, classificationFeatures, type RecipeClassification } from './classify.ts';

export type Verdict = 'pass' | 'yes' | 'must';

/** Features of a recipe used for learning: tags, non-staple ingredient names and its classification. */
export function recipeFeatures(
  tags: string[],
  ingredients: { name: string; is_staple?: boolean | null }[],
  classification?: RecipeClassification | null,
): string[] {
  return [...new Set([
    ...tags.map(canonicalFeature),
    ...ingredients.filter((i) => !i.is_staple).map((i) => i.name.toLowerCase()),
    ...(classification ? classificationFeatures(classification) : []),
  ])];
}
