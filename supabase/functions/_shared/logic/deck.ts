// Deck generation: hard filters from everyone's rules, then a score mixing
// goal fit (weighted by how much each eater minds it), taste (recommend.ts),
// mood, pantry overlap and household history. 12 cards in three tiers: 5 very
// close to everyone's taste, 5 close (maybe more one person's), 2 wildcards
// that fit the goals but take liberties; kept varied, with a treat for people
// who mind their diet.

import type { MealIntent } from './classify.ts';
import type { TasteProfile } from './profile.ts';
import {
  diversePick, fitWeight, similarity, TREAT_ADHERENCE, TREAT_MAX_FIT, TREAT_MIN_TASTE, tasteScore, uncertainty,
} from './recommend.ts';
import { type EaterTargets, type PotSplit, splitPot } from './portions.ts';

export type Diet = 'everything' | 'pescatarian' | 'vegetarian';
export type Mood = 'any' | 'comfort' | 'light' | 'quick' | 'fancy';

export interface CandidateRecipe {
  id: string;
  title: string;
  tags: string[];
  ingredientNames: string[]; // non-staple ingredient names, lowercase
  /** Every line's catalogue ingredient, staples and optional lines included: what allergies are checked against. */
  allIngredients?: string[];
  productIds?: string[]; // the catalogue items its ingredients are, staples included
  /** Items found only on optional lines: a "never" rule doesn't rule the recipe out for them. */
  optionalProductIds?: string[];
  dietClass: 'veg' | 'fish' | 'meat';
  totalMin: number | null;
  kcalPerServing: number | null;
  proteinGPerServing: number | null;
  /** Learning features (preferences.ts recipeFeatures); defaults to tags plus ingredient names. */
  features?: string[];
  /** What the dish is for (classify.ts); moods match on these when given, else on tags. */
  intents?: MealIntent[];
}

export interface DeckMember extends EaterTargets {
  /** Never / love rules: catalogue items, matched on the recipe's ingredient products. */
  never: string[];
  loves: string[];
  diet: Diet;
  /**
   * Catalogue ingredients this person is allergic to (an allergen's linked
   * ingredients and preparations, plus any added by hand). Harder than never:
   * optional lines and staples count too.
   */
  allergies?: string[];
  /** Soft weights per feature (tags/ingredients), [-1, 1], incl. accepted patterns. Used when there's no profile. */
  weights: Map<string, number>;
  /** Taste profile (profile.ts), accepted patterns included: scored with recommend.ts. */
  profile?: TasteProfile;
  /** 0..1, how much this eater sticks to their goals (recommend.ts dietAdherence); 0.5 when unknown. */
  adherence?: number;
}

/** How much an unexplored kind of dish is worth, at full uncertainty. */
export const EXPLORE_WEIGHT = 0.8;

export interface RecipeHistory {
  /** Household yes/must count across past decks. */
  yes: number;
  pass: number;
  cooked: number;
  lastCookedAt?: string; // ISO date
}

export interface DeckOptions {
  size?: number;
  /** @deprecated Ignored: decks are built in tiers (deckShape). */
  newShare?: number;
  mood?: Mood;
  maxMinutes?: number | null;
  pantry?: string[]; // ingredient names bought or marked at home recently
  recentlyCooked?: Set<string>;
  /** Cards of tonight's decks that ended without a match: left out of the new one. */
  exclude?: Set<string>;
  /** Features of what someone said yes to in those decks: the new deck leans towards them. */
  lean?: Set<string>;
  random?: () => number;
}

export interface DeckCard {
  recipeId: string;
  position: number;
  score: number;
  fitScore: number;
  fitsAll: boolean;
  split: PotSplit | null;
  known: boolean;
  reason: string | null;
  /** close: very close to everyone's taste; near: close, maybe more one person's; wild: fits the goals, takes liberties. */
  tier: 'close' | 'near' | 'wild';
}

// Tag names from the tag catalogue (logic/tags.ts), which maps other words onto them.
export const MOOD_TAGS: Record<Exclude<Mood, 'any'>, string[]> = {
  comfort: ['comfort', 'curry', 'stew', 'soup'],
  light: ['light', 'salad', 'bowl'],
  quick: ['quick'],
  fancy: ['fancy'],
};

