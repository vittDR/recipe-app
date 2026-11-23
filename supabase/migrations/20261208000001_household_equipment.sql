-- Kitchen appliances (onboarding "Qu'avez-vous en cuisine ?", Us > Préférences).
--
-- * public.appliances: the twelve the screen offers, like public.allergens;
--   the same keys and order as logic/facets.ts APPLIANCES. A key is also how
--   recipes name what they need (recipes.equipment: oven, special[]).
-- * households.equipment: the keys a household has. Null = never asked:
--   everything is assumed to be there. deal-deck never deals a recipe needing
--   one the household lacks; today the recipes only call for the oven, the
--   air fryer and the blender, so the other nine are kept but filter nothing.

create table if not exists public.appliances (
  key text primary key,
  name_fr text not null,
  name_en text not null,
  position int not null
);

insert into public.appliances (key, name_fr, name_en, position) values
  ('oven', 'Four', 'Oven', 1),
  ('air fryer', 'Air fryer', 'Air fryer', 2),
  ('microwave', 'Micro-ondes', 'Microwave', 3),
  ('multicooker', 'Robot cuiseur', 'Multicooker', 4),
  ('blender', 'Blender', 'Blender', 5),
  ('hand blender', 'Mixeur plongeant', 'Hand blender', 6),
  ('stand mixer', 'Robot pâtissier', 'Stand mixer', 7),
  ('steamer', 'Cuit-vapeur', 'Steamer', 8),
  ('pressure cooker', 'Autocuiseur', 'Pressure cooker', 9),
  ('slow cooker', 'Mijoteuse', 'Slow cooker', 10),
  ('rice cooker', 'Cuiseur à riz', 'Rice cooker', 11),
  ('barbecue', 'Barbecue', 'Barbecue', 12)
on conflict (key) do update set name_fr = excluded.name_fr, name_en = excluded.name_en, position = excluded.position;

alter table public.appliances enable row level security;
grant select on public.appliances to authenticated;
drop policy if exists appliances_read on public.appliances;
create policy appliances_read on public.appliances for select to authenticated using (true);

alter table public.households add column if not exists equipment text[];
grant update (equipment) on public.households to authenticated;

-- Only known appliances, each once (an array can't carry a foreign key).
create or replace function public.check_household_equipment()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.equipment is not null then
    if exists (select 1 from unnest(new.equipment) e where e not in (select key from public.appliances)) then
      raise exception 'unknown_appliance';
    end if;
    new.equipment := array(select distinct e from unnest(new.equipment) e
                           join public.appliances a on a.key = e order by 1);
  end if;
  return new;
end;
$$;

drop trigger if exists households_equipment_check on public.households;
create trigger households_equipment_check
  before insert or update of equipment on public.households
  for each row execute function public.check_household_equipment();
