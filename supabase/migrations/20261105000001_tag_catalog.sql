-- Recipe tags get a catalogue, like ingredients: recipes keep storing tag
-- names ("comfort", "one-pot"), and tag_catalog gives each one its English and
-- French label plus the words recipe sites use for it ("réconfortant", "plat
-- mijoté"), so tags read in the app's language and imports land on the same
-- tags whatever language the page was in. Households can add their own tags;
-- a label missing in one language can be filled in later.
--
-- Two kinds of rows are words to drop rather than tags: 'ingredient' (chicken,
-- rice…: the ingredient list already says it) and 'noise' (dinner, plat
-- principal…: says nothing about the dish).

create table public.tag_catalog (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade, -- null = shared
  name text not null check (name <> '' and name = lower(trim(name))),     -- what recipes.tags stores
  kind text not null default 'tag' check (kind in ('tag', 'ingredient', 'noise')),
  name_en text,
  name_fr text,
  aliases text[] not null default '{}',                                 -- any language, matched by product_key()
  check (household_id is null or kind = 'tag')
);
create unique index tag_catalog_shared_name on public.tag_catalog (name) where household_id is null;
create unique index tag_catalog_household_name on public.tag_catalog (household_id, name); -- shared rows (null) never clash

alter table public.tag_catalog enable row level security;
create policy tag_catalog_select on public.tag_catalog for select to authenticated
  using (household_id is null or public.is_member(household_id));
create policy tag_catalog_insert on public.tag_catalog for insert to authenticated
  with check (public.is_member(household_id));
create policy tag_catalog_update on public.tag_catalog for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy tag_catalog_delete on public.tag_catalog for delete to authenticated
  using (public.is_member(household_id));

insert into public.tag_catalog (name, kind, name_en, name_fr, aliases) values
  ('comfort', 'tag', 'Comfort', 'Réconfortant', array['réconfortant', 'réconfortante', 'comfort food', 'cocooning', 'plat réconfortant', 'hearty', 'copieux']::text[]),
  ('light', 'tag', 'Light', 'Léger', array['léger', 'légère', 'legers', 'light meal', 'plat léger', 'recette légère', 'low calorie', 'low-calorie', 'peu calorique']::text[]),
  ('quick', 'tag', 'Quick', 'Rapide', array['rapide', 'express', '15 min', '20 min', '30 min', 'quick and easy', 'facile et rapide', 'rapide et facile', 'recette rapide', '30 minute meals', 'under 30 minutes']::text[]),
  ('fancy', 'tag', 'Fancy', 'Chic', array['date night', 'special', 'special occasion', 'festif', 'festive', 'chic', 'recevoir', 'dîner entre amis', 'fête', 'entertaining']::text[]),
  ('treat', 'tag', 'Treat', 'Plaisir', array['gourmand', 'gourmande', 'indulgent', 'plaisir', 'cheat meal']::text[]),
  ('high protein', 'tag', 'High protein', 'Riche en protéines', array['protéiné', 'protéinée', 'riche en protéines', 'protein', 'high-protein', 'hyperprotéiné']::text[]),
  ('healthy', 'tag', 'Healthy', 'Équilibré', array['sain', 'saine', 'équilibré', 'équilibrée', 'healthy eating', 'santé', 'nutritious']::text[]),
  ('make ahead', 'tag', 'Make ahead', 'À préparer à l’avance', array['make-ahead', 'meal prep', 'à l''avance', 'à préparer à l''avance', 'préparer à l''avance', 'se prépare à l''avance']::text[]),
  ('batch cooking', 'tag', 'Batch cooking', 'Batch cooking', array['batch', 'batchcooking', 'big batch', 'cuisine en lot']::text[]),
  ('freezer-friendly', 'tag', 'Freezer-friendly', 'Se congèle', array['freezer friendly', 'freezable', 'se congèle', 'congélation', 'à congeler']::text[]),
  ('budget', 'tag', 'Budget', 'Petit budget', array['cheap', 'on a budget', 'budget friendly', 'budget-friendly', 'petit budget', 'pas cher', 'économique']::text[]),
  ('kid-friendly', 'tag', 'Kid-friendly', 'Pour les enfants', array['kid friendly', 'kids', 'family friendly', 'family-friendly', 'enfants', 'pour les enfants', 'spécial enfants']::text[]),
  ('spicy', 'tag', 'Spicy', 'Épicé', array['épicé', 'épicée', 'pimenté', 'pimentée', 'hot', 'piquant', 'relevé']::text[]),
  ('leftovers', 'tag', 'Leftovers', 'Restes', array['leftover', 'restes', 'anti-gaspi', 'antigaspi', 'zero waste', 'zéro déchet']::text[]),
  ('no-cook', 'tag', 'No-cook', 'Sans cuisson', array['no cook', 'sans cuisson', 'raw', 'cru']::text[]),
  ('starter', 'tag', 'Starter', 'Entrée', array['entrée', 'entrées', 'starters', 'appetizer', 'appetizers', 'appetiser', 'first course']::text[]),
  ('side dish', 'tag', 'Side dish', 'Accompagnement', array['side', 'sides', 'side dishes', 'accompagnement', 'accompagnements', 'garniture']::text[]),
  ('dessert', 'tag', 'Dessert', 'Dessert', array['desserts', 'sweet', 'sucré', 'pudding']::text[]),
  ('breakfast', 'tag', 'Breakfast', 'Petit-déjeuner', array['petit déjeuner', 'petit-déjeuner', 'brunch']::text[]),
  ('snack', 'tag', 'Snack', 'En-cas', array['snacks', 'en-cas', 'goûter', 'collation']::text[]),
  ('aperitif', 'tag', 'Aperitif', 'Apéro', array['apéro', 'apéritif', 'apero', 'finger food', 'tapas', 'amuse-bouche']::text[]),
  ('vegetarian', 'tag', 'Vegetarian', 'Végétarien', array['végétarien', 'végétarienne', 'veggie', 'végé', 'meatless', 'sans viande']::text[]),
  ('vegan', 'tag', 'Vegan', 'Végan', array['végan', 'végane', 'végétalien', 'végétalienne', 'plant-based', 'plant based']::text[]),
  ('gluten-free', 'tag', 'Gluten-free', 'Sans gluten', array['gluten free', 'sans gluten', 'gf']::text[]),
  ('dairy-free', 'tag', 'Dairy-free', 'Sans lactose', array['dairy free', 'sans lactose', 'sans produits laitiers', 'lactose free']::text[]),
  ('low carb', 'tag', 'Low carb', 'Pauvre en glucides', array['low-carb', 'keto', 'cétogène', 'pauvre en glucides', 'faible en glucides']::text[]),
  ('summer', 'tag', 'Summer', 'Été', array['été', 'estival', 'estivale', 'recette d''été', 'summer recipes']::text[]),
  ('autumn', 'tag', 'Autumn', 'Automne', array['automne', 'fall', 'automnal']::text[]),
  ('winter', 'tag', 'Winter', 'Hiver', array['hiver', 'hivernal', 'recette d''hiver']::text[]),
  ('spring', 'tag', 'Spring', 'Printemps', array['printemps', 'printanier']::text[]),
  ('christmas', 'tag', 'Christmas', 'Noël', array['noël', 'christmas dinner', 'repas de noël', 'fêtes de fin d''année']::text[]),
  ('picnic', 'tag', 'Picnic', 'Pique-nique', array['pique-nique', 'piquenique', 'lunchbox', 'lunch box']::text[]),
  ('oven', 'tag', 'Oven', 'Au four', array['au four', 'four', 'baked', 'roast', 'roasted', 'rôti', 'rôtie', 'oven-baked']::text[]),
  ('stew', 'tag', 'Stew', 'Mijoté', array['mijoté', 'mijotée', 'plat mijoté', 'ragoût', 'braise', 'braised', 'braisé', 'casserole', 'daube', 'slow cooked', 'slow-cooked']::text[]),
  ('one-pot', 'tag', 'One-pot', 'Tout-en-un', array['one pot', 'one pan', 'one-pan', 'une seule casserole', 'tout en un']::text[]),
  ('stir-fry', 'tag', 'Stir-fry', 'Sauté au wok', array['stir fry', 'wok', 'sauté', 'sautéed', 'poêlée']::text[]),
  ('grill', 'tag', 'Grill', 'Grillé', array['grillé', 'grillée', 'grilled', 'barbecue', 'bbq', 'plancha']::text[]),
  ('traybake', 'tag', 'Traybake', 'Plaque au four', array['tray bake', 'sheet pan', 'sheet-pan', 'sheet pan dinner', 'à la plaque']::text[]),
  ('bowl', 'tag', 'Bowl', 'Bowl', array['bowls', 'buddha bowl', 'poke', 'poké', 'poke bowl']::text[]),
  ('curry', 'tag', 'Curry', 'Curry', array['curries', 'cari', 'carry', 'dal', 'dahl']::text[]),
  ('soup', 'tag', 'Soup', 'Soupe', array['soupe', 'soupes', 'soups', 'potage', 'velouté', 'bouillon', 'broth']::text[]),
  ('salad', 'tag', 'Salad', 'Salade', array['salade', 'salades', 'salads']::text[]),
  ('pasta', 'ingredient', 'Pasta', 'Pâtes', array['pâtes', 'spaghetti', 'lasagne', 'lasagna', 'penne', 'tagliatelle']::text[]),
  ('noodles', 'ingredient', 'Noodles', 'Nouilles', array['nouilles', 'noodle', 'ramen', 'udon', 'soba', 'pad thai']::text[]),
  ('rice', 'ingredient', 'Rice', 'Riz', array['riz', 'fried rice', 'riz sauté']::text[]),
  ('risotto', 'tag', 'Risotto', 'Risotto', array['risottos']::text[]),
  ('wrap', 'tag', 'Wrap', 'Wrap', array['wraps', 'tortilla', 'burrito', 'fajitas', 'tacos']::text[]),
  ('pizza', 'tag', 'Pizza', 'Pizza', array['pizzas', 'flatbread', 'focaccia']::text[]),
  ('burger', 'tag', 'Burger', 'Burger', array['burgers', 'hamburger']::text[]),
  ('sandwich', 'tag', 'Sandwich', 'Sandwich', array['sandwiches', 'sandwichs', 'toast', 'croque']::text[]),
  ('tart', 'tag', 'Savoury tart', 'Tarte salée', array['quiche', 'quiches', 'tarte salée', 'tourte', 'pie', 'savoury tart', 'savory tart']::text[]),
  ('gratin', 'tag', 'Gratin', 'Gratin', array['gratins', 'gratiné', 'bake']::text[]),
  ('chicken', 'ingredient', 'Chicken', 'Poulet', array['poulet', 'volaille', 'poultry', 'poulets']::text[]),
  ('beef', 'ingredient', 'Beef', 'Bœuf', array['bœuf', 'boeuf', 'steak', 'viande hachée', 'ground beef', 'minced beef']::text[]),
  ('pork', 'ingredient', 'Pork', 'Porc', array['porc', 'cochon']::text[]),
  ('veal', 'ingredient', 'Veal', 'Veau', array['veau']::text[]),
  ('lamb', 'ingredient', 'Lamb', 'Agneau', array['agneau']::text[]),
  ('turkey', 'ingredient', 'Turkey', 'Dinde', array['dinde']::text[]),
  ('duck', 'ingredient', 'Duck', 'Canard', array['canard']::text[]),
  ('fish', 'ingredient', 'Fish', 'Poisson', array['poisson', 'poissons']::text[]),
  ('salmon', 'ingredient', 'Salmon', 'Saumon', array['saumon']::text[]),
  ('cod', 'ingredient', 'Cod', 'Cabillaud', array['cabillaud', 'morue', 'dos de cabillaud']::text[]),
  ('tuna', 'ingredient', 'Tuna', 'Thon', array['thon']::text[]),
  ('seafood', 'ingredient', 'Seafood', 'Fruits de mer', array['fruits de mer', 'shellfish', 'crustacés', 'coquillages', 'moules', 'mussels']::text[]),
  ('prawns', 'ingredient', 'Prawns', 'Crevettes', array['crevettes', 'shrimp', 'shrimps', 'gambas', 'prawn']::text[]),
  ('eggs', 'ingredient', 'Eggs', 'Œufs', array['œufs', 'oeufs', 'œuf', 'egg', 'omelette']::text[]),
  ('tofu', 'ingredient', 'Tofu', 'Tofu', array['tempeh', 'seitan']::text[]),
  ('lentils', 'ingredient', 'Lentils', 'Lentilles', array['lentilles', 'lentil']::text[]),
  ('chickpeas', 'ingredient', 'Chickpeas', 'Pois chiches', array['pois chiches', 'pois chiche', 'chickpea', 'houmous', 'hummus', 'falafel']::text[]),
  ('potatoes', 'ingredient', 'Potatoes', 'Pommes de terre', array['pommes de terre', 'pomme de terre', 'potato', 'patates', 'patate']::text[]),
  ('french', 'tag', 'French', 'Français', array['français', 'française', 'cuisine française', 'france', 'french cuisine', 'bistro', 'bistrot']::text[]),
  ('italian', 'tag', 'Italian', 'Italien', array['italien', 'italienne', 'cuisine italienne', 'italie', 'italy', 'sicilian', 'sicilien']::text[]),
  ('mediterranean', 'tag', 'Mediterranean', 'Méditerranéen', array['méditerranéen', 'méditerranéenne', 'méditerranée', 'cuisine méditerranéenne']::text[]),
  ('spanish', 'tag', 'Spanish', 'Espagnol', array['espagnol', 'espagnole', 'espagne', 'spain']::text[]),
  ('portuguese', 'tag', 'Portuguese', 'Portugais', array['portugais', 'portugaise', 'portugal']::text[]),
  ('greek', 'tag', 'Greek', 'Grec', array['grec', 'grecque', 'grèce', 'greece']::text[]),
  ('turkish', 'tag', 'Turkish', 'Turc', array['turc', 'turque', 'turquie', 'turkey cuisine']::text[]),
  ('british', 'tag', 'British', 'Britannique', array['britannique', 'anglais', 'anglaise', 'english', 'uk', 'england']::text[]),
  ('irish', 'tag', 'Irish', 'Irlandais', array['irlandais', 'irlandaise', 'irlande']::text[]),
  ('german', 'tag', 'German', 'Allemand', array['allemand', 'allemande', 'allemagne', 'germany']::text[]),
  ('belgian', 'tag', 'Belgian', 'Belge', array['belge', 'belgique', 'belgium']::text[]),
  ('swiss', 'tag', 'Swiss', 'Suisse', array['suisse', 'switzerland']::text[]),
  ('swedish', 'tag', 'Swedish', 'Suédois', array['suédois', 'suédoise', 'suède', 'scandinavian', 'scandinave', 'nordic']::text[]),
  ('hungarian', 'tag', 'Hungarian', 'Hongrois', array['hongrois', 'hongroise', 'hongrie']::text[]),
  ('georgian', 'tag', 'Georgian', 'Géorgien', array['géorgien', 'géorgienne', 'géorgie']::text[]),
  ('american', 'tag', 'American', 'Américain', array['américain', 'américaine', 'usa', 'us', 'tex-mex', 'southern', 'cajun']::text[]),
  ('canadian', 'tag', 'Canadian', 'Canadien', array['canadien', 'canadienne', 'québécois', 'quebec']::text[]),
  ('mexican', 'tag', 'Mexican', 'Mexicain', array['mexicain', 'mexicaine', 'mexique', 'mexico']::text[]),
  ('caribbean', 'tag', 'Caribbean', 'Antillais', array['antillais', 'antillaise', 'créole', 'creole', 'jamaican', 'jamaïcain', 'caraïbes']::text[]),
  ('brazilian', 'tag', 'Brazilian', 'Brésilien', array['brésilien', 'brésilienne', 'brésil', 'brazil']::text[]),
  ('peruvian', 'tag', 'Peruvian', 'Péruvien', array['péruvien', 'péruvienne', 'pérou', 'peru']::text[]),
  ('north african', 'tag', 'North African', 'Maghrébin', array['maghrébin', 'maghrébine', 'maghreb', 'algérien', 'algérienne', 'tunisien', 'tunisienne', 'oriental', 'orientale']::text[]),
  ('moroccan', 'tag', 'Moroccan', 'Marocain', array['marocain', 'marocaine', 'maroc', 'morocco', 'tajine', 'tagine']::text[]),
  ('african', 'tag', 'African', 'Africain', array['africain', 'africaine', 'afrique', 'africa', 'senegalese', 'sénégalais', 'west african']::text[]),
  ('ethiopian', 'tag', 'Ethiopian', 'Éthiopien', array['éthiopien', 'éthiopienne', 'éthiopie']::text[]),
  ('middle eastern', 'tag', 'Middle Eastern', 'Moyen-oriental', array['moyen-orient', 'moyen orient', 'moyen-oriental', 'middle east', 'israeli', 'israélien', 'persian', 'persan', 'iranien']::text[]),
  ('lebanese', 'tag', 'Lebanese', 'Libanais', array['libanais', 'libanaise', 'liban', 'mezze']::text[]),
  ('indian', 'tag', 'Indian', 'Indien', array['indien', 'indienne', 'inde', 'india']::text[]),
  ('asian', 'tag', 'Asian', 'Asiatique', array['asiatique', 'asie', 'asia']::text[]),
  ('chinese', 'tag', 'Chinese', 'Chinois', array['chinois', 'chinoise', 'chine', 'china', 'cantonese', 'sichuan', 'szechuan']::text[]),
  ('japanese', 'tag', 'Japanese', 'Japonais', array['japonais', 'japonaise', 'japon', 'japan']::text[]),
  ('korean', 'tag', 'Korean', 'Coréen', array['coréen', 'coréenne', 'corée', 'korea']::text[]),
  ('thai', 'tag', 'Thai', 'Thaï', array['thaï', 'thaïlandais', 'thaïlandaise', 'thaïlande', 'thailand']::text[]),
  ('vietnamese', 'tag', 'Vietnamese', 'Vietnamien', array['vietnamien', 'vietnamienne', 'vietnam', 'viêt nam']::text[]),
  ('indonesian', 'tag', 'Indonesian', 'Indonésien', array['indonésien', 'indonésienne', 'indonésie', 'indonesia']::text[]),
  ('malaysian', 'tag', 'Malaysian', 'Malaisien', array['malaisien', 'malaisienne', 'malaisie', 'malaysia']::text[]),
  ('filipino', 'tag', 'Filipino', 'Philippin', array['philippin', 'philippine', 'philippines']::text[]),
  ('taiwanese', 'tag', 'Taiwanese', 'Taïwanais', array['taïwanais', 'taïwanaise', 'taïwan', 'taiwan']::text[]),
  ('dinner', 'noise', null, null, array['lunch', 'supper', 'main', 'mains', 'main course', 'main courses', 'main dish', 'main dishes', 'recipe', 'recipes', 'easy', 'easy recipe', 'easy recipes', 'homemade', 'family', 'weeknight', 'weeknight dinner', 'dîner', 'déjeuner', 'plat', 'plats', 'plat principal', 'plats principaux', 'recette', 'recettes', 'facile', 'recette facile', 'fait maison', 'cuisine', 'cuisine du monde', 'world cuisine']::text[])
on conflict (name) where household_id is null do update
  set kind = excluded.kind, name_en = excluded.name_en, name_fr = excluded.name_fr, aliases = excluded.aliases;

-- The catalogue row some words name for a household: shared rows first, then
-- its own. Mirrors TagCatalog.find() in _shared/logic/tags.ts.
create or replace function public.find_tag(p_household uuid, p_text text)
returns public.tag_catalog
language sql stable set search_path = ''
as $$
  select t.* from public.tag_catalog t
  where (t.household_id is null or t.household_id = p_household)
    and public.product_key(p_text) in (
      select public.product_key(x) from unnest(array[t.name, t.name_en, t.name_fr] || t.aliases) x)
  order by t.household_id nulls first
  limit 1
$$;

-- Existing recipes: known words become their tag, ingredients and noise go,
-- and a household's other tags become its own tags, labelled in the recipe's
-- language (as TagCatalog.normalise() and import-recipe do).
insert into public.tag_catalog (household_id, name, name_en, name_fr)
select distinct on (r.household_id, n.name) r.household_id, n.name,
  case when r.language = 'en' then upper(left(n.name, 1)) || substr(n.name, 2) end,
  case when r.language = 'fr' then upper(left(n.name, 1)) || substr(n.name, 2) end
from public.recipes r
cross join lateral unnest(r.tags) t
cross join lateral (select left(regexp_replace(lower(trim(t)), '\s+', ' ', 'g'), 40) as name) n
where r.household_id is not null
  and public.product_key(t) <> ''
  and (public.find_tag(r.household_id, t)).name is null
on conflict do nothing;

update public.recipes r set tags = coalesce((
  select array_agg(name order by first) from (
    select name, min(ord) as first from (
      select f.name, u.ord
      from unnest(r.tags) with ordinality u(t, ord)
      cross join lateral (select (public.find_tag(r.household_id, u.t)).*) f
      where f.kind = 'tag'
    ) named group by name order by first limit 12
  ) kept), '{}')
where cardinality(r.tags) > 0;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.tag_catalog;
  end if;
end $$;
