// Taste profile: every recorded choice a person made about a recipe, turned
// into a weight per learning feature (tags, ingredients and the namespaced
// classification features of classify.ts). Recomputed from the signals each
// time, like the classification, so it follows the catalogue and the rules.
//
// Signals say different things, so they weigh differently:
//   deck swipe   "I'd eat that tonight"     yes +1, must +1.5, pass −0.4
//                a plain pass is mostly "not tonight", so it weighs far less than a yes:
//                liking something is news, skipping it rarely is;
//                a pass in a mood deck counts half again and says nothing about the dish's mood;
//                passes from before the reason chips were removed keep their reason:
//                not tonight / too long / had recently counts nothing, not for me in full
//   taste quiz   "that looks good"          the same, × 0.75 (looking is not choosing)
//   cooked       it was made                +0.5 for each person who ate it
//   rating       how it was after eating    loved +2, fine +0.5, not again −2
//
// Diet explains away. Someone who minds their diet passes on cheesy pasta
// because of the calories, not the cheese. Each swipe knows whether the dish
// fit that person's goals (member_portions.fits, or their goals now for the
// quiz). A pass on a dish that didn't fit counts only OFF_DIET_PASS_FACTOR
// against its taste; a yes on one ("I want it anyway") counts more. And
// diet-linked features (goal:*, intent:light/indulgent/fuel) aren't learned
// from deck swipes or cooking at all: the deck already ranks on fit, so those
// choices say what the diet is, not what tastes good. They're learned from
// ratings after eating, which do say what tastes good.
//
// Older signals fade (half-life PROFILE_HALF_LIFE_DAYS). Recipes that were never
// shown say nothing: there are no negative signals for them.

import { classificationFeatures, isClassFeature, type RecipeClassification } from './classify.ts';
import type { Mood } from './deck.ts';
import type { Verdict } from './preferences.ts';

export type PassReason = 'not_tonight' | 'too_long' | 'had_recently' | 'not_for_me';
export const PASS_REASONS: PassReason[] = ['not_tonight', 'too_long', 'had_recently', 'not_for_me'];
/** Reasons about tonight rather than the dish. */
export const TEMPORARY_REASONS = new Set<PassReason>(['not_tonight', 'too_long', 'had_recently']);

/** A quiz answer: a swipe verdict, or "I like it, but not often". */
export type StarterVerdict = Verdict | 'sometimes';

export type Rating = 'loved' | 'fine' | 'not_again' | 'not_eaten';
export const RATINGS: Rating[] = ['loved', 'fine', 'not_again'];

export type Signal =
  | {
    kind: 'swipe'; verdict: Verdict; mood?: Mood | null; reason?: PassReason | null; features: string[]; at: string;
    /** Whether the dish fit this person's goals when it was shown; null when unknown. */
    fits?: boolean | null;
  }
  | { kind: 'starter'; verdict: StarterVerdict; features: string[]; at: string; fits?: boolean | null; recipeId?: string }
  | { kind: 'cooked'; features: string[]; at: string }
  | { kind: 'rating'; rating: Rating; features: string[]; at: string };

export const STARTER_FACTOR = 0.75;
/** A plain deck pass, against a yes's 1: not feeling like it tonight is not a dislike. */
export const PASS_WEIGHT = 0.4;
export const MOOD_PASS_FACTOR = 0.5;
/** A pass on a dish that didn't fit the person's goals is mostly the diet talking. */
export const OFF_DIET_PASS_FACTOR = 0.2;
/** A yes on a dish that didn't fit says they really want it. */
export const OFF_DIET_YES_FACTOR = 1.25;
/** Features that describe what a dish does for a diet rather than how it tastes. */
export const DIET_FEATURE = /^(goal:|intent:(light|indulgent|fuel)$)/;
const tasteOnly = (features: string[]) => features.filter((f) => !DIET_FEATURE.test(f));
export const COOKED_WEIGHT = 0.5;
export const RATING_WEIGHT: Record<Rating, number> = { loved: 2, fine: 0.5, not_again: -2, not_eaten: 0 };
export const PROFILE_HALF_LIFE_DAYS = 180;
/** Pseudo-count that keeps one signal from making a feature a strong like or dislike. */
export const PROFILE_PRIOR = 2;

// "Not often" is a like: how often is the deck's business (occasionalKinds), not taste.
const VERDICT_WEIGHT: Record<StarterVerdict, number> = { yes: 1, must: 1.5, pass: -1, sometimes: 1 };

