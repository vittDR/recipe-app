-- Ingredient catalogue. Nutrition values are approximate per 100 g (raw),
-- good enough for estimates. The recipes are in seed_library.sql, generated
-- from seed/recipes.json by scripts/build-seed-library.ts.

insert into public.ingredient_catalog
  (name, name_fr, aliases, default_aisle, is_staple, kcal_100g, protein_100g, grams_per_unit, diet_class)
values
  -- staples
  ('olive oil', 'huile d''olive', '{oil,huile}', 'pantry', true, 884, 0, 14, 'veg'),
  ('salt', 'sel', '{sel,sea salt}', 'spices', true, 0, 0, 6, 'veg'),
  ('black pepper', 'poivre noir', '{pepper,poivre}', 'spices', true, 251, 10, 2, 'veg'),
  ('garlic', 'ail', '{garlic clove,gousse d''ail}', 'produce', true, 149, 6.4, 5, 'veg'),
  ('chicken stock', 'bouillon de volaille', '{stock,broth,bouillon,vegetable stock}', 'pantry', true, 7, 1, 240, 'meat'),
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

-- Italian names and extra IT/FR aliases for the catalogue above.
update public.ingredient_catalog set name_it = 'avocado' where name = 'avocado';
update public.ingredient_catalog set name_it = 'pancetta', aliases = (select array(select distinct unnest(aliases || '{"guanciale"}'::text[]))) where name = 'bacon';
update public.ingredient_catalog set name_it = 'peperone', aliases = (select array(select distinct unnest(aliases || '{"peperoni"}'::text[]))) where name = 'bell pepper';
update public.ingredient_catalog set name_it = 'fagioli neri', aliases = (select array(select distinct unnest(aliases || '{"fagioli"}'::text[]))) where name = 'black beans';
update public.ingredient_catalog set name_it = 'pepe nero', aliases = (select array(select distinct unnest(aliases || '{"pepe"}'::text[]))) where name = 'black pepper';
update public.ingredient_catalog set name_it = 'pane' where name = 'bread';
update public.ingredient_catalog set name_it = 'broccoli' where name = 'broccoli';
update public.ingredient_catalog set name_it = 'burro' where name = 'butter';
update public.ingredient_catalog set name_it = 'pomodori pelati', aliases = (select array(select distinct unnest(aliases || '{"pelati","polpa di pomodoro"}'::text[]))) where name = 'canned tomatoes';
update public.ingredient_catalog set name_it = 'carota', aliases = (select array(select distinct unnest(aliases || '{"carote"}'::text[]))) where name = 'carrot';
update public.ingredient_catalog set name_it = 'pomodorini' where name = 'cherry tomatoes';
update public.ingredient_catalog set name_it = 'petto di pollo', aliases = (select array(select distinct unnest(aliases || '{"pollo"}'::text[]))) where name = 'chicken breast';
update public.ingredient_catalog set name_it = 'brodo', aliases = (select array(select distinct unnest(aliases || '{"brodo di pollo"}'::text[]))) where name = 'chicken stock';
update public.ingredient_catalog set name_it = 'sovracosce di pollo', aliases = (select array(select distinct unnest(aliases || '{"cosce di pollo"}'::text[]))) where name = 'chicken thigh';
update public.ingredient_catalog set name_it = 'ceci' where name = 'chickpeas';
update public.ingredient_catalog set name_it = 'peperoncino' where name = 'chili flakes';
update public.ingredient_catalog set name_it = 'latte di cocco' where name = 'coconut milk';
update public.ingredient_catalog set name_it = 'merluzzo' where name = 'cod fillet';
update public.ingredient_catalog set name_it = 'cous cous' where name = 'couscous';
update public.ingredient_catalog set name_it = 'crème fraîche' where name = 'crème fraîche';
update public.ingredient_catalog set name_it = 'cetriolo' where name = 'cucumber';
update public.ingredient_catalog set name_it = 'cumino' where name = 'cumin';
update public.ingredient_catalog set name_it = 'pasta di curry' where name = 'curry paste';
update public.ingredient_catalog set name_it = 'origano' where name = 'dried oregano';
update public.ingredient_catalog set name_it = 'melanzana', aliases = (select array(select distinct unnest(aliases || '{"melanzane"}'::text[]))) where name = 'eggplant';
update public.ingredient_catalog set name_it = 'uova', aliases = (select array(select distinct unnest(aliases || '{"uovo"}'::text[]))) where name = 'eggs';
update public.ingredient_catalog set name_it = 'feta' where name = 'feta';
update public.ingredient_catalog set name_it = 'farina' where name = 'flour';
update public.ingredient_catalog set name_it = 'basilico' where name = 'fresh basil';
update public.ingredient_catalog set name_it = 'coriandolo' where name = 'fresh coriander';
update public.ingredient_catalog set name_it = 'piselli' where name = 'frozen peas';
update public.ingredient_catalog set name_it = 'aglio' where name = 'garlic';
update public.ingredient_catalog set name_it = 'zenzero' where name = 'ginger';
update public.ingredient_catalog set name_it = 'yogurt greco' where name = 'greek yogurt';
update public.ingredient_catalog set name_it = 'macinato di manzo', aliases = (select array(select distinct unnest(aliases || '{"carne macinata"}'::text[]))) where name = 'ground beef';
update public.ingredient_catalog set name_it = 'miele' where name = 'honey';
update public.ingredient_catalog set name_it = 'porro' where name = 'leek';
update public.ingredient_catalog set name_it = 'limone', aliases = (select array(select distinct unnest(aliases || '{"succo di limone"}'::text[]))) where name = 'lemon';
update public.ingredient_catalog set name_it = 'lattuga', aliases = (select array(select distinct unnest(aliases || '{"insalata"}'::text[]))) where name = 'lettuce';
update public.ingredient_catalog set name_it = 'lime' where name = 'lime';
update public.ingredient_catalog set name_it = 'latte' where name = 'milk';
update public.ingredient_catalog set name_it = 'mozzarella' where name = 'mozzarella';
update public.ingredient_catalog set name_it = 'funghi' where name = 'mushrooms';
update public.ingredient_catalog set name_it = 'noodles' where name = 'noodles';
update public.ingredient_catalog set name_it = 'olio d''oliva', aliases = (select array(select distinct unnest(aliases || '{"olio extravergine di oliva","olio evo"}'::text[]))) where name = 'olive oil';
update public.ingredient_catalog set name_it = 'cipolla' where name = 'onion';
update public.ingredient_catalog set name_it = 'paprika' where name = 'paprika';
update public.ingredient_catalog set name_it = 'parmigiano', aliases = (select array(select distinct unnest(aliases || '{"parmigiano reggiano","grana padano"}'::text[]))) where name = 'parmesan';
update public.ingredient_catalog set name_it = 'prezzemolo' where name = 'parsley';
update public.ingredient_catalog set name_it = 'pasta', aliases = (select array(select distinct unnest(aliases || '{"fusilli","rigatoni"}'::text[]))) where name = 'pasta';
update public.ingredient_catalog set name_it = 'burro di arachidi' where name = 'peanut butter';
update public.ingredient_catalog set name_it = 'pesto' where name = 'pesto';
update public.ingredient_catalog set name_it = 'filetto di maiale', aliases = (select array(select distinct unnest(aliases || '{"maiale"}'::text[]))) where name = 'pork tenderloin';
update public.ingredient_catalog set name_it = 'patata', aliases = (select array(select distinct unnest(aliases || '{"patate"}'::text[]))) where name = 'potato';
update public.ingredient_catalog set name_it = 'gamberi', aliases = (select array(select distinct unnest(aliases || '{"gamberetti"}'::text[]))) where name = 'prawns';
update public.ingredient_catalog set name_it = 'quinoa' where name = 'quinoa';
update public.ingredient_catalog set name_it = 'lenticchie rosse', aliases = (select array(select distinct unnest(aliases || '{"lenticchie rosse"}'::text[]))) where name = 'red lentils';
update public.ingredient_catalog set name_it = 'riso', aliases = (select array(select distinct unnest(aliases || '{"riso carnaroli","riso arborio"}'::text[]))) where name = 'rice';
update public.ingredient_catalog set name_it = 'salmone', aliases = (select array(select distinct unnest(aliases || '{"filetto di salmone"}'::text[]))) where name = 'salmon fillet';
update public.ingredient_catalog set name_it = 'sale' where name = 'salt';
update public.ingredient_catalog set name_it = 'olio di sesamo' where name = 'sesame oil';
update public.ingredient_catalog set name_it = 'scalogno' where name = 'shallot';
update public.ingredient_catalog set name_it = 'salsa di soia' where name = 'soy sauce';
update public.ingredient_catalog set name_it = 'spinaci' where name = 'spinach';
update public.ingredient_catalog set name_it = 'cipollotto' where name = 'spring onion';
update public.ingredient_catalog set name_it = 'zucchero' where name = 'sugar';
update public.ingredient_catalog set name_it = 'patata dolce' where name = 'sweet potato';
update public.ingredient_catalog set name_it = 'tofu' where name = 'tofu';
update public.ingredient_catalog set name_it = 'pomodoro', aliases = (select array(select distinct unnest(aliases || '{"pomodori"}'::text[]))) where name = 'tomato';
update public.ingredient_catalog set name_it = 'concentrato di pomodoro' where name = 'tomato paste';
update public.ingredient_catalog set name_it = 'tortillas' where name = 'tortillas';
update public.ingredient_catalog set name_it = 'tonno' where name = 'tuna';
update public.ingredient_catalog set name_it = 'aceto' where name = 'vinegar';
update public.ingredient_catalog set name_it = 'zucchina', aliases = (select array(select distinct unnest(aliases || '{"zucchine"}'::text[]))) where name = 'zucchini';

