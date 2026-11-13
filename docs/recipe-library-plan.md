# Recipe library plan: the next 240

The editorial brief for growing the library past the 119 seed recipes. It
covers what the collection is for, the quotas it's checked against, and what
fills the gaps. The draft list of 240 names has been triaged against it in
[recipe-list-triage.md](recipe-list-triage.md). Collection mechanics
(sources, JSON shape, catalogue names) stay in
[recipe-collection-guidelines.md](recipe-collection-guidelines.md).

Assumption: the 240 add to the seed library. If they replace it, the 20 seed
duplicates in the triage come back and the Italian and French targets below
go up by about 25 each.

## What the library is for

- **Weekly cooking for two in France.** Most dishes are reliable weeknight
  food. Safe flavours are fine. A dish is distinctive because it's the real
  version of something, not because it uses rare ingredients.
- **The supermarket first.** At least 80% of recipes use no `exotic`
  ingredient (not sold in most French supermarkets), and no recipe uses more
  than one. Everything else (cuts, seafood, grains) should be at a Carrefour
  or Monoprix, fresh or frozen.
- **The nutrition brief still applies:** at least 25 g of protein per
  serving. Several kept entries (gnocchi, flatbread pizzas, pea pasta) only
  pass if the chosen source recipe adds a protein.

## Quotas

The library is checked against these. None is a hard rule on a single
recipe; they decide what the next recipe should be.

### Cuisines: depth over breadth

Fourteen buckets, each deep enough to show a range: an everyday dish, a soup
or stew, something quick, something slow. "No cuisine" covers house
weeknight dishes (a salmon traybake) and is capped so that it doesn't become
the default.

| Cuisine | Target | Kept from the list | To add |
| --- | ---: | ---: | ---: |
| French | 22 | 15 | 7 |
| Italian | 24 | 23 | 1 |
| Spanish & Portuguese | 16 | 9 | 7 |
| Eastern Mediterranean (Greek, Turkish, Levantine) | 24 | 13 | 11 |
| North African | 12 | 2 | 10 |
| Indian | 20 | 10 | 10 |
| Chinese | 16 | 9 | 7 |
| Japanese | 14 | 7 | 7 |
| Thai, Vietnamese & South-East Asian | 14 | 4 | 10 |
| Korean | 8 | 2 | 6 |
| Mexican & Latin American | 18 | 8 | 10 |
| British & Irish | 14 | 14 | 0 |
| Discovery (Persian, West African, Caribbean, Central & Eastern European, Belgian, Creole…) | 24 | 7 | 17 |
| No cuisine (house dishes) | at most 14 | 4 | up to 10 |
| **Total** | **240** | **127** | **113** |

Italian and French are already the core of the seed library (27 each),
which is why their targets here are modest.

### Bases

No single base (pasta, rice, potato, bread and wraps) should be more than
**18%** of the library. Polenta, farro, barley, bulgur, couscous, freekeh,
buckwheat, gnocchi, noodles and dumplings should together be at least **20%**.

### Time

Worked out from `prep_min`, `cook_min` and `total_min`, never tagged:

| Tier | Rule | Target |
| --- | --- | ---: |
| Quick | total ≤ 20 min | 20% |
| Weeknight | total ≤ 45 min | 50% |
| Slow, hands-off | total > 45 min, prep ≤ 20 min | 18% |
| Weekend project | prep > 20 min and total > 60 min | 12% |

"Slow, hands-off" is the tier the list was missing. A braise with 15 minutes
of prep is still a Tuesday dinner.

### Protein

Roughly a third vegetarian (eggs, legumes, dairy and tofu, with no more
than a third of those relying on cheese), a quarter fish and seafood, and the
rest meat. Within meat and fish, include:

- cheaper cuts (chicken thighs, pork shoulder and belly, beef shin, lamb shoulder)
- shellfish beyond prawns (mussels, squid)
- rabbit, which every French supermarket sells

### Season

Recipes are seasoned from their ingredients (see below). Each month should
have at least **25 seasonal dishes in season**, on top of the all-year ones.
Aim for about 55% all-year and 45% seasonal, spread across the year. The draft
list leaned towards autumn and winter, so most of the additions below are
summer and spring dishes.

## Seasonality in the database

Added in `migrations/20261125000001_ingredient_seasons.sql`:

- `ingredient_catalog.season_months` holds the months each fresh ingredient is in
  season in France. The values are in the season block of `seed.sql`, and 25
  ingredients have one so far.
