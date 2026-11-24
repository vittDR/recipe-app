// What other households think of each dish (docs/taste-profiles.md §6): the
// prior mean of a dish's own effect (style.ts recipe:<id>). A dish most people
// want more often than they want dinners in general starts a little ahead
// for someone who hasn't said anything about it; their own answers take over
// as they come. It's what helps most the people who answer "regularly" to
// nearly everything, whose answers can't rank those dishes.
//
// Each answer is read on the frequency scale (style.ts, as observationsFor
// weighs it, without fading), relative to how
// often that person wants dinners in general (the mean of their answers),
// and a dish's effect is the weighted mean of those differences, shrunk
// towards 0 by POPULATION_PRIOR pseudo-answers. The people the deck is dealt
// for are left out, so their own answers don't count twice. In production
// the database does the summing (migration population_answers, one row per
// dish); populationEffects is the same from answers, for tests and the
// simulation.

import { dishFeature } from './profile.ts';

/** One person's answer about one dish, on the frequency scale. */
export interface PopulationAnswer { userId: string; recipeId: string; y: number; weight: number }

/** Pseudo-answers at 0 that each dish's effect is shrunk with: a handful of people agreeing is needed to move it. */
export const POPULATION_PRIOR = 4;
/** People with fewer answers say too little about their own mean to be read against it. */
export const POPULATION_MIN_ANSWERS = 5;
/** The most a dish's effect can be, in frequency points. */
export const POPULATION_MAX_EFFECT = 1;

/** A dish's effect from everyone's answers, those of `exclude` aside. */
export function populationEffects(answers: PopulationAnswer[], exclude: Iterable<string> = []): Map<string, number> {
  const skip = new Set(exclude);
  const byUser = new Map<string, PopulationAnswer[]>();
  for (const a of answers) {
    if (skip.has(a.userId) || a.weight <= 0) continue;
    const list = byUser.get(a.userId) ?? [];
    list.push(a);
    byUser.set(a.userId, list);
  }
  const sums = new Map<string, { s: number; w: number }>();
  for (const list of byUser.values()) {
    if (list.length < POPULATION_MIN_ANSWERS) continue;
    const w = list.reduce((s, a) => s + a.weight, 0);
    const mean = list.reduce((s, a) => s + a.weight * a.y, 0) / w;
    for (const a of list) {
      const e = sums.get(a.recipeId) ?? { s: 0, w: 0 };
      e.s += a.weight * (a.y - mean);
      e.w += a.weight;
      sums.set(a.recipeId, e);
    }
  }
  return new Map([...sums].map(([id, e]) => [id, shrink(e.s, e.w)]));
}

const shrink = (s: number, w: number) => Math.max(-POPULATION_MAX_EFFECT, Math.min(POPULATION_MAX_EFFECT, s / (w + POPULATION_PRIOR)));

/** The effects as style.ts featureMean: recipe:<id> starts at its effect, every other feature at 0. */
export function populationMean(effects: Map<string, number>): (feature: string) => number {
  const byFeature = new Map([...effects].map(([id, v]) => [dishFeature(id), v]));
  return (f) => byFeature.get(f) ?? 0;
}

/**
 * The effects from the database's sums (migration population_answers: per
 * dish, the weighted differences and the weights), shrunk like
 * populationEffects.
 */
export function effectsFromSums(sums: Record<string, [number, number]> | null | undefined): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, [s, w]] of Object.entries(sums ?? {})) out.set(id, shrink(s, w));
  return out;
}
