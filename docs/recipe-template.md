# Recipe data template

Use this to build the recipe catalogue. Each recipe is one JSON object in the
shape of the example below. That's the same shape the `import-recipe`
function's `save` action takes, so a bulk import can send each object as it is.

## Example

The catalogue is a JSON list of these objects. Copy this one and replace the values.

```json
[
  {
    "title": "Chicken thigh red curry",
    "language": "en",
    "servings": 2,
    "total_min": 35,
    "source_type": "seed",
    "source_url": null,
    "image_url": "https://example.com/images/chicken-thigh-red-curry.webp",
    "tags": ["chicken", "curry", "comfort", "asian"],
    "ingredients": [
      { "text": "350 g chicken thigh, diced" },
      { "text": "2 tbsp red curry paste" },
      { "text": "400 ml coconut milk" },
      { "text": "1 bell pepper, sliced" },
      { "text": "100 g spinach" },
      { "text": "150 g rice" },
      { "text": "1 lime", "guessed": false },
      { "text": "olive oil" }
    ],
    "steps": [
      "Fry the curry paste in a little oil for 1 min.",
      "Add the chicken, then the coconut milk; simmer 15 min.",
      "Add the pepper and spinach and cook 3 min more.",
      "Serve with rice and lime wedges."
    ]
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
| `title` | You | **yes** | Text, up to 200 characters. Keep it short enough for a card, e.g. "Chicken thigh red curry". | Cards, list, search, placeholder emoji |
| `language` | You | yes | `"en"` or `"fr"` | Display. Ingredient names are matched in both languages either way. |
| `servings` | You | **yes** | Number > 0 (defaults to 2 if left out). It's the number of servings the quantities below make. | Divides total macros into per-serving values. A wrong number gives wrong portions. |
| `total_min` | You | strongly recommended | Whole minutes, start to plate, including oven time | "Quick" mood (≤ 25 min), "fancy" mood (≥ 45 min), and the max-minutes filter. A recipe without it never passes a time filter's boost. |
| `ingredients` | You | **yes**, at least 1 | List of `{ "text": "...", "guessed": false }`. See below. | Everything computed below |
| `steps` | You | yes | List of strings, one action per step, in order | Cooking mode, one step per screen |
| `tags` | You | recommended | Up to 12, lowercase. See the tag list below. | Mood matching, "never"/"love" taste rules, learned patterns |
| `image_url` | You | recommended | Absolute `https://` URL. See image specs. | Swipe card, recipe tile, detail hero |
| `source_url` | You | optional | URL of the original recipe | Credit/link-out. It must be unique within a household (duplicates are rejected). |
| `source_type` | You | optional | `seed` for the catalogue. Otherwise `web`, `instagram`, `photo`, `typed` or `ai`. | Provenance |
| `kcal_per_serving` | Computed | — | — | Worked out from ingredients, never copied from the source site |
| `protein_g_per_serving` | Computed | — | — | Same as above |
| `macros_estimated` | Computed | — | — | True if any ingredient was guessed, unknown, or had no amount |
| diet class (veg/fish/meat) | Computed | — | — | Worked out from the ingredients each time a deck is dealt. Not stored. |
| `id`, `household_id`, `created_by`, `created_at`, `updated_at`, `copied_from` | System | — | — | — |

## Ingredient lines

Write each ingredient as one natural line. The server splits it up:

```
"<quantity> <unit> <name>[, preparation note]"
"300 g chicken thigh, diced"      -> 300, g, chicken thigh
"2 cloves garlic"                 -> 2, clove, garlic
"1 onion"                         -> 1, piece, onion
"½ c. à café de cumin"            -> 0.5, tsp, cumin
"salt"                            -> no amount (fine for staples)
```

| Part | Kind | Rules |
| --- | --- | --- |
| quantity | You | `300`, `1.5`, `1,5`, `1 1/2`, `½`. A range like `2-3` takes the upper bound. |
| unit | You | `g kg ml cl l tbsp tsp cup oz lb clove pinch can bunch slice piece`, or their EN/FR spellings. No unit means `piece`. |
| name | You | Use the ingredient catalogue's name or one of its aliases (see `supabase/seed.sql`), e.g. `chicken thigh`, not "boneless skinless thighs from the butcher". |
| `guessed` | You | `true` if you aren't sure of the amount. The macros are then marked as estimated. |
| preparation note | You (optional) | Anything after a comma or in brackets is ignored by the parser and kept only in `raw_text`. |
| canonical name, aisle, staple flag, `raw_text`, `position` | Computed | From the catalogue match and the line order |

