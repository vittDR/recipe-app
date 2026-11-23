// Deck generation: hard filters from everyone's rules, then a score mixing
// goal fit (weighted by how much each eater minds it), taste, mood, pantry
// overlap and household history. 12 cards in three tiers: 5 very close to
// everyone's taste, 5 close (maybe more one person's), 2 wildcards that fit
// the goals but take liberties; kept varied, and always a few dishes of the
// season.
//
// Taste is each eater's style + taste model when they have one
// (docs/taste-profiles.md, style.ts): how often they want the dish, on its
// plate that suits them (as written or without its optional lines). Their
// style decides how many "now and then" dishes a deck holds (NOW_AND_THEN):
// the share of the most restrained eater. Without a model, the v1 profile
// (recommend.ts) is used, with a treat slot for people who mind their diet.

import { SEASONS, type MealIntent, type Season } from './classify.ts';
import { type DeckFacets, type DeckFilters, filterCount, matchesDeckFilters } from './deckFilters.ts';
import { kindKeys, type TasteProfile } from './profile.ts';
import {
  diversePick, fitWeight, similarity, TREAT_ADHERENCE, TREAT_MAX_FIT, TREAT_MIN_TASTE, tasteScore, uncertainty,
} from './recommend.ts';
import { type EaterTargets, type PotSplit, splitPot } from './portions.ts';
import type { Plate } from './plate.ts';
import type { StyleModel } from './style.ts';

/** Flexitarian filters nothing but leans away from meat. */
export type Diet = 'everything' | 'flexitarian' | 'pescatarian' | 'vegetarian';
export type Mood = 'any' | 'comfort' | 'light' | 'healthy' | 'quick' | 'fancy';

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
  /** What the advanced filters look at (deckFilters.ts); without it, filters leave the recipe out. */
  facets?: DeckFacets;
  /** A balanced plate (classify.ts isHealthy): what the healthy mood matches first. */
  healthy?: boolean;
  /** What the dish is for (classify.ts); moods match on these when given, else on tags. */
  intents?: MealIntent[];
  /** Its plates (plate.ts rowPlates): as written, then without its optional lines when that's a different plate. */
  plates?: Plate[];
  /** Seasons it's a dish of (classify.ts seasons); all four, null or absent = all year. */
  seasons?: Season[] | null;
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
  /** Kinds of dish this person likes but not often (profile.ts occasionalKinds). */
  occasional?: Set<string>;
  /** Soft weights per feature (tags/ingredients), [-1, 1], incl. accepted patterns. Used when there's no profile. */
  weights: Map<string, number>;
  /** Taste profile (profile.ts), accepted patterns included: scored with recommend.ts when there's no style model. */
  profile?: TasteProfile;
  /** Style + taste model (style.ts styleModelFor): how often this eater wants each dish. Wins over the profile. */
  style?: StyleModel;
  /** 0..1, how much this eater sticks to their goals (recommend.ts dietAdherence); 0.5 when unknown. */
  adherence?: number;
}

/** How much an unexplored kind of dish is worth, at full uncertainty. */
export const EXPLORE_WEIGHT = 0.8;

/**
 * Goal fit counts this much for an eater with a style model: their style has
 * already learned how often they want heavy or light plates, whatever the
 * reason, so the full weight would count it twice.
 */
export const STYLE_FIT_FACTOR = 0.5;
/** A dish is adjustable for an eater when its plate without optional lines is wanted this much more often. */
export const ADJUSTABLE_GAIN = 0.5;

/** Frequencies (style.ts, 0..4): below OUT not for them, below REGULAR now and then, else regularly. */
export const FREQUENCY_OUT = 0.5;
export const FREQUENCY_REGULAR = 2;
/**
 * Taste in -1..1 from a frequency (style.ts rawFrequency, unclamped, so dishes
 * past "a favourite" still rank): now and then (1) −0.46, regularly (3) +0.46,
 * a favourite (4) +0.76.
 */