const usesProduct = (productIds: string[] | undefined, ids: string[]) =>
  ids.length > 0 && !!productIds?.some((id) => ids.includes(id));

export function passesHardFilters(recipe: CandidateRecipe, members: DeckMember[], opts: DeckOptions): boolean {
  if (opts.recentlyCooked?.has(recipe.id)) return false;
  if (opts.exclude?.has(recipe.id)) return false;
  if (opts.maxMinutes && recipe.totalMin && recipe.totalMin > opts.maxMinutes) return false;
  // The recipe as it's still made when every optional line is left out.
  const essential = recipe.productIds?.filter((id) => !recipe.optionalProductIds?.includes(id));
  for (const m of members) {
    if (m.diet === 'vegetarian' && recipe.dietClass !== 'veg') return false;
    if (m.diet === 'pescatarian' && recipe.dietClass === 'meat') return false;
    if (usesProduct(essential, m.never)) return false;
    if (m.allergies?.length) {
      const names = recipe.allIngredients ?? recipe.ingredientNames;
      if (names.some((n) => m.allergies!.includes(n.toLowerCase()))) return false;
    }
  }
  return true;
}

function moodScore(recipe: CandidateRecipe, mood: Mood | undefined): number {
  if (!mood || mood === 'any') return 0;
  if (mood === 'quick' && recipe.totalMin && recipe.totalMin <= 25) return 1;
  if (recipe.intents && mood !== 'quick') {
    // Classified: comfort, light and fancy are what the dish is for (its tags included).
    const want: MealIntent = mood === 'fancy' ? 'special_occasion' : mood;
    if (recipe.intents.includes(want)) return 1;
    if (mood === 'light' && recipe.intents.includes('fuel')) return 0.5;
    return mood === 'fancy' && recipe.totalMin && recipe.totalMin >= 45 ? 0.5 : 0;
  }
  if (mood === 'fancy' && recipe.totalMin && recipe.totalMin >= 45) return 0.5;
  // Ingredients aren't tags: fish and pasta come from the ingredient list.
  if (mood === 'light' && recipe.dietClass === 'fish') return 1;
  if (mood === 'comfort' && recipe.ingredientNames.includes('pasta')) return 1;
  const tags = recipe.tags.map((t) => t.toLowerCase());
  return MOOD_TAGS[mood].some((t) => tags.includes(t)) ? 1 : 0;
}

export function scoreRecipe(
  recipe: CandidateRecipe,
  members: DeckMember[],
  history: RecipeHistory | undefined,
  opts: DeckOptions,
): {
  score: number; split: PotSplit | null; reason: string | null; taste: number;
  /** Each eater's taste for it, in members' order (-1..1). */
  tastes: number[];
  /** Everything but taste and exploration: fit, loves, mood, pantry, history, noise. */
  base: number;
  /** 0..1, how little is known about this kind of dish for the eaters. */
  explore: number;
} {
  const split = splitPot(recipe, members);
  const fit = split?.fitScore ?? 0.5; // unknown macros: neutral
  const features = recipe.features ?? [...recipe.tags.map((t) => t.toLowerCase()), ...recipe.ingredientNames];

  let pref = 0;
  let love = 0;
  let explore = 0;
  let fitW = 0;
  const tastes: number[] = [];
  for (const m of members) {
    let taste: number;
    if (m.profile) {
      taste = tasteScore(features, m.profile);
      explore += uncertainty(features, m.profile);
    } else {
      let w = 0;
      for (const f of features) w += m.weights.get(f) ?? 0;
      taste = Math.max(-1, Math.min(1, w / 3));
    }
    tastes.push(taste);
    pref += taste;
    fitW += fitWeight(m.adherence ?? 0.5);
    if (usesProduct(recipe.productIds, m.loves)) love += 1;
  }
  const count = members.length || 1;
  pref /= count;
  love /= count;
  explore /= count;
  fitW = members.length ? fitW / count : fitWeight(0.5);

  const pantry = new Set((opts.pantry ?? []).map((p) => p.toLowerCase()));
  const pantryHits = recipe.ingredientNames.filter((n) => pantry.has(n));
  const pantryScore = recipe.ingredientNames.length ? pantryHits.length / recipe.ingredientNames.length : 0;

  const liked = history ? (history.yes - history.pass) / (history.yes + history.pass + 2) : 0;
  const novelty = (opts.random ?? Math.random)() * 0.15;
  // After a no-match: closer to what someone liked in the deck that failed (counts in every tier).
  const lean = opts.lean?.size ? Math.min(1, features.filter((f) => opts.lean!.has(f)).length / 3) : 0;

  const base = fitW * fit + 1 * love + 1.2 * moodScore(recipe, opts.mood) + 1 * pantryScore + 0.8 * liked + 1.2 * lean + novelty;
  const score = base + 1.5 * pref + EXPLORE_WEIGHT * explore;

  const reason = pantryHits.length > 0 ? `pantry:${pantryHits[0]}` : love > 0 ? 'love' : null;
  return { score: Math.round(score * 1000) / 1000, split, reason, taste: pref, tastes, base, explore };
}

