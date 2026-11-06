// Deck generation: hard filters from everyone's rules, then a score mixing
// goal fit (weighted by how much each eater minds it), taste (recommend.ts),
// an exploration bonus, mood, pantry overlap and household history. Roughly
// two thirds known favourites, one third new, kept varied, and a treat for
// people who mind their diet.

import type { MealIntent } from './classify.ts';
import type { TasteProfile } from './profile.ts';
import {
  diversePick, fitWeight, TREAT_ADHERENCE, TREAT_MAX_FIT, TREAT_MIN_TASTE, tasteScore, uncertainty,
} from './recommend.ts';
import { type EaterTargets, type PotSplit, splitPot } from './portions.ts';

export type Diet = 'everything' | 'pescatarian' | 'vegetarian';
export type Mood = 'any' | 'comfort' | 'light' | 'quick' | 'fancy';

export interface CandidateRecipe {
  id: string;
  title: string;
  tags: string[];
  ingredientNames: string[]; // non-staple ingredient names, lowercase
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
  newShare?: number; // fraction of new recipes, default 1/3
  mood?: Mood;
  maxMinutes?: number | null;
  pantry?: string[]; // ingredient names bought or marked at home recently
  recentlyCooked?: Set<string>;
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
  if (opts.maxMinutes && recipe.totalMin && recipe.totalMin > opts.maxMinutes) return false;
  // The recipe as it's still made when every optional line is left out.
  const essential = recipe.productIds?.filter((id) => !recipe.optionalProductIds?.includes(id));
  for (const m of members) {
    if (m.diet === 'vegetarian' && recipe.dietClass !== 'veg') return false;
    if (m.diet === 'pescatarian' && recipe.dietClass === 'meat') return false;
    if (usesProduct(essential, m.never)) return false;
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
): { score: number; split: PotSplit | null; reason: string | null; taste: number } {
  const split = splitPot(recipe, members);
  const fit = split?.fitScore ?? 0.5; // unknown macros: neutral
  const features = recipe.features ?? [...recipe.tags.map((t) => t.toLowerCase()), ...recipe.ingredientNames];

  let pref = 0;
  let love = 0;
  let explore = 0;
  let fitW = 0;
  for (const m of members) {
    if (m.profile) {
      pref += tasteScore(features, m.profile);
      explore += uncertainty(features, m.profile);
    } else {
      let w = 0;
      for (const f of features) w += m.weights.get(f) ?? 0;
      pref += Math.max(-1, Math.min(1, w / 3));
    }
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

  const score = fitW * fit + 1.5 * pref + 1 * love + 1.2 * moodScore(recipe, opts.mood) + 1 * pantryScore
    + 0.8 * liked + EXPLORE_WEIGHT * explore + novelty;

  const reason = pantryHits.length > 0 ? `pantry:${pantryHits[0]}` : love > 0 ? 'love' : null;
  return { score: Math.round(score * 1000) / 1000, split, reason, taste: pref };
}

/**
 * Builds the deck. Known = the household said yes to it or cooked it before.
 * New cards are spread through the deck rather than bunched at the end.
 */
export function buildDeck(
  recipes: CandidateRecipe[],
  members: DeckMember[],
  history: Map<string, RecipeHistory>,
  opts: DeckOptions = {},
): DeckCard[] {
  const size = opts.size ?? 12;
  const newTarget = Math.round(size * (opts.newShare ?? 1 / 3));

  const scored = recipes
    .filter((r) => passesHardFilters(r, members, opts))
    .map((r) => {
      const h = history.get(r.id);
      const known = !!h && (h.yes > 0 || h.cooked > 0);
      return { r, known, ...scoreRecipe(r, members, h, opts) };
    })
    .sort((a, b) => b.score - a.score);

  const known = scored.filter((s) => s.known);
  const fresh = scored.filter((s) => !s.known);
  let takeNew = Math.min(newTarget, fresh.length);
  let takeKnown = Math.min(size - takeNew, known.length);
  takeNew = Math.min(size - takeKnown, fresh.length); // fill shortfall from the other pool
  takeKnown = Math.min(size - takeNew, known.length);

  // Varied: a dish much like one already picked loses points (recommend.ts diversePick).
  const featuresOf = (s: (typeof scored)[number]) => s.r.features ?? s.r.tags;
  const pickedKnown = diversePick(known, takeKnown, (s) => s.score, featuresOf);
  const pickedNew = diversePick(fresh, takeNew, (s) => s.score, featuresOf, pickedKnown);

  // Someone who minds their diet rarely sees what they'd love but doesn't fit: keep a place for one.
  if (members.some((m) => (m.adherence ?? 0.5) >= TREAT_ADHERENCE)) {
    const inDeck = new Set([...pickedKnown, ...pickedNew]);
    const isTreat = (s: (typeof scored)[number]) => s.taste >= TREAT_MIN_TASTE && (s.split?.fitScore ?? 1) <= TREAT_MAX_FIT;
    const treat = [...inDeck].some(isTreat) ? undefined
      : scored.filter((s) => !inDeck.has(s) && isTreat(s)).sort((a, b) => b.taste - a.taste)[0];
    if (treat) {
      treat.reason = 'treat';
      if (pickedKnown.length + pickedNew.length >= size) {
        // Make room by dropping the lowest-scored card.
        const lowest = [...pickedKnown, ...pickedNew].reduce((a, b) => (b.score < a.score ? b : a));
        const from = pickedKnown.includes(lowest) ? pickedKnown : pickedNew;
        from.splice(from.indexOf(lowest), 1);
      }
      (treat.known ? pickedKnown : pickedNew).push(treat);
    }
  }

  // Interleave: new cards at evenly spaced slots, highest scores first.
  const total = pickedKnown.length + pickedNew.length;
  const newSlots = new Set(pickedNew.map((_, j) => Math.floor(((j + 0.5) * total) / pickedNew.length)));
  const ordered: typeof scored = [];
  let k = 0;
  let n = 0;
  for (let i = 0; i < total; i++) {
    ordered.push(newSlots.has(i) ? pickedNew[n++] : pickedKnown[k++]);
  }

  return ordered.map((s, i) => ({
    recipeId: s.r.id,
    position: i + 1,
    score: s.score,
    fitScore: s.split?.fitScore ?? 0,
    fitsAll: s.split?.fitsAll ?? false,
    split: s.split,
    known: s.known,
    reason: s.reason,
  }));
}
