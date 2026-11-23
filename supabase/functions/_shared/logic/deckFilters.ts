// Advanced deck filters: protein, cuisine, base, spice, and calories and
// protein per serving, picked in tonight's deck settings. Hard filters, like time: within a row any choice matches,
// across rows all must. Worked out from the recipe's classification
// (classify.ts), so seed, imported and typed recipes are filtered alike.
// Pure, shared by deal-deck, the web app and the learning (profile.ts).

import { CUISINE_PARENTS, type RecipeClassification } from './classify.ts';

export const FILTER_PROTEINS = ['chicken', 'turkey', 'beef', 'pork', 'lamb', 'fish', 'prawns', 'eggs', 'tofu', 'pulses'] as const;
export const FILTER_CUISINES = [
  'italian', 'french', 'spanish', 'greek', 'middle_eastern', 'north_african', 'indian', 'chinese', 'japanese', 'korean',
  'southeast_asian', 'mexican', 'british',
] as const;
export const FILTER_BASES = ['rice', 'pasta', 'noodles', 'potatoes', 'bread', 'grains'] as const;
export const FILTER_SPICES = ['any', 'mild', 'spicy'] as const;

export type FilterProtein = (typeof FILTER_PROTEINS)[number];
export type FilterCuisine = (typeof FILTER_CUISINES)[number];
export type FilterBase = (typeof FILTER_BASES)[number];
export type FilterSpice = (typeof FILTER_SPICES)[number];
/** How much work tonight: the minimum = easy dishes only, some = nothing hard. No effort = anything. */
export const FILTER_EFFORTS = ['minimum', 'some'] as const;
export type FilterEffort = (typeof FILTER_EFFORTS)[number];

/** Stored on the deck (decks.filters); an empty or missing row means no filter on it. */
export interface DeckFilters {
  proteins?: FilterProtein[];
  cuisines?: FilterCuisine[];
  bases?: FilterBase[];
  spice?: FilterSpice;
  /** At most this many kcal per serving. */
  maxKcal?: number;
  /** At least this many grams of protein per serving. */
  minProteinG?: number;
  effort?: FilterEffort;
}

/** Bounds for the two numbers, so a typo can't store something absurd. */
export const MAX_KCAL_LIMIT = 3000;
export const MIN_PROTEIN_LIMIT = 200;

/** The recipe cuisines (classification.cuisines, parents included) each choice covers. */
export const CUISINE_MATCH: Record<FilterCuisine, string[]> = {
  italian: ['italian'], french: ['french'], spanish: ['spanish'], greek: ['greek'],
  middle_eastern: ['middle eastern'], north_african: ['north african'], indian: ['indian'], chinese: ['chinese'],
  japanese: ['japanese'], korean: ['korean'],
  southeast_asian: ['thai', 'vietnamese', 'indonesian', 'malaysian', 'filipino'],
  mexican: ['mexican'], british: ['british'],
};

const BASE_MATCH: Record<FilterBase, string[]> = {
  rice: ['rice'], pasta: ['pasta'], noodles: ['noodles'], potatoes: ['potato', 'sweet_potato'],
  bread: ['bread', 'flatbread', 'tortilla'], grains: ['grain'],
};

/** Up to this chilli level (classify.ts heat_level, 0..4) is mild; from the next one, spicy. */
export const MILD_MAX_HEAT = 1;

// Protein choices from the catalogue ingredients a dish is built on (classification.protein_items).
const PROTEIN_ITEM: [FilterProtein, RegExp][] = [
  ['chicken', /chicken/],
  ['turkey', /turkey/],
  ['beef', /beef|veal|steak|oxtail/],
  ['pork', /pork|ham|bacon|sausage|chorizo|kielbasa|prosciutto|pancetta|char siu|lardons/],
  ['lamb', /lamb|merguez|mutton/],
  ['prawns', /prawn|shrimp|gambas/],
  ['eggs', /\beggs?\b/],
  ['tofu', /tofu|tempeh/],
  ['pulses', /lentil|chickpea|\bdal\b|(black|white|kidney|butter|pinto|borlotti|cannellini) beans|moong/],
];

/** What the filters look at, for one recipe. */
export interface DeckFacets {
  proteins: FilterProtein[];
  cuisines: FilterCuisine[];
  bases: FilterBase[];
  /** classify.ts heat_level; null when unknown. */
  heat: number | null;
  /** Per serving, from the recipe; null when unknown. */
  kcal?: number | null;
  proteinG?: number | null;
  /** The recipe's difficulty; null or absent when unknown (passes any effort). */
  difficulty?: 'easy' | 'medium' | 'hard' | null;
}

type FacetFields = 'protein_groups' | 'protein_items' | 'cuisines' | 'starch_bases' | 'heat_level';

