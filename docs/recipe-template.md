# Recipe data template

Use this to build the recipe catalogue. Each recipe is one JSON object in the
shape of the example below. That's the same shape the `import-recipe`
function's `save` action takes, so a bulk import can send each object as it is.

## Example

The catalogue is a JSON list of these objects. Copy this one and replace the values.

```json
[
  {
    "id": "5b0f9c1e-7d2a-4c8e-9f3b-2a6d8e1c4b70",
    "title": "Chicken thigh red curry",
    "language": "en",
    "servings": 2,
    "original_servings": 4,
    "prep_min": 10,
    "cook_min": 25,
    "source_type": "seed",
    "source_name": "RecipeTin Eats",
    "source_url": "https://www.example.com/chicken-thigh-red-curry/",
    "image_url": "https://example.com/images/chicken-thigh-red-curry.webp",
    "image_source_url": "https://www.example.com/wp-content/uploads/red-curry.jpg",
    "cuisine": "thai",
    "tags": ["chicken", "curry", "comfort", "asian", "thai"],
    "difficulty": "easy",
    "equipment": { "pots": 2, "oven": false, "special": [] },
    "ingredients": [
      { "id": "0c3e7a52-1b9d-4f60-8e2a-7d4b9c1f6e38", "text": "350 g chicken thigh, diced", "original_text": "700 g chicken thigh, diced" },
      { "text": "2 tbsp red curry paste", "original_text": "4 tbsp red curry paste" },
      { "text": "400 ml coconut milk", "original_text": "800 ml coconut milk" },
      { "text": "1 bell pepper, sliced", "original_text": "2 bell pepper, sliced" },
      { "text": "100 g spinach", "original_text": "200 g spinach" },
      { "text": "150 g rice", "original_text": "300 g rice" },
      { "text": "1 lime", "original_text": "2 lime", "guessed": false },
      { "text": "10 g fresh coriander, chopped", "original_text": "20 g fresh coriander, chopped", "optional": true },
      { "text": "olive oil", "original_text": "olive oil" }
    ],
    "steps": [
      "Fry the curry paste in a little oil for 1 min.",
      "Add the chicken, then the coconut milk; simmer 15 min.",
      "Add the pepper and spinach and cook 3 min more.",
      "Serve with rice and lime wedges."
    ],
    "translations": {
      "fr": {
        "title": "Curry rouge de cuisses de poulet",
        "steps": [
          "Faire revenir la pâte de curry dans un peu d'huile 1 min.",
          "Ajouter le poulet, puis le lait de coco ; laisser mijoter 15 min.",
          "Ajouter le poivron et les épinards et cuire encore 3 min.",
          "Servir avec du riz et des quartiers de citron vert."
        ]
      },
      "it": {
        "title": "Curry rosso di cosce di pollo",
        "steps": [
          "Soffriggere la pasta di curry in un filo d'olio per 1 min.",
          "Aggiungere il pollo, poi il latte di cocco; cuocere a fuoco lento 15 min.",
          "Aggiungere il peperone e gli spinaci e cuocere ancora 3 min.",
          "Servire con riso e spicchi di lime."
        ]
      }
    }
  }
]
```

Each field is one of three kinds:

- **You fill it in**: the app can't work it out.
- **Computed**: the server works it out from the ingredients. Leave it out.
- **System**: set by the database. Leave it out.

## Recipe fields

