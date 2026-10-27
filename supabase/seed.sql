-- Ingredient catalogue and a small starter library so decks work in development.
-- Nutrition values are approximate per 100 g (raw), good enough for estimates.
-- The real seed library (a few hundred recipes) is imported with
-- scripts/seed-import.ts once the owner picks the sources.

insert into public.ingredient_catalog
  (name, name_fr, aliases, default_aisle, is_staple, kcal_100g, protein_100g, grams_per_unit, diet_class)
values
  -- staples
  ('olive oil', 'huile d''olive', '{oil,huile}', 'pantry', true, 884, 0, 14, 'veg'),
  ('salt', 'sel', '{sel,sea salt}', 'spices', true, 0, 0, 6, 'veg'),
  ('black pepper', 'poivre noir', '{pepper,poivre}', 'spices', true, 251, 10, 2, 'veg'),
  ('garlic', 'ail', '{garlic clove,gousse d''ail}', 'produce', true, 149, 6.4, 5, 'veg'),
  ('chicken stock', 'bouillon de volaille', '{stock,broth,bouillon,vegetable stock}', 'pantry', true, 7, 1, 240, 'veg'),
  ('butter', 'beurre', '{}', 'dairy_eggs', true, 717, 0.9, 14, 'veg'),
  ('soy sauce', 'sauce soja', '{soja}', 'pantry', true, 53, 8, 16, 'veg'),
  ('flour', 'farine', '{all-purpose flour}', 'pantry', true, 364, 10, 8, 'veg'),
  ('sugar', 'sucre', '{}', 'pantry', true, 387, 0, 4, 'veg'),
  ('cumin', 'cumin', '{ground cumin}', 'spices', true, 375, 18, 2, 'veg'),
  ('paprika', 'paprika', '{smoked paprika}', 'spices', true, 282, 14, 2, 'veg'),
  ('chili flakes', 'piment', '{chilli flakes,red pepper flakes}', 'spices', true, 318, 12, 1, 'veg'),
  ('dried oregano', 'origan', '{oregano}', 'spices', true, 265, 9, 1, 'veg'),
  ('vinegar', 'vinaigre', '{red wine vinegar,balsamic vinegar}', 'pantry', true, 19, 0, 15, 'veg'),
  -- produce
  ('onion', 'oignon', '{yellow onion,red onion}', 'produce', false, 40, 1.1, 150, 'veg'),
  ('shallot', 'échalote', '{}', 'produce', false, 72, 2.5, 40, 'veg'),
  ('tomato', 'tomate', '{tomatoes,tomates}', 'produce', false, 18, 0.9, 120, 'veg'),
  ('cherry tomatoes', 'tomates cerises', '{}', 'produce', false, 18, 0.9, 15, 'veg'),
  ('spinach', 'épinards', '{baby spinach}', 'produce', false, 23, 2.9, 30, 'veg'),
  ('broccoli', 'brocoli', '{}', 'produce', false, 34, 2.8, 300, 'veg'),
  ('zucchini', 'courgette', '{courgette}', 'produce', false, 17, 1.2, 200, 'veg'),
  ('bell pepper', 'poivron', '{red pepper,poivron rouge}', 'produce', false, 31, 1, 160, 'veg'),
  ('carrot', 'carotte', '{carrots}', 'produce', false, 41, 0.9, 70, 'veg'),
  ('potato', 'pomme de terre', '{potatoes,pommes de terre}', 'produce', false, 77, 2, 170, 'veg'),
  ('sweet potato', 'patate douce', '{}', 'produce', false, 86, 1.6, 200, 'veg'),
  ('mushrooms', 'champignons', '{mushroom,champignon}', 'produce', false, 22, 3.1, 20, 'veg'),
  ('lemon', 'citron', '{lemon juice}', 'produce', false, 29, 1.1, 100, 'veg'),
  ('lime', 'citron vert', '{}', 'produce', false, 30, 0.7, 60, 'veg'),
  ('avocado', 'avocat', '{}', 'produce', false, 160, 2, 170, 'veg'),
  ('cucumber', 'concombre', '{}', 'produce', false, 15, 0.7, 300, 'veg'),
  ('ginger', 'gingembre', '{}', 'produce', false, 80, 1.8, 10, 'veg'),
  ('fresh basil', 'basilic', '{basil}', 'produce', false, 23, 3.2, 1, 'veg'),
  ('fresh coriander', 'coriandre', '{cilantro,coriander}', 'produce', false, 23, 2.1, 1, 'veg'),
  ('parsley', 'persil', '{}', 'produce', false, 36, 3, 1, 'veg'),
  ('spring onion', 'oignon nouveau', '{scallion,green onion}', 'produce', false, 32, 1.8, 15, 'veg'),
  ('leek', 'poireau', '{}', 'produce', false, 61, 1.5, 150, 'veg'),
  ('eggplant', 'aubergine', '{aubergine}', 'produce', false, 25, 1, 300, 'veg'),
  ('lettuce', 'salade', '{salad leaves,laitue}', 'produce', false, 15, 1.4, 300, 'veg'),
  -- meat & fish
  ('chicken breast', 'blanc de poulet', '{chicken,poulet,filet de poulet}', 'meat_fish', false, 120, 22.5, 150, 'meat'),
  ('chicken thigh', 'cuisse de poulet', '{haut de cuisse}', 'meat_fish', false, 177, 18, 120, 'meat'),
  ('ground beef', 'bœuf haché', '{minced beef,steak haché,boeuf haché}', 'meat_fish', false, 250, 26, 100, 'meat'),
  ('pork tenderloin', 'filet mignon de porc', '{pork}', 'meat_fish', false, 143, 21, 400, 'meat'),
  ('bacon', 'lardons', '{pancetta}', 'meat_fish', false, 417, 13, 15, 'meat'),
  ('salmon fillet', 'pavé de saumon', '{salmon,saumon}', 'meat_fish', false, 208, 20, 130, 'fish'),
  ('cod fillet', 'dos de cabillaud', '{cod,cabillaud}', 'meat_fish', false, 82, 18, 140, 'fish'),
  ('prawns', 'crevettes', '{shrimp}', 'meat_fish', false, 99, 24, 12, 'fish'),
  ('tuna', 'thon', '{canned tuna}', 'pantry', false, 116, 26, 140, 'fish'),
  -- dairy & eggs
  ('eggs', 'œufs', '{egg,oeufs,oeuf}', 'dairy_eggs', false, 143, 12.6, 55, 'veg'),
  ('greek yogurt', 'yaourt grec', '{yogurt,yaourt}', 'dairy_eggs', false, 97, 9, 150, 'veg'),
  ('parmesan', 'parmesan', '{parmigiano}', 'dairy_eggs', false, 431, 38, 5, 'veg'),
  ('feta', 'feta', '{}', 'dairy_eggs', false, 264, 14, 200, 'veg'),
  ('mozzarella', 'mozzarella', '{}', 'dairy_eggs', false, 280, 28, 125, 'veg'),
  ('crème fraîche', 'crème fraîche', '{cream,heavy cream,creme fraiche}', 'dairy_eggs', false, 292, 2.4, 15, 'veg'),
  ('milk', 'lait', '{}', 'dairy_eggs', false, 50, 3.4, 240, 'veg'),
  ('coconut milk', 'lait de coco', '{}', 'pantry', false, 197, 2.2, 400, 'veg'),
  ('tofu', 'tofu', '{firm tofu}', 'dairy_eggs', false, 144, 15.7, 200, 'veg'),
  -- pantry
  ('rice', 'riz', '{basmati rice,jasmine rice,riz basmati}', 'pantry', false, 360, 7, 75, 'veg'),
  ('pasta', 'pâtes', '{spaghetti,penne,linguine,pates}', 'pantry', false, 371, 13, 85, 'veg'),
  ('noodles', 'nouilles', '{rice noodles,egg noodles}', 'pantry', false, 364, 6, 85, 'veg'),
  ('couscous', 'semoule', '{}', 'pantry', false, 376, 13, 75, 'veg'),
  ('quinoa', 'quinoa', '{}', 'pantry', false, 368, 14, 75, 'veg'),
  ('red lentils', 'lentilles corail', '{lentils,lentilles}', 'pantry', false, 358, 24, 75, 'veg'),
  ('chickpeas', 'pois chiches', '{canned chickpeas}', 'pantry', false, 139, 7, 240, 'veg'),
  ('black beans', 'haricots noirs', '{beans}', 'pantry', false, 132, 8.9, 240, 'veg'),
  ('canned tomatoes', 'tomates concassées', '{crushed tomatoes,tomates pelées,passata}', 'pantry', false, 32, 1.6, 400, 'veg'),
  ('tomato paste', 'concentré de tomate', '{}', 'pantry', false, 82, 4.3, 16, 'veg'),
  ('curry paste', 'pâte de curry', '{red curry paste,green curry paste}', 'pantry', false, 140, 3, 15, 'veg'),
  ('tortillas', 'tortillas', '{wraps}', 'bakery', false, 310, 8, 60, 'veg'),
  ('bread', 'pain', '{baguette,sourdough}', 'bakery', false, 265, 9, 30, 'veg'),
  ('pesto', 'pesto', '{}', 'pantry', false, 400, 5, 15, 'veg'),
  ('honey', 'miel', '{}', 'pantry', false, 304, 0.3, 21, 'veg'),
  ('sesame oil', 'huile de sésame', '{}', 'pantry', false, 884, 0, 14, 'veg'),
  ('peanut butter', 'beurre de cacahuète', '{}', 'pantry', false, 588, 25, 16, 'veg'),
  ('frozen peas', 'petits pois surgelés', '{peas,petits pois}', 'frozen', false, 81, 5.4, 150, 'veg')