-- Ingredients the seed library needs (kcal/protein per 100 g raw, approximate).
insert into public.ingredient_catalog
  (name, name_fr, name_it, aliases, default_aisle, is_staple, kcal_100g, protein_100g, grams_per_unit, diet_class)
values
  ('allspice', 'piment de la Jamaïque', 'pimento giamaicano', '{"ground allspice"}', 'spices', true, 263, 6.1, null, 'veg'),
  ('almonds', 'amandes', 'mandorle', '{"ground almonds"}', 'pantry', false, 579, 21, null, 'veg'),
  ('apple', 'pomme', 'mela', '{"green apple"}', 'produce', false, 52, 0.3, null, 'veg'),
  ('arugula', 'roquette', 'rucola', '{"rocket","rughetta"}', 'produce', false, 25, 2.6, null, 'veg'),
  ('baking powder', 'levure chimique', 'lievito in polvere', '{}', 'pantry', true, 53, 0, null, 'veg'),
  ('baking soda', 'bicarbonate', 'bicarbonato', '{}', 'pantry', true, 0, 0, null, 'veg'),
  ('barley', 'orge', 'orzo', '{"pearl barley","spelt"}', 'pantry', false, 352, 9.9, null, 'veg'),
  ('bay leaf', 'laurier', 'alloro', '{"bay leaves","feuille de laurier","foglia di alloro","laurel"}', 'spices', true, 313, 7.6, 0.2, 'veg'),
  ('bean sprouts', 'germes de soja', 'germogli di soia', '{"mung bean sprouts"}', 'produce', false, 30, 3, null, 'veg'),
  ('beef steak', 'steak de bœuf', 'bistecca di manzo', '{"beef fillet","beef strips","beef tenderloin","bistecca","entrecôte","flank steak","manzo","rump steak","sirloin","sirloin steak","skirt steak","sliced beef","steak"}', 'meat_fish', false, 165, 21.5, null, 'meat'),
  ('beef stew meat', 'bœuf à braiser', 'spezzatino di manzo', '{"beef chuck","braising beef","chuck steak","stewing beef"}', 'meat_fish', false, 180, 19, null, 'meat'),
  ('berbere', 'berbéré', 'berberè', '{"berbere spice"}', 'spices', true, 300, 12, null, 'veg'),
  ('bok choy', 'pak-choï', 'pak choi', '{}', 'produce', false, 13, 1.5, 120, 'veg'),
  ('bouquet garni', 'bouquet garni', 'mazzetto aromatico', '{}', 'spices', true, 50, 2, 10, 'veg'),
  ('breadcrumbs', 'chapelure', 'pangrattato', '{"bread crumbs","pan grattato"}', 'pantry', false, 395, 13, null, 'veg'),
  ('cabbage', 'chou', 'cavolo', '{"green cabbage","pointed cabbage","white cabbage"}', 'produce', false, 25, 1.3, null, 'veg'),
  ('cajun seasoning', 'épices cajun', 'spezie cajun', '{"cajun spice"}', 'spices', true, 260, 10, null, 'veg'),
  ('capers', 'câpres', 'capperi', '{}', 'pantry', false, 23, 2.4, null, 'veg'),
  ('cardamom', 'cardamome', 'cardamomo', '{"ground cardamom"}', 'spices', true, 311, 11, null, 'veg'),
  ('cashews', 'noix de cajou', 'anacardi', '{"cashew nuts"}', 'pantry', false, 553, 18, null, 'veg'),
  ('cauliflower', 'chou-fleur', 'cavolfiore', '{}', 'produce', false, 25, 1.9, 600, 'veg'),
  ('celery', 'céleri', 'sedano', '{"celery stalk"}', 'produce', false, 16, 0.7, 40, 'veg'),
  ('cheese curds', 'fromage en grains', 'cagliata', '{"squeaky cheese"}', 'dairy_eggs', false, 370, 23, null, 'veg'),
  ('chicken wings', 'ailes de poulet', 'ali di pollo', '{}', 'meat_fish', false, 190, 18, null, 'meat'),
  ('chili powder', 'piment en poudre', 'chili in polvere', '{"chili powder blend"}', 'spices', true, 282, 13.5, null, 'veg'),
  ('chives', 'ciboulette', 'erba cipollina', '{}', 'produce', false, 30, 3.3, null, 'veg'),
  ('chorizo', 'chorizo', 'chorizo', '{"cooking chorizo"}', 'meat_fish', false, 455, 24, null, 'meat'),
  ('cinnamon', 'cannelle', 'cannella', '{"cinnamon stick","ground cinnamon"}', 'spices', true, 247, 4, 3, 'veg'),
  ('clams', 'palourdes', 'vongole', '{"vongole veraci"}', 'meat_fish', false, 22, 4, null, 'fish'),
  ('cloves', 'clou de girofle', 'chiodi di garofano', '{"clove powder","clove spice","ground cloves","whole cloves"}', 'spices', true, 274, 6, 0.1, 'veg'),
  ('coriander seeds', 'graines de coriandre', 'semi di coriandolo', '{"coriander powder","ground coriander"}', 'spices', true, 298, 12, null, 'veg'),
  ('corn', 'maïs', 'mais', '{"baby corn","sweet corn","sweetcorn"}', 'pantry', false, 86, 3.3, null, 'veg'),
  ('cornstarch', 'fécule de maïs', 'amido di mais', '{"corn starch","cornflour","maizena","potato starch"}', 'pantry', true, 381, 0.3, null, 'veg'),
  ('cream cheese', 'fromage frais à tartiner', 'formaggio spalmabile', '{"light cream cheese"}', 'dairy_eggs', false, 253, 7, null, 'veg'),
  ('curry powder', 'curry en poudre', 'curry in polvere', '{"curry","korean curry powder"}', 'spices', true, 325, 14, null, 'veg'),
  ('desiccated coconut', 'noix de coco râpée', 'cocco rapè', '{"shredded coconut"}', 'pantry', false, 660, 6.9, null, 'veg'),
  ('dijon mustard', 'moutarde de Dijon', 'senape di Digione', '{"dijon"}', 'pantry', true, 150, 7, null, 'veg'),
  ('dill', 'aneth', 'aneto', '{"fresh dill"}', 'produce', false, 43, 3.5, 30, 'veg'),
  ('dried fenugreek leaves', 'feuilles de fenugrec', 'foglie di fieno greco', '{"kasuri methi"}', 'spices', true, 320, 23, null, 'veg'),
  ('dry yeast', 'levure sèche', 'lievito secco', '{"instant yeast"}', 'pantry', true, 325, 40, null, 'veg'),
  ('emmental', 'emmental', 'emmental', '{"fol épi","swiss cheese"}', 'dairy_eggs', false, 380, 28, null, 'veg'),
  ('farro', 'épeautre', 'farro', '{"farro perlato"}', 'pantry', false, 340, 14, null, 'veg'),
  ('fish sauce', 'sauce de poisson', 'salsa di pesce', '{"nam pla","nuoc mam","sauce poisson"}', 'pantry', true, 35, 5, null, 'fish'),
  ('five-spice', 'cinq-épices', 'cinque spezie', '{"chinese five spice","five spice powder"}', 'spices', true, 347, 10, null, 'veg'),
  ('fontina', 'fontina', 'fontina', '{}', 'dairy_eggs', false, 389, 25.6, null, 'veg'),
  ('fresh mint', 'menthe', 'menta', '{"mint"}', 'produce', false, 70, 3.8, 1, 'veg'),
  ('fromage blanc', 'fromage blanc', 'quark', '{"fromage frais"}', 'dairy_eggs', false, 75, 7.5, null, 'veg'),
  ('frozen fries', 'frites surgelées', 'patatine surgelate', '{"french fries"}', 'frozen', false, 150, 2.5, null, 'veg'),
  ('galangal', 'galanga', 'galanga', '{}', 'produce', false, 71, 1.2, null, 'veg'),
  ('garam masala', 'garam masala', 'garam masala', '{"mekelesha","tikka spice"}', 'spices', true, 380, 15, null, 'veg'),
  ('gherkins', 'cornichons', 'cetriolini', '{"baby gherkins","pickles"}', 'pantry', false, 14, 0.6, null, 'veg'),
  ('gochujang', 'gochujang', 'gochujang', '{"korean chili paste"}', 'pantry', true, 210, 4.5, null, 'veg'),
  ('gravy mix', 'préparation pour sauce brune', 'preparato per gravy', '{"brown gravy mix"}', 'pantry', false, 350, 10, null, 'meat'),
  ('green beans', 'haricots verts', 'fagiolini', '{"french beans"}', 'produce', false, 31, 1.8, null, 'veg'),
  ('ham', 'jambon', 'prosciutto cotto', '{"cooked ham","cured ham","jambon blanc","jambon de bayonne"}', 'meat_fish', false, 145, 20, 30, 'meat'),
  ('harissa', 'harissa', 'harissa', '{"harissa paste"}', 'pantry', true, 100, 3, null, 'veg'),
  ('herbes de provence', 'herbes de Provence', 'erbe di Provenza', '{"provencal herbs"}', 'spices', true, 270, 9, null, 'veg'),
  ('jerk seasoning', 'assaisonnement jerk', 'condimento jerk', '{"jamaican jerk seasoning"}', 'spices', true, 250, 6, null, 'veg'),
  ('kaffir lime leaves', 'feuilles de combava', 'foglie di lime kaffir', '{"lime leaves","makrut lime leaves"}', 'produce', false, 60, 2, 0.5, 'veg'),
  ('ketchup', 'ketchup', 'ketchup', '{}', 'pantry', true, 112, 1.7, null, 'veg'),
  ('kidney beans', 'haricots rouges', 'fagioli rossi', '{"red kidney beans"}', 'pantry', false, 100, 7, null, 'veg'),
  ('kimchi', 'kimchi', 'kimchi', '{}', 'other', false, 15, 1.1, null, 'fish'),
  ('korean rice cakes', 'gâteaux de riz coréens', 'tteok', '{"rice cakes"}', 'pantry', false, 230, 4, null, 'veg'),
  ('lamb', 'agneau', 'agnello', '{"ground lamb","lamb leg","lamb mince","lamb neck","lamb shoulder","minced lamb"}', 'meat_fish', false, 230, 18, null, 'meat'),
  ('lemongrass', 'citronnelle', 'citronella', '{"lemongrass paste","lemongrass stalk"}', 'produce', false, 99, 1.8, 20, 'veg'),
  ('mackerel', 'maquereau', 'sgombro', '{}', 'meat_fish', false, 205, 18.6, null, 'fish'),
  ('maple syrup', 'sirop d''érable', 'sciroppo d''acero', '{}', 'pantry', true, 260, 0, null, 'veg'),
  ('mayonnaise', 'mayonnaise', 'maionese', '{"mayo","toum"}', 'pantry', false, 680, 1, null, 'veg'),
  ('mirin', 'mirin', 'mirin', '{}', 'pantry', true, 240, 0.3, null, 'veg'),
  ('miso paste', 'pâte de miso', 'pasta di miso', '{"miso","white miso"}', 'pantry', true, 199, 12, null, 'veg'),
  ('msg', 'glutamate', 'glutammato', '{"monosodium glutamate"}', 'spices', true, 0, 0, null, 'veg'),
  ('mussels', 'moules', 'cozze', '{"mussels in shell"}', 'meat_fish', false, 25, 3.5, null, 'fish'),
  ('mustard', 'moutarde', 'senape', '{"wholegrain mustard"}', 'pantry', true, 66, 4.4, null, 'veg'),
  ('nasi goreng paste', 'pâte nasi goreng', 'pasta per nasi goreng', '{}', 'pantry', false, 220, 3, null, 'fish'),
  ('nutmeg', 'muscade', 'noce moscata', '{"ground nutmeg"}', 'spices', true, 525, 5.8, null, 'veg'),
  ('octopus', 'poulpe', 'polpo', '{"polipo"}', 'meat_fish', false, 82, 14.9, null, 'fish'),
  ('olives', 'olives', 'olive', '{"black olives","green olives","kalamata olives","taggiasca olives"}', 'pantry', false, 145, 1, 4, 'veg'),
  ('orange', 'orange', 'arancia', '{"orange zest"}', 'produce', false, 47, 0.9, 200, 'veg'),
  ('oyster sauce', 'sauce d''huître', 'salsa di ostriche', '{"sauce huître"}', 'pantry', true, 51, 1.4, null, 'fish'),
  ('peanuts', 'cacahuètes', 'arachidi', '{"raw peanuts","roasted peanuts"}', 'pantry', false, 567, 25.8, null, 'veg'),
  ('pear', 'poire', 'pera', '{"asian pear","korean pear"}', 'produce', false, 57, 0.4, null, 'veg'),
  ('perilla leaves', 'feuilles de périlla', 'foglie di perilla', '{"kkaennip","korean perilla"}', 'produce', false, 37, 3.9, null, 'veg'),
  ('pickled ginger', 'gingembre mariné', 'zenzero marinato', '{"gari","sushi ginger"}', 'pantry', false, 20, 0.2, null, 'veg'),
  ('pistachios', 'pistaches', 'pistacchi', '{}', 'pantry', false, 562, 20, null, 'veg'),
  ('prosciutto', 'jambon cru', 'prosciutto crudo', '{"jambon de Parme","parma ham"}', 'meat_fish', false, 250, 26, 15, 'meat'),
  ('pumpkin', 'potiron', 'zucca', '{"butternut squash","squash"}', 'produce', false, 45, 1, null, 'veg'),
  ('rabbit', 'lapin', 'coniglio', '{}', 'meat_fish', false, 136, 20.1, null, 'meat'),
  ('radish', 'radis', 'ravanello', '{"radishes"}', 'produce', false, 16, 0.7, 10, 'veg'),
  ('reblochon', 'reblochon', 'reblochon', '{}', 'dairy_eggs', false, 330, 20, 450, 'veg'),
  ('red wine', 'vin rouge', 'vino rosso', '{"dry red wine"}', 'drinks', false, 85, 0.1, null, 'veg'),
  ('rice syrup', 'sirop de riz', 'sciroppo di riso', '{"jocheong","korean rice syrup"}', 'pantry', false, 316, 0, null, 'veg'),
  ('rice wine', 'vin de riz', 'vino di riso', '{"chinese cooking wine","korean rice wine","mijiu","sake","shaoxing wine"}', 'pantry', true, 120, 0.5, null, 'veg'),
  ('ricotta', 'ricotta', 'ricotta', '{}', 'dairy_eggs', false, 174, 11.3, null, 'veg'),
  ('rosemary', 'romarin', 'rosmarino', '{"dried rosemary","fresh rosemary"}', 'produce', true, 131, 3.3, 2, 'veg'),
  ('sage', 'sauge', 'salvia', '{"fresh sage"}', 'produce', true, 315, 10.6, 1, 'veg'),
  ('salt cod', 'morue salée', 'baccalà', '{"bacalao"}', 'meat_fish', false, 125, 28, null, 'fish'),
  ('salt pork', 'petit salé', 'pancetta salata', '{}', 'meat_fish', false, 250, 18, null, 'meat'),
  ('sausage', 'saucisse', 'salsiccia', '{"morteau sausage"}', 'meat_fish', false, 300, 14, 100, 'meat'),
  ('sea bream', 'dorade', 'orata', '{}', 'meat_fish', false, 96, 19.7, null, 'fish'),
  ('sesame seeds', 'graines de sésame', 'semi di sesamo', '{"toasted sesame seeds"}', 'pantry', true, 573, 17.7, null, 'veg'),
  ('sherry', 'xérès', 'sherry', '{"dry sherry","fino","manzanilla"}', 'drinks', false, 116, 0.2, null, 'veg'),
  ('sichuan pepper', 'poivre du Sichuan', 'pepe di Sichuan', '{"sichuan pepper powder","sichuan peppercorns"}', 'spices', true, 300, 10, null, 'veg'),
  ('snow peas', 'pois gourmands', 'taccole', '{"mange-tout","mangetout","sugar snap peas"}', 'produce', false, 42, 2.8, null, 'veg'),
  ('sorrel', 'oseille', 'acetosa', '{}', 'produce', false, 22, 2, null, 'veg'),
  ('sriracha', 'sriracha', 'sriracha', '{"sriracha sauce"}', 'pantry', true, 93, 1.9, null, 'veg'),
  ('ssamjang', 'ssamjang', 'ssamjang', '{"ssamjang paste"}', 'pantry', true, 200, 8, null, 'veg'),
  ('star anise', 'anis étoilé', 'anice stellato', '{}', 'spices', true, 337, 18, 2, 'veg'),
  ('swordfish', 'espadon', 'pesce spada', '{}', 'meat_fish', false, 144, 19.7, 180, 'fish'),
  ('tamarind paste', 'pâte de tamarin', 'pasta di tamarindo', '{"tamarind puree"}', 'pantry', true, 239, 2.8, null, 'veg'),
  ('tarragon', 'estragon', 'dragoncello', '{"dried tarragon","fresh tarragon"}', 'produce', false, 50, 3.4, 5, 'veg'),
  ('thyme', 'thym', 'timo', '{"dried thyme","fresh thyme"}', 'produce', true, 101, 5.6, 1, 'veg'),
  ('turkey breast', 'blanc de dinde', 'petto di tacchino', '{"ground turkey","turkey mince"}', 'meat_fish', false, 114, 23.7, null, 'meat'),
  ('turkey thigh', 'cuisse de dinde', 'sovracosce di tacchino', '{}', 'meat_fish', false, 144, 19.5, 450, 'meat'),
  ('turmeric', 'curcuma', 'curcuma', '{}', 'spices', true, 312, 9.7, null, 'veg'),
  ('turnip', 'navet', 'rapa', '{"turnips"}', 'produce', false, 28, 0.9, 120, 'veg'),
  ('veal', 'veau', 'vitello', '{"ground veal","minced veal","veal escalope","veal stew meat"}', 'meat_fish', false, 120, 20.5, 100, 'meat'),
  ('vegetable oil', 'huile végétale', 'olio di semi', '{"corn oil","frying oil","seed oil","sunflower oil"}', 'pantry', true, 884, 0, null, 'veg'),
  ('white wine', 'vin blanc', 'vino bianco', '{"dry white wine","vermouth"}', 'drinks', false, 82, 0.1, null, 'veg'),
  ('worcestershire sauce', 'sauce Worcestershire', 'salsa Worcestershire', '{}', 'pantry', true, 78, 0, null, 'fish')
