// One pot, several plates. Each eater's share of the pot follows their dinner
// calorie target, so a plate always matches its owner's calories; whether a
// recipe "fits" then depends on how close the plate's protein lands to target.
// Mirrors public.my_portion() in the SQL migrations.

export const FIT_TOLERANCE = 0.15;
export const DEFAULT_DINNER_KCAL = 700;

export interface EaterTargets {
  userId: string;
  dinnerKcal: number | null;
  dinnerProteinG: number | null;
}

export interface RecipeMacros {
  kcalPerServing: number | null;
  proteinGPerServing: number | null;
}

export interface Plate {
  userId: string;
  kcal: number;
  proteinG: number;
  servings: number;
  /** Relative protein gap: (plate - target) / target. 0 when there is no target. */
  proteinGap: number;
  fits: boolean;
}

export interface PotSplit {
  potServings: number;
  plates: Plate[];
  fitsAll: boolean;
  /** 0..1, how well the recipe suits everyone eating (1 = spot on). */
  fitScore: number;
}

export function splitPot(recipe: RecipeMacros, eaters: EaterTargets[]): PotSplit | null {
  const kcalPerServing = recipe.kcalPerServing ?? 0;
  if (kcalPerServing <= 0 || eaters.length === 0) return null;
  const proteinPerKcal = (recipe.proteinGPerServing ?? 0) / kcalPerServing;

  const plates = eaters.map((e): Plate => {
    const kcal = e.dinnerKcal ?? DEFAULT_DINNER_KCAL;
    const proteinG = kcal * proteinPerKcal;
    const target = e.dinnerProteinG ?? 0;
    const proteinGap = target > 0 ? (proteinG - target) / target : 0;
    return {
      userId: e.userId,
      kcal,
      proteinG,
      servings: kcal / kcalPerServing,
      proteinGap,
      fits: Math.abs(proteinGap) <= FIT_TOLERANCE,
    };
  });

  const potServings = plates.reduce((sum, p) => sum + p.servings, 0);
  // Full marks inside the tolerance, falling to zero at three times it.
  const plateScore = (gap: number) =>
    Math.abs(gap) <= FIT_TOLERANCE ? 1 : Math.max(0, 1 - (Math.abs(gap) - FIT_TOLERANCE) / (2 * FIT_TOLERANCE));
  const fitScore = plates.reduce((sum, p) => sum + plateScore(p.proteinGap), 0) / plates.length;

  return { potServings, plates, fitsAll: plates.every((p) => p.fits), fitScore };
}
