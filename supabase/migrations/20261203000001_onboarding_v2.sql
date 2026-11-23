-- Onboarding v2 (design/HANDOFF: onboarding handoff, 23 Nov 2026).
--
-- * profiles.onboarded_at: set when someone finishes onboarding. Goals can be
--   skipped now, so "has goals" no longer says onboarding is done. Everyone
--   already set up counts as onboarded.
-- * Goals per dinner: calories and protein can be switched off (null), and
--   carbs, fat and fibre can be switched on. Null = no target; member_fits()
--   and my_portion() already read null as "no target".
-- * households.deck_defaults: the weeknight defaults the creator picks
--   (time, effort, mood, filters); they prefill Ce soir's deck settings.
-- * Diets: 'flexitarian' joins everything / pescatarian / vegetarian
--   (taste_rules.value for kind 'diet'; free text, no constraint).

alter table public.profiles add column if not exists onboarded_at timestamptz;

update public.profiles p set onboarded_at = coalesce(p.onboarded_at, now())
where exists (select 1 from public.member_goals g where g.user_id = p.id)
   or exists (select 1 from public.household_members m where m.user_id = p.id);

alter table public.member_goals alter column dinner_kcal drop not null;
alter table public.member_goals alter column dinner_protein_g drop not null;
alter table public.member_goals add column if not exists dinner_carbs_g int check (dinner_carbs_g between 0 and 300);
alter table public.member_goals add column if not exists dinner_fat_g int check (dinner_fat_g between 0 and 200);
alter table public.member_goals add column if not exists dinner_fibre_g int check (dinner_fibre_g between 0 and 100);

alter table public.households add column if not exists deck_defaults jsonb not null default '{}'::jsonb;

comment on column public.households.deck_defaults is
  'Weeknight defaults from onboarding: {maxMinutes, mood, filters}. Prefills the deck settings on Ce soir.';
comment on column public.profiles.onboarded_at is 'When this person finished onboarding; null = still in it.';

-- Members already edit the household's settings; the weeknight defaults are one of them.
grant update (deck_defaults) on public.households to authenticated;
