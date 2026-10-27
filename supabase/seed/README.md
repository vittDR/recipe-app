# Seed recipe library

110 recipes: 25 Italian, 25 French, 25 Asian, 25 from other cuisines and 10 "treat" dishes.

| File | What it is |
| --- | --- |
| `recipes.json` | The recipes, in the `import-recipe` save shape (format: [docs/recipe-template.md](../../docs/recipe-template.md)). This is the source of truth. |
| `recipes-summary.csv` | Review sheet: group, source, time, estimated protein and kcal per serving, photo yes/no. |

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
- Collection rules for adding more: [docs/recipe-collection-guidelines.md](../../docs/recipe-collection-guidelines.md).

## Photos

`image_path` points at each source site's own photo (9 recipes have none and show the emoji). Some sites block hotlinking. To host your own copies at the app's 4:3 spec:

```bash
pip install requests pillow
python3 scripts/download_images.py supabase/seed/recipes.json images/ --base-url <public URL of your storage folder>
```

Upload `images/`, then load the written `recipes.hosted.json` instead (copy it over `recipes.json` and regenerate).

## Known limits

- **Low protein:** eight of the healthy recipes estimate under 25 g per serving: Cozze alla tarantina, Frittata di zucchine e ricotta, Œufs pochés épinards et lentilles, Chicken tinga, Moules marinières, Spaghetti alle vongole, Poulet à l'estragon, Crispy scallion ginger salmon.
- **Bone-in and in-shell weights overcount** protein and kcal, because the catalogue is per edible weight (satay drumsticks, Peruvian chicken, Moroccan tagine, mussels, clams).
- **Long `total_min`** for marinated or soaked dishes (tandoori chicken 415 min, brandade 1,485 min), so the time filter treats them as slow. They're tagged `make ahead`.
- **Herb bunches** count as 1 g (`grams_per_unit = 1`), and `1 mazzetto rucola` is left out of the macros (arugula has no weight per bunch). Both are negligible.
