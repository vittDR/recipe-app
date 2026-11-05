# Recipe classification (v1)

The goal is a catalogue that can explain both similarities and differences
between recipes, so feedback can reveal preferences. A cod curry, fish and
chips and a Greek baked fish share an ingredient; their sauce, starch,
cooking method, texture and heat differ, and any of those can be why
someone likes one and passes on another.

Every recipe gets the same description from the same rules, whether it's in
the seed library, imported from a link or typed in. The description is
**derived** from the recipe's ingredients and amounts (against the
ingredient catalogue), its steps (in every language it has), its times,
equipment and tags. Nothing is annotated by hand and there are no AI calls.

Code: `supabase/functions/_shared/logic/classify.ts` (rules, vocabulary,
thresholds), with tests in `logic/tests/classify.test.ts`. Catalogue data:
the last `update` block of `supabase/seed.sql`.

## Not stored: recomputed where it's used

The classification isn't a column. `classifyRow()` runs wherever it's needed:
in `deal-deck` (scoring and learning), in the app (Recipes filters, the
recipe page's "About this dish", the Us tab's patterns), in `import-recipe`
(returned after a save) and in `build-seed-library.ts` (coverage report).
So it always matches the current catalogue and rules: changing a trait or a
threshold reclassifies every recipe, with no backfill. `CLASSIFICATION_VERSION`
is bumped when a rule changes what recipes are called.

## Four layers, kept apart

1. **Identity and ingredients**: the recipe row and its normalised lines
   (catalogue names, amounts, units, optional lines). Already existed.
2. **What the dish is** (taste and meal characteristics): below.
3. **Practical fit**: `prep_min` / `cook_min` / `total_min`, `difficulty`
   (`easy` / `medium` / `hard`) and `equipment` (`{ pots, oven, special }`)
   stay as they were. The draft's active/total minutes and equipment list
   map onto these; nothing was duplicated.
4. **Constraints**: diet class, never rules on catalogue items, optional
   lines. Unchanged: classification never decides whether a recipe is
   allowed, only how it's described and ranked.

## Vocabulary