export function deckFacets(c: Pick<RecipeClassification, FacetFields>): DeckFacets {
  const proteins = new Set<FilterProtein>();
  for (const item of c.protein_items ?? []) {
    for (const [p, re] of PROTEIN_ITEM) if (re.test(item)) proteins.add(p);
  }
  // Fish by its group: the catalogue has dozens of fish, none of them named "fish".
  if (c.protein_groups?.includes('fish')) proteins.add('fish');
  return {
    proteins: FILTER_PROTEINS.filter((p) => proteins.has(p)),
    cuisines: FILTER_CUISINES.filter((f) => CUISINE_MATCH[f].some((x) => c.cuisines.includes(x))),
    bases: FILTER_BASES.filter((b) => BASE_MATCH[b].some((x) => (c.starch_bases ?? []).includes(x as never))),
    heat: c.heat_level,
  };
}

/**
 * Within a row any choice matches; across rows all must. Unknown heat counts
 * as mild; unknown calories or protein never pass a number asked for.
 */
export function matchesDeckFilters(f: DeckFacets, filters: DeckFilters | null | undefined): boolean {
  if (!filters) return true;
  if (filters.proteins?.length && !filters.proteins.some((p) => f.proteins.includes(p))) return false;
  if (filters.cuisines?.length && !filters.cuisines.some((x) => f.cuisines.includes(x))) return false;
  if (filters.bases?.length && !filters.bases.some((b) => f.bases.includes(b))) return false;
  if (filters.spice === 'mild' && (f.heat ?? 0) > MILD_MAX_HEAT) return false;
  if (filters.spice === 'spicy' && (f.heat ?? 0) <= MILD_MAX_HEAT) return false;
  if (filters.maxKcal && !(f.kcal != null && f.kcal <= filters.maxKcal)) return false;
  if (filters.minProteinG && !(f.proteinG != null && f.proteinG >= filters.minProteinG)) return false;
  if (filters.effort === 'minimum' && f.difficulty && f.difficulty !== 'easy') return false;
  if (filters.effort === 'some' && f.difficulty === 'hard') return false;
  return true;
}

const pick = <T extends string>(vocab: readonly T[], raw: unknown): T[] | undefined => {
  if (!Array.isArray(raw)) return undefined;
  const out = vocab.filter((v) => raw.includes(v));
  return out.length ? out : undefined;
};

/** A whole number in 1..limit, or nothing. */
const amount = (raw: unknown, limit: number): number | undefined => {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 ? Math.min(Math.round(n), limit) : undefined;
};

/** Cleans filters from an untrusted source (a request body, a stored deck); anything unknown is dropped. */
export function normaliseFilters(raw: unknown): DeckFilters {
  const r = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const out: DeckFilters = {};
  const proteins = pick(FILTER_PROTEINS, r.proteins);
  const cuisines = pick(FILTER_CUISINES, r.cuisines);
  const bases = pick(FILTER_BASES, r.bases);
  if (proteins) out.proteins = proteins;
  if (cuisines) out.cuisines = cuisines;
  if (bases) out.bases = bases;
  if (r.spice === 'mild' || r.spice === 'spicy') out.spice = r.spice;
  const maxKcal = amount(r.maxKcal, MAX_KCAL_LIMIT);
  const minProteinG = amount(r.minProteinG, MIN_PROTEIN_LIMIT);
  if (maxKcal) out.maxKcal = maxKcal;
  if (minProteinG) out.minProteinG = minProteinG;
  if (r.effort === 'minimum' || r.effort === 'some') out.effort = r.effort;
  return out;
}

/** How many choices are made: the badge on "More filters". Effort has its own row, so it isn't one. */
export function filterCount(filters: DeckFilters | null | undefined): number {
  if (!filters) return 0;
  return (filters.proteins?.length ?? 0) + (filters.cuisines?.length ?? 0) + (filters.bases?.length ?? 0)
    + (filters.spice && filters.spice !== 'any' ? 1 : 0) + (filters.maxKcal ? 1 : 0) + (filters.minProteinG ? 1 : 0);
}

/**
 * Learning features the filters asked for (profile.ts): a pass in a chicken
 * deck says nothing about chicken. Rows not filtered on are kept.
 */
export function askedFor(filters: DeckFilters | null | undefined): (feature: string) => boolean {
  if (!filterCount(filters)) return () => false;
  const cuisines = new Set((filters!.cuisines ?? []).flatMap((c) => CUISINE_MATCH[c])
    .flatMap((c) => [c, ...(CUISINE_PARENTS[c] ?? [])]));
  return (f) => (!!filters!.proteins?.length && f.startsWith('protein:'))
    || (!!filters!.bases?.length && f.startsWith('starch:'))
    || (!!filters!.spice && filters!.spice !== 'any' && f.startsWith('heat:'))
    || cuisines.has(f);
}
