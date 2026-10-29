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

select public.sync_products_from_catalog();

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
