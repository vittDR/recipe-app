-- The appliances a household has (onboarding "Qu'avez-vous en cuisine ?"):
-- only those our recipes call for, logic/facets.ts APPLIANCES ('oven',
-- 'air fryer', 'blender'). deal-deck never deals a recipe needing one the
-- household lacks. Null = never asked: everything is assumed to be there.
alter table public.households add column if not exists equipment text[];
grant update (equipment) on public.households to authenticated;
