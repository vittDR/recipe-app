// Light recommender: scores a recipe for a person from their taste profile
// (profile.ts), how much they mind their diet, and how much is still unknown
// about them. Pure functions, used by deck.ts.
//
// Three ideas keep it precise without boxing people in:
// 1. Taste and diet are separate. The profile learns taste with the diet
//    explained away (profile.ts); how strictly someone sticks to their goals
//    is its own number (adherence), which only sets how much goal fit counts.
//    Someone who eats lean on weekdays can still love cheesy pasta.
// 2. Taste is scored per kind of feature (dish, sauce, protein…), averaged
//    within each kind and then across kinds, so a recipe with fifteen
//    ingredients isn't louder than one with five, and liking most things
//    doesn't make every dish a 1.
// 3. Discovery: features with little evidence earn an exploration bonus
//    (optimism under uncertainty), decks are kept varied (diversePick:
//    similar dishes lose points), and people who mind their diet still get the
//    occasional treat they'd probably love.

import type { Signal, TasteProfile } from './profile.ts';
import { DIET_FEATURE } from './profile.ts';

/** How much each kind of feature counts towards taste. Plain words are tags, cuisines and ingredients. */
export const GROUP_WEIGHT: Record<string, number> = {
  dish: 1, sauce: 1, protein: 1, starch: 0.7, heat: 0.8, texture: 0.4, method: 0.5, intent: 0.6, goal: 0.4, plain: 1,
};
const groupOf = (f: string) => {
  const i = f.indexOf(':');
  return i < 0 ? 'plain' : f.slice(0, i);
};

/** Sharpens the mean opinion: a mean of 0.5 over every kind of feature reads as about 0.76. */
export const TASTE_GAIN = 2;

/** -1..1: how much this person should like a recipe with these features. Unknown features count as neutral. */
export function tasteScore(features: string[], profile: TasteProfile): number {
  const groups = new Map<string, { sum: number; n: number }>();
  for (const f of new Set(features)) {
    const g = groupOf(f);
    if (!(g in GROUP_WEIGHT)) continue;
    const e = groups.get(g) ?? { sum: 0, n: 0 };
    e.sum += profile.get(f)?.weight ?? 0;
    e.n += 1;
    groups.set(g, e);
  }
  let total = 0;
  let norm = 0;
  for (const [g, e] of groups) {
    // Within a kind: mean over the features, with at most 3 unknowns diluting it.
    total += GROUP_WEIGHT[g] * Math.max(-1, Math.min(1, e.sum / Math.min(e.n, 3)));
    norm += GROUP_WEIGHT[g];
  }
  // A weighted mean across kinds, so liking most things doesn't pile up to 1 for every dish.
  return norm ? Math.tanh(TASTE_GAIN * (total / norm)) : 0;
}

/** Uncertainty is about these: what a dish is, not every ingredient. */
const EXPLORE_GROUPS = new Set(['dish', 'sauce', 'protein', 'starch', 'heat', 'method']);

/** 0..1: how little is known about the recipe's kind of dish for this person (1 = never seen anything like it). */
export function uncertainty(features: string[], profile: TasteProfile): number {
  const relevant = [...new Set(features)].filter((f) => EXPLORE_GROUPS.has(groupOf(f)) && !DIET_FEATURE.test(f));
  if (relevant.length === 0) return 0.5;
  const sum = relevant.reduce((s, f) => s + 1 / Math.sqrt(1 + (profile.get(f)?.evidence ?? 0)), 0);
  return sum / relevant.length;
}

/**
 * 0..1: how much this person sticks to dishes that fit their goals, from the
 * swipes where fit was known. 0.5 when there's too little to tell: a yes rate
 * on fitting dishes no higher than on others means they don't mind (0); a yes
 * rate on others near zero means they mind a lot (1).
 */
export function dietAdherence(signals: Signal[]): number {
  let fitYes = 0, fitN = 0, offYes = 0, offN = 0;
  for (const s of signals) {
    if ((s.kind !== 'swipe' && s.kind !== 'starter') || s.fits == null) continue;
    if (s.kind === 'swipe' && s.reason && s.reason !== 'not_for_me') continue;
    const yes = s.verdict !== 'pass' ? 1 : 0;
    if (s.fits) { fitYes += yes; fitN += 1; } else { offYes += yes; offN += 1; }
  }
  const fitRate = (fitYes + 1) / (fitN + 2);
  const offRate = (offYes + 1) / (offN + 2);
  const raw = Math.max(0, Math.min(1, (fitRate - offRate) / fitRate));
  // Shrink towards "don't know" until there are swipes on both sides.
  const n = Math.min(fitN, offN);
  const confidence = n / (n + ADHERENCE_PRIOR);
  return 0.5 + (raw - 0.5) * confidence;
}
export const ADHERENCE_PRIOR = 5;

/** How much goal fit counts in a deck score: 3 by default, from 2.25 (doesn't mind) to 3.75 (minds a lot). */
export const fitWeight = (adherence: number) => 3 * (0.75 + 0.5 * adherence);

/** From this adherence on, a deck saves a place for a treat the person would probably love. */
export const TREAT_ADHERENCE = 0.6;
/** A treat must be at least this much to their taste, and fit their goals at most this well. */
export const TREAT_MIN_TASTE = 0.1;
export const TREAT_MAX_FIT = 0.6;

/** What makes two dishes "the same kind" for variety in a deck. */
const KIND = /^(dish|protein|sauce|starch):/;

/** 0..1: Jaccard overlap of what the two dishes are. */
export function similarity(a: string[], b: string[]): number {
  const ka = new Set(a.filter((f) => KIND.test(f)));
  const kb = new Set(b.filter((f) => KIND.test(f)));
  if (ka.size === 0 || kb.size === 0) return 0;
  let both = 0;
  for (const f of ka) if (kb.has(f)) both += 1;
  return both / (ka.size + kb.size - both);
}

/** How much a dish like one already in the deck loses (maximal marginal relevance). */
export const DIVERSITY_PENALTY = 1.2;

/** Picks `n` items greedily by score minus their overlap with what's already picked. */
export function diversePick<T>(items: T[], n: number, score: (t: T) => number, features: (t: T) => string[], already: T[] = []): T[] {
  const pool = [...items];
  const picked: T[] = [];
  const chosen = [...already];
  while (picked.length < n && pool.length) {
    let best = 0;
    let bestValue = -Infinity;
    pool.forEach((item, i) => {
      const overlap = chosen.reduce((m, c) => Math.max(m, similarity(features(item), features(c))), 0);
      const value = score(item) - DIVERSITY_PENALTY * overlap;
      if (value > bestValue) { bestValue = value; best = i; }
    });
    const [item] = pool.splice(best, 1);
    picked.push(item);
    chosen.push(item);
  }
  return picked;
}
