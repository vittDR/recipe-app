// Row shapes used by the app (subset of columns it reads).
import type { Difficulty, Equipment } from '@logic/facets.ts';
import type { Aisle } from '@logic/ingredients.ts';

export type { Aisle };
export type Verdict = 'pass' | 'yes' | 'must';
export type Mood = 'any' | 'comfort' | 'light' | 'quick' | 'fancy';
export type DeckStatus = 'open' | 'matched' | 'tiebreak' | 'closed';
export type Goal = 'lean' | 'maintain' | 'build';
export type Diet = 'everything' | 'pescatarian' | 'vegetarian';

export interface Profile {
  id: string;
  first_name: string;
  color: string;
  locale: 'en' | 'fr';
}

export interface Household {
  id: string;
  name: string;
  owner_id: string;
  timezone: string;
  store_name: string | null;
  prompt_time: string;
  reminder_time: string;
}

export interface Member {
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
  profile: Profile;
}

export interface MemberGoals {
  user_id: string;
  goal: Goal;
  dinner_kcal: number;
  dinner_protein_g: number;
  /** Servings on this person's plate. */
  servings: number;
}

export interface TasteRule {
  id: string;
  user_id: string;
  kind: 'never' | 'love' | 'diet';
  value: string;
  /** The catalogue item a never / love rule is about; null for older free-text rules. */
  product_id: string | null;
  source: 'manual' | 'learned';
}

export interface Recipe {
  id: string;
  household_id: string | null;
  title: string;
  source_type: 'web' | 'instagram' | 'photo' | 'typed' | 'ai' | 'seed';
  source_url: string | null;
  source_name: string | null;
  image_path: string | null;
  servings: number;
  /** Start to plate, including marinating and resting. */
  total_min: number | null;
  /** Hands-on preparation. */
  prep_min: number | null;
  /** On the hob, in the oven or on the grill; 0 for no-cook dishes. */
  cook_min: number | null;
  steps: string[];
  tags: string[];
  kcal_per_serving: number | null;
  protein_g_per_serving: number | null;
  macros_estimated: boolean;
  difficulty: Difficulty | null;
  /** Null when unknown. */
  equipment: Equipment | null;
  /** Written by an AI rather than taken from a source. */
  ai_generated_recipe: boolean;
  created_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  position: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  aisle: Aisle;
  is_staple: boolean;
  guessed: boolean;
  /** The dish works without it (a garnish, cheese on top). */
  optional: boolean;
  raw_text: string | null;
  product_id: string | null;
  /** Embedded with `select('*, product:products(name_fr, name_en)')`. */
  product?: { name_fr: string; name_en: string | null } | null;
}

export interface Deck {
  id: string;
  household_id: string;
  for_date: string;
  started_by: string;
  who_eating: string[];
  max_minutes: number | null;
  mood: Mood;
  status: DeckStatus;
  matched_recipe_id: string | null;
  created_at: string;
}

export interface DeckCard {
  deck_id: string;
  recipe_id: string;
  position: number;
  score: number;
  fit_score: number;
  fits_all: boolean;
  reason: string | null;
  recipe: Recipe;
}

export interface DeckMemberProgress {
  deck_id: string;
  user_id: string;
  swiped_count: number;
  finished_at: string | null;
  nudged_at: string | null;
}

export interface MemberPortion {
  recipe_id: string;
  kcal: number | null;
  protein_g: number | null;
  servings: number | null;
  fits: boolean;
}

export interface Swipe {
  deck_id: string;
  recipe_id: string;
  user_id: string;
  verdict: Verdict;
  created_at: string;
}

export interface GroceryRow {
  id: string;
  household_id: string;
  product_id: string | null;
  /** Snapshot of the product's French name; display goes through the product. */
  name: string;
  quantity: number | null;
  unit: string | null;
  aisle: Aisle;
  store_id: string | null;
  recipe_id: string | null;
  added_by: string | null;
  checked_by: string | null;
  checked_at: string | null;
  cleared_at: string | null;
  sort_key: number;
  created_at: string;
}

export interface Store {
  id: string;
  name: string;
  position: number;
}

export interface Meal {
  id: string;
  for_date: string;
  recipe_id: string;
  status: 'planned' | 'cooked' | 'skipped';
  deck_id: string | null;
}

export interface PlanDay {
  household_id: string;
  weekday: number;
  cook_at_home: boolean;
  recipe_id: string | null;
}

export interface LearnedPattern {
  id: string;
  user_id: string;
  pattern: { kind: 'avoid' | 'prefer'; value: string };
  evidence_count: number;
  status: 'suggested' | 'accepted' | 'dismissed';
  weight: number;
}