**Writing ingredients so the computed values come out right:**

1. **Give every non-staple ingredient an amount.** Use weights where you can, because `g`/`ml` are exact. A `piece` is converted using the catalogue's `grams_per_unit`, so `1 onion` counts as 150 g.
2. **Make sure every ingredient is in the catalogue.** An ingredient the catalogue doesn't have:
   - adds 0 kcal and 0 protein, and the recipe is marked as estimated;
   - is grouped under the **Other** aisle on the grocery list;
   - **counts as vegetarian.** An uncatalogued meat or fish (e.g. `chorizo`) makes the whole recipe show up for vegetarians.

   When a name is missing, add it to the catalogue first (next section).
3. **Quantities are for the whole recipe** (all `servings`), not per person.

## Adding a catalogue ingredient (when the name is missing)

| Field | Required | Example | Notes |
| --- | --- | --- | --- |
| `name` | yes | `chorizo` | Lowercase English, singular-ish |
| `name_fr` | yes | `chorizo` | French name for matching and display |
| `aliases` | optional | `{chorizo sausage}` | Other spellings in any language |
| `default_aisle` | yes | `meat_fish` | `produce meat_fish dairy_eggs bakery pantry spices frozen drinks household other` |
| `is_staple` | yes | `false` | `true` for oil, salt, spices: these go on the list unchecked and don't need amounts |
| `kcal_100g` | yes | `455` | Raw weight, per 100 g |
| `protein_100g` | yes | `24` | Raw weight, per 100 g |
| `grams_per_unit` | yes if counted in pieces/cloves/cans | `60` | Grams in one `piece` (or clove, can…) |
| `diet_class` | **yes** | `meat` | `veg`, `fish` or `meat`. This drives the diet filters. |

## Tags

Lowercase, up to 12. Tags don't decide the diet (the ingredients do), but they do
drive moods and taste rules. Use these words where they apply, because the deck
looks for them exactly:

| Mood | Tags that trigger it |
| --- | --- |
| comfort | `comfort`, `curry`, `stew`, `pasta`, `soup` |
| light | `light`, `salad`, `bowl`, `fish` |
| quick | `quick` (or just set `total_min` ≤ 25) |
| fancy | `fancy`, `date night`, `special` |

Add cuisine (`asian`, `mexican`, `mediterranean`…), main protein (`chicken`,
`beef`, `tofu`…) and format (`traybake`, `noodles`, `eggs`…). People can mark
any tag as "never" or "love", so use the same word every time (`chicken`, not
`poulet` in one recipe and `chicken` in another).

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
| Size | **1600 × 1200 px** recommended, 1200 × 900 minimum (sharp on 3× screens) |
| Safe area | Keep the dish inside the **central square** (the middle 75% of the width). Nothing important near the edges. |
| Format | WebP (quality ~80) or JPEG (quality ~82), progressive. sRGB. |
| File size | Under 300 KB is the target, 500 KB at most. Cards load over mobile data. |
| Content | The finished dish, top-down or 45°, plated as served. No text, logos, watermarks or borders. The title is drawn by the app. |
| Hosting | An absolute `https://` URL you're allowed to reuse, and that will stay up. |
| Missing image | Allowed. The app shows a food emoji picked from the title and tags. |

> **Note:** `image_path` can also hold a path in the private `recipe-images`
> storage bucket (`<household_id>/<file>`). The app currently only *displays*
> `https://` URLs, so for now host catalogue images at a public URL.

## Checklist per recipe

- [ ] title, language, servings, total_min
- [ ] every ingredient has an amount (staples can skip it) and a catalogue name
- [ ] any missing catalogue ingredient added, with its `diet_class`
- [ ] steps in order, one action each
- [ ] 3–8 tags, using the mood words where they apply
- [ ] 4:3 image, at least 1200 × 900, dish centred, under 500 KB
