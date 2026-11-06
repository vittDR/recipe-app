// Recipe classification v1: what a dish is (protein, starch, dish family,
// sauce, cooking method, chilli heat, how saucy), what it does nutritionally
// (lean, high protein…) and what it's for (comfort, light, treat…), derived
// from its ingredients, amounts, steps, times and tags. No AI and nothing
// stored: every recipe, seed, imported or typed, gets the same description
// from the same rules, recomputed wherever it's used, so it follows the
// catalogue and these rules as they change. Bump CLASSIFICATION_VERSION when
// a rule changes what a recipe is called.
//
// Conventions (docs/recipe-classification.md):
// - null = unknown (no ingredient could be read); [] = known to have none.
// - Tags people chose (comfort, spicy, curry…) are sourced and win over rules.
// - Estimates, not measurements: thresholds are coarse on purpose.

import { type Difficulty, type Equipment } from './facets.ts';
import { type CatalogEntry, type Catalog, estimateMacros, gramsOf, type NormalisedIngredient } from './ingredients.ts';

export const CLASSIFICATION_VERSION = 1;

export const PROTEIN_GROUPS = [
  'poultry', 'beef', 'pork', 'lamb', 'veal', 'game', 'offal', 'fish', 'shellfish', 'eggs', 'legumes', 'soy', 'dairy',
] as const;
export const STARCH_BASES = [
  'rice', 'pasta', 'noodles', 'potato', 'sweet_potato', 'bread', 'flatbread', 'tortilla', 'grain', 'rice_cakes',
] as const;
export const DISH_FAMILIES = [
  'curry', 'stew', 'soup', 'salad', 'grain_bowl', 'rice_dish', 'pasta_dish', 'noodle_dish', 'stir_fry', 'wrap',
  'sandwich', 'tacos', 'pizza', 'pie', 'gratin', 'traybake', 'roast', 'savory_pancake', 'egg_dish', 'dumplings',
  'plated', 'other',
] as const;
export const SAUCE_FAMILIES = [
  'tomato', 'cream', 'cheese', 'coconut', 'broth', 'soy_based', 'chilli_based', 'peanut', 'yogurt', 'mustard',
  'gravy', 'herb_oil', 'citrus', 'mayonnaise',
] as const;
export const COOKING_METHODS = [
  'pan_fried', 'stir_fried', 'deep_fried', 'baked', 'roasted', 'grilled', 'braised', 'simmered', 'poached',
  'steamed', 'boiled', 'no_cook',
] as const;
export const MEAL_INTENTS = ['comfort', 'indulgent', 'light', 'fuel', 'everyday', 'special_occasion'] as const;
export const NUTRITION_GOALS = ['high_protein', 'lean', 'low_kcal', 'high_fibre'] as const;
export const SAUCE_LEVELS = ['dry', 'coated', 'saucy', 'brothy'] as const;

export type ProteinGroup = (typeof PROTEIN_GROUPS)[number];
export type StarchBase = (typeof STARCH_BASES)[number];
export type DishFamily = (typeof DISH_FAMILIES)[number];
export type SauceFamily = (typeof SAUCE_FAMILIES)[number];
export type CookingMethod = (typeof COOKING_METHODS)[number];
export type MealIntent = (typeof MEAL_INTENTS)[number];
export type NutritionGoal = (typeof NUTRITION_GOALS)[number];

// ---------------------------------------------------------------------------
// Thresholds (per serving). Coarse estimates; see the doc for the reasoning.
// ---------------------------------------------------------------------------