on conflict (name) do nothing;


-- Split out of broader entries, so a recipe asks for what you'd actually buy:
-- vegetable stock isn't chicken stock, green lentils aren't red ones.
insert into public.ingredient_catalog
  (name, name_fr, name_it, aliases, default_aisle, is_staple, kcal_100g, protein_100g, grams_per_unit, diet_class)
values
  ('vegetable stock', 'bouillon de légumes', 'brodo vegetale', '{"vegetable broth","veggie stock","bouillon légumes"}', 'pantry', true, 5, 0.5, 240, 'veg'),
  ('beef stock', 'bouillon de bœuf', 'brodo di carne', '{"beef broth","bouillon de boeuf","brodo di manzo","fond de veau"}', 'pantry', true, 7, 1.2, 240, 'meat'),
  ('fish stock', 'fumet de poisson', 'fumetto di pesce', '{"fish broth","fumet"}', 'pantry', true, 8, 1.5, 240, 'fish'),
  ('green lentils', 'lentilles vertes', 'lenticchie', '{"lentils","lentilles","lentilles du puy","puy lentils","brown lentils"}', 'pantry', false, 352, 24, 75, 'veg'),
  ('butternut squash', 'butternut', 'zucca butternut', '{"courge butternut"}', 'produce', false, 45, 1, null, 'veg'),
  ('ground turkey', 'dinde hachée', 'macinato di tacchino', '{"turkey mince","minced turkey","haché de dinde"}', 'meat_fish', false, 150, 20, null, 'meat'),
  ('passata', 'coulis de tomate', 'passata di pomodoro', '{"tomato passata","passata de tomates","purée de tomates"}', 'pantry', false, 30, 1.5, null, 'veg'),
  ('balsamic vinegar', 'vinaigre balsamique', 'aceto balsamico', '{"balsamic","crème de balsamique","glassa di aceto balsamico"}', 'pantry', true, 88, 0.5, 15, 'veg'),
  ('chicken drumsticks', 'pilons de poulet', 'fusi di pollo', '{"drumsticks","chicken drumstick","pilon de poulet"}', 'meat_fish', false, 172, 18, 110, 'meat'),
  ('cream', 'crème liquide', 'panna', '{"heavy cream","single cream","whipping cream","crème fleurette","panna da cucina","panna fresca"}', 'dairy_eggs', false, 292, 2.1, 15, 'veg'),
  ('plain yogurt', 'yaourt nature', 'yogurt bianco', '{"yogurt","yaourt","natural yogurt","yogurt naturale"}', 'dairy_eggs', false, 61, 3.5, 125, 'veg'),
  ('pecorino', 'pecorino', 'pecorino romano', '{"pecorino sardo"}', 'dairy_eggs', false, 387, 32, 5, 'veg')
