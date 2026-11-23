-- Ingredient groups ("macro ingredients"): one name for a whole family of
-- catalogue items, so that someone who doesn't eat pork says so once and
-- gets no pork tenderloin, bacon, ham, sausage, chorizo… someone who avoids
-- cow's milk gets no butter, cream, yoghurt or cow's cheese, and someone who
-- hates cheese gets no cheese at all. Meat, fish, seafood, dairy, cheese, eggs,
-- red meat, mushrooms, chilli, onions, garlic, legumes and alcohol.
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
  -- Red meat as health advice counts it (WHO): beef, veal, lamb and pork.
  ('red_meat', 'Viande rouge (bœuf, agneau, porc…)', 'Red meat (beef, lamb, pork…)', 'Carne rossa (manzo, agnello, maiale…)', '{viande rouge,viandes rouges,red meat,carne rossa,boeuf,bœuf,agneau,veau,beef,lamb}', 4),
  ('poultry', 'Volaille (tout)', 'Poultry (all)', 'Pollame (tutto)', '{volaille,poulet,dinde,poultry,chicken,turkey,pollo,tacchino}', 5),
  ('fish', 'Poisson (tout)', 'Fish (all)', 'Pesce (tutto)', '{poisson,poissons,fish,pesce,sauce poisson,fish sauce}', 6),
  ('seafood', 'Fruits de mer et crustacés', 'Seafood and shellfish', 'Frutti di mare e crostacei', '{fruits de mer,crustacés,coquillages,crevettes,moules,seafood,shellfish,prawns,shrimp,mussels,frutti di mare,crostacei}', 7),
  ('cow_milk', 'Lait de vache et dérivés', 'Cow''s milk and dairy', 'Latte vaccino e derivati', '{lait,lait de vache,laitage,laitages,crème,yaourt,beurre,milk,cow milk,cream,yoghurt,yogurt,butter,latte,panna,burro}', 8),
  ('dairy', 'Produits laitiers (tous laits)', 'Dairy (any milk)', 'Latticini (ogni latte)', '{produits laitiers,laitages,lait,lactose,dairy,milk,latticini,latte,vegan,végétalien}', 9),
  ('cheese', 'Fromage (tout)', 'Cheese (all)', 'Formaggio (tutto)', '{fromage,fromages,cheese,formaggio,formaggi}', 10),
  ('eggs', 'Œufs (et mayonnaise)', 'Eggs (and mayonnaise)', 'Uova (e maionese)', '{oeuf,œuf,oeufs,œufs,egg,eggs,uova,uovo,mayonnaise}', 11),
  ('mushrooms', 'Champignons (tous)', 'Mushrooms (all)', 'Funghi (tutti)', '{champignon,champignons,cèpes,mushroom,mushrooms,porcini,funghi}', 12),
  ('chilli', 'Piment et épicé', 'Chilli and spicy', 'Peperoncino e piccante', '{piment,piments,épicé,piquant,chilli,chili,spicy,hot,piccante,peperoncino}', 13),
  ('onions', 'Oignon, échalote et poireau', 'Onion, shallot and leek', 'Cipolla, scalogno e porro', '{oignon,oignons,poireau,échalote,ciboulette,cébette,onion,onions,leek,shallot,chives,spring onion,cipolla,porro,scalogno}', 14),
  -- Its own group: most recipes hold garlic, the app says so when it is picked.
  ('garlic', 'Ail (et pesto, harissa…)', 'Garlic (and pesto, harissa…)', 'Aglio (e pesto, harissa…)', '{ail,aïl,gousse d''ail,garlic,aglio}', 15),
  ('legumes', 'Légumineuses (haricots, lentilles…)', 'Legumes (beans, lentils…)', 'Legumi (fagioli, lenticchie…)', '{légumineuses,legumineuses,haricots,lentilles,pois chiches,petits pois,legumes,pulses,beans,lentils,chickpeas,peas,legumi,fagioli,lenticchie,ceci}', 16),
  ('alcohol', 'Alcool (vin, bière…)', 'Alcohol (wine, beer…)', 'Alcol (vino, birra…)', '{alcool,vin,bière,alcohol,wine,beer,alcol,vino,birra}', 17)
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