/** How much a signal says, and about which of the recipe's features. */
export function signalWeight(s: Signal): { weight: number; features: string[] } {
  switch (s.kind) {
    case 'swipe': {
      const moody = !!s.mood && s.mood !== 'any';
      // The deck was ranked on diet fit, so diet features say nothing here; in a mood
      // deck the dish's own mood was asked for, not judged.
      const features = tasteOnly(s.features).filter((f) => !(moody && f.startsWith('intent:')));
      if (s.verdict !== 'pass') return { weight: VERDICT_WEIGHT[s.verdict] * (s.fits === false ? OFF_DIET_YES_FACTOR : 1), features };
      if (s.reason && TEMPORARY_REASONS.has(s.reason)) return { weight: 0, features };
      if (s.reason === 'not_for_me') return { weight: -1, features: tasteOnly(s.features) };
      return { weight: -PASS_WEIGHT * (moody ? MOOD_PASS_FACTOR : 1) * (s.fits === false ? OFF_DIET_PASS_FACTOR : 1), features };
    }
    case 'starter': {
      if (s.verdict !== 'pass') {
        return { weight: VERDICT_WEIGHT[s.verdict] * STARTER_FACTOR * (s.fits === false ? OFF_DIET_YES_FACTOR : 1), features: s.features };
      }
      // Passing on a dish that doesn't fit: likely the diet, and not a dislike of indulgence itself.
      return s.fits === false
        ? { weight: -STARTER_FACTOR * OFF_DIET_PASS_FACTOR, features: tasteOnly(s.features) }
        : { weight: -STARTER_FACTOR, features: s.features };
    }
    case 'cooked':
      return { weight: COOKED_WEIGHT, features: tasteOnly(s.features) };
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
    if (weight === 0) continue; // "not tonight": nothing about taste
    const decay = 0.5 ** (Math.max(0, (now - Date.parse(s.at)) / 86_400_000) / PROFILE_HALF_LIFE_DAYS);
    const w = weight * decay;
    for (const f of new Set(features)) {
      const e = sums.get(f) ?? { sum: 0, abs: 0, n: 0 };
      e.sum += w;
      // Every choice is at least one unit of evidence, so many weak signals (passes the diet
      // explains) stay weak instead of adding up to a strong opinion.
      e.abs += Math.max(Math.abs(weight), 1) * decay;
      e.n += 1;
      sums.set(f, e);
    }
  }
  const profile: TasteProfile = new Map();
  for (const [f, e] of sums) {
    const weight = Math.max(-1, Math.min(1, e.sum / (e.abs + PROFILE_PRIOR)));
    profile.set(f, { weight: Math.round(weight * 1000) / 1000, evidence: e.n });
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
/** member_portions: whether a deck card fit a person's goals when it was dealt. */
export interface PortionRow { deck_id: string; recipe_id: string; user_id: string; fits: boolean }

/** One person's signals: their deck swipes (with pass reasons), quiz answers, ratings and the meals they ate. */
export function signalsFor(
  userId: string,
  rows: { swipes: SwipeRow[]; tasteSignals: TasteSignalRow[]; meals: MealRow[]; portions?: PortionRow[] },
  featuresOf: (recipeId: string) => string[] | undefined,
  /** Whether a recipe fits this person's goals now: for quiz answers, which have no deck. */
  fitsNow?: (recipeId: string) => boolean | null,
): Signal[] {
  const mine = rows.tasteSignals.filter((t) => t.user_id === userId);
  const fitAtDeal = new Map((rows.portions ?? []).filter((p) => p.user_id === userId)
    .map((p) => [`${p.deck_id}:${p.recipe_id}`, p.fits]));
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
      features, at: s.created_at, fits: fitAtDeal.get(`${s.deck_id}:${s.recipe_id}`) ?? null,
    }));
  }
  for (const t of mine) {
    if (t.kind === 'starter') {
      push(t.recipe_id, (features) => ({
        kind: 'starter', verdict: t.value as StarterVerdict, features, at: t.created_at, fits: fitsNow?.(t.recipe_id) ?? null,
        recipeId: t.recipe_id,
      }));
    }
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

/**
 * The kinds of dish someone likes but doesn't want often: from quiz answers
 * "I like it, but not often", the dish's family (dish:pizza, dish:gratin…)
 * and the recipe itself (recipe:<id>). The deck keeps these occasional.
 */
export function occasionalKinds(signals: Signal[]): Set<string> {
  const kinds = new Set<string>();
  for (const s of signals) {
    if (s.kind !== 'starter' || s.verdict !== 'sometimes') continue;
    for (const f of s.features) if (f.startsWith('dish:') && f !== 'dish:other' && f !== 'dish:plated') kinds.add(f);
    if (s.recipeId) kinds.add(`recipe:${s.recipeId}`);
  }
  return kinds;
}

/** The keys a recipe is matched on against occasionalKinds. */
export function kindKeys(recipeId: string, features: string[] | undefined): string[] {
  return [`recipe:${recipeId}`, ...(features ?? []).filter((f) => f.startsWith('dish:'))];
}