/** A protein group counts from this much protein, or this share of the dish's protein. */
export const PROTEIN_MIN_G = 6;
export const PROTEIN_MIN_SHARE = 0.25;
/** A starch is the dish's base from this many calories of it. */
export const STARCH_MIN_KCAL = 80;
/** Default grams per serving for an ingredient to make the sauce (a trait can say otherwise: sauce:cream@60). */
export const SAUCE_MIN_G: Record<SauceFamily, number> = {
  tomato: 40, cream: 20, cheese: 25, coconut: 40, broth: 80, soy_based: 6, chilli_based: 4, peanut: 8,
  yogurt: 30, mustard: 5, gravy: 4, herb_oil: 10, citrus: 30, mayonnaise: 10,
};
/** Chilli heat points (grams per serving × the ingredient's heat:<n>) at which each level starts. */
export const HEAT_STEPS = [0.3, 1.2, 2.5, 5];
/** A heat ingredient without an amount ("chilli flakes to taste") counts as this many points. */
export const HEAT_UNWEIGHED = 0.5;
/** Spices are lighter than water: a spoon of chilli flakes is about half the weight a spoon of liquid is. */
const DRY_SPOON_G: Record<string, number> = { tsp: 2.5, tbsp: 7.5 };
/** Grams of liquid per serving at which a dish is coated, saucy, brothy. */
export const LIQUID_STEPS = [8, 60, 300];

export const HIGH_PROTEIN_MIN_G = 30;
/** Share of calories from protein for high protein: 25% is about 6 g per 100 kcal. */
export const HIGH_PROTEIN_MIN_SHARE = 0.25;
/** Lean: at most this share of calories from fat, and not a huge plate. */
export const LEAN_MAX_FAT_SHARE = 0.3;
export const LEAN_MAX_KCAL = 700;
export const LOW_KCAL_MAX = 500;
export const HIGH_FIBRE_MIN_G = 8;
export const EVERYDAY_MAX_MIN = 45;

// ---------------------------------------------------------------------------

export interface ClassifyIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  optional?: boolean;
  is_staple?: boolean;
  guessed?: boolean;
  catalog?: CatalogEntry;
}

export interface ClassifyInput {
  /** Title in every language it has. */
  titles: string[];
  servings: number;
  tags: string[];
  cuisine: string | null;
  /** Steps in every language they have. */
  steps: string[];
  prepMin: number | null;
  cookMin: number | null;
  totalMin: number | null;
  difficulty: Difficulty | null;
  equipment: Equipment | null;
  ingredients: ClassifyIngredient[];
}

export interface Nutrition {
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  fiber_g: number | null;
  estimated: boolean;
}

export interface RecipeClassification {
  version: number;
  cuisines: string[];
  protein_groups: ProteinGroup[] | null;
  starch_bases: StarchBase[] | null;
  dish_families: DishFamily[];
  sauce_families: SauceFamily[] | null;
  cooking_methods: CookingMethod[];
  /** 0 none … 4 very hot; null when no ingredient could be read. */
  heat_level: number | null;
  /** An optional line (chilli on the side) makes it hotter. */
  heat_adjustable: boolean;
  /** 0 dry, 1 coated, 2 saucy, 3 brothy. */
  sauce_level: number | null;
  /** Per serving. */
  nutrition: Nutrition;
  nutrition_goals: NutritionGoal[];
  meal_intents: MealIntent[];
  /** Fields set from the recipe's own tags or cuisine rather than worked out. */
  sourced: string[];
}

// ---------------------------------------------------------------------------
// Text matching
// ---------------------------------------------------------------------------

