# Recipe collection guidelines

You are collecting real recipes from recipe websites for a private two-person
dinner app (non-commercial). Output is one JSON file. Quality and exact structure
matter more than speed.

## How to fetch
- The shell cannot reach the web. Use WebSearch (mode "standard") to find recipe
  pages, then WebFetch the result URL (only URLs that appeared in search results
  are fetchable). If a URL is refused, pick another result; don't retry it.
- In the WebFetch prompt ask for: title, servings, prep + cook time, the full
  ingredient list with exact quantities as written, a short summary of each step,
  and the main photo URL (og:image) copied exactly.
- Only keep a recipe if you actually fetched its page and got servings + an
  ingredient list with quantities. Never invent a recipe or a URL.
- Image: use the page's og:image / main photo URL exactly as returned. If none
  was found, set image_url to null (don't guess).

## Nutrition brief (applies unless your task says otherwise)
Rather healthy, sport-friendly dinners — real meals, not just salads. Medium to
high protein: aim for >= 25 g protein per serving (estimate with the catalogue
values below), most recipes 30 g+. Avoid deep-fried / very heavy dishes. If a
classic recipe is low-protein, you may pick a version that adds a protein, but
it must be the source's recipe, not your modification. Prefer recipes where
coriander/cilantro is not central (garnish is fine).

## Output file
Write ONE file (path of your choice):

```json
{
  "recipes": [ RECIPE, ... ],
  "new_ingredients": [ NEW_INGREDIENT, ... ]
}
```

### RECIPE
```json
{
  "title": "Petto di pollo alla cacciatora",
  "language": "it",
  "servings": 2,
  "original_servings": 4,
  "total_min": 40,
  "source_type": "seed",
  "source_name": "Dissapore",
  "source_url": "https://www.dissapore.com/ricette/petto-di-pollo-alla-cacciatora/",
  "image_url": "https://images.dissapore.com/.../petto-di-pollo-alla-cacciatora.jpg?width=1280&height=720&quality=75",
  "cuisine": "italian",
  "tags": ["chicken", "italian", "stew", "comfort"],
  "difficulty": "easy",
  "equipment": { "pots": 1, "oven": false, "special": [] },
  "ingredients": [
    { "text": "300 g petto di pollo, a pezzi", "original_text": "600 g petto di pollo, a pezzi", "guessed": false,
      "_catalog": "chicken breast", "_qty": 300, "_unit": "g" },
    { "text": "125 g pomodori pelati", "original_text": "250 g pomodori pelati", "guessed": false,
      "_catalog": "canned tomatoes", "_qty": 125, "_unit": "g" },
    { "text": "50 ml vino bianco", "original_text": "100 ml vino bianco", "guessed": true,
      "_catalog": "white wine", "_qty": 50, "_unit": "ml" },
    { "text": "sale", "original_text": "sale", "guessed": false,
      "_catalog": "salt", "_qty": null, "_unit": null }
  ],
  "steps": ["...", "..."]
}
```

Field rules:
- `title`: short card title in the recipe's language (the dish name; may tidy the source title).
- `language`: `it` for Italian sites, `fr` for French sites, `en` for English sites. Write title, ingredient lines and steps in that language.
- `servings`: always 2. `original_servings`: the source's number (if the source gives a range like 4-6, use the lower bound).
- `total_min`: whole minutes start to plate incl. oven/marinating-free time (if a long marinade is needed, include it and add tag "make ahead"). If the page lacks a time, estimate from the steps.
- `source_name`: the site's display name (GialloZafferano, Marmiton, 750g, RecipeTin Eats, ...). `source_url`: the fetched URL.
- `cuisine`: one lowercase word/phrase (italian, french, chinese, japanese, korean, thai, vietnamese, indian, indonesian, mexican, greek, spanish, lebanese, moroccan, american, ...).
- `tags`: 3–8, lowercase **English** always, consistent vocabulary:
  - cuisine tag (same as `cuisine`; for any Asian cuisine ALSO add `asian`; for Italian/Greek/Spanish/Lebanese etc. you may add `mediterranean`)
  - main protein: one of `chicken beef pork lamb turkey veal duck fish salmon tuna cod prawns seafood eggs tofu tempeh lentils chickpeas beans`
  - format: `pasta rice noodles traybake stew soup curry salad bowl stir-fry grill oven one-pot wrap burger risotto`
  - mood words exactly as defined: `comfort` `light` `quick` (only if total_min <= 25) `fancy` (special / date-night dishes) ; `vegetarian` when there is no meat/fish.
- `difficulty` and `equipment`: see [recipe-template.md](recipe-template.md#equipment). Keep equipment coarse: count pots/pans/dishes, say whether the oven is on, and list only uncommon equipment under `special`.
- `steps`: rewrite in YOUR OWN WORDS (never copy the site's sentences), in the recipe language, one action per step, in order, keeping concrete temps/times/doneness cues. Typically 4–10 steps. Steps refer to 2 servings implicitly (don't mention quantities that only apply to the original yield).
- `image_url`: exact source main photo URL or null.

### Ingredient lines (`text` and `original_text`)
Format exactly: `<quantity> <unit> <name>[, note]` — or `<name>` alone for staples without amount.
- `original_text`: the source's quantity for `original_servings`. `text`: scaled to 2 servings. Round sensibly (grams to 5 g, pieces to 0.5, spoons to 0.5). If original_servings is 2, both are equal.
- `<name>` must be EXACTLY the catalogue name for the recipe's language (column EN / FR / IT below), or a listed alias. Nothing else in the name part: no "di", "de", "d'", no adjectives. Put descriptors after a comma: `200 g petto di pollo, a cubetti`, `1 c. à soupe huile d'olive`, `2 cloves garlic, minced`.
- Units allowed:
  - en: `g kg ml l tbsp tsp clove pinch can bunch slice piece` (no unit = piece, e.g. `1 onion`)
  - fr: `g kg ml cl l c. à soupe c. à café gousse(s) pincée botte tranche(s) boîte` (no unit = piece)
  - it: `g kg ml l cucchiaio cucchiai cucchiaino cucchiaini spicchio spicchi pizzico mazzetto fetta fette scatola` (no unit = piece)
- Convert vague units (glass/bicchiere/verre, handful/manciata, "q.b.") to g or ml and set `guessed: true`. Every non-staple ingredient needs an amount; if the source gives none, estimate and set `guessed: true`.
- Prefer g/ml for meat, fish, grains, pasta, vegetables when the source gives them.
- Helper fields (machine-checked, keep them accurate): `_catalog` = the EN catalogue name the line maps to; `_qty` = scaled numeric quantity (number, null if none); `_unit` = one of `g kg ml l tbsp tsp clove pinch can bunch slice piece` (English normalized) or null.
- Skip pure garnish water ("acqua", "water") lines entirely. Keep salt/pepper/oil lines.
- Sub-recipes (e.g. a sauce): flatten into the one list.

## Catalogue
Map every ingredient to an existing entry when it is the same thing or a close
nutritional equivalent (use `red lentils` for any dry lentil; whole-wheat pasta -> pasta; any dry pasta shape -> pasta; any rice -> rice; parmigiano/grana/pecorino -> parmesan; any chilli -> chili flakes; cream/panna/crème liquide -> crème fraîche; any stock -> chicken stock; any vinegar -> vinegar; turkey breast is NOT chicken). Only create a NEW ingredient when nothing close exists.

EN | FR | IT  (existing; use exactly these names, or aliases in brackets)
- olive oil | huile d'olive | olio d'oliva [olio extravergine di oliva, olio evo]
- salt | sel | sale
- black pepper | poivre noir [poivre] | pepe nero [pepe]
- garlic | ail [gousse d'ail] | aglio
- chicken stock [stock, broth, vegetable stock] | bouillon de volaille [bouillon] | brodo [brodo vegetale, brodo di pollo]
- butter | beurre | burro
- soy sauce | sauce soja | salsa di soia
- flour | farine | farina
- sugar | sucre | zucchero
- cumin | cumin | cumino
- paprika | paprika | paprika
- chili flakes [chilli flakes] | piment | peperoncino
- dried oregano [oregano] | origan | origano
- vinegar [balsamic vinegar] | vinaigre | aceto [aceto balsamico]
- onion | oignon | cipolla
- shallot | échalote | scalogno
- tomato | tomate | pomodoro [pomodori]
- cherry tomatoes | tomates cerises | pomodorini
- spinach | épinards | spinaci
- broccoli | brocoli | broccoli
- zucchini [courgette] | courgette | zucchina [zucchine]
- bell pepper | poivron | peperone [peperoni]
- carrot | carotte | carota [carote]
- potato | pomme de terre [pommes de terre] | patata [patate]
- sweet potato | patate douce | patata dolce
- mushrooms | champignons | funghi [champignon]
- lemon [lemon juice] | citron | limone [succo di limone]
- lime | citron vert | lime
- avocado | avocat | avocado
- cucumber | concombre | cetriolo
- ginger | gingembre | zenzero
- fresh basil [basil] | basilic | basilico
- fresh coriander [cilantro, coriander] | coriandre | coriandolo
- parsley | persil | prezzemolo
- spring onion [scallion, green onion] | oignon nouveau | cipollotto
- leek | poireau | porro
- eggplant [aubergine] | aubergine | melanzana [melanzane]
- lettuce | salade | lattuga [insalata]
- chicken breast [chicken] | blanc de poulet [poulet, filet de poulet] | petto di pollo [pollo]
- chicken thigh | cuisse de poulet [haut de cuisse] | sovracosce di pollo [cosce di pollo]
- ground beef [minced beef] | bœuf haché | macinato di manzo [carne macinata]
- pork tenderloin [pork] | filet mignon de porc | filetto di maiale [maiale]
- bacon [pancetta] | lardons | pancetta [guanciale]
- salmon fillet [salmon] | pavé de saumon [saumon] | salmone [filetto di salmone]
- cod fillet [cod] | dos de cabillaud [cabillaud] | merluzzo
- prawns [shrimp] | crevettes | gamberi [gamberetti]
- tuna [canned tuna] | thon | tonno
- eggs [egg] | œufs [oeufs, oeuf] | uova [uovo]
- greek yogurt [yogurt] | yaourt grec [yaourt] | yogurt greco [yogurt]
- parmesan [parmigiano] | parmesan | parmigiano [parmigiano reggiano, grana padano, pecorino]
- feta | feta | feta
- mozzarella | mozzarella | mozzarella
- crème fraîche [cream, heavy cream] | crème fraîche [crème liquide] | panna
- milk | lait | latte
- coconut milk | lait de coco | latte di cocco
- tofu | tofu | tofu
- rice [basmati rice, jasmine rice] | riz | riso [riso carnaroli, riso arborio]
- pasta [spaghetti, penne, linguine] | pâtes | pasta [spaghetti, penne, fusilli, linguine, rigatoni]
- noodles [rice noodles, egg noodles] | nouilles | noodles
- couscous | semoule | cous cous
- quinoa | quinoa | quinoa
- red lentils [lentils] | lentilles corail [lentilles] | lenticchie [lenticchie rosse]
- chickpeas | pois chiches | ceci
- black beans [beans] | haricots noirs | fagioli neri [fagioli]
- canned tomatoes [crushed tomatoes, passata] | tomates concassées [tomates pelées] | pomodori pelati [pelati, passata di pomodoro, polpa di pomodoro]
- tomato paste | concentré de tomate | concentrato di pomodoro
- curry paste [red curry paste, green curry paste] | pâte de curry | pasta di curry
- tortillas [wraps] | tortillas | tortillas
- bread [baguette, sourdough] | pain | pane
- pesto | pesto | pesto
- honey | miel | miele
- sesame oil | huile de sésame | olio di sesamo
- peanut butter | beurre de cacahuète | burro di arachidi
- frozen peas [peas] | petits pois | piselli

### NEW_INGREDIENT (only when nothing above fits)
```json
{ "name": "white wine", "name_fr": "vin blanc", "name_it": "vino bianco",
  "aliases": ["dry white wine"], "default_aisle": "drinks", "is_staple": false,
  "kcal_100g": 82, "protein_100g": 0.1, "grams_per_unit": null, "diet_class": "veg" }
```
- `name` lowercase English singular-ish; `name_fr` and `name_it` are the exact
  names you use in FR / IT lines. Lines in a language must use that language's name.
- `default_aisle`: produce meat_fish dairy_eggs bakery pantry spices frozen drinks household other
- `is_staple`: true only for oils, salt, spices, dried herbs, condiments used in small amounts.
- kcal/protein per 100 g RAW, realistic values. `grams_per_unit` required if you
  count it in pieces/cloves/cans/slices/bunches (weight of one), else null.
- `diet_class`: veg / fish / meat — get this right (fish sauce = fish, anchovies = fish, chorizo = meat, gelatin = meat).
- Before adding, check you didn't already add it; reuse your own new names consistently.
- Common ones you will likely need (use these exact EN names if you add them, so
  agents stay consistent): white wine, red wine, olives, capers, anchovies,
  rosemary, thyme, bay leaf, fresh mint, dill, celery, fennel, green beans,
  cauliflower, cabbage, kale, asparagus, pumpkin, peas (fresh -> use frozen peas),
  turkey breast, veal, beef steak, beef stew meat, lamb, duck breast, sausage,
  chorizo, ham, sea bass, sea bream, swordfish, squid, mussels, clams,
  ricotta, goat cheese, gruyère, emmental, cottage cheese, white beans,
  cannellini beans, kidney beans, green lentils (do NOT add; use red lentils),
  edamame, bulgur, farro, barley, polenta, oats, potato gnocchi, puff pastry,
  fish sauce, oyster sauce, hoisin sauce, rice vinegar, mirin, miso paste,
  gochujang, sriracha, sesame seeds, cashews, peanuts, almonds, pine nuts,
  walnuts, coconut cream, tahini, harissa, curry powder, garam masala,
  turmeric, cinnamon, coriander seeds, five-spice, star anise, mustard,
  dijon mustard, worcestershire sauce, cornstarch, breadcrumbs, lemongrass,
  bean sprouts, bok choy, pak choi (-> bok choy), red cabbage, beetroot,
  radish, corn, tomato sauce (-> canned tomatoes).

## When done
Validate your file parses (python3 -c "import json;json.load(open(PATH))").
Reply with a short summary: count of recipes, list of titles with source_name,
any recipe where protein looked under 25 g/serving, and new ingredient names.
