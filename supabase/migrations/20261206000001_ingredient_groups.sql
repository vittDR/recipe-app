-- Ingredient groups ("macro ingredients"): one name for a whole family of
-- catalogue items, so that someone who doesn't eat pork says so once and
-- gets no pork tenderloin, bacon, ham, sausage, chorizo… and someone who
-- avoids cow's milk gets no butter, cream, yoghurt or cow's cheese.
-- A "never" (or "love") rule names either one catalogue item (product_id)
-- or one group (group_key); a group stands for every item linked to it.
-- The links are in seed.sql, next to the allergen links.

create table if not exists public.ingredient_groups (
  key text primary key,
  name_fr text not null,
  name_en text not null,
  name_it text,
  -- Other names people search for, any language, lowercase.
  aliases text[] not null default '{}',
  position int not null
);

insert into public.ingredient_groups (key, name_fr, name_en, name_it, aliases, position) values
  ('pork', 'Porc (tout)', 'Pork (all)', 'Maiale (tutto)', '{porc,pork,maiale,cochon,charcuterie,halal,casher,kosher}', 1),
  ('beef', 'Bœuf et veau (tout)', 'Beef and veal (all)', 'Manzo e vitello (tutto)', '{boeuf,bœuf,beef,veau,veal,manzo,vitello}', 2),
  ('lamb', 'Agneau et mouton (tout)', 'Lamb and mutton (all)', 'Agnello e montone (tutto)', '{agneau,mouton,lamb,mutton,agnello}', 3),
  ('poultry', 'Volaille (tout)', 'Poultry (all)', 'Pollame (tutto)', '{volaille,poulet,dinde,poultry,chicken,turkey,pollo,tacchino}', 4),
  ('cow_milk', 'Lait de vache et dérivés', 'Cow''s milk and dairy', 'Latte vaccino e derivati', '{lait,lait de vache,laitage,laitages,produits laitiers,crème,yaourt,fromage,milk,cow milk,dairy,cream,yoghurt,yogurt,cheese,latte,latticini}', 5),
  ('alcohol', 'Alcool (vin, bière…)', 'Alcohol (wine, beer…)', 'Alcol (vino, birra…)', '{alcool,vin,bière,alcohol,wine,beer,alcol,vino,birra}', 6)
on conflict (key) do update set
  name_fr = excluded.name_fr, name_en = excluded.name_en, name_it = excluded.name_it,
  aliases = excluded.aliases, position = excluded.position;

create table if not exists public.ingredient_group_members (
  group_key text not null references public.ingredient_groups (key) on delete cascade,
  ingredient text not null references public.ingredient_catalog (name) on delete cascade on update cascade,
  primary key (group_key, ingredient)
);

alter table public.ingredient_groups enable row level security;
alter table public.ingredient_group_members enable row level security;
grant select on public.ingredient_groups, public.ingredient_group_members to authenticated;
drop policy if exists ingredient_groups_read on public.ingredient_groups;
create policy ingredient_groups_read on public.ingredient_groups for select to authenticated using (true);
drop policy if exists ingredient_group_members_read on public.ingredient_group_members;
create policy ingredient_group_members_read on public.ingredient_group_members for select to authenticated using (true);

-- Rules on a group.
alter table public.taste_rules
  add column if not exists group_key text references public.ingredient_groups (key) on delete cascade;
alter table public.taste_rules drop constraint if exists taste_rules_item;
alter table public.taste_rules add constraint taste_rules_item check (
  case when kind = 'diet' then product_id is null and group_key is null
       else (product_id is null) <> (group_key is null) end
);
create unique index if not exists taste_rules_one_per_group on public.taste_rules (user_id, kind, group_key)
  where group_key is not null;
