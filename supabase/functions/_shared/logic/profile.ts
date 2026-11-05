// Taste profile: every recorded choice a person made about a recipe, turned
// into a weight per learning feature (tags, ingredients and the namespaced
// classification features of classify.ts). Recomputed from the signals each
// time, like the classification, so it follows the catalogue and the rules.
//
// Signals say different things, so they weigh differently:
//   deck swipe   "I'd eat that tonight"     yes +1, must +1.5, pass −1
//                a pass in a mood deck counts half and says nothing about the dish's mood;
//                a pass marked not tonight / too long / had recently counts nothing;
//                a pass marked not for me counts in full, whatever the mood
//   taste quiz   "that looks good"          the same, × 0.75 (looking is not choosing)
//   cooked       it was made                +0.5 for each person who ate it
//   rating       how it was after eating    loved +2, fine +0.5, not again −2
// Older signals fade (half-life PROFILE_HALF_LIFE_DAYS). Recipes that were never
// shown say nothing: there are no negative signals for them.

import { classificationFeatures, isClassFeature, type RecipeClassification } from './classify.ts';
import type { Mood } from './deck.ts';
import type { Verdict } from './preferences.ts';

export type PassReason = 'not_tonight' | 'too_long' | 'had_recently' | 'not_for_me';
export const PASS_REASONS: PassReason[] = ['not_tonight', 'too_long', 'had_recently', 'not_for_me'];
/** Reasons about tonight rather than the dish. */
export const TEMPORARY_REASONS = new Set<PassReason>(['not_tonight', 'too_long', 'had_recently']);

export type Rating = 'loved' | 'fine' | 'not_again' | 'not_eaten';
export const RATINGS: Rating[] = ['loved', 'fine', 'not_again'];

export type Signal =
  | { kind: 'swipe'; verdict: Verdict; mood?: Mood | null; reason?: PassReason | null; features: string[]; at: string }
  | { kind: 'starter'; verdict: Verdict; features: string[]; at: string }
  | { kind: 'cooked'; features: string[]; at: string }
  | { kind: 'rating'; rating: Rating; features: string[]; at: string };

export const STARTER_FACTOR = 0.75;
export const MOOD_PASS_FACTOR = 0.5;
export const COOKED_WEIGHT = 0.5;
export const RATING_WEIGHT: Record<Rating, number> = { loved: 2, fine: 0.5, not_again: -2, not_eaten: 0 };
export const PROFILE_HALF_LIFE_DAYS = 180;
/** Pseudo-count that keeps one signal from making a feature a strong like or dislike. */
export const PROFILE_PRIOR = 2;

const VERDICT_WEIGHT: Record<Verdict, number> = { yes: 1, must: 1.5, pass: -1 };

/** How much a signal says, and about which of the recipe's features. */
export function signalWeight(s: Signal): { weight: number; features: string[] } {
  switch (s.kind) {
    case 'swipe': {
      const moody = !!s.mood && s.mood !== 'any';
      // In a mood deck the dish's own mood was asked for, not judged.
      const features = moody ? s.features.filter((f) => !f.startsWith('intent:')) : s.features;
      if (s.verdict !== 'pass') return { weight: VERDICT_WEIGHT[s.verdict], features };
      if (s.reason && TEMPORARY_REASONS.has(s.reason)) return { weight: 0, features };
      if (s.reason === 'not_for_me') return { weight: -1, features: s.features };
      return { weight: moody ? -MOOD_PASS_FACTOR : -1, features };
    }
    case 'starter':
      return { weight: VERDICT_WEIGHT[s.verdict] * STARTER_FACTOR, features: s.features };
    case 'cooked':
      return { weight: COOKED_WEIGHT, features: s.features };
    case 'rating':
      return { weight: RATING_WEIGHT[s.rating], features: s.features };
  }
}

export interface ProfileEntry {
  /** In [-1, 1]: below zero a dislike, above a like. */
  weight: number;
  /** How many signals mentioned the feature (any weight, any age). */
  evidence: number;
}
export type TasteProfile = Map<string, ProfileEntry>;

export function buildProfile(signals: Signal[], now: number = Date.now()): TasteProfile {
  const sums = new Map<string, { sum: number; abs: number; n: number }>();
  for (const s of signals) {
    const { weight, features } = signalWeight(s);
    const ageDays = Math.max(0, (now - Date.parse(s.at)) / 86_400_000);
    const w = weight * 0.5 ** (ageDays / PROFILE_HALF_LIFE_DAYS);
    for (const f of new Set(features)) {
      const e = sums.get(f) ?? { sum: 0, abs: 0, n: 0 };
      e.sum += w;
      e.abs += Math.abs(w);
      e.n += 1;
      sums.set(f, e);
    }
  }
  const profile: TasteProfile = new Map();
  for (const [f, e] of sums) {
    profile.set(f, { weight: Math.round((e.sum / (e.abs + PROFILE_PRIOR)) * 1000) / 1000, evidence: e.n });
  }
  return profile;
}

export const weightsOf = (p: TasteProfile) => new Map([...p].map(([f, e]) => [f, e.weight]));

