-- DINEAMITE core schema.
-- Shared data hangs off households; goals, taste rules and learned patterns
-- hang off the user and are private to them (enforced by RLS in the next
-- migration). Business rules that both phones must agree on (matching,
-- tie-break, list merging) live in SQL so they run in one place.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.member_role as enum ('owner', 'member');
create type public.goal_kind as enum ('lean', 'maintain', 'build');
create type public.taste_kind as enum ('never', 'love', 'diet');
create type public.rule_source as enum ('manual', 'learned');
create type public.pattern_status as enum ('suggested', 'accepted', 'dismissed');
create type public.recipe_source as enum ('web', 'instagram', 'photo', 'typed', 'ai', 'seed');
create type public.deck_status as enum ('open', 'matched', 'tiebreak', 'closed');
create type public.deck_mood as enum ('any', 'comfort', 'light', 'quick', 'fancy');
create type public.verdict as enum ('pass', 'yes', 'must');
create type public.meal_status as enum ('planned', 'cooked', 'skipped');

-- Aisles are stable keys; the app translates them.
create type public.aisle as enum (
  'produce', 'meat_fish', 'dairy_eggs', 'bakery', 'pantry', 'spices',
  'frozen', 'drinks', 'household', 'other'
);

-- ---------------------------------------------------------------------------
-- People and households
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  color text not null default '#C24E33',
  locale text not null default 'en' check (locale in ('en', 'fr')),
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  owner_id uuid not null references public.profiles (id),
  timezone text not null default 'Europe/Paris',
  store_name text,
  prompt_time time not null default '17:30',
  reminder_time time not null default '18:30',
  -- Set by the scheduler so each prompt goes out once per local day.
  last_prompt_on date,
  last_reminder_on date,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
-- One household per user for now. Drop this index to allow several.
create unique index household_members_one_per_user on public.household_members (user_id);

create table public.invites (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '48 hours',
  used_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Private per-person data
-- ---------------------------------------------------------------------------

create table public.member_goals (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  goal public.goal_kind not null default 'maintain',
  dinner_kcal int not null default 700 check (dinner_kcal between 200 and 3000),
  dinner_protein_g int not null default 40 check (dinner_protein_g between 0 and 300),
  updated_at timestamptz not null default now()
);

create table public.taste_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.taste_kind not null,
  -- For 'diet': everything | pescatarian | vegetarian. Otherwise a tag or ingredient name.
  value text not null,
  source public.rule_source not null default 'manual',
  created_at timestamptz not null default now(),
  unique (user_id, kind, value)
);
create unique index taste_rules_one_diet on public.taste_rules (user_id) where kind = 'diet';

create table public.learned_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- e.g. {"kind":"avoid","target":"tag","value":"mushroom"} or
  --      {"kind":"prefer","target":"tag","value":"bowl","weekday":1}
  pattern jsonb not null,
  evidence_count int not null default 0,
  status public.pattern_status not null default 'suggested',
  -- Soft weight applied to deck scoring once accepted (negative = show less).
  weight real not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index learned_patterns_unique on public.learned_patterns (user_id, (pattern));

-- Web Push subscriptions (one per installed device/browser).
create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  user_agent text,
  updated_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- Recipes
-- ---------------------------------------------------------------------------

create table public.ingredient_catalog (
  name text primary key,                -- canonical lowercase English name
  name_fr text,
  aliases text[] not null default '{}', -- lowercase alternatives in any language
  default_aisle public.aisle not null default 'other',
  is_staple boolean not null default false,
  -- Per 100 g, for macro computation. Null when unknown.
  kcal_100g real,
  protein_100g real,
  -- Grams in one "piece" / "clove" / etc., for unit conversion.
  grams_per_unit real,
  -- Whether the ingredient is meat or fish, for diet filtering.
  diet_class text not null default 'veg' check (diet_class in ('veg', 'fish', 'meat'))
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade, -- null = seed library
  copied_from uuid references public.recipes (id) on delete set null,
  title text not null,
  source_type public.recipe_source not null,
  source_url text,
  image_path text,                -- storage path or absolute URL
  servings real not null default 2 check (servings > 0),
  total_min int check (total_min > 0),
  steps jsonb not null default '[]'::jsonb, -- array of strings
  tags text[] not null default '{}',
  kcal_per_serving real,
  protein_g_per_serving real,
  macros_estimated boolean not null default false,
  language text not null default 'en',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipes_household on public.recipes (household_id);
create unique index recipes_household_source on public.recipes (household_id, source_url)
  where source_url is not null;

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  position int not null default 0,
  name text not null,                    -- normalised, matches ingredient_catalog.name when known
  quantity real,
  unit text,                             -- g, ml, piece, tbsp, tsp, cup, clove, pinch, ...
  aisle public.aisle not null default 'other',
  is_staple boolean not null default false,
  guessed boolean not null default false,
  raw_text text
);
create index recipe_ingredients_recipe on public.recipe_ingredients (recipe_id);

