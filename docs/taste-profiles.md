# Taste profiles (v2 spec)

Status: plate space, model, quiz picker, simulation and the signals → model path built; deck and quiz screen to do. Replaces how the taste quiz, `logic/profile.ts` and the
deck's treat / adherence logic decide *what kind of dinners* someone wants.

## The problem

A person's taste is two things that v1 mixes up:

- **Taste**: what they like. Fish over beef, curries over stews, spicy or not.
- **Style**: how often they want each kind of plate. "Mostly lean protein over
  a carb base with veg, something creamy now and then, fried rarely."

v1 learns only taste (a weight per feature) and guesses style from
*adherence*, a single number, plus one treat slot. Someone can love cheesy
pasta and want it twice a month. To v1 that looks the same as someone who
wants it twice a week.

Style is about **frequency**, so v2 asks about frequency and models it
directly.

## 1. Plate space: what a dish is, as a plate

Code: `logic/plate.ts`, tests in `logic/tests/plate.test.ts`.

Every recipe gets a **plate vector** of four numbers in [0, 1]. They are
worked out from the classification it already has (`classify.ts`), per
serving, so nothing is tagged by hand. Portion size isn't an axis: portions
are scaled to each eater (`portions.ts`). Each axis runs from about the
library's 5th percentile (0) to its 95th (1), so the space is used evenly.

| Axis | Raw value | 0 at | 1 at | Notes |
| --- | --- | --- | --- | --- |
| `protein` | protein kcal share, `4·protein / kcal` | 0.12 | 0.38 | how protein-led the plate is |
| `rich` | 0.6 × fat kcal share (`9·fat / kcal`, 0.20 → 0.55) + bonuses | | | cream / cheese +0.3, mayonnaise +0.2, coconut +0.1; gratin / pie / pizza +0.15; deep-fried +0.35; clamped |
| `veg` | `veg_g` | 0 g | 300 g | |
| `carb` | carb kcal share, `4·carbs / kcal` | 0.10 | 0.58 | by the numbers, not `starch_bases`: lasagne sheets have no starch trait yet |

Richness is how a plate eats, not only its fat. Olive oil on a Niçoise is as
much fat as the cream in a gratin, but the Niçoise eats lighter, so fat counts
for 60% of the axis and the cream, cheese and frying bonuses for the rest.

From the library (`tests/fixtures/library.json`):

| Dish | protein | rich | veg | carb |
| --- | --- | --- | --- | --- |
| Teriyaki chicken with rice | 0.37 | 0.00 | 0.14 | 0.98 |
| Jerk chicken curry with beans | 0.50 | 0.11 | 0.92 | 0.69 |
| Air-fryer teriyaki salmon, rice, broccoli | 0.38 | 0.16 | 0.43 | 0.77 |
| Thai green curry with chicken | 0.07 | 0.55 | 0.66 | 0.66 |
| Salade niçoise | 0.50 | 0.55 | 1.00 | 0.32 |
| Fish and chips | 0.52 | 0.59 | 0.03 | 0.46 |
| Lasagne verdi alla bolognese | 0.21 | 0.84 | 0.95 | 0.55 |
| Tartiflette | 0.09 | 1.00 | 0.13 | 0.32 |

The axes are continuous, so there are no fixed meal types. "Generous but high
protein" and "generous and rich" sit in different places, and someone can
like one and not the other.

Distance between plates is a weighted Euclidean distance, normalised so that
opposite corners are 1 apart. `rich` counts most, because that's where people
differ most: `w = { protein: 1, rich: 1.5, veg: 1, carb: 0.8 }`.

**Adjustable dishes.** When leaving out a recipe's optional lines changes its
plate by at least 0.08, the recipe has a second plate (`platesOf`), and each
eater is scored on whichever plate suits them better. Six library recipes
qualify today, for example the chilli with avocado on top, or keema with
optional potatoes. Optional lines aren't always the rich part: some are a
side of rice.

Every library recipe has readable nutrition. A recipe that didn't would be
scored on taste only and never shown in the quiz.

## 2. Answers are frequencies

Each quiz card asks **"How often would you want this for dinner?"**

| Answer | Stored value (existing) | Frequency score `y` |
| --- | --- | --- |
| Not for me | `pass` | 0 |
| Now and then | `sometimes` | 1 |
| Regularly | `yes` | 3 |
| A favourite | `must` | 4 |

These are the four quiz values `taste_signals` already accepts, so quiz
answers need no migration. Only the wording and the meaning change.