// A deck of 12: 5 very close to everyone's taste, 5 close (one person may like
// it more than the other), 2 wildcards that fit everyone's goals but take
// liberties with taste. Other sizes keep the proportions.
export const CLOSE_SHARE = 5 / 12;
export const WILDCARD_SHARE = 2 / 12;
/** Taste weight for "very close" (on the least keen eater) and "close" (mostly on the keenest). */
export const CLOSE_TASTE_WEIGHT = 2.5;
export const NEAR_TASTE_WEIGHT = 2;
/** "Close" cards say whose kind of dish it is when tastes differ by this much. */
export const LEANS_GAP = 0.25;
/** Wildcards must fit everyone's goals this well, and nobody may dislike them more than this. */
export const WILDCARD_MIN_FIT = 0.7;
export const WILDCARD_MIN_TASTE = -0.2;

/** How many cards of each tier a deck of `size` has. */
export function deckShape(size: number): { close: number; near: number; wild: number } {
  const wild = size >= 6 ? Math.round(size * WILDCARD_SHARE) : 0;
  const close = Math.round(size * CLOSE_SHARE);
  return { close, near: Math.max(0, size - close - wild), wild };
}

/**
 * Builds the deck. Very close cards rank on the least keen eater's taste (all
 * of them should like it); close cards mostly on the keenest's. Wildcards are
 * drawn at random, favouring kinds of dish we know least about, among dishes
 * that fit everyone's calorie and protein goals, that nobody dislikes and that
 * the household hasn't chosen before. Every tier is kept varied. Known = the
 * household said yes to it or cooked it before.
 */
