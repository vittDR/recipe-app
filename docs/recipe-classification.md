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

## Stored, and cleared when anything it depends on changes

`recipes.classification` keeps the result, with `classified_with` set to the
ingredient catalogue's version (`catalog_version()->>'ingredients'`) it was
worked out with. A trigger clears both when the recipe's title, translations,
servings, tags, cuisine, steps, times, difficulty or equipment change, or
when any of its ingredient lines is added, changed or removed. A stored
classification is used only while its `version` is `CLASSIFICATION_VERSION`
and its `classified_with` is the current catalogue version, so changing a
trait, a rule or the version reclassifies every recipe with no backfill.

`classifyRow()` returns the stored classification when it's fresh and works
it out otherwise. `deal-deck` stores what it had to work out
(`store_classifications()`, server only), so after the first deal following
a change, the app and the next decks read it instead of recomputing.

On a recipe, only diet, health (`nutrition_goals`) and mood (`meal_intents`)
are shown as tags (`visibleTags()` in `web/src/lib/classes.ts`); the rest is
for the deck and learning.

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
| `dish_families` | curry, stew, soup, salad, grain_bowl, rice_dish, pasta_dish, noodle_dish, stir_fry, wrap, sandwich, tacos, pizza, pie, gratin, oven_bake, roast, savory_pancake, egg_dish, dumplings, plated, other | tags, then title words (EN/FR/IT), then what's on the plate |
| `sauce_families` | tomato, cream, cheese, coconut, broth, soy_based, chilli_based, peanut, yogurt, mustard, gravy, herb_oil, citrus, mayonnaise | `sauce:*` traits above a per-family amount per serving (`SAUCE_MIN_G`; `@n` on a trait overrides it) |
| `cooking_methods` | pan_fried, stir_fried, deep_fried, baked, roasted, grilled, braised, simmered, poached, steamed, boiled, no_cook | words in the steps (EN/FR/IT), tags, the oven flag, `cook_min = 0` |
| `heat_level` | 0 none, 1 mild, 2 medium, 3 hot, 4 very hot | grams per serving × `heat:*` of each chilli ingredient (spoons of spices weighed as dry); a `spicy` tag means at least 2 |
| `heat_adjustable` | true/false | chilli on optional lines (it doesn't raise the level) |
| `sauce_level` | 0 dry, 1 coated, 2 saucy, 3 brothy | grams of `liquid` ingredients per serving; soups are brothy, baked dishes at most saucy |
| `season_months` | months 1–12 (all twelve = all year) | `ingredient_catalog.season_months` of the main ingredients (below) |
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

## Season

`ingredient_catalog.season_months` holds the months an ingredient is in
season in France (`{6,7,8,9}` for tomatoes); null means all year (pantry,
frozen, stored crops like onions and potatoes, imports sold all year like
lemons). The values are in the season block of `seed.sql`.

A recipe's `season_months` is worked out, never tagged:

- Only required lines with at least `SEASON_MIN_G` (75 g) a serving count, about
  a portion of vegetables. Half a pepper in a stew, a tomato in a sauce or a
  handful of basil don't make a dish seasonal.
- The recipe is in season in the months those ingredients share. Courgette,
  aubergine and tomato give July to September.
- When they share none (a pumpkin dish with asparagus), the heaviest decides.
- No seasonal main ingredient: all twelve months. Nothing readable: null.

`inSeason(c, month)` and `isSeasonal(c)` read it. Season isn't a learning
feature: when a dish is eaten says nothing about whether someone likes it.
Editing a month changes the catalogue version, so every recipe is reseasoned
on the next deal with no backfill.

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

### Taste profile

`logic/profile.ts` turns every recorded choice into a weight per feature,
in [-1, 1], with how many choices it rests on. The choices say different
things, so they weigh differently:

| Choice | Where it's recorded | Weight |
| --- | --- | --- |
| Deck swipe ("I'd eat that tonight") | `swipes` | yes +1, must +1.5, pass −1; half in a mood deck |
| Pass reason | `taste_signals` (`reason`) | not tonight / too long / had recently: the pass counts nothing; not for me: −1 even in a mood deck |
| Taste quiz ("that looks good") | `taste_signals` (`starter`) | as a swipe × 0.75 |
| Cooked | `meals.status = cooked`, for the deck's eaters | +0.5 |
| Rating after eating | `taste_signals` (`rating`) | loved +2, fine +0.5, not again −2; "didn't have it" counts nothing and cancels the cooked signal |

**Diet explains away.** Each deck card records whether it fit the person's
goals (`member_portions.fits`; quiz answers are judged against their goals
now). A pass on a dish that didn't fit counts only 0.2 against its taste:
someone who eats lean on weekdays isn't saying they dislike cheesy pasta. A
yes on a dish that didn't fit counts 1.25 ("I want it anyway"). Diet-linked
features (`goal:*`, `intent:light`, `intent:indulgent`, `intent:fuel`) aren't
learned from deck swipes or cooking at all, because the deck already ranks on
fit; they're learned from ratings after eating and the quiz.

Older choices fade with a 180-day half-life. A feature's weight is the sum
of its signals over their total (each choice counting at least 1) plus 2,
clamped to [-1, 1]: one choice never makes a strong like, and many weak ones
stay weak. Recipes never shown say nothing. The profile is rebuilt from the choices
each time a deck is dealt (and on the Us tab, which shows the clearest
likes and dislikes), so it follows the classification as it improves.

### Recommendation

`logic/recommend.ts`, used by `logic/deck.ts`. Per eater:

- **Taste** (−1..1): the profile's weights, averaged within each kind of
  feature (dish, sauce, protein, starch, heat, texture, method, intent, plain
  tags and ingredients; at most three unknowns dilute a kind), summed with
  per-kind weights into a weighted mean and sharpened with tanh(2 ×). A
  recipe with fifteen ingredients isn't louder than one with five, and
  liking most things doesn't make every dish a 1.
- **How much they mind their diet** (adherence, 0..1): yes rate on dishes
  that fit versus dishes that didn't, shrunk to 0.5 until there are swipes on
  both sides. It sets how much goal fit counts: 2.25 (doesn't mind) to 3.75
  (minds a lot), 3 by default. It never changes their taste.
- **Exploration**: how little is known about a dish's kind (dish, sauce,
  protein, starch, heat, method) for them, 0..1. It weighs the wildcard draw
  and adds a little to "close" cards.

A dish's base = fit × fit weight + love + 1.2 × mood + pantry + 0.8 ×
household history + a little noise. A deck of 12 is built in three tiers
(`deckShape()` keeps the proportions for other sizes):

| Tier | Cards | Ranked on | On the card |
| --- | --- | --- | --- |
| Very close | 5 | base + 2.5 × the **least** keen eater's taste: everyone should like it | |
| Close | 5 | base + 2 × (0.6 × keenest + 0.4 × least keen) + a little exploration | "More Anna's kind of dish" when tastes differ by ≥ 0.25 |
| Wildcard | 2 | random draw, likelier the less we know about that kind of dish, among dishes that fit everyone's goals (fit ≥ 0.7), that nobody dislikes (taste ≥ −0.2) and that the household hasn't chosen before | "Something a little different" |

Tastes are compared half raw, half relative to each eater's own average over
the library, so someone who likes most things isn't always "the keener one".
Each tier is picked for variety: a dish much like one already in the deck
(Jaccard over dish, protein, sauce, starch) loses up to 1.2. For an eater
with adherence ≥ 0.6, one "close" card is kept for a **treat**: the dish most
to their taste (≥ 0.1) that fits their goals poorly (≤ 0.6), labelled as
such. Very close and close cards alternate, best first (the first card both
say yes to wins); the wildcards sit about a third and three quarters of the
way in. The Us tab says which way someone leans on their diet.

### Taste quiz

Onboarding ends with 20 recipes to swipe (`/onboarding/quiz`, again from
the Us tab). `pickStarterSet()` chooses them greedily for variety: each
next card adds the most protein, dish, sauce, method, heat, goal, mood and
broad-cuisine values not shown yet, preferring recipes with a photo, after
the person's diet and never rules. Retaking it shows unanswered recipes
first.

Still to do: tell liking the look of a dish apart from intending to cook it
in the deck itself; let a rating name what was wrong (too spicy, too heavy).

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