Other signals keep feeding the same scale as the person uses the app:

| Signal | `y` | Weight |
| --- | --- | --- |
| Deck yes / must | 3 / 4 | 0.5 |
| Deck pass, not for me | 0 | 0.5 |
| Plain deck pass | none: it's "not tonight" | 0 |
| Cooked and rated loved / fine / not again | 4 / 2.5 / 0 | 1 |
| Quiz answer | as above | 1 |

All of them fade with v1's half-life (180 days). That's how the style drifts:
the quiz is the starting point, and what people actually pick takes over
gradually. Unrated cooked meals count too: they're `y` 3 at weight 0.25, and a
rating of the same meal replaces them. Quiz pairs fade the same way.

Code: `observationsFor` / `styleModelFor` in `logic/style.ts`. They read
`profile.ts` `signalsFor`, the same signals the v1 profile reads. A dish is
judged on its plate as written. A recipe's plates come from `plate.ts`
`rowPlates`: the stored classification, plus the dish worked out without its
optional lines. With the most observations past 600 (`MAX_OBSERVATIONS`), the
weakest go first.

Unlike v1, the diet isn't explained away. A pass on a heavy dish says how
often the person wants heavy plates, whatever the reason. The deck therefore
has to count goal fit less where style has already learned it (see §5).

`scripts/taste-profile.ts <user>` shows one person's model from a database's
real rows: their most and least wanted dishes, style along each axis, and
their clearest tastes. For a simulated mostly-balanced person (26 quiz answers
and 6 pairs) in the local database, it gave:

```
Style along each axis (0 → 1, others in the middle):
  protein  2.73  2.76  2.95  3.18  3.26
  rich     3.41  2.97  2.39  1.96  1.67
  veg      2.52  2.62  2.80  3.12  3.43
Taste: +0.34 protein:poultry … −0.60 dish:soup
```

Preparing the plates of 509 recipes took 150 ms; reading the signals and
fitting the model took 5 ms.

## 3. The model: one additive Gaussian process

Code: `logic/style.ts` (`fitStyle`), tests in `logic/tests/style.test.ts`.

A person's expected frequency for recipe `r` is

```
F(r) = clamp( ȳ + s(plate_r) + t(features_r), 0, 4 )
```

where `ȳ` is their weighted mean answer, and `s` and `t` are fitted
**together**, as one Gaussian process with an additive kernel:

- `s(p)`: **style**, how often they want a plate like `p`, whatever's in it.
  The kernel is a linear trend (prior variance 4 per axis) plus a
  squared-exponential (variance 1, lengthscale 0.15 in plate distance). A few
  answers give a broad trend ("less rich is better"); more answers add detail
  ("rich is fine if it's high protein").
- `t(f)`: **taste**, a sum of one effect per feature, each with a prior
  variance set by its kind (`TASTE_VARIANCE`): dish family and protein 1, heat
  0.8, sauce 0.5, starch 0.4, cooking method 0.15, and a plain feature
  (ingredient, tag, cuisine) 0.08. A dish family can matter a lot; one
  ingredient among fifteen matters only a little. Plate-like features
  (`goal:*`, `intent:*`, `texture:*`, cream / cheese / mayonnaise sauces,
  deep-fried) are left out, because style already covers them.
- Noise variance 1 per answer, divided by the signal's weight, so weaker and
  older signals count less.

Fitting both at once is what lets a pass on a cod curry be put down to "no
fish" (taste) or "too rich" (style), depending on the other answers. A first
version used a kernel smoother and backfitting. With 300 answers it still
scored 0.2–0.3 below what was learnable, because averaging taste across
kinds of feature diluted strong dislikes. The joint process fixed both
problems.

It's exact and deterministic: one Cholesky solve over the answers. A
quiz-sized fit is instant; the style tests, which include 26 refits picking
cards from the whole library, run in under 3 s. Hundreds of deck signals are
still fine. Past ~1,000 the cost grows with the cube of the count, so the plan
is to drop the oldest and weakest signals before fitting.

**Contrast pairs** are observations of the difference `s(a) − s(b)`: +1.5 for
a, −1.5 for b, 0 for "either". "Neither" also adds a −1 observation on each
plate at half weight. Pairs touch style only, because both dishes share their
protein.

**What comes out**, per person:
- `F(r)` for every recipe, and its posterior variance (how sure the model is).
- `s` and its variance at any plate, `t` for any set of features, and each
  feature's learned effect (`tasteWeights`) for "what we learned" highlights.
