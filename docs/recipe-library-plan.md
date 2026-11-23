# Recipe library plan

The editorial brief for our own recipe library (the `original` collection):
what it's for, the quotas it's checked against, and what to add next.
Collection mechanics (sources, JSON shape, catalogue names) are in
[recipe-collection-guidelines.md](recipe-collection-guidelines.md). The 109
recipes taken from recipe sites are not counted or changed by this plan.

## What the library is for

Recipes you actually cook on a weeknight: more or less healthy, quick, high in
protein and made from what the supermarket sells. Think chicken in a sauce
over rice with vegetables, or noodles with a protein. Cuisines give the
library its variety, but they come second to that.

- **Weekly cooking for two in France.** Safe flavours are fine. A dish is
  distinctive because it's the real version of something, not because it
  uses rare ingredients.
- **The supermarket first.** Recipes use what a Carrefour or Monoprix sells,
  its world-food aisle included (soy sauce, oyster sauce, mirin, curry paste,
  harissa). When a dish needs something else and a supermarket ingredient
  does the same job, use the supermarket one: dry sherry for Shaoxing wine,
  soy sauce with a little sugar for dark soy, chilli flakes or paprika for
  Korean or Kashmiri chilli, lime for tamarind. Keep a specialty ingredient
  only when the dish isn't itself without it, and then the catalogue flags it
  `exotic` and the "Everyday ingredients" filter leaves the recipe out.
- **Calories.** Most of the library sits between 500 and 900 kcal a serving.
  Portions are each dish's normal ones; the app scales them to each eater.
- **Air fryer.** Many quick dishes use it.

## Weeknight rules

A new recipe meets all six. Recipes already in the library are checked
against them too: one that fails a single rule is reworked when that can be
done honestly (a stand-in, more of the protein and less of the base, a side
of vegetables), and otherwise it stays as one of the minority below.

1. **Healthy** by the app's rule: a protein, a base, at least 75 g of
   vegetables a serving, nothing fried, creamy or cheesy
   ([recipe-classification.md](recipe-classification.md)).
2. **Quick:** 40 min or less from start to plate (aim for 30), and not
   `hard`. Marinating counts.
3. **High protein** by the app's rule: at least 30 g a serving **and** at
   least 25 % of the calories from protein. It's about what's on the plate,
   not its size: more chicken and a little less rice, not a bigger plate.
   Vegetarian dishes get there with eggs, tofu, Greek yogurt, cottage cheese,
   edamame or a second protein, not with pulses alone.
4. **Everyday ingredients:** nothing the catalogue flags `exotic`.
5. **A short list:** at most 10 ingredient lines that aren't staples (salt,
   pepper, oil, dried spices) or optional garnishes, and aim for 8.
6. **The weeknight shape:** a protein, a sauce or seasoning that carries the
   dish, a carb from the supermarket's everyday shelves and a vegetable. The
   carbs to spread across: rice (basmati, jasmine, long-grain), egg and rice
   noodles, udon, pasta (short and long), orzo, fresh gnocchi, potatoes and
   sweet potatoes, couscous, bulgur, quinoa, tortillas and wraps, pitta,
   naan, bread, and tinned beans or lentils as a side.

Richer dishes, weekend projects and dishes that need a specialty ingredient
stay in the library, in the minority. The deck learns from swipes and taste
ratings which of them a household wants, so they aren't removed for failing
these rules.

## Quotas

The library is checked against these after the weeknight rules. None is a
hard rule on a single recipe; they decide what the next recipe should be.

### Cuisines: depth over breadth

Fourteen groups, each deep enough to show a range (an everyday dish, a soup or
stew, something quick, something slow). Targets for a library of 300 (scale them with the library):

