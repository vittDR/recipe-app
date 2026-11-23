// One pot, several plates. Each eater says how many servings they eat
// (1 by default), so a plate is the recipe's per-serving macros times that.
// A recipe "fits" an eater when their plate lands near their calorie target,
// carries enough protein and fibre (more is fine) and stays under their carbs
// and fat (less is fine). Each target is optional: switched off (null), it
// doesn't count. A recipe whose carbs, fat or fibre aren't known isn't held
// to those targets. Mirrors public.my_portion() in the SQL migrations.

/** Plate calories may be this far from target, either way. */
export const KCAL_TOLERANCE = 0.2;
/** Plate protein may fall this far short of target. */
export const PROTEIN_SHORTFALL = 0.15;
/** Plate fibre may fall this far short of target. */
export const FIBRE_SHORTFALL = 0.15;
/** Plate carbs and fat may go this far over target. */
export const CEILING_OVERSHOOT = 0.2;
export const DEFAULT_SERVINGS = 1;

export interface EaterTargets {
  userId: string;
  dinnerKcal: number | null;
  dinnerProteinG: number | null;
  /** At most this much, per dinner; null or absent = no target. */
  dinnerCarbsG?: number | null;
  dinnerFatG?: number | null;
  /** At least this much, per dinner; null or absent = no target. */
  dinnerFibreG?: number | null;
  /** Servings this eater has on their plate. Null means 1. */
  servings?: number | null;
}

/** A member_goals row as stored, as targets. */
export function targetsOf(userId: string, g: {
  dinner_kcal?: number | null; dinner_protein_g?: number | null; dinner_carbs_g?: number | null;
  dinner_fat_g?: number | null; dinner_fibre_g?: number | null; servings?: number | null;
} | null | undefined): EaterTargets {
  return {
    userId,
    dinnerKcal: g?.dinner_kcal ?? null,
    dinnerProteinG: g?.dinner_protein_g ?? null,
    dinnerCarbsG: g?.dinner_carbs_g ?? null,
    dinnerFatG: g?.dinner_fat_g ?? null,
    dinnerFibreG: g?.dinner_fibre_g ?? null,
    servings: g?.servings ?? null,
  };
}

export interface RecipeMacros {
  kcalPerServing: number | null;
  proteinGPerServing: number | null;
  /** From the recipe's classification (classify.ts nutrition); null or absent = unknown. */
  carbsGPerServing?: number | null;
  fatGPerServing?: number | null;
  fibreGPerServing?: number | null;
}

/** A recipe's per-serving macros: calories and protein as stored, the rest from its classification. */
export function macrosOf(
  row: { kcal_per_serving: number | null; protein_g_per_serving: number | null },
  nutrition?: { carbs_g?: number | null; fat_g?: number | null; fiber_g?: number | null } | null,
): RecipeMacros {
  return {
    kcalPerServing: row.kcal_per_serving,
    proteinGPerServing: row.protein_g_per_serving,
    carbsGPerServing: nutrition?.carbs_g ?? null,
    fatGPerServing: nutrition?.fat_g ?? null,
    fibreGPerServing: nutrition?.fiber_g ?? null,
  };
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
  /** Relative gaps for carbs, fat and fibre; 0 when there is no target or the recipe's value is unknown. */
  carbsGap: number;
  fatGap: number;
  fibreGap: number;
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
    const known = (perServing: number | null | undefined, target: number | null | undefined) =>
      perServing == null ? 0 : gap(perServing * servings, target ?? null);
    const carbsGap = known(recipe.carbsGPerServing, e.dinnerCarbsG);
    const fatGap = known(recipe.fatGPerServing, e.dinnerFatG);
    const fibreGap = known(recipe.fibreGPerServing, e.dinnerFibreG);
    return {
      userId: e.userId, kcal, proteinG, servings, kcalGap, proteinGap, carbsGap, fatGap, fibreGap,
      fits: Math.abs(kcalGap) <= KCAL_TOLERANCE && -proteinGap <= PROTEIN_SHORTFALL
        && carbsGap <= CEILING_OVERSHOOT && fatGap <= CEILING_OVERSHOOT && -fibreGap <= FIBRE_SHORTFALL,
    };
  });

  const potServings = plates.reduce((sum, p) => sum + p.servings, 0);
  const plateScore = (p: Plate) => Math.min(
    within(Math.abs(p.kcalGap), KCAL_TOLERANCE),
    within(Math.max(0, -p.proteinGap), PROTEIN_SHORTFALL),
    within(Math.max(0, p.carbsGap), CEILING_OVERSHOOT),
    within(Math.max(0, p.fatGap), CEILING_OVERSHOOT),
    within(Math.max(0, -p.fibreGap), FIBRE_SHORTFALL),
  );
  const fitScore = plates.reduce((sum, p) => sum + plateScore(p), 0) / plates.length;

  return { potServings, plates, fitsAll: plates.every((p) => p.fits), fitScore };
}