- A **style summary** for display and editing. Plate space is cut into
  regions ("lean & balanced", "light", "generous high-protein",
  "rich & creamy", "fried / treat"), and each region gets the person's mean
  `s`, read back in words: *Regularly: lean & balanced, light. Now and then:
  rich & creamy. Rarely: fried.* The regions are labels only; scores never use
  them. *(Not built yet.)*

**Editing.** On the summary screen people can move a region between Rarely,
Now and then and Regularly. Each move is a stated signal: a pseudo-answer at
the region's centre with weight 3, which fades like everything else. That
way, stating a style and drifting from it are the same mechanism.

## 4. The quiz

Code: `nextQuizCard`, `nextQuizPair` in `logic/style.ts`.

**26 cards and 6 pairs, 32 decisions, around 4 minutes**, with a progress bar.
The person can stop after 20 ("That's enough for now"). Diet and never rules
filter the pool, as today. Only cards with photos are shown, while any are left.

**Cards: integrated variance reduction.** After each answer the model is
refitted. The next card is the one whose answer would most reduce what the
model doesn't know about the rest of the library:
`Σ over library dishes of cov(card, dish)² / (var(card) + noise)`, measured on
a random sample of 150 dishes for speed. A card like many others, on a plate
and with contents the person hasn't said much about yet, wins. An odd dish, or
one like those already answered, doesn't. The first card needs no special
case: it's simply the most typical dish.

Two simpler pickers were tried and dropped. Picking the card the model is
least sure about favoured dishes with many ingredients. Spending the first 10
cards spreading over plate space ("anchors") scored worse at every length (see
Results).

**Pairs (6).** Two cards side by side: *"On a normal weeknight, which one?"*,
with *This one / This one / Either / Neither*. A pair is two dishes with the
same protein (the same cuisine when possible), at least 0.2 apart in plate,
where style is least sure and can't yet tell the two plates apart. In the
simulation they're neutral against two more cards (Results). They stay in
because a comparison is an easier judgement than an absolute answer, which the
simulation can't measure. They're cheap to drop if real answers don't back
that up.

**Then:** the style summary (section 3) with its regions, editable, and the
love / never items as today.

**Retaking** keeps the earlier answers, which fade like everything else. The
picker then goes for what's least known: there's nothing to start from scratch.

Storage (migration `20261201000001_taste_pairs.sql`, done): a pair is a
`taste_signals` row of kind `pair`. `recipe_id` holds the first dish and the
new `other_recipe_id` the second. `value` is `a` (the first), `b` (the second),
`either` or `neither`. Answering again replaces it, and a dish can be in
several pairs. Region edits will be kind `style`, with value = region and
level (to do, with the summary screen).

## Results: the simulation

Code: `scripts/taste-sim.ts`. The library is exported by
`scripts/export-plates.ts`.

Simulated people have a true frequency for every library dish they can be
offered (their diet), made of:
- a true style over plates,
- true tastes on features,
- a random effect per dish (sd 0.5), which nothing can learn from other dishes.

They answer each card from it, with noise (sd 0.4), on the four answers. The
personas are mostly balanced (the main case), generous, lean fish lover
(pescatarian), vegetarian comfort, and picky (no spice, no soup), plus one
drawn at random per seed so the tuning doesn't fit the personas. The score is
Spearman ρ between the fitted and the true frequency on every dish the person
*wasn't* shown. "Learnable" compares against the truth without the per-dish
effect.

6 people per persona, learnable ρ (all personas · mostly balanced):

| Picker | 20 decisions | 32 | 48 |
| --- | --- | --- | --- |
| random | 0.53 · 0.66 | 0.59 · 0.71 | 0.63 · 0.74 |
| v1 (most varied facets) | 0.59 · 0.69 | 0.65 · 0.71 | 0.70 · 0.78 |
| **variance reduction** | 0.59 · 0.69 | **0.66 · 0.74** | 0.70 · 0.76 |
| anchors, then variance reduction | 0.58 · 0.70 | 0.62 · 0.73 | 0.67 · 0.78 |
| variance reduction + pairs | 0.59 · 0.69 | 0.66 · 0.72 | 0.70 · 0.76 |

At 32 decisions, the variance-reduction picker has tier accuracy 0.79: the
share of unshown dishes the model puts in the right tier of *not for me*, *now
and then* and *regularly*. Its error on the deck's occasional share is ±0.06.