| Field | Values | Derived from |
| --- | --- | --- |
| `cuisines` | the recipe's cuisine and cuisine tags, plus broader ones (`goan` → `indian` → `asian`) | `cuisine`, tags, `CUISINE_PARENTS` (sourced) |
| `protein_groups` | poultry, beef, pork, lamb, veal, game, offal, fish, shellfish, eggs, legumes, soy, dairy | `protein:*` traits, a group counting from 6 g protein per serving or a quarter of the dish's protein |
| `starch_bases` | rice, pasta, noodles, potato, sweet_potato, bread, flatbread, tortilla, grain, rice_cakes | `starch:*` traits, from 80 kcal per serving |
| `dish_families` | curry, stew, soup, salad, grain_bowl, rice_dish, pasta_dish, noodle_dish, stir_fry, wrap, sandwich, tacos, pizza, pie, gratin, traybake, roast, savory_pancake, egg_dish, dumplings, plated, other | tags, then title words (EN/FR/IT), then what's on the plate |
| `sauce_families` | tomato, cream, cheese, coconut, broth, soy_based, chilli_based, peanut, yogurt, mustard, gravy, herb_oil, citrus, mayonnaise | `sauce:*` traits above a per-family amount per serving (`SAUCE_MIN_G`; `@n` on a trait overrides it) |
| `cooking_methods` | pan_fried, stir_fried, deep_fried, baked, roasted, grilled, braised, simmered, poached, steamed, boiled, no_cook | words in the steps (EN/FR/IT), tags, the oven flag, `cook_min = 0` |
| `heat_level` | 0 none, 1 mild, 2 medium, 3 hot, 4 very hot | grams per serving × `heat:*` of each chilli ingredient (spoons of spices weighed as dry); a `spicy` tag means at least 2 |
| `heat_adjustable` | true/false | chilli on optional lines (it doesn't raise the level) |
| `sauce_level` | 0 dry, 1 coated, 2 saucy, 3 brothy | grams of `liquid` ingredients per serving; soups are brothy, baked dishes at most saucy |
| `nutrition` | kcal, protein, fat, carbs, fibre per serving | `estimateMacros()`; a nutrient is null when ingredients without it carry over a tenth of the calories |
| `nutrition_goals` | high_protein, lean, low_kcal, high_fibre | numbers only (below) |
| `meal_intents` | comfort, indulgent, light, fuel, everyday, special_occasion | mood tags (sourced), then rules (below) |

`sourced` lists the fields a tag or the cuisine set rather than a rule.

Deliberately left for later, because they're the hardest to derive
consistently and the library is too small to learn them yet: the five
flavour axes (sweetness, tanginess, richness…), textures, aromatic notes,
relative cost and make-ahead suitability.

### Nutrition goals and meal intents: two axes

"Lean and high protein" and "comfort and pleasure" are not opposite ends of
one scale. Goals are what the numbers show; intents are what the dish is
for. Keeping them apart lets a turkey chilli be both lean and comfort food.

| Goal | Rule (per serving) |
| --- | --- |
| high_protein | ≥ 30 g protein **and** ≥ 25 % of calories from protein (not just a big plate) |
| lean | ≤ 30 % of calories from fat and ≤ 700 kcal; never claimed when fat is unknown |
| low_kcal | ≤ 500 kcal |
| high_fibre | ≥ 8 g fibre |

| Intent | Rule |
| --- | --- |
| comfort | `comfort` tag; or a stew, curry, soup, gratin, pie or roast; or a starch with a cream/cheese/gravy sauce, or saucy and ≥ 550 kcal |
| indulgent | `treat` tag; or deep-fried, ≥ 900 kcal, or ≥ 45 % fat and ≥ 700 kcal |
| light | `light` tag; or ≤ 500 kcal with ≤ 35 % fat, or a salad ≤ 600 kcal (never if indulgent) |
| fuel | high protein and lean |
| everyday | ≤ 45 min total, not hard, no exotic ingredients |
| special_occasion | `fancy` tag, or hard |

## Catalogue traits

Ingredients carry what they say about a dish in `ingredient_catalog.traits`:

- `protein:<group>`: the group it's a protein of (`protein:fish`).
- `starch:<base>`: the base it can be (`starch:rice`).
- `sauce:<family>[@grams]`: the sauce it makes in enough quantity
  (`sauce:coconut`; `sauce:cream@60` for milk, which takes more than cream).
- `heat:<points per gram>`: chilli heat. Chilli flakes 0.9, curry paste 0.15,
  gochujang 0.12: one teaspoon of flakes for two is mild, a tablespoon hot.
- `liquid`: counts towards how saucy the dish is (stock, wine, coconut milk,
  passata, milk, cream).

Plus `fat_100g`, `carbs_100g` and `fiber_100g` alongside kcal and protein. A
new ingredient without traits is still matched and counted; it just doesn't
make a dish fish, rice-based or spicy until someone adds them.

## Conventions

- **null is unknown, [] is none.** A recipe whose lines match nothing in the
  catalogue has `protein_groups: null`, not `[]`. There's no `none` value.
- **Tags people chose win.** `spicy`, `curry`, `comfort`… are sourced and
  feed the classification; rules only add to them.
- **Required lines describe the dish; optional lines don't.** Parmesan to
  serve doesn't make it a dairy dish; chilli on the side makes the heat
  adjustable, not higher.
- **Coarse on purpose.** Salt to taste doesn't produce a saltiness score;
  spoons are converted with water density except for chilli spices. These
  are estimates, recomputed as the rules improve.
- **One vocabulary.** Display labels live in `web/src/i18n` (`classes.*`), in
  English and French; the values never change with the language.

## Learning

Swipe learning (`logic/preferences.ts`) uses tags, non-staple ingredient
names and the classification as **namespaced features**: `protein:fish`,
`dish:curry`, `sauce:coconut`, `method:deep_fried`, `goal:lean`,
`intent:comfort`, `texture:brothy`, and cumulative heat (`heat:2+` is
"medium or hotter", so a liking for spicy food is one signal). Cuisines stay
plain names, like their tags. Tags that name a classified feature become it
(`curry` → `dish:curry`), including patterns accepted before v1, so nothing
counts twice.

The deck's mood is recorded with each swipe. A pass in a deck dealt for
"light" is partly about tonight: it counts half, and says nothing about the
dish's own mood (`intent:*` is skipped). Moods are matched on intents
(comfort → comfort, light → light, fancy → special occasion).

Still to do: separate liking the look of a dish, intending to cook it and
liking it after eating; record a reason for a pass; never treat unseen
recipes as negative (already true).

## Catalogue coverage

`node scripts/build-seed-library.ts --check` prints counts of dish families,
proteins, sauces, heat, goals and intents, protein × dish family, and lean ×
comfort. Use it to find gaps and confounds: if every vegetarian option is a
salad, a pass on salad can't be told from a pass on vegetarian. At v1 the
seed library is mostly not spicy (88 of 119 at heat 0), heavy on poultry and
fish, light on legumes and soy as the main protein, and has 14 lean comfort
dishes.

## Changing the rules

1. Edit the words, thresholds or traits (`classify.ts`, `seed.sql`).
2. `npm run test:logic`; add a test for the case you fixed.
3. Run the seed build script and read the coverage report for surprises.
4. Bump `CLASSIFICATION_VERSION` if recipes change category.
