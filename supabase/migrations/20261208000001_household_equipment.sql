-- The appliances a household has (onboarding "Qu'avez-vous en cuisine ?"),
-- from logic/facets.ts APPLIANCES (oven, air fryer, microwave, blender…).
-- deal-deck never deals a recipe needing one the household lacks; today the
-- recipes only call for the oven, the air fryer and the blender. Null = never
-- asked: everything is assumed to be there.
alter table public.households add column if not exists equipment text[];
grant update (equipment) on public.households to authenticated;