/** Lowercase, no accents, punctuation as spaces, padded: " poulet roti ". */
export function textKey(s: string): string {
  return ` ${s.toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

/** Words or phrases; a trailing * matches any ending ("brais*": braise, braised, braiser). */
function matcher(words: string[]): RegExp {
  const parts = words.map((w) => {
    const star = w.endsWith('*');
    const key = textKey(star ? w.slice(0, -1) : w).trim().replace(/ /g, ' +');
    return star ? `${key}[a-z]*` : key;
  });
  return new RegExp(` (?:${parts.join('|')}) `);
}

const has = (text: string, re: RegExp) => re.test(text);

// Dish families from titles (EN/FR/IT and the dishes the library cooks).
const DISH_WORDS: [DishFamily, RegExp][] = ([
  ['curry', ['curry*', 'korma', 'tikka', 'masala', 'vindaloo', 'dhal', 'daal', 'tarka dal', 'dal tadka', 'masoor dal', 'chana dal', 'rendang', 'massaman']],
  ['soup', ['soup*', 'soupe*', 'veloute*', 'potage*', 'zuppa', 'minestron*', 'ramen', 'pho', 'chowder', 'bisque',
    'gazpacho', 'laksa', 'broth', 'bouillon', 'brodo']],
  ['stew', ['stew*', 'ragout*', 'daube', 'bourguignon*', 'mijote*', 'blanquette', 'navarin', 'tajine', 'tagine',
    'goulash', 'stufato', 'spezzatino', 'chili con carne', 'chilli con carne', 'cassoulet', 'cacciator*',
    'casserole', 'fricassee', 'carbonnade', 'potee', 'pot au feu', 'osso buco', 'jjigae', 'jjim', 'adobo',
    'brasato', 'estouffade', 'basquaise', 'stifado']],
  ['salad', ['salad*', 'salade*', 'insalat*', 'slaw', 'taboule', 'tabbouleh', 'larb', 'niçoise']],
  ['grain_bowl', ['bowl*', 'poke', 'bibimbap', 'buddha']],
  ['rice_dish', ['risott*', 'paella', 'fried rice', 'riz cantonais', 'riz saute', 'biryani', 'pilaf', 'pilau',
    'jambalaya', 'nasi goreng', 'arroz', 'donburi', 'congee', 'kedgeree']],
  ['pasta_dish', ['pasta', 'spaghett*', 'penne', 'linguin*', 'tagliatell*', 'lasagn*', 'carbonara', 'orecchiette',
    'rigatoni', 'fusilli', 'macaroni', 'pates', 'farfalle', 'pappardell*', 'gnocchi', 'ravioli', 'tortellini',
    'cannelloni', 'bucatini', 'amatriciana', 'cacio e pepe', 'mac and cheese', 'trofie', 'paccheri']],
  ['noodle_dish', ['noodle*', 'nouille*', 'pad thai', 'udon', 'soba', 'lo mein', 'chow mein', 'japchae',
    'vermicell*', 'mie goreng', 'pancit', 'yakisoba']],
  ['stir_fry', ['stir fr*', 'wok', 'saute au wok']],
  ['wrap', ['wrap*', 'burrito*', 'shawarma', 'kebab*', 'gyro*', 'durum']],
  ['sandwich', ['sandwich*', 'burger*', 'croque*', 'panini', 'banh mi', 'bagel*', 'toastie*', 'slider*']],
  ['tacos', ['taco*', 'fajita*', 'quesadilla*', 'enchilada*', 'tostada*']],
  ['pizza', ['pizza', 'pizzas', 'pizze', 'calzone', 'khachapuri', 'pide', 'lahmacun', 'flammekueche', 'tarte flambee', 'focaccia', 'pissaladiere']],
  ['pie', ['pie', 'pies', 'tourte*', 'quiche*', 'tart', 'tarte', 'tartes', 'parmentier', 'pastilla', 'empanada*']],
  ['gratin', ['gratin*', 'tartiflette', 'croziflette', 'parmigiana', 'moussaka', 'lasagn*', 'bake', 'pasta bake',
    'parmentier']],
  ['traybake', ['traybake*', 'tray bake*', 'sheet pan', 'one tray']],
  ['roast', ['roast chicken', 'roasted chicken', 'roast beef', 'roast pork', 'roast lamb', 'roast turkey', 'sunday roast',
    'roti de', 'poulet roti', 'arrosto di', 'rotisserie']],
  ['savory_pancake', ['pancake*', 'galette*', 'crepe*', 'okonomiyaki', 'jeon', 'pajeon', 'buchimgae', 'socca',
    'farinata', 'dosa']],
  ['egg_dish', ['omelet*', 'omelette*', 'frittata', 'shakshuka', 'oeufs', 'eggs', 'uova', 'tortilla espanola', 'menemen']],
  ['dumplings', ['dumpling*', 'gyoza', 'wonton*', 'dim sum', 'momo*', 'mandu', 'pierogi', 'bao']],
] as [DishFamily, string[]][]).map(([f, w]) => [f, matcher(w)]);

// Cooking methods from steps. Specific ones first: "stir-fry" and "deep-fry" are not pan-frying.
const METHOD_WORDS: [CookingMethod, RegExp][] = ([
  ['deep_fried', ['deep fr*', 'friteuse', 'bain de friture', 'huile de friture', 'frittura', 'deep fat']],
  ['stir_fried', ['stir fr*', 'wok', 'saute au wok', 'sautez au wok']],
  ['pan_fried', ['fry', 'frying', 'fried', 'pan fr*', 'sear*', 'saute*', 'poele*', 'poeler', 'saisi*',
    'faire revenir', 'faites revenir', 'revenir', 'padella', 'rosola*', 'soffrigg*', 'frigg*', 'brown the', 'brown on']],
  ['roasted', ['roast*', 'rotir', 'rotissez', 'faire rotir', 'arrost*']],
  ['baked', ['bake*', 'baking', 'enfourn*', 'au four', 'le four', 'du four', 'in forno', 'al forno', 'forno', 'oven']],
  ['grilled', ['grill', 'grills', 'grilled', 'grilling', 'grill pan', 'barbecue', 'bbq', 'plancha', 'grigli*', 'broil*', 'char grill*', 'chargrill*']],
  ['braised', ['brais*', 'brasa*', 'a l etouffee']],
  ['simmered', ['simmer*', 'mijot*', 'fremir', 'fremiss*', 'sobboll*', 'fuoco lento', 'feu doux', 'stew*']],
  ['poached', ['poach*', 'poch*', 'in camicia', 'affogat*']],
  ['steamed', ['steam*', 'vapeur', 'vapore']],
  ['boiled', ['boil*', 'bouillir', 'bouillante*', 'ebullition', 'bolli*', 'bollente', 'salted water', 'eau salee',
    'acqua salata']],
] as [CookingMethod, string[]][]).map(([m, w]) => [m, matcher(w)]);
const HEAT_METHODS = new Set<CookingMethod>(COOKING_METHODS.filter((m) => m !== 'no_cook'));

/** Tags that already name something classified: the tag is sourced, the classification follows it. */
const TAG_DISH: Record<string, DishFamily> = {
  curry: 'curry', stew: 'stew', soup: 'soup', salad: 'salad', bowl: 'grain_bowl', risotto: 'rice_dish',
  'stir-fry': 'stir_fry', wrap: 'wrap', sandwich: 'sandwich', burger: 'sandwich', pizza: 'pizza', tart: 'pie',
  gratin: 'gratin', traybake: 'traybake',
};
const TAG_METHOD: Record<string, CookingMethod> = { grill: 'grilled', 'no-cook': 'no_cook' };
const TAG_INTENT: Record<string, MealIntent> = {
  comfort: 'comfort', treat: 'indulgent', light: 'light', fancy: 'special_occasion',
};

/** Cuisine tags and the broader cuisines they belong to, so "goan" and "indian" share a signal. */
export const CUISINE_PARENTS: Record<string, string[]> = {
  goan: ['indian', 'asian'], indian: ['asian'], chinese: ['asian'], japanese: ['asian'], korean: ['asian'],
  thai: ['asian'], vietnamese: ['asian'], indonesian: ['asian'], filipino: ['asian'], malaysian: ['asian'],
  taiwanese: ['asian'], italian: ['mediterranean'], greek: ['mediterranean'], spanish: ['mediterranean'],
  portuguese: ['mediterranean'], lebanese: ['middle eastern', 'mediterranean'], turkish: ['middle eastern', 'mediterranean'],
  moroccan: ['north african'], 'north african': ['african'], ethiopian: ['african'],
};

// ---------------------------------------------------------------------------

interface Trait { kind: string; value: string; amount: number | null }

/** "sauce:cream@60" -> { kind: sauce, value: cream, amount: 60 }; "heat:1.5" -> amount 1.5; "liquid". */
export function parseTrait(t: string): Trait {
  const [kind, rest = ''] = t.split(':');
  const [value, at] = rest.split('@');
  if (kind === 'heat') return { kind, value: '', amount: Number(value) || 0 };
  return { kind, value, amount: at ? Number(at) : null };
}

const traitsOf = (e?: CatalogEntry) => (e?.traits ?? []).map(parseTrait);

function level(points: number, steps: number[]): number {
  let l = 0;
  for (const s of steps) if (points >= s) l += 1;
  return l;
}

const ordered = <T extends string>(vocab: readonly T[], set: Set<T>): T[] => vocab.filter((v) => set.has(v));

export function classifyRecipe(input: ClassifyInput): RecipeClassification {
  const servings = input.servings > 0 ? input.servings : 1;
  const tags = input.tags.map((t) => t.toLowerCase());
  const sourced = new Set<string>();
  const known = input.ingredients.filter((i) => i.catalog);
  const readable = known.length > 0;
  const required = input.ingredients.filter((i) => !i.optional);
  const perServing = (i: ClassifyIngredient) => {
    const g = gramsOf(i, i.catalog);
    return g === null ? null : g / servings;
  };

  // Nutrition: every line, like the recipe's stored macros.
  const m = estimateMacros(input.ingredients.map((i) => ({
    ...i, raw_text: '', aisle: 'other', is_staple: !!i.is_staple, catalog: i.catalog,
  }) as NormalisedIngredient & { guessed?: boolean }), servings);
  const nutrition: Nutrition = {
    kcal: m.kcalPerServing, protein_g: m.proteinGPerServing, fat_g: m.fatGPerServing,
    carbs_g: m.carbsGPerServing, fiber_g: m.fiberGPerServing, estimated: m.estimated,
  };

  // What the dish is made of: required lines only (a garnish doesn't make it a dairy dish).
  const proteinBy = new Map<ProteinGroup, number>();
  const starchKcal = new Map<StarchBase, number>();
  const sauceGrams = new Map<SauceFamily, { grams: number; min: number }>();
  let heat = 0;
  let optionalHeat = 0;
  let liquid = 0;
  let totalProtein = 0;
  for (const i of input.ingredients) {
    const dry = i.catalog?.default_aisle === 'spices' && i.quantity !== null && i.unit ? DRY_SPOON_G[i.unit] : undefined;
    const g = dry ? (i.quantity! * dry) / servings : perServing(i);
    for (const t of traitsOf(i.catalog)) {
      if (t.kind !== 'heat') continue;
      const points = g === null ? HEAT_UNWEIGHED : g * (t.amount ?? 0);
      if (i.optional) optionalHeat += points;
      else heat += points;
    }
  }
  for (const i of required) {
    const g = perServing(i);
    if (g === null || !i.catalog) continue;
    const protein = ((i.catalog.protein_100g ?? 0) * g) / 100;
    totalProtein += protein;
    for (const t of traitsOf(i.catalog)) {
      if (t.kind === 'protein') {
        const p = t.value as ProteinGroup;
        proteinBy.set(p, (proteinBy.get(p) ?? 0) + protein);
      } else if (t.kind === 'starch') {
        const s = t.value as StarchBase;
        starchKcal.set(s, (starchKcal.get(s) ?? 0) + ((i.catalog.kcal_100g ?? 0) * g) / 100);
      } else if (t.kind === 'sauce') {
        const f = t.value as SauceFamily;
        const prev = sauceGrams.get(f);
        const min = Math.min(prev?.min ?? Infinity, t.amount ?? SAUCE_MIN_G[f] ?? 20);
        sauceGrams.set(f, { grams: (prev?.grams ?? 0) + g, min });
      } else if (t.kind === 'liquid') liquid += g;
    }
  }
  const proteins = new Set<ProteinGroup>();
  for (const [p, grams] of proteinBy) {
    if (grams >= PROTEIN_MIN_G || (totalProtein > 0 && grams / totalProtein >= PROTEIN_MIN_SHARE)) proteins.add(p);
  }
  const starches = new Set<StarchBase>();
  for (const [s, kcal] of starchKcal) if (kcal >= STARCH_MIN_KCAL) starches.add(s);
  const sauces = new Set<SauceFamily>();
  for (const [f, { grams, min }] of sauceGrams) if (grams >= min) sauces.add(f);

  // How it's cooked: steps, then tags and equipment.
  const steps = textKey(input.steps.join(' . '));
  const methods = new Set<CookingMethod>();
  let rest = steps;
  for (const [method, re] of METHOD_WORDS) {
    if (has(rest, re)) {
      methods.add(method);
      // "stir-fry" shouldn't also read as pan-frying: drop the words once used.
      if (method === 'deep_fried' || method === 'stir_fried') rest = rest.replace(new RegExp(re.source, 'g'), ' ');
    }
  }
  for (const t of tags) if (TAG_METHOD[t]) { methods.add(TAG_METHOD[t]); sourced.add('cooking_methods'); }
  if (input.equipment?.oven && !methods.has('roasted')) methods.add('baked');
  if (methods.has('roasted')) methods.delete('baked');
  if ([...methods].some((x) => HEAT_METHODS.has(x))) methods.delete('no_cook');
  else if (input.cookMin === 0) methods.add('no_cook');

  // Dish family: tags, then title words, then what's on the plate.
  const families = new Set<DishFamily>();
  for (const t of tags) if (TAG_DISH[t]) { families.add(TAG_DISH[t]); sourced.add('dish_families'); }
  const title = textKey(input.titles.join(' . '));
  for (const [family, re] of DISH_WORDS) if (has(title, re)) families.add(family);
  if (families.has('pizza')) families.delete('pie'); // "tarte flambée"
  if (families.has('egg_dish') && families.size > 1 && !/omelet|frittata|shakshuka/.test(title)) families.delete('egg_dish');
  if (families.size === 0 && readable) {
    if (starches.has('pasta')) families.add('pasta_dish');
    else if (starches.has('noodles')) families.add('noodle_dish');
    else if (methods.has('stir_fried') && !['steamed', 'baked', 'roasted', 'grilled', 'braised'].some((x) => methods.has(x as CookingMethod))) {
      families.add('stir_fry');
    }
    else if (liquid >= LIQUID_STEPS[2]) families.add('soup');
    else if (proteins.size > 0) families.add('plated');
  }
  if (families.size === 0) families.add('other');

  // Sauce level from liquids; soups are brothy, a named sauce coats at least.
  let sauceLevel: number | null = readable ? level(liquid, LIQUID_STEPS) : null;
  if (sauceLevel !== null) {
    if (families.has('soup')) sauceLevel = 3;
    // Liquid that bakes into a dish (béchamel, a braise in the oven) doesn't make it brothy.
    else if (sauceLevel === 3 && (methods.has('baked') || methods.has('roasted'))) sauceLevel = 2;
    else if (sauceLevel === 0 && sauces.size > 0) sauceLevel = 1;
  }

  let heatLevel: number | null = readable ? level(heat, HEAT_STEPS) : null;
  if (tags.includes('spicy')) { heatLevel = Math.max(heatLevel ?? 0, 2); sourced.add('heat_level'); }

  // Nutrition goals: only what the numbers show.
  const goals = new Set<NutritionGoal>();
  const { kcal, protein_g: protein, fat_g: fat, fiber_g: fiber } = nutrition;
  const fatShare = kcal && fat !== null ? (fat * 9) / kcal : null;
  if (kcal && protein !== null && protein >= HIGH_PROTEIN_MIN_G && (protein * 4) / kcal >= HIGH_PROTEIN_MIN_SHARE) {
    goals.add('high_protein');
  }
  if (kcal && fatShare !== null && fatShare <= LEAN_MAX_FAT_SHARE && kcal <= LEAN_MAX_KCAL) goals.add('lean');
  if (kcal && kcal <= LOW_KCAL_MAX) goals.add('low_kcal');
  if (fiber !== null && fiber >= HIGH_FIBRE_MIN_G) goals.add('high_fibre');

  // What it's for: the recipe's own mood tags, then rules.
  const intents = new Set<MealIntent>();
  for (const t of tags) if (TAG_INTENT[t]) { intents.add(TAG_INTENT[t]); sourced.add('meal_intents'); }
  const comfortFamily = ['stew', 'curry', 'soup', 'gratin', 'pie', 'roast'].some((f) => families.has(f as DishFamily));
  const richSauce = ['cream', 'cheese', 'gravy'].some((s) => sauces.has(s as SauceFamily));
  if (comfortFamily || (starches.size > 0 && (richSauce || ((sauceLevel ?? 0) >= 2 && (kcal ?? 0) >= 550)))) {
    intents.add('comfort');
  }
  if (methods.has('deep_fried') || (kcal ?? 0) >= 900 || ((fatShare ?? 0) >= 0.45 && (kcal ?? 0) >= 700)) {
    intents.add('indulgent');
  }
  if (!intents.has('indulgent') && kcal && ((kcal <= LOW_KCAL_MAX && fatShare !== null && fatShare <= 0.35)
    || (families.has('salad') && kcal <= 600))) {
    intents.add('light');
  }
  if (goals.has('high_protein') && goals.has('lean')) intents.add('fuel');
  const exotic = input.ingredients.some((i) => i.catalog?.exotic);
  if (input.totalMin !== null && input.totalMin <= EVERYDAY_MAX_MIN && input.difficulty !== 'hard' && !exotic) {
    intents.add('everyday');
  }
  if (input.difficulty === 'hard') intents.add('special_occasion');

  const cuisines = new Set<string>();
  const ownCuisine = input.cuisine?.toLowerCase().trim();
  for (const c of [ownCuisine, ...tags.filter((t) => t in CUISINE_PARENTS)]) {
    if (!c) continue;
    cuisines.add(c);
    for (const p of CUISINE_PARENTS[c] ?? []) cuisines.add(p);
  }
  if (cuisines.size) sourced.add('cuisines');

  return {
    version: CLASSIFICATION_VERSION,
    cuisines: [...cuisines],
    protein_groups: readable ? ordered(PROTEIN_GROUPS, proteins) : null,
    starch_bases: readable ? ordered(STARCH_BASES, starches) : null,
    dish_families: ordered(DISH_FAMILIES, families),
    sauce_families: readable ? ordered(SAUCE_FAMILIES, sauces) : null,
    cooking_methods: ordered(COOKING_METHODS, methods),
    heat_level: heatLevel,
    heat_adjustable: optionalHeat >= HEAT_STEPS[0],
    sauce_level: sauceLevel,
    nutrition,
    nutrition_goals: ordered(NUTRITION_GOALS, goals),
    meal_intents: ordered(MEAL_INTENTS, intents),
    sourced: [...sourced].sort(),
  };
}

// ---------------------------------------------------------------------------
// From a database row
// ---------------------------------------------------------------------------

export interface ClassifiableRow {
  title: string;
  servings: number;
  tags: string[] | null;
  cuisine?: string | null;
  steps?: unknown;
  prep_min?: number | null;
  cook_min?: number | null;
  total_min?: number | null;
  difficulty?: Difficulty | null;
  equipment?: Equipment | null;
  translations?: unknown;
  /** Stored by deal-deck (recipes.classification), with the catalogue version it was worked out with. */
  classification?: unknown;
  classified_with?: string | null;
  recipe_ingredients: {
    name: string; quantity?: number | null; unit?: string | null; optional?: boolean | null;
    is_staple?: boolean | null; guessed?: boolean | null;
  }[];
}

/** The columns classifyRow reads, for a select(): `recipes.select(\`id, ${CLASSIFY_COLUMNS}\`)`. */
export const CLASSIFY_COLUMNS = 'title, servings, tags, cuisine, steps, prep_min, cook_min, total_min, difficulty, '
  + 'equipment, translations, classification, classified_with, recipe_ingredients(name, quantity, unit, optional, is_staple, guessed)';

/** The recipe's stored classification, when it was worked out with this catalogue and these rules. */
export function storedClassification(row: Pick<ClassifiableRow, 'classification' | 'classified_with'>, catalog: Catalog): RecipeClassification | null {
  const c = row.classification as RecipeClassification | null | undefined;
  return c && c.version === CLASSIFICATION_VERSION && catalog.version && row.classified_with === catalog.version ? c : null;
}

/** A recipe row as stored (lines named by catalogue ingredient), classified against the catalogue. */
export function classifyRow(row: ClassifiableRow, catalog: Catalog): RecipeClassification {
  const stored = storedClassification(row, catalog);
  if (stored) return stored;
  const tr = (row.translations && typeof row.translations === 'object' ? row.translations : {}) as
    Record<string, { title?: string; steps?: string[] }>;
  const strings = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  return classifyRecipe({
    titles: [row.title, ...Object.values(tr).map((t) => t?.title ?? '')].filter(Boolean),
    servings: row.servings,
    tags: row.tags ?? [],
    cuisine: row.cuisine ?? null,
    steps: [...strings(row.steps), ...Object.values(tr).flatMap((t) => strings(t?.steps))],
    prepMin: row.prep_min ?? null,
    cookMin: row.cook_min ?? null,
    totalMin: row.total_min ?? null,
    difficulty: row.difficulty ?? null,
    equipment: row.equipment ?? null,
    ingredients: row.recipe_ingredients.map((i) => ({
      name: i.name, quantity: i.quantity ?? null, unit: i.unit ?? null, optional: !!i.optional,
      is_staple: !!i.is_staple, guessed: !!i.guessed, catalog: catalog.find(i.name),
    })),
  });
}

// ---------------------------------------------------------------------------
// As learning features
// ---------------------------------------------------------------------------

/**
 * Features for preference learning, namespaced so the same word means one
 * thing ("sauce:coconut" is not the ingredient "coconut milk"). Heat is
 * cumulative ("heat:2+" for anything at least medium) so a liking for spicy
 * food is one feature, not five unrelated ones. Cuisines stay plain names,
 * like the cuisine tags they come from.
 */
export function classificationFeatures(c: RecipeClassification): string[] {
  const out = [
    ...c.cuisines,
    ...(c.protein_groups ?? []).map((v) => `protein:${v}`),
    ...(c.starch_bases ?? []).map((v) => `starch:${v}`),
    ...c.dish_families.filter((v) => v !== 'other').map((v) => `dish:${v}`),
    ...(c.sauce_families ?? []).map((v) => `sauce:${v}`),
    ...c.cooking_methods.map((v) => `method:${v}`),
    ...c.nutrition_goals.map((v) => `goal:${v}`),
    ...c.meal_intents.map((v) => `intent:${v}`),
  ];
  if (c.heat_level !== null) {
    if (c.heat_level === 0) out.push('heat:0');
    for (let l = 1; l <= c.heat_level; l++) out.push(`heat:${l}+`);
  }
  if (c.sauce_level !== null) out.push(`texture:${SAUCE_LEVELS[c.sauce_level]}`);
  return out;
}

/** Tags that name a classified feature, as that feature: learning on "curry" and "dish:curry" is one signal. */
const TAG_FEATURE: Record<string, string> = {
  ...Object.fromEntries(Object.entries(TAG_DISH).map(([t, f]) => [t, `dish:${f}`])),
  ...Object.fromEntries(Object.entries(TAG_METHOD).map(([t, m]) => [t, `method:${m}`])),
  ...Object.fromEntries(Object.entries(TAG_INTENT).map(([t, i]) => [t, `intent:${i}`])),
  spicy: 'heat:2+',
  'high protein': 'goal:high_protein',
};

/** A feature as learning stores it now: legacy tag patterns ("curry") read as "dish:curry". */
export function canonicalFeature(f: string): string {
  const k = f.toLowerCase();
  return TAG_FEATURE[k] ?? k;
}

/** Whether a feature value is a classification feature (namespaced), not a tag or ingredient. */
export function isClassFeature(f: string): boolean {
  return /^(protein|starch|dish|sauce|method|goal|intent|heat|texture):/.test(f);
}