export const tasteOfFrequency = (f: number) => Math.tanh((f - 2) / 2);

/** Softmin temperature: a dish everyone likes beats one someone loves and someone merely puts up with. */
export const SOFTMIN_TEMPERATURE = 0.5;
/** Close to the lowest value, but the others still count a little. */
export function softmin(values: number[], t = SOFTMIN_TEMPERATURE): number {
  if (values.length === 0) return 0;
  const lo = Math.min(...values);
  return lo - t * Math.log(values.reduce((s, v) => s + Math.exp(-(v - lo) / t), 0));
}

/**
 * An eater's share of "now and then" dishes, from their style: the frequency
 * mass of the dishes they want now and then over all they'd eat. Someone who
 * wants rich plates twice a month and lean ones twice a week gets about 1 in 8.
 */
export function nowAndThenShare(frequencies: number[]): number {
  const total = frequencies.reduce((s, f) => s + (f >= FREQUENCY_OUT ? f : 0), 0);
  const occasional = frequencies.reduce((s, f) => s + (f >= FREQUENCY_OUT && f < FREQUENCY_REGULAR ? f : 0), 0);
  return total ? occasional / total : 0;
}

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
  /** Protein, cuisine, base, spice (deckFilters.ts): hard filters, like time. */
  filters?: DeckFilters;
  pantry?: string[]; // ingredient names bought or marked at home recently
  recentlyCooked?: Set<string>;
  /** Cards of tonight's decks that ended without a match: left out of the new one. */
  exclude?: Set<string>;
  /** kindKeys of what the household ate in the last OCCASIONAL_DAYS: an occasional kind among them waits. */
  recentKinds?: Set<string>;
  /** Features of what someone said yes to in those decks: the new deck leans towards them. */
  lean?: Set<string>;
  /** How many recent decks dealt each recipe without it being chosen: it gives way to others (ROTATION_*). */
  recentlyDealt?: Map<string, number>;
  /** The evening's season (classify.ts seasonOfMonth): dishes of the season come first. */
  season?: Season;
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
  healthy: ['healthy'],
  quick: ['quick'],
  fancy: ['fancy'],
};

/** Rotation: a recipe dealt lately without being chosen loses this much per deck it was in… */
export const ROTATION_PENALTY = 0.35;
/** …counting at most this many decks, so a favourite still comes back. */
export const ROTATION_MAX_DECKS = 3;
/** How far back dealt decks count, in days. */
export const ROTATION_DAYS = 14;

/** A seasonal dish (not all year) of this season: worth this much more. */
export const SEASON_BONUS = 0.5;
/** A seasonal dish out of season: worth this much less, but never left out (there are imports). */
export const OFF_SEASON_PENALTY = 0.8;
/** At least this share of a deck is seasonal dishes in season, when the library has them (3 of 12). */
export const SEASONAL_SHARE = 3 / 12;
/** A meat dish loses this much for each flexitarian at the table (shared by the eaters). */
export const FLEXITARIAN_MEAT_PENALTY = 0.6;

/** 1 for a seasonal dish of this season, -1 out of season, 0 for an all-year dish or no season given. */
export function seasonFit(recipe: Pick<CandidateRecipe, 'seasons'>, season: Season | undefined): -1 | 0 | 1 {
  const seasons = recipe.seasons;
  if (!season || !seasons?.length || seasons.length >= SEASONS.length) return 0;
  return seasons.includes(season) ? 1 : -1;
}

const usesProduct = (productIds: string[] | undefined, ids: string[]) =>
  ids.length > 0 && !!productIds?.some((id) => ids.includes(id));