export function buildDeck(
  recipes: CandidateRecipe[],
  members: DeckMember[],
  history: Map<string, RecipeHistory>,
  opts: DeckOptions = {},
): DeckCard[] {
  const size = opts.size ?? 12;
  const random = opts.random ?? Math.random;
  const shape = deckShape(size);

  const scored = recipes
    .filter((r) => passesHardFilters(r, members, opts))
    .map((r) => {
      const h = history.get(r.id);
      const known = !!h && (h.yes > 0 || h.cooked > 0);
      return { r, known, tier: 'close' as 'close' | 'near' | 'wild', value: 0, ...scoreRecipe(r, members, h, opts) };
    });
  type Scored = (typeof scored)[number];
  const featuresOf = (s: Scored) => s.r.features ?? s.r.tags;
  // Tastes compared relative to each eater's own average over the library: someone who says
  // yes to most things isn't automatically the keener one.
  // Half raw, half relative to the eater's own average over the library: someone who likes
  // most things isn't automatically the keener one, but a dish they love still counts as theirs.
  const means = members.map((_, j) => (scored.length ? scored.reduce((sum, s) => sum + s.tastes[j], 0) / scored.length : 0));
  const relative = (s: Scored) => s.tastes.map((t, j) => t - 0.5 * means[j]);
  const min = (s: Scored) => (s.tastes.length ? Math.min(...relative(s)) : 0);
  const max = (s: Scored) => (s.tastes.length ? Math.max(...relative(s)) : 0);
  const rawMin = (s: Scored) => (s.tastes.length ? Math.min(...s.tastes) : 0);
  const closeValue = (s: Scored) => s.base + CLOSE_TASTE_WEIGHT * min(s);
  const nearValue = (s: Scored) => s.base + NEAR_TASTE_WEIGHT * (0.4 * min(s) + 0.6 * max(s)) + 0.5 * EXPLORE_WEIGHT * s.explore;
  const left = (picked: Scored[]) => scored.filter((s) => !picked.includes(s));

  // 1. Very close to everyone.
  const close = diversePick([...scored].sort((a, b) => closeValue(b) - closeValue(a)), shape.close, closeValue, featuresOf);
  for (const s of close) { s.tier = 'close'; s.value = closeValue(s); }

  // 3. Wildcards (picked before "close" so the best of the rest isn't all used up): fit the goals, take liberties with taste.
  const fresh = (s: Scored) => (s.split?.fitScore ?? 0) >= WILDCARD_MIN_FIT && rawMin(s) >= WILDCARD_MIN_TASTE;
  let pool = left(close).filter((s) => fresh(s) && !s.known);
  if (pool.length < shape.wild) pool = left(close).filter(fresh);
  const wild: Scored[] = [];
  while (wild.length < shape.wild && pool.length) {
    // Weighted draw: the less we know about a kind of dish, the likelier; never two alike.
    const options = pool.filter((s) => !wild.some((w) => similarity(featuresOf(w), featuresOf(s)) >= 0.5));
    const from = options.length ? options : pool;
    const weights = from.map((s) => 0.3 + s.explore);
    let x = random() * weights.reduce((a, b) => a + b, 0);
    let i = 0;
    while (i < from.length - 1 && (x -= weights[i]) > 0) i += 1;
    const pick = from[i];
    pool = pool.filter((s) => s !== pick);
    pick.tier = 'wild';
    pick.value = pick.score;
    pick.reason = 'wildcard';
    wild.push(pick);
  }

  // 2. Close: good for the table, maybe more one person's thing.
  const nearCount = size - close.length - wild.length;
  const near = diversePick(left([...close, ...wild]).sort((a, b) => nearValue(b) - nearValue(a)), nearCount, nearValue, featuresOf, close);
  for (const s of near) {
    s.tier = 'near';
    s.value = nearValue(s);
    if (members.length > 1 && max(s) - min(s) >= LEANS_GAP && !s.reason?.startsWith('pantry:')) {
      s.reason = `leans:${members[relative(s).indexOf(max(s))].userId}`;
    }
  }

  // Someone who minds their diet rarely sees what they'd love but doesn't fit: one "close" place is kept for it.
  if (members.some((m) => (m.adherence ?? 0.5) >= TREAT_ADHERENCE)) {
    const inDeck = [...close, ...near, ...wild];
    const isTreat = (s: Scored) => s.taste >= TREAT_MIN_TASTE && (s.split?.fitScore ?? 1) <= TREAT_MAX_FIT;
    const treat = inDeck.some(isTreat) ? undefined : left(inDeck).filter(isTreat).sort((a, b) => b.taste - a.taste)[0];
    if (treat) {
      treat.reason = 'treat';
      treat.tier = 'near';
      treat.value = nearValue(treat);
      if (inDeck.length >= size && near.length) near.pop(); // the last "close" pick
      near.push(treat);
    }
  }

  // Order: very close and close alternate, best first (the first card both say yes to wins);
  // wildcards a third and three quarters of the way in.
  const byValue = (a: Scored, b: Scored) => b.value - a.value;
  close.sort(byValue);
  near.sort(byValue);
  const ordered: Scored[] = [];
  for (let i = 0; i < Math.max(close.length, near.length); i++) {
    if (close[i]) ordered.push(close[i]);
    if (near[i]) ordered.push(near[i]);
  }
  const total = ordered.length + wild.length;
  const slots = wild.length === 1 ? [0.4] : [0.34, 0.75];
  wild.forEach((w, j) => ordered.splice(Math.min(ordered.length, Math.round(slots[j] * total)), 0, w));

  return ordered.map((s, i) => ({
    recipeId: s.r.id,
    position: i + 1,
    score: Math.round(s.value * 1000) / 1000,
    fitScore: s.split?.fitScore ?? 0,
    fitsAll: s.split?.fitsAll ?? false,
    split: s.split,
    known: s.known,
    reason: s.reason,
    tier: s.tier,
  }));
}