on conflict (name) do nothing;

-- For the AI-generated seed batch.
insert into public.ingredient_catalog
  (name, name_fr, name_it, aliases, default_aisle, is_staple, kcal_100g, protein_100g, grams_per_unit, diet_class)
values
  ('edamame', 'edamame', 'edamame', '{"shelled edamame","soy beans","fèves de soja"}', 'frozen', false, 121, 11.9, null, 'veg'),
  ('pita', 'pain pita', 'pane pita', '{"pitta","pita bread","pitas","flatbread","flatbreads","pains pita"}', 'bakery', false, 275, 9.1, 60, 'veg'),
  ('hot sauce', 'sauce piquante', 'salsa piccante', '{"chilli sauce","chili sauce","tabasco"}', 'pantry', true, 12, 0.5, null, 'veg')
on conflict (name) do nothing;

-- Chicken stock is made from chicken (databases seeded before this said veg).
update public.ingredient_catalog set diet_class = 'meat' where name = 'chicken stock';

-- Their names come off the entries they were part of (databases seeded before the split).
update public.ingredient_catalog c
set aliases = array(select a from unnest(c.aliases) a where a <> all (v.gone))
from (values
  ('chicken stock', '{"vegetable stock","brodo vegetale"}'::text[]),
  ('red lentils', '{"lentils","lentilles"}'),
  ('pumpkin', '{"butternut squash"}'),
  ('turkey breast', '{"ground turkey","turkey mince"}'),
  ('canned tomatoes', '{"passata","passata di pomodoro"}'),
  ('vinegar', '{"balsamic vinegar","aceto balsamico"}'),
  ('crème fraîche', '{"cream","heavy cream","crème liquide"}'),
  ('greek yogurt', '{"yogurt","yaourt"}'),
  ('parmesan', '{"pecorino"}')
) as v(name, gone)
where c.name = v.name;
update public.products p
set aliases = array(select a from unnest(p.aliases) a where a <> all (v.gone))
from (values
  ('chicken stock', '{"vegetable stock","brodo vegetale","fond de veau"}'::text[]),
  ('red lentils', '{"lentils","lentilles","lenticchie"}'),
  ('pumpkin', '{"butternut squash"}'),
  ('turkey breast', '{"ground turkey","turkey mince"}'),
  ('canned tomatoes', '{"passata","passata di pomodoro"}'),
  ('vinegar', '{"balsamic vinegar","aceto balsamico"}'),
  ('crème fraîche', '{"cream","heavy cream","crème liquide","panna"}'),
  ('greek yogurt', '{"yogurt","yaourt"}'),
  ('parmesan', '{"pecorino"}')
) as v(ingredient, gone)
where p.ingredient = v.ingredient;