| Cuisine | Target |
| --- | ---: |
| French | 27 |
| Italian | 30 |
| Spanish & Portuguese | 20 |
| Eastern Mediterranean (Greek, Turkish, Levantine) | 30 |
| North African | 15 |
| Indian | 25 |
| Chinese | 20 |
| Japanese | 18 |
| Thai, Vietnamese & South-East Asian | 18 |
| Korean | 10 |
| Mexican & Latin American | 22 |
| British & Irish | 18 |
| Discovery (Persian, West African, Caribbean, Central & Eastern European, Belgian, Creole…) | 30 |
| House weeknight dishes, no particular cuisine | at most 17 |

### Bases

No single base (pasta, rice, potato, bread and wraps) should be more than
**18%** of the library. Polenta, farro, barley, bulgur, couscous, quinoa,
buckwheat, gnocchi, noodles and pulses should together be at least **20%**.

### Protein

Most dishes are high protein (rule 3 above). Roughly a third vegetarian (eggs, legumes, dairy and tofu, with no more than a
third of those relying on cheese), a quarter fish and seafood, and the rest
meat. Within meat and fish, include:

- cheaper cuts (chicken thighs, pork shoulder and belly, beef shin, lamb shoulder)
- shellfish beyond prawns (mussels, squid)
- rabbit, which every French supermarket sells

### Season

By season, not by month, to keep it flexible
([recipe-classification.md](recipe-classification.md#season)). **Most dishes
are all year** (about three quarters). Only the dishes people link to a
season are seasonal: tag them `spring`, `summer`, `autumn` or `winter`, for
example tartiflette in winter, gazpacho in summer, and ceviche in spring and
summer. A few ingredients (asparagus, broad beans, peaches, pumpkin and squash)
make a dish seasonal on their own. Each season should have at least **20
dishes** of its own, so the deck can always keep 3 of 12 cards for the season.

## How to add recipes

1. **Pick from whatever is furthest below target:** the weeknight rules first,
   then cuisine, base, protein and season.
2. **Write** with the guidelines: the dish as it's commonly made (looking at
   published versions for inspiration is fine), with quantities and steps in
   our own words. Don't name or link a source in the recipe.
3. **Re-audit** after each batch.
   - `node scripts/build-seed-library.ts` prints the classification coverage.
   - `node scripts/export-recipes.ts` lists every recipe with whether it's healthy, its
     season and illustration status.

## Status (November 2026)

Our own library is **704 recipes**: the 10 first AI recipes, 290 written from
this plan, 100 quick, healthy dishes, 45 weeknight chicken dinners, 59
weeknight plates written to the weeknight rules, and 200 vegetarian weeknight
dinners (86 of them vegan).
[CATALOG-FIT-2026-11.md](CATALOG-FIT-2026-11.md) lists which recipes meet
the rules and why the others don't.

- **Meet all six weeknight rules: 440 of 704** (it was 51 of 400). 95
  recipes that failed one rule were reworked (stand-ins for specialty
  ingredients, more protein and less base, more vegetables, shorter
  marinades), 31 of the chicken dinners were lightly reworked the same way,
  and the 59 weeknight plates meet them all.
- **The 45 chicken dinners** were written before the rules: 30 min or less,
  each with a base and a real portion of vegetables, 19 with the air fryer.
  After a light rework, 40 meet all six rules. The other 5 would become
  different dishes (pide, ají de gallina, yu xiang aubergine, anticuchos,
  poulet au vinaigre).
- **Healthy: 622 of 704 (88%).** Healthy and 40 min or less in total: 528.
- **High protein: 471 of 704** (it was 120 of 400).
- **The 59 weeknight plates** take 17 to 36 min and spread across everyday
  carbs: rice, noodles, pasta and gnocchi, potatoes and sweet potatoes,
  couscous, bulgur and polenta, wraps, pitta and bread, and tinned beans.
- **Seasons:** 611 of the 704 are all year (87%). The others are the key
  seasonal dishes: 23 spring, 30 summer, 25 autumn and 33 winter.
- **Vegetarian: 305 of 704, 97 of them vegan.** The 200 vegetarian dinners
  take 10 to 40 min and meet all six rules, with eggs, tofu, soy mince, seitan,
  paneer, halloumi, skyr, cottage cheese or edamame for the protein.
- **Illustrations:** all 704 have one.