| Field | Kind | Required | Format / rules | What it's used for |
| --- | --- | --- | --- | --- |
| `id` | You | **yes** for seed recipes | A new lowercase uuid (`python3 -c "import uuid; print(uuid.uuid4())"`). Never change or reuse it. Every ingredient line has one too. | The recipe's id in every database, so decks, swipes, meals and copies keep pointing at it whatever else changes. |
| `title` | You | **yes** | Text, up to 200 characters. Keep it short enough for a card, e.g. "Chicken thigh red curry". | Cards, list, search, placeholder emoji |
| `language` | You | yes | `"en"`, `"fr"` or `"it"`. Title, ingredient lines and steps are written in this language. | Display. Ingredient names are matched in all three languages either way. |
| `servings` | You | **yes** | Number > 0 (defaults to 2 if left out). It's the number of servings the `text` quantities make. Seed recipes are scaled to 2. | Divides total macros into per-serving values. A wrong number gives wrong portions. |
| `original_servings` | You | optional | Number > 0. The yield the source recipe was written for (lower bound of a range). | Shows the original yield and lets the app rescale from the source values. Must match the quantities in each ingredient's `original_text`. |
| `prep_min` | You | **yes** for seed recipes | Whole minutes of hands-on preparation: chopping, mixing, shaping, assembling. Not marinating or resting. | Recipe detail ("Prep 10 min") |
| `cook_min` | You | **yes** for seed recipes | Whole minutes on the hob, in the oven or on the grill. `0` for no-cook dishes. | Recipe detail ("Cooking 25 min", or "No cooking") |
| `total_min` | You | only with waiting time | Whole minutes start to plate. **Leave it out** and it's `prep_min + cook_min`. Write it only when the recipe also waits: marinating, soaking, rising, resting. It must then be more than prep + cook. | "Quick" mood (≤ 25 min), "fancy" mood (≥ 45 min), and the max-minutes filter. A recipe with no times at all never passes a time filter's boost. |
| `ingredients` | You | **yes**, at least 1 | List of `{ "text": "...", "guessed": false }`. See below. | Everything computed below |
| `translations` | You | **yes** for seed recipes | `{ "<lang>": { "title": "…", "steps": ["…"] } }` for each of `en`, `fr`, `it` except the recipe's own `language`. Same number of steps, in the same order, with the same quantities, times and temperatures. French and Italian steps use the infinitive ("Faire revenir…", "Rosolare…"), English the imperative. | The title and steps in the reader's language, everywhere in the app. Ingredient names are translated by the catalogue. |
| `steps` | You | yes | List of strings, one action per step, in order | Cooking mode, one step per screen |
| `tags` | You | recommended | Up to 12, lowercase. See the tag list below. | Mood matching, "never"/"love" taste rules, learned patterns |
| `difficulty` | You | **yes** for seed recipes | `"easy"`, `"medium"` or `"hard"`. Easy = basic techniques, forgiving. Medium = several components or timing to juggle (sear then braise, a sauce, marinating). Hard = delicate technique (dough, deep-frying, emulsions, many components); use it sparingly. | "Easy" filter, recipe tile and detail |
| `equipment` | You | **yes** for seed recipes | `{ "pots": n, "oven": true/false, "special": [...] }`. Keep it coarse: it's there to tell an easy cook from a tedious one. See below. | "One pot" filter; 3+ pots and special equipment are flagged on tiles |
| `image_url` | You | recommended | Absolute `https://` URL. See image specs. | Swipe card, recipe tile, detail hero |
| `image_source_url` | You | optional | URL the photo was originally taken from. Stays the same after you re-host the image under `image_url`. | Photo credit, re-downloading |
| `source_name` | You | recommended with `source_url` | Display name of the website, e.g. `GialloZafferano`, `Marmiton`, `RecipeTin Eats`. | "From GialloZafferano" credit line |
| `source_url` | You | **yes** for seed recipes, except AI-generated ones | URL of the original recipe | Credit/link-out. It must be unique within a household (duplicates are rejected). The seed library also uses it to recognise a recipe it has already loaded. |
| `ai_generated_recipe` | You | optional | `true` when the recipe was written by an AI rather than taken from a source. Such seed recipes have no `source_url`, `original_servings` or `original_text`. | Not shown in the app. Lets these recipes be reviewed and checked separately. |
| `cuisine` | You | optional | One lowercase English word or phrase: `italian`, `french`, `thai`, `mexican`… The same word is also put in `tags`. | Cuisine filter or grouping, without parsing tags |
| `source_type` | You | optional | `seed` for the catalogue. Otherwise `web`, `instagram`, `photo`, `typed` or `ai`. | Provenance |
| `kcal_per_serving` | Computed | — | — | Worked out from ingredients, never copied from the source site |
| `protein_g_per_serving` | Computed | — | — | Same as above |
| `macros_estimated` | Computed | — | — | True if any ingredient was guessed, unknown, or had no amount |
| exotic ingredients | Computed | — | — | Ingredients whose catalogue entry has `exotic` set (not sold in most French supermarkets). Flagged on the recipe and drive the "Everyday ingredients" filter. |
| diet class (veg/fish/meat) | Computed | — | — | Worked out from the ingredients each time a deck is dealt. Not stored. |
| `id`, `household_id`, `created_by`, `created_at`, `updated_at`, `copied_from` | System | — | — | — |