-- Exotic: not sold in most French supermarkets, so it needs an Asian or
-- specialty shop (or online). Drives the "Everyday ingredients" filter.
update public.ingredient_catalog set exotic = (name in (
  'berbere', 'cheese curds', 'dried fenugreek leaves', 'galangal', 'gochujang', 'gravy mix', 'jerk seasoning',
  'kaffir lime leaves', 'kimchi', 'korean rice cakes', 'mirin', 'msg', 'nasi goreng paste', 'perilla leaves',
  'rice syrup', 'rice wine', 'sichuan pepper', 'ssamjang', 'tamarind paste'
));

-- ---------------------------------------------------------------------------
-- Grocery products: one per catalogue ingredient (French name first). The
-- everyday items that aren't recipe ingredients are in the grocery_products
-- migration. Safe to re-run.
-- ---------------------------------------------------------------------------

-- Fixed ids for catalogue ingredients: the same in every environment. The
-- product of each ingredient takes its id (sync_products_from_catalog). A new
-- ingredient needs a new uuid here; never change or reuse one.
update public.ingredient_catalog c set id = v.id
from (values
  ('allspice', '10eff731-6d5e-40b5-afde-66ffe3e4400e'::uuid),
  ('almonds', '8a5ec3ac-4f94-49cf-b741-48980d2a8297'::uuid),
  ('apple', '297eede8-bcc2-4756-a665-c9c080c9c466'::uuid),
  ('arugula', 'ff51bb03-81b8-469a-b48e-3204a6a91635'::uuid),
  ('avocado', '5413611b-599b-4652-8e3a-11f4c4022bc5'::uuid),
  ('bacon', '057817c4-53a4-4303-a951-789122463b28'::uuid),
  ('baking powder', '8692d651-71ac-44ef-a851-e1e8956db755'::uuid),
  ('baking soda', '439a7053-f583-4707-87f2-2d37b2970b1b'::uuid),
  ('balsamic vinegar', '2c17dde1-a3fb-4f9e-8669-04f442048690'::uuid),
  ('barley', 'eb7be49b-a08f-41ed-bf4f-57af8dbf6ff2'::uuid),
  ('bay leaf', '5efc9e24-f518-46e3-b777-6534885dad68'::uuid),
  ('bean sprouts', 'eec83291-a95b-466e-ad9c-1356266e575e'::uuid),
  ('beef steak', 'c00de82b-26ba-4a03-955b-ca08d77b2349'::uuid),
  ('beef stew meat', '3d033dad-7c4f-40b8-aba2-dc9ed3ba0f88'::uuid),
  ('beef stock', 'ed5a7b05-c8b0-4bcf-8128-177f319ab880'::uuid),
  ('bell pepper', '3ce4437e-5c81-4dfc-aa7b-57337e9c8529'::uuid),
  ('berbere', 'ec371815-7934-4dff-b41d-6e13365c2202'::uuid),
  ('black beans', '91b5d268-385e-406f-9d42-27813938d16b'::uuid),
  ('black pepper', '6b4e981a-44d9-44d5-902f-934bae806056'::uuid),
  ('bok choy', 'd670abe8-532d-4a72-ba09-aecc419f7027'::uuid),
  ('bouquet garni', 'b9d15cc8-231f-4101-8ea9-9e628dd664cb'::uuid),
  ('bread', 'ed4c5bcf-12fa-456d-ae6b-be9dd76adeb5'::uuid),
  ('breadcrumbs', 'd0865551-b549-4579-ac28-f824029bb1ee'::uuid),
  ('broccoli', '7316abbe-f2b5-4a2a-9974-03de194262c4'::uuid),
  ('butter', 'b721695f-a012-4500-a634-8a7c711054c9'::uuid),
  ('butternut squash', '9d7cfee7-0a2c-465e-90e8-9ca8aec42ef2'::uuid),
  ('cabbage', '0d682199-1e7d-4a6a-8685-3216ba14274d'::uuid),
  ('cajun seasoning', '9453fe3c-e229-4d12-a304-f48137ce127e'::uuid),
  ('canned tomatoes', '8ed4cc58-580c-448f-b088-7ada9e1a33a5'::uuid),
  ('capers', '6e9b4150-6592-4a99-9877-32d4e2231e49'::uuid),
  ('cardamom', '8a460b9f-58df-4e4c-9433-ac13696f8be2'::uuid),
  ('carrot', 'c21bdf4a-1639-49a9-8a83-6affb0a58535'::uuid),
  ('cashews', '4717f06c-8270-4ca4-8481-1f3bd1c5573f'::uuid),
  ('cauliflower', '88f43d65-a11f-4b94-9d99-c491e3421e7f'::uuid),
  ('celery', '25ef7329-cf9d-4017-8ec7-351725aa2cf1'::uuid),
  ('cheese curds', '5c7ed331-e39d-473d-9d0a-54b0d2b4fcce'::uuid),
  ('cherry tomatoes', 'd9230258-0c13-4a31-aaed-ea8718f80a35'::uuid),
  ('chicken breast', '44ac9818-4c5f-4581-bbcb-3c675d31614d'::uuid),
  ('chicken drumsticks', 'fc065363-d83d-4f96-a865-08300dae0e4b'::uuid),
  ('chicken stock', '9d3bb4cc-d9a4-4417-a653-0874485ed8cb'::uuid),
  ('chicken thigh', '6c03472b-7530-4063-8af9-8835f14c9fb7'::uuid),
  ('chicken wings', '1f0a9a94-a5bb-44f2-924b-2aa2c71cc935'::uuid),
  ('chickpeas', '0e2d990d-368d-4e2c-9080-4e9b025ed4db'::uuid),
  ('chili flakes', '93d70cd6-7ee7-410e-960b-0b47e2e6c9c7'::uuid),
  ('chili powder', '502efbde-4bdf-4413-bd27-a7b85083d365'::uuid),
  ('chives', '6d97d589-9643-43e1-aec2-bc9b3c63815c'::uuid),
  ('chorizo', '95dd5ca2-d348-45d5-8639-16bef585eb36'::uuid),
  ('cinnamon', 'c3a455d5-c660-4c91-bc9b-d43f407b04d7'::uuid),
  ('clams', '26b0b80d-a00a-4b39-9231-996cee4613c1'::uuid),
  ('cloves', 'bd2b402b-0ac9-47fa-b642-d47ab19d390d'::uuid),
  ('coconut milk', '279902b8-1728-4daa-8503-f5c951532935'::uuid),
  ('cod fillet', '94c1fe2f-6615-40b5-ac49-327fe04b5444'::uuid),
  ('coriander seeds', '47ce4af3-e62a-4c12-a1e8-f1bb23955c7b'::uuid),
  ('corn', 'f1b909a8-eccc-4726-8bbe-c4cbb1e82596'::uuid),
  ('cornstarch', 'aa215ed7-247c-409b-9331-fa75d7dd160a'::uuid),
  ('couscous', '10b3a7bf-1e53-4529-ac12-c68f45a57313'::uuid),
  ('cream', '43690159-cbc2-487a-bf87-1643e9e5acbf'::uuid),
  ('cream cheese', '17277f56-e016-4253-84ec-a787062dc7f9'::uuid),
  ('crème fraîche', '93a05cb6-e30b-475d-bbd6-2f5b2ddcf8ff'::uuid),
  ('cucumber', '75dc0b60-59a3-4614-ab87-135dcd6019f7'::uuid),
  ('cumin', 'aaa5029e-88f1-4fd7-a804-3c7d52ce09a3'::uuid),
  ('curry paste', 'c788bcd0-75d8-48e0-888c-1730eee0f05c'::uuid),
  ('curry powder', '887bc9a5-af89-4094-bb5b-e3131cd4958e'::uuid),
  ('desiccated coconut', 'ab7fdc9d-641b-428f-9a86-b6929bf6207f'::uuid),
  ('dijon mustard', '98fea912-5a76-4244-87e4-c06fcd154869'::uuid),
  ('dill', 'c27fb28c-7132-4aba-8bf3-f1b7e799ea5c'::uuid),
  ('dried fenugreek leaves', '4f6eed7c-251c-4906-afda-b91ab8edc9c7'::uuid),
  ('dried oregano', '171345d8-fda1-4a07-8af4-12d3018904b9'::uuid),
  ('dry yeast', '1a9b77e6-c56b-4371-a763-7f28d8fd6008'::uuid),
  ('edamame', '051dc2cb-18c6-4a44-b004-aa72e5a56936'::uuid),
  ('eggplant', '0f2d5cdd-870d-444b-91b4-76d9f120d982'::uuid),
  ('eggs', '2cea4cf0-075a-48b8-81bf-d44e31541fb1'::uuid),
  ('emmental', 'a82681f8-e180-44f2-8799-da5428ff1dcc'::uuid),
  ('farro', 'fa4f3a99-0810-4081-826b-5afa2e27d681'::uuid),
  ('feta', 'b16728be-d819-4bfc-8253-199b6baf7e33'::uuid),
  ('fish sauce', 'ffbc6ce8-1980-474d-84fe-7b7688496e81'::uuid),
  ('fish stock', '6d76f65b-9eda-49f2-aca7-c07e4875395d'::uuid),
  ('five-spice', '36bf6390-be5b-49e0-b0a8-b1d0dd1c181c'::uuid),
  ('flour', '9d86573b-d33f-403b-99c0-21ad57f375df'::uuid),
  ('fontina', '6c98ad90-dc35-4c0c-9d13-f5e269e5a9cd'::uuid),
  ('fresh basil', 'f634f40e-8663-4a34-b8fd-316364e19219'::uuid),
  ('fresh coriander', '7fac4a2f-8794-42c0-b2ea-b5e5bcbc6705'::uuid),
  ('fresh mint', '0a6034a0-ee13-4e66-b5c9-039fc98364dd'::uuid),
  ('fromage blanc', '5045ce6d-b986-4694-b82e-382af877d9a6'::uuid),
  ('frozen fries', '4ac48a44-5641-4296-9a82-e4b9053f2fdc'::uuid),
  ('frozen peas', 'a66f36d4-e213-404b-a295-e517483bb82a'::uuid),
  ('galangal', 'dc43c8ac-1750-4269-bd3a-3a07a9dc3025'::uuid),
  ('garam masala', 'e4fa86d9-2d36-4e72-8630-c98238c38830'::uuid),
  ('garlic', 'cae6de62-f53e-4445-86da-a9705d39570b'::uuid),
  ('gherkins', '365b4915-f9be-4a44-ac12-eec07200d1de'::uuid),
  ('ginger', '53090518-ea67-40cf-8330-1e3fb635927b'::uuid),
  ('gochujang', '465b2757-ddb2-4119-ae01-fc5582e9937b'::uuid),
  ('gravy mix', 'f87fb273-845b-401e-91f2-1b8f0ca8a805'::uuid),
  ('greek yogurt', '5cf22e19-c85c-480f-92c5-b06b8cfe6557'::uuid),
  ('green beans', 'f653750e-18e0-4966-b090-5e8869d7d789'::uuid),
  ('green lentils', 'e2c88c03-8705-4e00-a4a2-c5f07af8f9df'::uuid),
  ('ground beef', 'f6fef71c-aeff-40fb-bdb7-3951b8ca2110'::uuid),
  ('ground turkey', '5e675a9d-3fa6-4ef2-9098-229b112e9115'::uuid),
  ('ham', '86a88f39-fff2-406b-9ed0-c8dacd944a6f'::uuid),
  ('harissa', '644eaeb8-1240-4095-913f-2679eaccb446'::uuid),
  ('herbes de provence', '47b04287-dcb0-4fe4-b713-b31fdbf85034'::uuid),
  ('honey', '9e895de8-2e0b-40b0-bb68-015dd9af7f12'::uuid),
  ('hot sauce', '666579a1-5983-40f3-a95f-f02c434298bc'::uuid),
  ('jerk seasoning', 'c88c4249-817f-4219-8c73-ae1fcf37326f'::uuid),
  ('kaffir lime leaves', 'cfc49278-52cd-47f6-82b7-9edfe5cff2be'::uuid),
  ('ketchup', '1268b8bf-ee15-4590-9778-cc8d12996ef0'::uuid),
  ('kidney beans', '68638ad8-a85a-4937-bfa1-b08dc282845d'::uuid),
  ('kimchi', 'ea334ddd-524d-4f38-8619-7eec4ac26ca7'::uuid),
  ('korean rice cakes', '151123bc-6f6f-4894-8936-115777808370'::uuid),
  ('lamb', 'fadea5a6-3b80-4a9e-98b2-7bbf05ff05c6'::uuid),
  ('leek', '13e3cd0f-25ff-4fa7-800c-a20a23483a75'::uuid),
  ('lemon', 'd5369b45-e676-43cc-9c4b-99b05f7ecbe8'::uuid),
  ('lemongrass', '5cafe976-11a1-4737-aabf-285a0c11b0ff'::uuid),
  ('lettuce', '173625c0-6559-4de5-9000-7946231192da'::uuid),
  ('lime', '9458551f-8dfc-496a-9bc0-b8871ede07b3'::uuid),
  ('mackerel', '6b8d559c-6c8c-4af8-aaf8-68311f79c65f'::uuid),
  ('maple syrup', '23b7d39d-2da2-49f6-b2f0-d94276c8ee12'::uuid),
  ('mayonnaise', 'd195df54-f459-4899-9daa-df8e618f77e9'::uuid),
  ('milk', '99a34c5f-50a1-4c21-918e-da32011a331f'::uuid),
  ('mirin', '56f390fa-e512-4cfd-8ff1-981a32fa3cdf'::uuid),
  ('miso paste', '2358c8f0-5960-45f5-b2cb-6a26d7335350'::uuid),
  ('mozzarella', 'd8d85fdd-cd1c-494b-ad41-5e470a768c3b'::uuid),
  ('msg', 'cb321c82-ec98-45ff-8d1e-afda271c7838'::uuid),
  ('mushrooms', '73e9ab13-32ba-49bd-8b95-caf095b6c190'::uuid),
  ('mussels', '455bb69f-56b4-4f2f-8b8c-c9fd92df0539'::uuid),
  ('mustard', 'bc911a1e-1ff4-43c5-ae5e-ea891256ead7'::uuid),
  ('nasi goreng paste', '5d41b281-cf22-4d8d-818d-955f0adc9bec'::uuid),
  ('noodles', 'fd4ce13d-daaf-4363-9b5e-1fc0fc76596f'::uuid),
  ('nutmeg', '0fc6311e-854c-4342-ad67-11642010451e'::uuid),
  ('octopus', '62c86120-c6cc-4e11-9e25-a1ed64b31f0f'::uuid),
  ('olive oil', '31ea62a7-f216-40b6-a6d8-ea8fc749b1a7'::uuid),
  ('olives', '3d88bc6a-ebdc-4384-85e1-e21d2e413d6c'::uuid),
  ('onion', '949d4514-6dcd-4753-8793-c9781c440369'::uuid),
  ('orange', 'c5a8cb26-2dec-4f59-955f-c6f2633b5bdc'::uuid),
  ('oyster sauce', 'ebab33cc-d3cf-419e-b6c3-15fb7d056d93'::uuid),
  ('paprika', '1ff1ed8e-b4cc-4567-9c5e-a271841f23a9'::uuid),
  ('parmesan', 'a7509d96-5553-4029-bc2a-243096d73c31'::uuid),
  ('parsley', '2151ee2b-46bb-4d3c-9618-da6a8d5bfa67'::uuid),
  ('passata', '2d7dfc43-5997-4457-b410-de58333b06de'::uuid),
  ('pasta', 'daacd401-b1af-4ee8-a880-35db7d5942ef'::uuid),
  ('peanut butter', 'bb3f7d59-d7b6-4384-91b7-dc20f2fb1eb0'::uuid),
  ('peanuts', '4dda9d55-7dfc-4ac6-b49e-85aaa01385bf'::uuid),
  ('pear', 'b1629415-5168-435d-8169-907801c3e36f'::uuid),
  ('pecorino', '2c79a2b3-7d56-4503-a0f6-b992c6230563'::uuid),
  ('perilla leaves', '7e77de34-4676-4ea7-9e75-9f5638ee1b2a'::uuid),
  ('pesto', '92d35811-5b59-4905-b398-5c9af1a41e64'::uuid),
  ('pickled ginger', 'ec4582c5-5916-416c-b2d3-2ee852afb912'::uuid),
  ('pistachios', 'f241f2b0-9f44-4743-a389-2420dffce23b'::uuid),
  ('pita', '55694b5c-4abe-471d-8a80-9127e73899b5'::uuid),
  ('plain yogurt', '1a07d871-27fa-4cd1-8109-20802d2772b0'::uuid),
  ('pork tenderloin', '47cb0ec5-ae0e-42b4-a53f-9b78126e10bc'::uuid),
  ('potato', '7d1337ca-8f71-4c08-9c7f-a4be971870f9'::uuid),
  ('prawns', '2036cb2d-2636-4e0d-be84-4ce9d449183c'::uuid),
  ('prosciutto', '9b8e9494-c5b5-4b26-8516-d4559bffa29b'::uuid),
  ('pumpkin', 'dfba257b-608c-4d51-abf6-ae5eb80f4ee4'::uuid),
  ('quinoa', '885eea7e-2f28-46ae-999e-318ce0f54700'::uuid),
  ('rabbit', 'fdccd82e-51db-4959-8945-1223ccfa996a'::uuid),
  ('radish', 'a4ddfc8d-ff5c-435b-8ac4-ac76cf395236'::uuid),
  ('reblochon', '6abb60ce-21aa-4bcd-ae39-a10d0c3e0c5c'::uuid),
  ('red lentils', 'a44dea8b-c15f-49cc-9a89-ee15a177921e'::uuid),
  ('red wine', '32bef6a2-fc87-44a6-bfe3-21a7553f1cd1'::uuid),
  ('rice', '7e278c11-ab33-4fea-b3ba-0a557b4e7c9d'::uuid),
  ('rice syrup', 'ebf8c92b-8eec-4968-ad48-9e18af8abb0d'::uuid),
  ('rice wine', 'c56c6242-cbf2-4d1b-aaf1-d9716b847385'::uuid),
  ('ricotta', '7ea3389c-f9eb-449d-ae50-c53790be19d4'::uuid),
  ('rosemary', '11c42199-0fa4-4ee7-a17a-105aa406f411'::uuid),
  ('sage', '3e127195-c7d8-488e-91a2-5f3b91ad7d83'::uuid),
  ('salmon fillet', '9f706856-62b7-4002-8352-008846c3feec'::uuid),
  ('salt', 'b0f5e443-9214-482c-9712-d50aa7a08d0b'::uuid),
  ('salt cod', '515cccb8-a710-4d98-9533-f5336e3a39d9'::uuid),
  ('salt pork', 'd13fcb61-08c0-4e31-87cc-e5ed122e8d97'::uuid),
  ('sausage', '2d2a5de6-259c-4fc5-839e-2cddb329d2c6'::uuid),
  ('sea bream', 'd8f05a4c-dbb6-4af9-92a8-5a84eceda1ff'::uuid),
  ('sesame oil', '7686a849-1a4a-4099-8695-6d17112908a1'::uuid),
  ('sesame seeds', 'cea88de4-0aca-493f-b80d-d3b77ea0bcde'::uuid),
  ('shallot', '379f44e8-909f-46d3-bf2c-af310c89751d'::uuid),
  ('sherry', '3d66100d-8c38-4967-be21-1893d0fccc6c'::uuid),
  ('sichuan pepper', 'cddd01e3-cf53-4841-8785-a7c321ad1c2d'::uuid),
  ('snow peas', 'fafc1951-97ac-4f19-ab53-31d4e536a145'::uuid),
  ('sorrel', '9859a79a-3f99-4125-b22c-f71973cfd010'::uuid),
  ('soy sauce', '33a8c428-aac6-409e-a653-2e378ee043b9'::uuid),
  ('spinach', 'ccf356fe-f6a4-4c78-b87c-2f10e65309f4'::uuid),
  ('spring onion', '2c46fa4e-7478-43f2-8419-1c8fcf90a19c'::uuid),
  ('sriracha', '56c61d45-efc8-48eb-b266-6a723fa802e9'::uuid),
  ('ssamjang', 'bd18791d-32cb-48f0-93cd-9563769ffa7c'::uuid),
  ('star anise', 'fe57dd0c-4c0c-4ff5-ad42-03669585301b'::uuid),
  ('sugar', 'e025119a-0387-4832-9ea5-d45002855d66'::uuid),
  ('sweet potato', 'e2db1c58-4a62-4b44-a148-2cfaf1cceaa5'::uuid),
  ('swordfish', 'faf0c8ef-5500-4c38-85f5-f7b19de11626'::uuid),
  ('tamarind paste', 'e1a9f13c-3da7-403f-9de6-e5688b2dcab7'::uuid),
  ('tarragon', '618ce2cb-36d2-4a0c-bf5e-948f3c202f8e'::uuid),
  ('thyme', 'b48393cc-dcff-4725-b9aa-0ad4c00f3868'::uuid),
  ('tofu', '98ca3c1c-12f1-46f1-bfee-943c67c37612'::uuid),
  ('tomato', '64d06deb-557c-4643-9ff0-6423fc19cc3c'::uuid),
  ('tomato paste', '0841c19b-49b1-49d2-a619-7307d62ebd03'::uuid),
  ('tortillas', '4f710b79-7126-419b-a5f3-63a4c1ac84b1'::uuid),
  ('tuna', '4ee14727-b473-4d48-ae0d-bdff404c2d2f'::uuid),
  ('turkey breast', 'd69a7aa6-597d-4de9-9c74-0fbb7f73952f'::uuid),
  ('turkey thigh', 'c7124447-daa4-4027-91e5-3fea430fd0f3'::uuid),
  ('turmeric', '3514ae4e-2419-4a9a-978d-69168077eea6'::uuid),
  ('turnip', '4b54d94e-b44a-4b0e-a248-ed233c0f4bd6'::uuid),
  ('veal', 'ed97fb43-0f2f-470a-81fa-f1820b941061'::uuid),
  ('vegetable oil', '269d1456-dc5f-4ef8-8faf-0816a4c84582'::uuid),
  ('vegetable stock', '02d3aa03-c957-4757-b903-fb620a5d00f8'::uuid),
  ('vinegar', 'fcf65703-4c6d-4ccc-8759-4561bf388701'::uuid),
  ('white wine', '9abb08c7-0586-4201-9c33-80b09ff11ab1'::uuid),
  ('worcestershire sauce', '3f313e55-61b6-450f-a599-3b8c7c7d1155'::uuid),
  ('zucchini', 'ce2d8345-c2fa-4817-be49-d261c99359b8'::uuid)
) as v(name, id)
where c.name = v.name and c.id <> v.id;

