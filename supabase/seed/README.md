# Seed recipe library

813 recipes:

- **109 from recipe sites (hidden in the app** since November 2026: the library view and the deck leave out the `web` collection; they still open from past decks and meals): 25 Italian, 24 French, 25 Asian, 25 from other cuisines and 10 "treat" dishes.
- **10 AI-generated recipes**, whose Poulet basquaise replaced the Chef Simon one.
- **The original library, 290 recipes written for the app** (November 2026): 240 from the plan, plus 50 everyday plates (30 of them air-fryer). It follows the plan in [docs/recipe-library-plan.md](../../docs/recipe-library-plan.md): the draft list's kept and reworked dishes, plus named additions across 14 cuisine groups.
  - Each one was written for the app, informed by how the dish is commonly made (proportions, technique, times and temperatures), with quantities and steps in our own words. The recipes don't name or link any source.
  - They kept the dish's real ingredients, with anything most French supermarkets don't sell flagged `exotic` in the catalogue. Since the [weeknight rules](../../docs/recipe-library-plan.md#weeknight-rules), a supermarket stand-in replaces it where the dish works with one (dry sherry for Shaoxing wine, paprika for Kashmiri chilli…).
  - They are `ai_generated_recipe: true` with no `source_url`, so they belong to the `original` collection. All of them have illustrations (supplied as 900×675 WebP, re-encoded to about 100 KB where larger).
- **100 quick, healthy dishes** (November 2026), written the same way. All take 30 min or less in total and are healthy by the app's rule, which looks at what's on the plate rather than its numbers (see [recipe-classification.md](../../docs/recipe-classification.md)). Portions are each dish's normal ones. 42 use the air fryer.
- **45 weeknight chicken dinners** (November 2026), written the same way: 30 min or less in total, each with a base and a real portion of vegetables, from 15 cuisines across Europe, Asia, the Americas and beyond. 40 are healthy; the rest are comfort dishes. 19 use the air fryer. 31 of them were lightly reworked to the weeknight rules (more chicken and a little less base, supermarket stand-ins, yogurt for cream), so 40 now meet all six.
- **200 vegetarian weeknight dinners** (November 2026), for the vegetarian and vegan diets, written to the [weeknight rules](../../docs/recipe-library-plan.md#weeknight-rules): all six met, 10 to 40 min, at least 30 g of protein a serving from eggs, tofu, smoked tofu, soy mince, seitan, paneer, halloumi, skyr, cottage cheese or edamame, and 480 to 810 kcal. 86 are vegan, 82 use the air fryer, and they span 8 groups of cuisines. They are waiting for their illustrations.
- **59 weeknight plates** (November 2026), written to the [weeknight rules](../../docs/recipe-library-plan.md#weeknight-rules): healthy, 40 min or less, at least 30 g of protein and 25 % of the calories from it, no exotic ingredients, at most 10 lines that aren't staples or garnishes, and a protein, sauce, everyday carb and vegetable.
- **95 of the earlier recipes were reworked** (94, plus the chicken chow mein) at the same time because they failed just one of those rules (see [CATALOG-FIT-2026-11.md](../../docs/CATALOG-FIT-2026-11.md)).

| File | What it is |
| --- | --- |
| `recipes.json` | The recipes, in the `import-recipe` save shape (format: [docs/recipe-template.md](../../docs/recipe-template.md)). This is the source of truth. |

`../seed_library.sql` is generated from `recipes.json`. Don't edit it by hand:

```bash
npm run test:sql                        # leaves a local dineamite_test database with the catalogue
node scripts/build-seed-library.ts      # checks every line, prints the macros, writes seed_library.sql
```

The script runs each ingredient line through the app's parser and catalogue, the same way `import-recipe` does. It stops on any line that matches no catalogue ingredient. Add missing ingredients to `seed.sql` first.

## How the recipes were written

- Each recipe comes from its source page (`source_url`, credited by `source_name`). Titles, ingredient lines and steps are in the source's language: 27 Italian, 27 French, 56 English. Tags are always English.
- Quantities are scaled to 2 servings. `original_text` keeps the source's line for `original_servings`. Vague amounts ("q.b.", "a glass") were converted to g/ml and marked `guessed`.
- Steps are rewritten, one action per step.
- Collection rules for adding more: [docs/recipe-collection-guidelines.md](../../docs/recipe-collection-guidelines.md). What to add next (cuisine, base, time and season quotas): [docs/recipe-library-plan.md](../../docs/recipe-library-plan.md).

## Photos

The photos are in `web/public/recipe-photos/` and ship with the app, so `image_url` is a path like `/recipe-photos/spaghetti-alle-vongole.webp`. `image_source_url` keeps where each photo came from.

- Every recipe has a photo. The 11 site recipes whose source had none (or a dead link) have illustrations like the original library, so their `image_source_url` is the local path.
- The 10 AI-generated recipes have AI-generated photos (4:3 PNGs converted with `to_webp` from `download_images.py`). Their `image_source_url` is left out, so it's stored as the local path.
- 72 source photos were smaller than 1200×900 and were upscaled when downloaded (before the switch to 900×675), so some look soft.
- A few carry the source blog's watermark (Arrosto di tacchino, Blanquette de veau légère, Frittata di zucchine, Saltimbocca).
- The service worker doesn't precache them: each loads the first time a card shows it.

To replace or add photos, run `scripts/download_images.py` (needs `pip install requests pillow`), or drop a 4:3 WebP into the folder and point `image_url` at it. Then run `python3 scripts/make_thumbnails.py web/public/recipe-photos` to refresh the small copies in `recipe-photos/thumb/` that the Recipes grid uses. Regenerate `seed_library.sql` and reload it: recipes already in the database (and households' copies still showing the seed photo) pick up the new photo.

## Known limits

- **Low protein:** eight of the healthy recipes estimate under 25 g per serving: Cozze alla tarantina, Frittata di zucchine e ricotta, Œufs pochés épinards et lentilles, Chicken tinga, Moules marinières, Spaghetti alle vongole, Poulet à l'estragon, Crispy scallion ginger salmon.
- **Bone-in and in-shell weights overcount** protein and kcal, because the catalogue is per edible weight (satay drumsticks, Peruvian chicken, Moroccan tagine, mussels, clams).
- **Long `total_min`** for marinated or soaked dishes (tandoori chicken 415 min, brandade 1,485 min), so the time filter treats them as slow. They're tagged `make ahead`. Their `prep_min` and `cook_min` stay short.
- **AI-generated recipes:** 704 recipes (`ai_generated_recipe: true`) were written by Claude rather than taken from a site. None has a source link, and none has been tested in a kitchen. The first 10 have AI-generated photos; 494 others have illustrations, and the 200 vegetarian dinners are waiting for theirs.
- **How the original library was checked:** many recipe sites refused automated reading, so quantities were often set from search summaries and the classic proportions of each dish. None has been cooked to test it.
- **Ingredient mappings:** a few ingredients are mapped to the nearest catalogue entry rather than added (sour cream to crème fraîche, Comté to emmental, Napa cabbage to cabbage). Exotic ingredients the dish can't do without are kept and flagged.
- **Protein:** the weeknight rules ask for 30 g a serving and 25 % of the calories. Recipes that miss it are mostly built on pulses, halloumi or cheese, or are long braises; they stay as written (gołąbki, pumpkin and sage risotto, rajma, chana masala, halloumi fajitas…).
- **Optional lines** (garnishes, toppings) are judged per recipe; 74 lines in 54 recipes are marked so far.
- **Estimated prep and cook times:** 42 source pages give no prep/cook split, so those times were estimated from the steps.
- **Herb bunches** count as 1 g (`grams_per_unit = 1`), and `1 mazzetto rucola` is left out of the macros (arugula has no weight per bunch). Both are negligible.