on conflict (name) do nothing;

-- Starter library. Macros are per serving and marked as estimated.
with r (title, tags, mins, kcal, protein, steps, ingredients) as (values
  ('Lemon chicken with spinach rice', '{chicken,rice,quick,light}'::text[], 30, 560, 42,
   '["Cook the rice.","Season and pan-fry the chicken in olive oil, 6 min per side.","Wilt the spinach with garlic and lemon, stir into the rice.","Slice the chicken over the rice."]',
   '[["chicken breast",300,"g"],["rice",150,"g"],["spinach",150,"g"],["lemon",1,"piece"],["garlic",2,"clove"],["olive oil",1,"tbsp"]]'),
  ('Salmon, broccoli and sesame noodles', '{fish,noodles,quick,asian}', 25, 640, 38,
   '["Roast the salmon at 200°C for 12 min.","Boil noodles and broccoli together for 4 min.","Toss with soy sauce, sesame oil and ginger.","Flake the salmon on top."]',
   '[["salmon fillet",260,"g"],["noodles",150,"g"],["broccoli",250,"g"],["soy sauce",2,"tbsp"],["sesame oil",1,"tbsp"],["ginger",10,"g"]]'),
  ('Red lentil coconut dal', '{vegetarian,lentils,comfort,curry}', 35, 520, 24,
   '["Soften onion, garlic and ginger.","Add lentils, coconut milk, canned tomatoes and cumin.","Simmer 20 min, season, serve with rice."]',
   '[["red lentils",200,"g"],["coconut milk",200,"ml"],["canned tomatoes",400,"g"],["onion",1,"piece"],["garlic",2,"clove"],["ginger",10,"g"],["cumin",1,"tsp"],["rice",120,"g"]]'),
  ('Beef and black bean tacos', '{beef,mexican,quick,comfort}', 25, 690, 40,
   '["Brown the beef with onion, cumin and paprika.","Add black beans and a splash of water, cook 5 min.","Warm tortillas, fill with beef, avocado and lime."]',
   '[["ground beef",300,"g"],["black beans",240,"g"],["tortillas",6,"piece"],["onion",1,"piece"],["avocado",1,"piece"],["lime",1,"piece"],["cumin",1,"tsp"],["paprika",1,"tsp"]]'),
  ('Prawn and courgette linguine', '{fish,pasta,quick}', 20, 610, 36,
   '["Cook the pasta.","Sauté prawns with garlic and chili flakes.","Add grated courgette and lemon, toss with pasta and some cooking water."]',
   '[["prawns",250,"g"],["pasta",180,"g"],["zucchini",1,"piece"],["garlic",2,"clove"],["lemon",1,"piece"],["chili flakes",1,"pinch"],["olive oil",2,"tbsp"]]'),
  ('Chickpea, feta and roasted veg traybake', '{vegetarian,traybake,light,mediterranean}', 40, 540, 22,
   '["Roast peppers, courgette and onion with chickpeas and oregano at 210°C for 25 min.","Crumble feta on top and roast 5 min more."]',
   '[["chickpeas",240,"g"],["feta",150,"g"],["bell pepper",2,"piece"],["zucchini",1,"piece"],["onion",1,"piece"],["dried oregano",1,"tsp"],["olive oil",2,"tbsp"]]'),
  ('Chicken thigh red curry', '{chicken,curry,comfort,asian}', 35, 680, 38,
   '["Fry curry paste in a little oil.","Add chicken, then coconut milk; simmer 15 min.","Add peppers and spinach, serve with rice and lime."]',
   '[["chicken thigh",350,"g"],["curry paste",2,"tbsp"],["coconut milk",400,"ml"],["bell pepper",1,"piece"],["spinach",100,"g"],["rice",150,"g"],["lime",1,"piece"]]'),
  ('Mushroom and spinach omelette', '{vegetarian,eggs,quick,light}', 15, 420, 30,
   '["Sauté mushrooms and spinach in butter.","Pour in beaten eggs, cook until just set, fold with parmesan."]',
   '[["eggs",6,"piece"],["mushrooms",200,"g"],["spinach",100,"g"],["parmesan",30,"g"],["butter",1,"tbsp"]]'),
  ('Cod with tomato and olive sauce', '{fish,light,mediterranean}', 25, 430, 40,
   '["Simmer canned tomatoes with garlic and oregano for 10 min.","Nestle the cod in, cover and cook 8 min.","Serve with potatoes or bread."]',
   '[["cod fillet",320,"g"],["canned tomatoes",400,"g"],["garlic",2,"clove"],["dried oregano",1,"tsp"],["potato",400,"g"],["olive oil",1,"tbsp"]]'),
  ('Tofu and broccoli stir-fry', '{vegetarian,tofu,quick,asian}', 20, 520, 28,
   '["Crisp cubed tofu in a hot pan.","Stir-fry broccoli, ginger and garlic.","Add soy sauce and honey, toss with tofu, serve on rice."]',
   '[["tofu",300,"g"],["broccoli",300,"g"],["ginger",10,"g"],["garlic",2,"clove"],["soy sauce",3,"tbsp"],["honey",1,"tbsp"],["rice",150,"g"]]'),
  ('Pesto pasta with peas and parmesan', '{vegetarian,pasta,quick,comfort}', 15, 650, 24,
   '["Cook the pasta, adding peas for the last 2 minutes.","Toss with pesto, parmesan and lemon."]',
   '[["pasta",200,"g"],["frozen peas",150,"g"],["pesto",60,"g"],["parmesan",30,"g"],["lemon",1,"piece"]]'),
  ('Pork tenderloin with sweet potato mash', '{pork,comfort}', 40, 590, 44,
   '["Sear the pork, roast at 200°C for 18 min.","Boil and mash the sweet potato with butter.","Rest and slice the pork."]',
   '[["pork tenderloin",400,"g"],["sweet potato",500,"g"],["butter",1,"tbsp"],["paprika",1,"tsp"]]'),
  ('Greek chicken bowls', '{chicken,bowl,light,mediterranean}', 30, 580, 46,
   '["Marinate chicken in yogurt, lemon and oregano, then grill.","Cook couscous.","Serve with cucumber, tomato and a spoon of yogurt."]',
   '[["chicken breast",320,"g"],["greek yogurt",150,"g"],["couscous",120,"g"],["cucumber",1,"piece"],["tomato",2,"piece"],["lemon",1,"piece"],["dried oregano",1,"tsp"]]'),
  ('Shakshuka', '{vegetarian,eggs,comfort}', 30, 410, 22,
   '["Soften onion and pepper with cumin and paprika.","Add canned tomatoes, simmer 10 min.","Crack in eggs, cover until set, top with feta and parsley."]',
   '[["eggs",5,"piece"],["canned tomatoes",400,"g"],["onion",1,"piece"],["bell pepper",1,"piece"],["feta",80,"g"],["cumin",1,"tsp"],["paprika",1,"tsp"],["parsley",5,"g"],["bread",120,"g"]]')
),
inserted as (
  insert into public.recipes (household_id, title, source_type, servings, total_min, steps, tags,
                              kcal_per_serving, protein_g_per_serving, macros_estimated, language)
  select null, r.title, 'seed', 2, r.mins, r.steps::jsonb, r.tags, r.kcal, r.protein, true, 'en'
  from r
  where not exists (select 1 from public.recipes x where x.household_id is null and x.title = r.title)
  returning id, title
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle, is_staple)
select i.id, ord::int - 1, e ->> 0, (e ->> 1)::real, e ->> 2,
       coalesce(c.default_aisle, 'other'), coalesce(c.is_staple, false)
from inserted i
join r on r.title = i.title
cross join lateral jsonb_array_elements(r.ingredients::jsonb) with ordinality as t(e, ord)
left join public.ingredient_catalog c on c.name = e ->> 0;