select public.sync_products_from_catalog();

-- Fixed ids for the shared everyday products (not recipe ingredients), by
-- their search key. A new one needs a new uuid here; never change or reuse one.
update public.products p set id = v.id
from (values
  ('abricots', '15d6c79d-3790-43bf-b0ea-cd4d44d997e4'::uuid),
  ('adoucissant', 'a423eacd-54ff-4f7d-bb8d-e902c098d63a'::uuid),
  ('ampoules', '426208bd-c1e2-4974-938d-b5a64a13df1a'::uuid),
  ('ananas', '0d85ac75-cb14-4774-a83c-748400ff672b'::uuid),
  ('apres shampoing', '0960273c-9a01-4799-a19f-afff8ab921bd'::uuid),
  ('asperges', 'fecd6d10-c5fe-4491-8acc-9142a1d276ab'::uuid),
  ('babybel', '4a94bb4a-4736-4bf2-961c-c09952661838'::uuid),
  ('bananes', '3ee47437-8e38-4f0b-af00-5d990b41a27e'::uuid),
  ('betteraves', 'b27af9af-54b6-4f5e-ade8-e23e666ab6b7'::uuid),
  ('biere', 'd6616387-99d7-4e1f-a48c-b7d9a15ad94a'::uuid),
  ('biscuits', 'd16c4506-f546-4f82-9384-5ca4268c1086'::uuid),
  ('boissons', '413f73dd-67cd-4763-9529-0c5f9a474b18'::uuid),
  ('brosses a dents', '10727640-b4f2-47d1-82d5-d579f8979378'::uuid),
  ('cafe', '12b60ee0-ab0b-47dc-a2c7-40e44962a42f'::uuid),
  ('cafe decafeine', 'b7f3c4d2-6420-42cf-94a6-39ef53cc833d'::uuid),
  ('cereales', '8f996671-ea04-4997-b485-c92b833e14fc'::uuid),
  ('chocolat', '3a77dc16-9b70-4e26-86fc-d4b549533748'::uuid),
  ('choux de bruxelles', 'fa948d36-5b8f-45fb-adb3-6fa62453453c'::uuid),
  ('clementines', 'd97dc35b-499e-4ceb-9c2a-182b41aa48a6'::uuid),
  ('compotes', 'dbef9094-8a24-4704-9f3c-21ae661179f9'::uuid),
  ('comte', '0f8b72fc-d33d-4f55-bd25-f7eccd2da30e'::uuid),
  ('confiture', 'c51676e3-0311-413e-a7a6-e68eb225cd12'::uuid),
  ('cotons demaquillants', 'b044869d-c037-4250-8cb8-3a0fe39444e6'::uuid),
  ('cotons tiges', 'b8ce2c4e-e2de-46dd-af47-23f89a1b52e2'::uuid),
  ('creme pour le corps', 'ce560bb7-72be-45c6-8756-3c1a052fe4ef'::uuid),
  ('crevettes decortiquees', '693f598f-2eea-4b07-b69c-4aa9474a2ef6'::uuid),
  ('croissants', 'a93741f0-9a17-4f50-89dc-a06bc7c2ebc7'::uuid),
  ('croustibat', 'ddc1d569-0354-4c46-b575-fce8f017efd2'::uuid),
  ('dentifrice', '262a4b16-c042-4172-a9e3-5f436017f293'::uuid),
  ('deodorant', 'c73e10e4-b384-4ba5-91f1-2569ce9c3a94'::uuid),
  ('eau', '8095e65c-5dab-4762-9d5e-913717a4e9d0'::uuid),
  ('eau gazeuse', 'b8a637df-020f-40fe-ab35-e0dd49597101'::uuid),
  ('endives', '8448fff3-dfa0-4c63-b85b-0ab6ba606e6e'::uuid),
  ('eponges', '3050704b-6d61-401e-9d56-423f19b423f3'::uuid),
  ('escalopes de poulet', '7e707754-9037-497b-91fe-07e456d7e9b3'::uuid),
  ('essuie tout', '5069e7e9-fbd6-4a1f-ab39-f15ba21a59a6'::uuid),
  ('fenouil', '7a0b7b89-f3a4-4aec-8914-0bd987228ff0'::uuid),
  ('film alimentaire', '871a9b19-b4d5-4547-ad23-6deea3909e3e'::uuid),
  ('fraises', 'c56faf45-5a48-4e1a-a2a0-475c4796cc36'::uuid),
  ('framboises', '93ae5f90-7743-43e6-afa5-3dd7fbf3b169'::uuid),
  ('fromage rape', 'b988cb77-3acb-4d29-a9bb-721ca0c3e4f0'::uuid),
  ('fruits', '0d24f43d-55f5-4f69-88d0-120e7185d0f3'::uuid),
  ('gel douche', 'e3785963-5d60-40d2-8d78-86191d6f4064'::uuid),
  ('glace', 'e0c3004e-97bd-4c11-86b4-d5f233e0e6b4'::uuid),
  ('gommage', '9111ea9c-22fc-4831-8f34-acf2d1e86d5e'::uuid),
  ('grissini', '5130e703-a1ab-4e13-be7e-3c71cf2611d5'::uuid),
  ('jus d orange', '105739be-8b89-4012-b811-4fa3ecf0ceed'::uuid),
  ('kiwis', '63c652e2-9ee4-4153-9976-4261753bb15a'::uuid),
  ('lait d avoine', 'ac7178fd-bf25-43c4-995c-e02ffdf06780'::uuid),
  ('lessive', '2f77a62c-56a0-4aa1-acc4-53aedf4fae09'::uuid),
  ('lingettes humides', '7ca463f9-acc7-40c1-a21a-ddb533a0f67a'::uuid),
  ('liquide vaisselle', 'f3e7cb06-f23d-4b54-a3bc-b0234c9ad36f'::uuid),
  ('mache', '68e8519c-a14d-4ee8-814c-56845ac2d305'::uuid),
  ('mangue', '9ab32fd2-7345-4572-9255-cafe77b5b2f5'::uuid),
  ('melon', '7bb1488a-2f00-4dc5-a6b5-c2872c153e5a'::uuid),
  ('mouchoirs', '04448eba-d044-4e3b-b509-9e7cb77eec2f'::uuid),
  ('myrtilles', '6fc7119d-cf4e-450c-adb6-8e35057e3d86'::uuid),
  ('nettoyant multi usage', '78d44ba9-02eb-4b9d-91bf-8e691d199a90'::uuid),
  ('pain de mie', 'a4879344-129a-40a2-b61b-ee83f11e84d7'::uuid),
  ('pamplemousse', 'b8ad5a56-7c02-422e-92bd-1ccd296d4095'::uuid),
  ('papier aluminium', 'ad3a2182-5fd8-42ab-bc51-2c0146f66306'::uuid),
  ('papier sulfurise', '84e90fb2-91dc-4b36-bec9-e70da5225418'::uuid),
  ('papier toilette', '5aaeaa32-5d02-4750-a3c3-da046b23890a'::uuid),
  ('peches', 'd16fa927-020a-4ed5-a354-dec2b6d13f36'::uuid),
  ('piles', '24effd9b-16e4-4e18-82d8-14000692fbf3'::uuid),
  ('poulet au citron', '5b216714-db3e-4570-9d46-7e18bf27b961'::uuid),
  ('puree', 'f8dd508c-533c-4e2d-8d69-9eeaed62960f'::uuid),
  ('raisin', 'dee081ad-d549-4075-8d86-72bc2cdd746b'::uuid),
  ('rasoirs', 'd844c38b-231a-4766-914a-7951e6d17289'::uuid),
  ('recharge savon mains', 'e34edba9-a1d5-4f95-b7e1-856641ac30c7'::uuid),
  ('sacs poubelle', 'a96b66ae-5bb7-4694-bb42-c4096a601903'::uuid),
  ('sardines', 'a37be9ce-48a2-41a3-bfeb-2fc319ade104'::uuid),
  ('saumon fume', '8603d62f-0e1d-45f0-afec-0a31f0cf1e52'::uuid),
  ('savon pour les mains', 'fc3c7093-4923-4a92-a416-302c47d03cde'::uuid),
  ('scotch', '87e75ed3-b50d-4f70-a12b-6c5b059c7cc1'::uuid),
  ('sel lave vaisselle', '102ff8d7-b791-41ff-8801-6ef8c4edbdd4'::uuid),
  ('serviettes en papier', '75dc64c6-9c22-454e-ba54-5925e3ea1f18'::uuid),
  ('shampoing', 'b96a31be-458f-4589-8746-a06887663df8'::uuid),
  ('skyr', 'e0812ecf-1df9-4f28-b214-d77bbd796938'::uuid),
  ('skyr de brebis', '9d41edaf-8955-499e-acb2-d83f62efe313'::uuid),
  ('sojasun', '2ecf2f81-4fac-4b38-a75d-d6576bf62e12'::uuid),
  ('soupe', 'a69b70c0-e8a6-4df4-9ac1-39d51137920f'::uuid),
  ('tablettes lave vaisselle', '78626bf5-29db-4c93-9ea6-36b58baf22f1'::uuid),
  ('the', '1ad9eaeb-203c-4d03-84d5-72a6485128fb'::uuid),
  ('tisane', 'f492b721-0def-40eb-9809-eee93e767909'::uuid),
  ('wasa fibres', '6bc397f9-b87e-4c5b-825c-a507f50a4d79'::uuid)
) as v(search_key, id)
where p.household_id is null and p.ingredient is null and p.search_key = v.search_key and p.id <> v.id
  and not exists (select 1 from public.products q where q.id = v.id);

-- Shopping-list words for catalogue products.
update public.products p
set aliases = (select array_agg(distinct a order by a) from unnest(p.aliases || v.extra) a)
from (values
  ('crème fraîche', '{crème}'::text[]),
  ('chicken stock', '{fond de volaille}'),
  ('salmon fillet', '{saumon frais}'),
  ('bread', '{baguette,pain frais}'),
  ('tuna', '{thon en boîte}'),
  ('frozen peas', '{petits pois}'),
  ('lettuce', '{laitue,salade verte}')
) as v(ingredient, extra)
where p.ingredient = v.ingredient;

-- What you usually buy of each product (2 lemons, 2 l of milk): fills
-- products that have no default yet, never overwrites one.
select public.apply_product_defaults();
