// Deck generation: hard filters from everyone's rules, then a score mixing
// macro fit, learned preferences, mood, pantry overlap and novelty. Roughly
// two thirds known favourites, one third new.

import { type EaterTargets, type PotSplit, splitPot } from './portions.ts';

export type Diet = 'everything' | 'pescatarian' | 'vegetarian';
export type Mood = 'any' | 'comfort' | 'light' | 'quick' | 'fancy';

export interface CandidateRecipe {
  id: string;
  title: string;
  tags: string[];
  ingredientNames: string[]; // non-staple ingredient names, lowercase
  dietClass: 'veg' | 'fish' | 'meat';
  totalMin: number | null;
  kcalPerServing: number | null;
  proteinGPerServing: number | null;
}

export interface DeckMember extends EaterTargets {
  never: string[];
  loves: string[];
  diet: Diet;
  /** Soft weights per feature (tags/ingredients), [-1, 1], incl. accepted patterns. */
  weights: Map<string, number>;
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

export const MOOD_TAGS: Record<Exclude<Mood, 'any'>, string[]> = {
  comfort: ['comfort', 'curry', 'stew', 'pasta', 'soup', 'réconfortant'],
  light: ['light', 'salad', 'bowl', 'fish', 'léger', 'salade'],
  quick: ['quick', 'rapide', '15 min', '20 min'],
  fancy: ['fancy', 'date night', 'special', 'festif'],
};

function matchesTerm(recipe: CandidateRecipe, term: string): boolean {
  const t = term.toLowerCase().trim();
  if (!t) return false;
  return (
    recipe.tags.some((tag) => tag.toLowerCase() === t) ||
    recipe.ingredientNames.some((n) => n === t || n.includes(t)) ||
    recipe.title.toLowerCase().includes(t)
  );
}

export function passesHardFilters(recipe: CandidateRecipe, members: DeckMember[], opts: DeckOptions): boolean {
  if (opts.recentlyCooked?.has(recipe.id)) return false;
  if (opts.maxMinutes && recipe.totalMin && recipe.totalMin > opts.maxMinutes) return false;
  for (const m of members) {
    if (m.diet === 'vegetarian' && recipe.dietClass !== 'veg') return false;
    if (m.diet === 'pescatarian' && recipe.dietClass === 'meat') return false;
    if (m.never.some((n) => matchesTerm(recipe, n))) return false;
  }
  return true;
}

function moodScore(recipe: CandidateRecipe, mood: Mood | undefined): number {
  if (!mood || mood === 'any') return 0;
  if (mood === 'quick' && recipe.totalMin && recipe.totalMin <= 25) return 1;
  if (mood === 'fancy' && recipe.totalMin && recipe.totalMin >= 45) return 0.5;
  const tags = recipe.tags.map((t) => t.toLowerCase());
  return MOOD_TAGS[mood].some((t) => tags.includes(t)) ? 1 : 0;
}

export function scoreRecipe(
  recipe: CandidateRecipe,
  members: DeckMember[],
  history: RecipeHistory | undefined,
  opts: DeckOptions,
): { score: number; split: PotSplit | null; reason: string | null } {
  const split = splitPot(recipe, members);
  const fit = split?.fitScore ?? 0.5; // unknown macros: neutral
  const features = [...recipe.tags.map((t) => t.toLowerCase()), ...recipe.ingredientNames];

  let pref = 0;
  let love = 0;
  for (const m of members) {
    let w = 0;
    for (const f of features) w += m.weights.get(f) ?? 0;
    pref += Math.max(-1, Math.min(1, w / 3));
    if (m.loves.some((l) => matchesTerm(recipe, l))) love += 1;
  }
  pref /= members.length || 1;
  love /= members.length || 1;

  const pantry = new Set((opts.pantry ?? []).map((p) => p.toLowerCase()));
  const pantryHits = recipe.ingredientNames.filter((n) => pantry.has(n));
  const pantryScore = recipe.ingredientNames.length ? pantryHits.length / recipe.ingredientNames.length : 0;

  const liked = history ? (history.yes - history.pass) / (history.yes + history.pass + 2) : 0;
  const novelty = (opts.random ?? Math.random)() * 0.3;

  const score =
    3 * fit + 1.5 * pref + 1 * love + 1.2 * moodScore(recipe, opts.mood) + 1 * pantryScore + 0.8 * liked + novelty;

  const reason = pantryHits.length > 0 ? `pantry:${pantryHits[0]}` : love > 0 ? 'love' : null;
  return { score: Math.round(score * 1000) / 1000, split, reason };
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

  const pickedKnown = known.slice(0, takeKnown);
  const pickedNew = fresh.slice(0, takeNew);

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