## Equipment

| Key | Rules |
| --- | --- |
| `pots` | Every pot, pan, wok and oven dish or tray that gets dirty. A vessel reused after emptying counts once. Count the vessel for a side the recipe cooks (rice, pasta…). `1` makes it a one-pot recipe; `3` or more is flagged as a lot of washing up. `0` only for barbecue-only recipes. |
| `oven` | `true` if the oven (or its grill) is used. |
| `special` | Only equipment many kitchens lack, from: `blender` (incl. stick blender), `food processor`, `stand mixer`, `thermometer`, `mortar and pestle`, `barbecue`, `mandoline`, `rolling pin`, `steamer`, `rice cooker`, `slow cooker`, `pressure cooker`, `air fryer`. In that order. Never list basics: baking tray, sieve, grater, string, whisk, skewers. |

## Ingredient lines

Write each ingredient as one natural line. The server splits it up:

```
"<quantity> <unit> <name>[, preparation note]"
"300 g chicken thigh, diced"      -> 300, g, chicken thigh
"2 cloves garlic"                 -> 2, clove, garlic
"1 onion"                         -> 1, piece, onion
"½ c. à café de cumin"            -> 0.5, tsp, cumin
"2 spicchi aglio"                 -> 2, clove, garlic
"1 cucchiaio olio d'oliva"        -> 1, tbsp, olive oil
"salt"                            -> no amount (fine for staples)
```

Each ingredient can carry two lines in this format:

| Key | Required | What it holds |
| --- | --- | --- |
| `id` | **yes** for seed recipes | A new lowercase uuid per line, never changed or reused. The example shows it on the first line only. |
| `text` | **yes** | Quantities for `servings`. This is what the server parses and computes from. |
| `original_text` | optional | The same line with the source's quantities, for `original_servings`. Same name and format, so the server can parse it too. It's kept for reference and isn't used for macros. |
| `guessed` | optional | See below |
| `optional` | optional | `true` when the dish works without the line. See below. |

