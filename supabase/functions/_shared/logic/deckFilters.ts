// Advanced deck filters: protein, cuisine, base and spice, picked in tonight's
// deck settings. Hard filters, like time: within a row any choice matches,
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

/** Stored on the deck (decks.filters); an empty or missing row means no filter on it. */
export interface DeckFilters {
  proteins?: FilterProtein[];
  cuisines?: FilterCuisine[];
  bases?: FilterBase[];
  spice?: FilterSpice;
}

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

/** Within a row any choice matches; across rows all must. Unknown heat counts as mild. */
export function matchesDeckFilters(f: DeckFacets, filters: DeckFilters | null | undefined): boolean {
  if (!filters) return true;
  if (filters.proteins?.length && !filters.proteins.some((p) => f.proteins.includes(p))) return false;
  if (filters.cuisines?.length && !filters.cuisines.some((x) => f.cuisines.includes(x))) return false;
  if (filters.bases?.length && !filters.bases.some((b) => f.bases.includes(b))) return false;
  if (filters.spice === 'mild' && (f.heat ?? 0) > MILD_MAX_HEAT) return false;
  if (filters.spice === 'spicy' && (f.heat ?? 0) <= MILD_MAX_HEAT) return false;
  return true;
}

const pick = <T extends string>(vocab: readonly T[], raw: unknown): T[] | undefined => {
  if (!Array.isArray(raw)) return undefined;
  const out = vocab.filter((v) => raw.includes(v));
  return out.length ? out : undefined;
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
  return out;
}

/** How many choices are made: the badge on "More filters". */
export function filterCount(filters: DeckFilters | null | undefined): number {
  if (!filters) return 0;
  return (filters.proteins?.length ?? 0) + (filters.cuisines?.length ?? 0) + (filters.bases?.length ?? 0)
    + (filters.spice && filters.spice !== 'any' ? 1 : 0);
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