-- Cache for AI / import calls: never re-call for the same input.
create table public.ai_cache (
  input_hash text primary key,
  kind text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tonight: decks, swipes, tie-breaks, meals
-- ---------------------------------------------------------------------------

create table public.decks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  for_date date not null,
  started_by uuid not null references public.profiles (id),
  who_eating uuid[] not null check (cardinality(who_eating) >= 1),
  max_minutes int,
  mood public.deck_mood not null default 'any',
  status public.deck_status not null default 'open',
  matched_recipe_id uuid references public.recipes (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index decks_household_date on public.decks (household_id, for_date desc);

create table public.deck_cards (
  deck_id uuid not null references public.decks (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  position int not null,
  score real not null default 0,      -- overall ranking score
  fit_score real not null default 0,  -- macro fit for everyone eating, 0..1 (tie-break)
  fits_all boolean not null default false,
  reason text,                         -- short AI or rule-based reason, optional
  primary key (deck_id, recipe_id),
  unique (deck_id, position)
);

-- Private per-member plate for each card: only the member reads their row.
create table public.member_portions (
  deck_id uuid not null references public.decks (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kcal real,
  protein_g real,
  servings real,
  fits boolean not null default false,
  primary key (deck_id, recipe_id, user_id)
);

-- Per-member progress, visible to the household (counts only, no verdicts).
create table public.deck_members (
  deck_id uuid not null references public.decks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  swiped_count int not null default 0,
  finished_at timestamptz,
  nudged_at timestamptz,
  primary key (deck_id, user_id)
);

create table public.swipes (
  deck_id uuid not null references public.decks (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  verdict public.verdict not null,
  created_at timestamptz not null default now(),
  primary key (deck_id, recipe_id, user_id)
);
create index swipes_user_created on public.swipes (user_id, created_at desc);

create table public.tiebreak_picks (
  deck_id uuid not null references public.decks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (deck_id, user_id)
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  for_date date not null,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  deck_id uuid references public.decks (id) on delete set null,
  status public.meal_status not null default 'planned',
  portion_split jsonb,
  created_at timestamptz not null default now()
);
create unique index meals_household_date on public.meals (household_id, for_date);

create table public.plan_days (
  household_id uuid not null references public.households (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7), -- ISO: 1 = Monday
  cook_at_home boolean not null default true,
  recipe_id uuid references public.recipes (id) on delete set null, -- optional pre-pick
  primary key (household_id, weekday)
);

-- ---------------------------------------------------------------------------
-- Groceries
-- ---------------------------------------------------------------------------

create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  quantity real,
  unit text,
  aisle public.aisle not null default 'other',
  recipe_id uuid references public.recipes (id) on delete set null,
  added_by uuid references public.profiles (id) on delete set null,
  checked_by uuid references public.profiles (id) on delete set null,
  checked_at timestamptz,
  -- Cleared items are kept for "probably at home" detection.
  cleared_at timestamptz,
  sort_key real not null default 0,
  created_at timestamptz not null default now()
);
create index grocery_items_household on public.grocery_items (household_id) where cleared_at is null;

create table public.household_staples (
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  primary key (household_id, name)
);

create table public.household_aisle_order (
  household_id uuid not null references public.households (id) on delete cascade,
  aisle public.aisle not null,
  position int not null,
  primary key (household_id, aisle)
);

-- ---------------------------------------------------------------------------
-- Push outbox: rows are written by triggers and RPCs, sent by the
-- push-dispatch edge function. Clients never read or write it.
-- ---------------------------------------------------------------------------

create table public.push_outbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null, -- prompt | reminder | deck_dealt | partner_finished | match | nudge | partner_joined
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  error text
);
create index push_outbox_pending on public.push_outbox (created_at) where sent_at is null;