What it says:
- **The model mattered more than the picker.** Moving from the smoother to the
  joint process gained more than any picker did. Its settings hardly matter
  around the defaults (`--tune`: the best dozen of 81 settings are within 0.01
  of each other and of the defaults).
- **Length helps, slowly.** 20 → 32 → 48 decisions gives learnable ρ 0.59 →
  0.66 → 0.70. 32 is a fair trade for about 4 minutes. Deck swipes and ratings
  keep teaching the same model afterwards.
- **The weak case is someone who wants almost everything regularly**
  (generous, vegetarian comfort: 0.45–0.58). Their answers all land on
  *regularly*, so four coarse levels can't rank those dishes, and the
  vegetarian pool is small. Ranking questions (pairs) are the natural fix. In
  the simulation, though, pairs come from the same noisy truth as the cards,
  so they can't show that benefit.
- The spec's target of ρ ≥ 0.7 at 32 decisions is met for the mostly-balanced
  and lean personas, but not on average.

## 5. The deck

**Per person:** `F_m(r)` as above, with goal fit, season, variety and
exploration on top, as in v1.

**Mix per deck.** A deck of `N` cards gets its share of occasional plates from
the style itself, not from a fixed treat slot:

- A dish is **regular** for a person when `F ≥ 2`, **occasional** when
  `0.5 ≤ F < 2`, and **out** below 0.5 (exploration can still show one).
- `occasional share = Σ_occasional F / Σ F` over the library, per person. For
  a "mostly balanced" person that comes to about 1 card in 8. For a "generous"
  person it's around 1 in 3.
- The deck holds `round(N × share)` occasional dishes. The rest are regular,
  and the occasional slots are picked for taste.

This replaces the treat slot (`TREAT_*`). The "sometimes" spacing (no
occasional kind eaten in the last two weeks) stays. Adherence stays, but only
for goal fit, where it belongs.

**Households: what works for both.** One deck, several people:

- Joint score: `J(r) = softmin_m F_m(r)`
  (`−τ·log Σ exp(−F_m/τ)`, `τ = 0.5`). That's near the least keen person's
  score, so a dish one person loves and the other merely tolerates loses to
  one they both like.
- **Adjustable dishes.** When a recipe's rich parts are on optional lines
  (cheese to serve, cream to finish), it gets a second plate vector without
  them. Each person is scored on the version that suits them better, and the
  card says so ("parmesan on the side"). This is how a balanced base with a
  richer topping wins in a mixed household. It works like `heat_adjustable`
  and is computed the same way, from optional lines.
- The occasional share is the household's *smallest*, so the person who wants
  treats rarely isn't outvoted. Occasional slots go to dishes with `J ≥ 0.5`.
- Each person's own profile still learns from their own swipes.

## 6. What changes in code

| Where | Change |
| --- | --- |
| `plate.ts` | **done**: `plateVector`, `platesOf`, `plateDistance` |
| `style.ts` | **done**: `fitStyle` (additive GP), `nextQuizCard`, `nextQuizPair`, `observationsFor` / `styleModelFor` (signals → model). To do: region summary |
| `profile.ts` | **done**: signals carry their recipe (and meal); `pair` signals read from `taste_signals`, ignored by the v1 profile |
| `recommend.ts` | `expectedFrequency`, `softmin`, region definitions |
| `deck.ts`, deal-deck | build each member's model (`styleModelFor`, plates from `rowPlates`); score on `F`; occasional share in place of the treat slot; joint score for households; adjustable variant; less weight on goal fit where style covers it |
| `TasteQuiz.tsx` | new wording, the three phases, pair cards, early stop, summary screen |
| migration | **done**: `pair` kind and `other_recipe_id`; deal-deck and the Us screen read it. To do: `style` kind |
| tests | **done**: plate vectors for known dishes, style/taste separation, pairs, a synthetic person recovered from 26 quiz answers on the library. To do: household softmin, deck mix shares |

## Open points

- Lasagne sheets (and maybe other bases) lack a `starch:*` trait in the
  catalogue. The carb axis doesn't depend on it, but `isHealthy` and the dish
  features do.
- 20 decisions before the early stop gives learnable ρ ≈ 0.59, against 0.66 at
  32. That's acceptable for people in a hurry.
- Check the simulated noise (answer sd 0.4, dish effect sd 0.5) against real
  answers once there are some: retaking the quiz on the same cards measures
  answer noise directly.
- Region names and boundaries for the summary, and translations.