- A recipe's season is part of its classification (`season_months`,
  `logic/classify.ts`). It's worked out from main ingredients (75 g a
  serving or more), never tagged by hand, and recomputed when the catalogue
  changes. Details: [recipe-classification.md](recipe-classification.md#season).

On the current seed library, 87 of 119 recipes come out all-year. Between 90
and 117 recipes can be cooked in any given month, and July to September are
the richest months.

Not done yet:

- **Deck: done.** `logic/deck.ts` gives a seasonal dish in season this month
  (the household's time zone) a bonus (`SEASON_BONUS`) and one out of season
  a penalty (`OFF_SEASON_PENALTY`), without excluding it (imports exist).
  Every deck holds at least 3 of 12 in-season dishes (`SEASONAL_SHARE`) when
  the library has them. They replace the weakest close, then very close,
  cards, never a wildcard or the treat, and show an "In season now" badge.
- **Filters.** Not done yet: an "In season" filter on the Recipes tab
  (`logic/facets.ts`).
- **Missing produce.** The new recipes need catalogue entries that don't
  exist yet: asparagus, fennel, beetroot, kale, celeriac, parsnip, endive,
  squid, peach, fig, chestnut, artichoke, broad beans. Give each one its
  `season_months` when it's added.

## Additions

These dishes fill the "to add" column. Each one is the name of a real
dish, so collection searches find a source page. Notes: **Q** quick,
**S** slow and hands-off, **P** weekend project, a season where it matters, and
**ex** where it takes the recipe's one exotic ingredient.

**French (7):**
- Lapin à la moutarde (S)
- Hachis parmentier (winter)
- Pot-au-feu (P, winter)
- Endives au jambon (winter)
- Calamars à la provençale (Q, summer)
- Bavette à l'échalote, haricots verts (Q, summer)
- Soupe au pistou with white beans (summer)

**Italian (1):**
- Orecchiette, broccoli e salsiccia (winter)

**Spanish & Portuguese (7):**
- Pollo al ajillo
- Lentejas con chorizo (S, winter)
- Bacalhau à Brás
- Pisto manchego con huevo (summer)
- Albóndigas en salsa de almendras
- Mejillones a la marinera (autumn)
- Caldo verde with chouriço (winter)

**Eastern Mediterranean (11):**
- Kleftiko (P)
- Stifado (S, winter)
- Youvetsi
- Karnıyarık (summer)
- Menemen (Q, summer)
- Lahmacun (P)
- Fattoush with grilled chicken (summer)
- Hünkar beğendi (P)
- Shish tawook with garlic sauce
- Kibbeh bil sayniyeh (P)
- Mujadara with halloumi

**North African (10):**
- Couscous royal (P)
- Tajine d'agneau aux pruneaux (S)
- Tajine de kefta aux œufs
- Harira (autumn)
- Lablabi (Q)
- Tajine de poisson
- Méchoui-style lamb shoulder (S)
- Merguez and roast vegetable couscous (summer)
- Chermoula prawns with couscous (Q)
- Loubia with lamb (S, winter)

**Indian (10):**
- Rajma chawal
- Chicken jalfrezi (Q)
- Anda curry (egg curry)
- Rogan josh (S)
- Chicken biryani (P)
- Matar paneer (Q)
- Prawn masala
- Chicken korma
- Fish tikka (summer)
- Moong dal khichdi with egg (Q)

**Chinese (7):**
- Mapo tofu (ex: Sichuan pepper)
- Hong shao rou (P)
- Tomato and egg stir-fry (Q, summer)
- Char siu pork with greens
- Hot and sour soup with pork and tofu
- Cumin lamb stir-fry (Q)
- Lion's head meatballs with cabbage (winter)

**Japanese (7):**
- Butaniku shōgayaki (Q)
- Nikujaga (S)
- Saba shioyaki (Q)
- Japanese chicken curry
- Yakisoba with pork (Q)
- Hambāgu
- Cold soba with tofu and edamame (summer)

**Thai, Vietnamese & South-East Asian (10):**
- Massaman beef curry (S)
- Thai red curry with butternut and chicken (autumn)
- Gai yang with cucumber salad (summer)
- Phở bò (P)
- Bún chả
- Bò lúc lắc (Q)
- Cà ri gà
- Gado-gado with egg and tofu (summer)
- Singapore noodles (Q)
- Ayam kecap (ex: kecap manis)

**Korean (6):**
- Japchae
- Kimchi jjigae (ex: kimchi)
- Jeyuk bokkeum (ex: gochujang)
- Andong jjimdak
- Haemul pajeon
- Bossam (P)

**Mexican & Latin American (10):**
- Lomo saltado (Q)
- Ropa vieja (S)
- Carnitas tacos (S)
- Sopa de tortilla with chicken
- Ceviche with sweet potato (summer)
- Steak with chimichurri and potatoes (summer)
- Feijoada (P)
- Huevos rancheros (Q)
- Picadillo with rice (Q)
- Empanadas (P)

**Discovery (17):**
- Joojeh kabab with saffron rice (summer)
- Fesenjan (ex: pomegranate molasses)
- Kuku sabzi (Q, spring)
- Jollof rice with chicken
- Poulet yassa
- Thieboudienne (P)
- Brown stew chicken (S)
- Gulyás (S)
- Bigos (P, winter)
- Chkmeruli (Q)
- Carbonnade flamande (S)
- Waterzooi
- Käsespätzle (treat)
- Jambalaya
- Borscht with beef (winter)
- Misir wot with eggs (ex: berbere)
- Frikadeller with potatoes

**No cuisine (up to 10):** these slots are left open. Fill them with house
weeknight dishes only when a quota above is met, or to fix a base, time or
season shortfall.

After the additions, 8 of the 240 recipes use an exotic ingredient, well
within the 20% limit. About half of the 103 named additions are quick, slow or
weekend dishes, which moves the time mix towards the targets.

## How to use this

1. **Cut first.** Apply the triage decisions before collecting anything new.
2. **Collect by bucket.** Use the guidelines, and take the source's version
   of the dish, not a lighter rewrite.
3. **Re-audit after each batch.** Count cuisines and bases, work out time
   tiers from the stored times, and check months from `season_months`. Then
   pick the next batch from whatever is furthest below target.