| Part | Kind | Rules |
| --- | --- | --- |
| quantity | You | `300`, `1.5`, `1,5`, `1 1/2`, `½`. A range like `2-3` takes the upper bound. |
| unit | You | `g kg ml cl l tbsp tsp cup oz lb clove pinch can bunch slice piece`, or their EN/FR/IT spellings (table below). No unit means `piece`. |
| name | You | Use the ingredient catalogue's name in the recipe's language (`name`, `name_fr`, `name_it`) or one of its aliases (see `supabase/seed.sql`), e.g. `chicken thigh`, not "boneless skinless thighs from the butcher". Don't put connectors in front of the name: write `2 spicchi aglio`, not `2 spicchi d'aglio`. |
| `guessed` | You | `true` if you aren't sure of the amount. The macros are then marked as estimated. |
| `optional` | You | `true` for a line the dish works without: herbs scattered on top, sesame seeds, a spring-onion garnish, a finishing chilli, cheese grated over at the table, a side the source calls optional. Decide it per recipe, not per ingredient: coriander on a curry is optional, coriander in a green chutney isn't; Parmesan on pasta e ceci is optional, Parmesan in a parmigiana isn't. A person's "never" rule doesn't take a recipe out of the deck for an optional line, and the page shows it as optional. It still counts in the macros. |
| preparation note | You (optional) | Anything after a comma or in brackets is ignored by the parser and kept only in `raw_text`. |
| canonical name, aisle, staple flag, `raw_text`, `position` | Computed | From the catalogue match and the line order |

**Unit spellings per language** (each maps to the unit in the first column):

| Unit | en | fr | it |
| --- | --- | --- | --- |
| tbsp | `tbsp` | `c. à soupe` | `cucchiaio`, `cucchiai` |
| tsp | `tsp` | `c. à café` | `cucchiaino`, `cucchiaini` |
| clove | `clove(s)` | `gousse(s)` | `spicchio`, `spicchi` |
| pinch | `pinch` | `pincée(s)` | `pizzico`, `pizzichi` |
| bunch | `bunch` | `botte(s)` | `mazzetto`, `mazzetti` |
| slice | `slice(s)` | `tranche(s)` | `fetta`, `fette` |
| can | `can(s)` | `boîte(s)` | `scatola`, `scatole` |
| g kg ml cl l | same in all three languages | | |

The parser accepts these spellings in any recipe and matches ingredient names
against `name`, `name_fr`, `name_it` and `aliases`.

**Writing ingredients so the computed values come out right:**

1. **Give every non-staple ingredient an amount.** Use weights where you can, because `g`/`ml` are exact. A `piece` is converted using the catalogue's `grams_per_unit`, so `1 onion` counts as 150 g.
2. **Make sure every ingredient is in the catalogue.** An ingredient the catalogue doesn't have:
   - adds 0 kcal and 0 protein, and the recipe is marked as estimated;
   - is grouped under the **Other** aisle on the grocery list;
   - **counts as vegetarian.** An uncatalogued meat or fish (e.g. `chorizo`) makes the whole recipe show up for vegetarians.

   When a name is missing, add it to the catalogue first (next section).
3. **Quantities are for the whole recipe** (all `servings`), not per person.
4. **Bone-in and in-shell weights overcount.** The catalogue values are for edible
   weight, so `900 g chicken thigh` (bone-in) or `500 g mussels` (in shell)
   overstates protein and kcal. Write the edible weight where the source allows,
   or set `guessed: true`.

## Adding a catalogue ingredient (when the name is missing)

| Field | Required | Example | Notes |
| --- | --- | --- | --- |
| `name` | yes | `chorizo` | Lowercase English, singular-ish |
| `name_fr` | yes | `chorizo` | French name for matching and display |
| `name_it` | yes | `chorizo` | Italian name for matching and display |
| `aliases` | optional | `{chorizo sausage}` | Other spellings in any language |
| `default_aisle` | yes | `meat_fish` | `produce meat_fish dairy_eggs bakery pantry spices frozen drinks household other` |
| `is_staple` | yes | `false` | `true` for oil, salt, spices: these go on the list unchecked and don't need amounts |
| `kcal_100g` | yes | `455` | Raw weight, per 100 g |
| `protein_100g` | yes | `24` | Raw weight, per 100 g |
| `grams_per_unit` | yes if counted in pieces/cloves/cans | `60` | Grams in one `piece` (or clove, can…) |
| id | yes | a new uuid | Fixed id, the same in every environment; the ingredient's grocery product gets it too. Add the name and a new uuid to the "Fixed ids for catalogue ingredients" list in `seed.sql`. Never change or reuse one. |
| `exotic` | optional | `false` | `true` when most French supermarkets don't sell it (needs an Asian or specialty shop). Set in the `update … set exotic` list at the end of `seed.sql`. |
| `diet_class` | **yes** | `meat` | `veg`, `fish` or `meat`. This drives the diet filters. |

## Tags

Lowercase, up to 12. Tags don't decide the diet (the ingredients do), but they do
drive moods and taste rules. Use these words where they apply, because the deck
looks for them exactly:

| Mood | Tags that trigger it |
| --- | --- |
| comfort | `comfort`, `curry`, `stew`, `pasta`, `soup` |
| light | `light`, `salad`, `bowl`, `fish` |
| quick | `quick` (or just a total time ≤ 25 min) |
| fancy | `fancy`, `date night`, `special` |

Add cuisine (`asian`, `mexican`, `mediterranean`…), main protein (`chicken`,
`beef`, `tofu`…) and format (`traybake`, `noodles`, `eggs`…). People can mark
any tag as "never" or "love", so use the same word every time (`chicken`, not
`poulet` in one recipe and `chicken` in another). **Tags are always in English,
whatever the recipe's `language`.**

The seed library also uses these tags:

| Tag | Meaning |
| --- | --- |
| `fish` | Main protein is fish or seafood. Added alongside `salmon`, `cod`, `prawns`… so the "light" mood picks it up. |
| `asian` | Added alongside every Asian cuisine tag (`chinese`, `thai`, `indian`…) |
| `vegetarian` | No meat or fish |
| `high protein` | 35 g protein or more per serving (estimated) |
| `make ahead` | Needs marinating, soaking or long resting, so `total_min` is long but mostly hands-off |
| `treat` | Indulgent dish that doesn't follow the healthy brief |

## Image specs

One image per recipe. The app shows the same file in three crops, each with
`background-size: cover` centred:

| Where | Shape on a phone (~390 px wide) | Crop from a 4:3 image |
| --- | --- | --- |
| Recipe tile (list) | 4:3 | none |
| Detail / match hero | full width × 260 px, about 3:2 | a little off top and bottom |
| Swipe card | roughly square to slightly portrait | about ¼ off each side |

| Spec | Value |
| --- | --- |
| Aspect ratio | **4:3 landscape** |
| Size | **900 × 675 px** (sharp on a phone-width card; larger sources are scaled down) |
| Safe area | Keep the dish inside the **central square** (the middle 75% of the width). Nothing important near the edges. |
| Format | WebP (quality ~80) or JPEG (quality ~82), progressive. sRGB. |
| File size | Under 100 KB is the target (WebP ~q70), 200 KB at most. Cards load over mobile data. |
| Content | The finished dish, top-down or 45°, plated as served. No text, logos, watermarks or borders. The title is drawn by the app. |
| Hosting | An absolute `https://` URL you're allowed to reuse, and that will stay up. Seed library photos live in `web/public/recipe-photos/` and are referenced as `/recipe-photos/<file>.webp`; `scripts/download_images.py` makes them from each `image_source_url` |
| Missing image | Allowed. The app shows a food emoji picked from the title and tags. |

> **Note:** `image_path` can also hold a path in the private `recipe-images`
> storage bucket (`<household_id>/<file>`). The app currently only *displays*
> `https://` URLs, so for now host catalogue images at a public URL.

## Checklist per recipe

- [ ] title, language, servings, prep_min, cook_min (total_min only if there's marinating, rising or resting)
- [ ] source_name and source_url; original_servings if you scaled the recipe
- [ ] every ingredient has an amount (staples can skip it) and a catalogue name in the recipe's language
- [ ] if scaled: every ingredient has an `original_text` with the source's quantities
- [ ] any missing catalogue ingredient added, with its `diet_class`
- [ ] steps in order, one action each
- [ ] title and steps translated into the other two of en, fr, it, step for step
- [ ] garnishes and toppings the dish works without marked `optional`
- [ ] AI-written: `ai_generated_recipe: true`, no `source_url`
- [ ] difficulty and equipment (pots, oven, special only if uncommon)
- [ ] 3–8 tags, using the mood words where they apply
- [ ] 4:3 image, 900 × 675, dish centred, under 200 KB
