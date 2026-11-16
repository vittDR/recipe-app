# Recipe library plan

The editorial brief for our own recipe library (the `original` collection):
what it's for, the quotas it's checked against, and what to add next.
Collection mechanics (sources, JSON shape, catalogue names) are in
[recipe-collection-guidelines.md](recipe-collection-guidelines.md). The 109
recipes taken from recipe sites are not counted or changed by this plan.

## What the library is for

- **Healthy first.** DINEAMITE is a weeknight-dinner app, so most of the
  library is healthy by the app's rule: a protein, a base, a real portion of
  vegetables, nothing fried, creamy or cheesy
  ([recipe-classification.md](recipe-classification.md)); "healthy" is a mood
  you can pick for the deck. Richer dishes and weekend projects stay, in the
  minority.
- **Weekly cooking for two in France.** Safe flavours are fine. A dish is
  distinctive because it's the real version of something, not because it
  uses rare ingredients.
- **The supermarket first, but authentic.** Most recipes use what a Carrefour
  or Monoprix sells, its world-food aisle included (soy sauce, mirin, curry
  paste). When a dish really needs something else (doubanjiang, gochugaru,
  curry leaves), the recipe keeps it and the catalogue flags it `exotic`, so
  the "Everyday ingredients" filter leaves the recipe out. Never swap it for a
  supermarket stand-in.
- **Protein is a guide, not a rule.** Most dishes land at 25 g or more, but a
  dish is written the way it's really made; protein isn't bolted on.
- **Calories.** Hearty dishes over 1,000 kcal are fine, as long as most of the
  library sits between 500 and 900 kcal a serving.
- **Air fryer.** Many quick dishes use it.

## Quotas

The library is checked against these. None is a hard rule on a single recipe;
they decide what the next recipe should be.

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

Roughly a third vegetarian (eggs, legumes, dairy and tofu, with no more than a
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

1. **Pick from whatever is furthest below target:** healthy first, then
   cuisine, base, protein and season.
2. **Write** with the guidelines: the dish as it's commonly made (looking at
   published versions for inspiration is fine), with quantities and steps in
   our own words. Don't name or link a source in the recipe.
3. **Re-audit** after each batch.
   - `node scripts/build-seed-library.ts` prints the classification coverage.
   - `node scripts/export-recipes.ts` lists every recipe with whether it's healthy, its
     season and illustration status.

## Status (November 2026)

Our own library is **400 recipes**: the 10 first AI recipes, 290 written from
this plan, and 100 quick, healthy dishes added because decks for
"healthy, under 40 min" kept showing the same dishes.

- **Healthy: 311 of 400 (78%).** Healthy and 40 min or less in total: 205 (it was 105).
- **The 100 quick, healthy dishes** all take 30 min or less in total and are
  healthy by the app's rule, which is about the plate's make-up, not its
  numbers (a protein, a base, at least 75 g of vegetables a serving, nothing
  fried, creamy or cheesy), at each dish's normal portions. 42 use the air
  fryer.
- **Seasons:** 316 of the 400 are all year (79%). The others are the key
  seasonal dishes: 22 spring, 26 summer, 22 autumn and 30 winter.
- **Illustrations:** 300 have one. The 100 new dishes don't yet.