/** The clearest likes and dislikes, for showing a person their profile. */
export function profileHighlights(p: TasteProfile, opts: { limit?: number; minEvidence?: number; minWeight?: number } = {}) {
  const { limit = 6, minEvidence = 2, minWeight = 0.2 } = opts;
  const clear = [...p].filter(([, e]) => e.evidence >= minEvidence && Math.abs(e.weight) >= minWeight);
  const by = (sign: 1 | -1) => clear.filter(([, e]) => Math.sign(e.weight) === sign)
    .sort((a, b) => sign * (b[1].weight - a[1].weight) || b[1].evidence - a[1].evidence)
    .slice(0, limit).map(([feature, e]) => ({ feature, ...e }));
  return { likes: by(1), dislikes: by(-1) };
}

// ---------------------------------------------------------------------------
// Taste quiz: which recipes to show first
// ---------------------------------------------------------------------------

export const STARTER_SIZE = 20;

/** What a quiz card should vary on: one value each of these makes the cards tell more apart. */
function quizFacets(c: RecipeClassification): string[] {
  const heat = c.heat_level === null ? [] : [`heat:${c.heat_level === 0 ? 'none' : c.heat_level <= 2 ? 'some' : 'hot'}`];
  return [
    ...classificationFeatures(c).filter((f) => isClassFeature(f) && !f.startsWith('heat:') && !f.startsWith('method:boiled')),
    ...heat,
    // Broad cuisines only: italian/french would otherwise crowd the quiz.
    ...c.cuisines.filter((x) => ['asian', 'mediterranean', 'middle eastern', 'african', 'french', 'american', 'british', 'mexican'].includes(x))
      .map((x) => `cuisine:${x}`),
  ];
}

/**
 * Picks varied recipes for the taste quiz: each next card is the one adding
 * the most protein / dish / sauce / heat / goal / mood / cuisine values not
 * yet covered, so 20 swipes say as much as possible. Recipes with a photo
 * are preferred (the quiz is about how a dish looks); ties are random.
 */
export function pickStarterSet<T extends { id: string; classification: RecipeClassification; hasPhoto?: boolean }>(
  candidates: T[],
  size = STARTER_SIZE,
  random: () => number = Math.random,
): T[] {
  const pool = candidates.map((r) => ({ r, facets: quizFacets(r.classification), jitter: random() }));
  const seen = new Map<string, number>();
  const picked: T[] = [];
  while (picked.length < size && pool.length) {
    let best = -1;
    let bestScore = -Infinity;
    pool.forEach((p, i) => {
      // New values count fully; values already shown count less each time they come back.
      const gain = p.facets.reduce((s, f) => s + 1 / (1 + 2 * (seen.get(f) ?? 0)), 0);
      const score = gain + (p.r.hasPhoto ? 1 : 0) + p.jitter * 0.5;
      if (score > bestScore) { bestScore = score; best = i; }
    });
    const [p] = pool.splice(best, 1);
    for (const f of p.facets) seen.set(f, (seen.get(f) ?? 0) + 1);
    picked.push(p.r);
  }
  return picked;
}

// ---------------------------------------------------------------------------
// From database rows
// ---------------------------------------------------------------------------

export interface SwipeRow { user_id: string; deck_id: string; recipe_id: string; verdict: Verdict; created_at: string; mood?: Mood | null }
export interface TasteSignalRow {
  user_id: string; recipe_id: string; kind: 'starter' | 'reason' | 'rating'; value: string;
  deck_id: string | null; meal_id: string | null; created_at: string;
}
export interface MealRow { id: string; recipe_id: string; for_date: string; status: string; who_eating?: string[] | null }

/** One person's signals: their deck swipes (with pass reasons), quiz answers, ratings and the meals they ate. */
export function signalsFor(
  userId: string,
  rows: { swipes: SwipeRow[]; tasteSignals: TasteSignalRow[]; meals: MealRow[] },
  featuresOf: (recipeId: string) => string[] | undefined,
): Signal[] {
  const mine = rows.tasteSignals.filter((t) => t.user_id === userId);
  const reasons = new Map(mine.filter((t) => t.kind === 'reason').map((t) => [`${t.deck_id}:${t.recipe_id}`, t.value as PassReason]));
  const out: Signal[] = [];
  const push = (recipeId: string, make: (features: string[]) => Signal) => {
    const features = featuresOf(recipeId);
    if (features) out.push(make(features));
  };
  for (const s of rows.swipes) {
    if (s.user_id !== userId) continue;
    push(s.recipe_id, (features) => ({
      kind: 'swipe', verdict: s.verdict, mood: s.mood ?? null, reason: reasons.get(`${s.deck_id}:${s.recipe_id}`) ?? null,
      features, at: s.created_at,
    }));
  }
  for (const t of mine) {
    if (t.kind === 'starter') push(t.recipe_id, (features) => ({ kind: 'starter', verdict: t.value as Verdict, features, at: t.created_at }));
    if (t.kind === 'rating') push(t.recipe_id, (features) => ({ kind: 'rating', rating: t.value as Rating, features, at: t.created_at }));
  }
  const notEaten = new Set(mine.filter((t) => t.kind === 'rating' && t.value === 'not_eaten').map((t) => t.meal_id));
  for (const m of rows.meals) {
    if (m.status !== 'cooked' || notEaten.has(m.id)) continue;
    if (m.who_eating && !m.who_eating.includes(userId)) continue;
    push(m.recipe_id, (features) => ({ kind: 'cooked', features, at: `${m.for_date}T20:00:00Z` }));
  }
  return out;
}
