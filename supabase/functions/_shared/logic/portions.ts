// One pot, several plates. Each eater says how many servings they eat
// (1 by default), so a plate is the recipe's per-serving macros times that.
// A recipe "fits" an eater when their plate lands near their calorie target
// and carries enough protein (more protein is fine).
// Mirrors public.my_portion() in the SQL migrations.

/** Plate calories may be this far from target, either way. */
export const KCAL_TOLERANCE = 0.2;
/** Plate protein may fall this far short of target. */
export const PROTEIN_SHORTFALL = 0.15;
export const DEFAULT_SERVINGS = 1;

export interface EaterTargets {
  userId: string;
  dinnerKcal: number | null;
  dinnerProteinG: number | null;
  /** Servings this eater has on their plate. Null means 1. */
  servings?: number | null;
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
  /** Relative calorie gap: (plate - target) / target. 0 when there is no target. */
  kcalGap: number;
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

const gap = (value: number, target: number | null) => (target && target > 0 ? (value - target) / target : 0);
// Full marks inside the tolerance, falling to zero at three times it.
const within = (miss: number, tolerance: number) =>
  miss <= tolerance ? 1 : Math.max(0, 1 - (miss - tolerance) / (2 * tolerance));

export function splitPot(recipe: RecipeMacros, eaters: EaterTargets[]): PotSplit | null {
  const kcalPerServing = recipe.kcalPerServing ?? 0;
  if (kcalPerServing <= 0 || eaters.length === 0) return null;

  const plates = eaters.map((e): Plate => {
    const servings = e.servings && e.servings > 0 ? e.servings : DEFAULT_SERVINGS;
    const kcal = kcalPerServing * servings;
    const proteinG = (recipe.proteinGPerServing ?? 0) * servings;
    const kcalGap = gap(kcal, e.dinnerKcal);
    const proteinGap = gap(proteinG, e.dinnerProteinG);
    return {
      userId: e.userId, kcal, proteinG, servings, kcalGap, proteinGap,
      fits: Math.abs(kcalGap) <= KCAL_TOLERANCE && -proteinGap <= PROTEIN_SHORTFALL,
    };
  });

  const potServings = plates.reduce((sum, p) => sum + p.servings, 0);
  const plateScore = (p: Plate) =>
    Math.min(within(Math.abs(p.kcalGap), KCAL_TOLERANCE), within(Math.max(0, -p.proteinGap), PROTEIN_SHORTFALL));
  const fitScore = plates.reduce((sum, p) => sum + plateScore(p), 0) / plates.length;

  return { potServings, plates, fitsAll: plates.every((p) => p.fits), fitScore };
}