export function passesHardFilters(recipe: CandidateRecipe, members: DeckMember[], opts: DeckOptions): boolean {
  if (opts.recentlyCooked?.has(recipe.id)) return false;
  if (opts.exclude?.has(recipe.id)) return false;
  if (opts.maxMinutes && recipe.totalMin && recipe.totalMin > opts.maxMinutes) return false;
  if (opts.filters && !(recipe.facets ? matchesDeckFilters(recipe.facets, opts.filters) : filterCount(opts.filters) === 0)) return false;
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
  if (mood === 'healthy') {
    // Its composition first (the same rule as the Recipes tab's filter), then what the dish is for.
    if (recipe.healthy) return 1;
    if (recipe.intents?.includes('indulgent')) return 0;
    if (recipe.intents?.includes('fuel') || recipe.intents?.includes('light')) return 0.5;
    return recipe.tags.some((t) => MOOD_TAGS.healthy.includes(t.toLowerCase())) ? 0.5 : 0;
  }
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
  /** Each eater's expected frequency (style.ts), in members' order; null for an eater without a style model. */
  frequencies: (number | null)[];
  /** Someone wants it clearly more without its optional lines. */
  adjustable: boolean;
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
  const frequencies: (number | null)[] = [];
  let adjustable = false;
  for (const m of members) {
    let taste: number;
    let fitFactor = 1;
    let frequency: number | null = null;
    if (m.style && recipe.plates?.length) {
      const f = m.style.frequency(recipe.plates, features);
      frequency = f;
      taste = tasteOfFrequency(m.style.rawFrequency(recipe.plates, features));
      explore += m.style.uncertainty(recipe.plates[0], features);
      if (recipe.plates.length > 1 && f - m.style.frequency([recipe.plates[0]], features) >= ADJUSTABLE_GAIN) adjustable = true;
      fitFactor = STYLE_FIT_FACTOR;
    } else if (m.profile) {
      taste = tasteScore(features, m.profile);
      explore += uncertainty(features, m.profile);
    } else {
      let w = 0;
      for (const f of features) w += m.weights.get(f) ?? 0;
      taste = Math.max(-1, Math.min(1, w / 3));
    }
    frequencies.push(frequency);
    tastes.push(taste);
    pref += taste;
    fitW += fitWeight(m.adherence ?? 0.5) * fitFactor;
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

  const season = seasonFit(recipe, opts.season);
  const seasonScore = season > 0 ? SEASON_BONUS : season < 0 ? -OFF_SEASON_PENALTY : 0;

  const flexitarians = members.filter((m) => m.diet === 'flexitarian').length;
  const flexi = recipe.dietClass === 'meat' && flexitarians ? FLEXITARIAN_MEAT_PENALTY * flexitarians / count : 0;

  const rotation = ROTATION_PENALTY * Math.min(ROTATION_MAX_DECKS, opts.recentlyDealt?.get(recipe.id) ?? 0);

  const base = fitW * fit + 1 * love + 1.2 * moodScore(recipe, opts.mood) + 1 * pantryScore + 0.8 * liked + 1.2 * lean
    + seasonScore - rotation - flexi + novelty;
  const score = base + 1.5 * pref + EXPLORE_WEIGHT * explore;

  const reason = pantryHits.length > 0 ? `pantry:${pantryHits[0]}` : love > 0 ? 'love' : null;
  return { score: Math.round(score * 1000) / 1000, split, reason, taste: pref, tastes, frequencies, adjustable, base, explore };
}

/** A dish someone likes "but not often" waits this long after one of its kind was eaten. */
export const OCCASIONAL_DAYS = 14;

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

  // "Not often" dishes: none when one of that kind was eaten lately, and at most one per deck (the best).
  const occasional = (r: CandidateRecipe) => {
    const keys = kindKeys(r.id, r.features);
    return members.some((m) => m.occasional?.size && keys.some((k) => m.occasional!.has(k)));
  };
  const recentKind = (r: CandidateRecipe) => kindKeys(r.id, r.features).some((k) => opts.recentKinds?.has(k));
  const bestOccasional = scored.filter((s) => occasional(s.r) && !recentKind(s.r)).sort((a, b) => b.score - a.score)[0];
  for (let i = scored.length - 1; i >= 0; i--) {
    if (occasional(scored[i].r) && scored[i] !== bestOccasional) scored.splice(i, 1);
  }
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

  const styled = members.length > 0 && members.every((m) => m.style);
  if (styled) {
    // As many "now and then" dishes as the most restrained eater's style says, of those that work for everyone.
    const joint = (s: Scored) => softmin(s.frequencies.map((f) => f ?? FREQUENCY_REGULAR));
    const occasionalNow = (s: Scored) => joint(s) >= FREQUENCY_OUT && joint(s) < FREQUENCY_REGULAR;
    const share = Math.min(...members.map((_, j) => nowAndThenShare(scored.map((s) => s.frequencies[j] ?? FREQUENCY_REGULAR))));
    const wanted = Math.round(size * share);
    const swap = (out: Scored, add: Scored, reason: string | null) => {
      const list = near.includes(out) ? near : close;
      list.splice(list.indexOf(out), 1, add);
      add.tier = out.tier;
      add.value = add.tier === 'close' ? closeValue(add) : nearValue(add);
      if (reason) add.reason ??= reason;
    };
    const weakest = (fits: (s: Scored) => boolean) => [...near, ...close].filter(fits).sort((a, b) => a.value - b.value)[0];
    for (let have = [...close, ...near, ...wild].filter(occasionalNow).length; have !== wanted; have += have < wanted ? 1 : -1) {
      const inDeck = [...close, ...near, ...wild];
      const fewer = have > wanted;
      const fits = fewer ? (s: Scored) => joint(s) >= FREQUENCY_REGULAR : occasionalNow;
      const [add] = diversePick(left(inDeck).filter(fits).sort((a, b) => nearValue(b) - nearValue(a)), 1, nearValue, featuresOf, inDeck);
      const out = weakest(fewer ? occasionalNow : (s) => !occasionalNow(s));
      if (!add || !out) break;
      // A dish someone wants now and then says so, as the treat did.
      swap(out, add, fewer ? null : 'treat');
    }
  } else if (members.some((m) => (m.adherence ?? 0.5) >= TREAT_ADHERENCE)) {
    // Someone who minds their diet rarely sees what they'd love but doesn't fit: one "close" place is kept for it.
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

  // Always some dishes of the season: when too few made it on taste, the best in-season ones
  // the deck doesn't have take the places of its weakest close (then very close) cards.
  // Wildcards and the treat keep their places. (Healthy is the deck's mood, not a minimum.)
  const inSeason = (s: Scored) => seasonFit(s.r, opts.season) > 0;
  const ensure = (wanted: number, fits: (s: Scored) => boolean, reason: string) => {
    for (let have = [...close, ...near, ...wild].filter(fits).length; have < wanted; have++) {
      const inDeck = [...close, ...near, ...wild];
      const pool = left(inDeck).filter(fits).sort((a, b) => nearValue(b) - nearValue(a));
      const [add] = diversePick(pool, 1, nearValue, featuresOf, inDeck);
      if (!add) return;
      const swappable = (list: Scored[]) => list.filter((s) => !fits(s) && s.reason !== 'treat')
        .sort((a, b) => a.value - b.value)[0];
      const fromNear = swappable(near);
      const out = fromNear ?? swappable(close);
      if (!out) return;
      const list = fromNear ? near : close;
      list.splice(list.indexOf(out), 1, add);
      add.tier = out.tier;
      add.value = add.tier === 'close' ? closeValue(add) : nearValue(add);
      add.reason ??= reason;
    }
  };
  if (opts.season) ensure(Math.round(size * SEASONAL_SHARE), inSeason, 'season');

  // A dish someone wants more without its optional lines says they're optional.
  for (const c of [...close, ...near]) if (c.adjustable && !c.reason) c.reason = 'adjustable';

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
