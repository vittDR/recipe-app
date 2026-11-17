# Taste profiles (v2 spec)

Status: proposal. Replaces how the taste quiz, `logic/profile.ts` and the
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

Every recipe gets a **plate vector** of four numbers in [0, 1]. They are
worked out from the classification it already has (`classify.ts`), per
serving, so nothing is tagged by hand. Portion size isn't an axis: portions
are scaled to each eater (`portions.ts`).

| Axis | Raw value | 0 at | 1 at | Notes |
| --- | --- | --- | --- | --- |
| `protein` | protein kcal share, `4·protein / kcal` | 0.10 | 0.40 | how protein-led the plate is |
| `rich` | fat kcal share, `9·fat / kcal` | 0.20 | 0.55 | +0.25 for a cream / cheese / mayonnaise sauce, +0.3 deep-fried, +0.15 gratin / pie / pizza; clamped |
| `veg` | `veg_g` | 0 g | 200 g | |
| `carb` | carb kcal share, `4·carbs / kcal`, if there is a starch base | 0.15 | 0.60 | 0 without a base, unless pulses are the base |

Examples (rough):

| Dish | protein | rich | veg | carb |
| --- | --- | --- | --- | --- |
| Chicken, rice, broccoli | 0.8 | 0.1 | 0.6 | 0.6 |
| Turkey chilli | 0.7 | 0.2 | 0.7 | 0.4 |
| Creamy salmon pasta | 0.4 | 0.8 | 0.2 | 0.7 |
| Tartiflette | 0.2 | 1.0 | 0.1 | 0.6 |
| Niçoise salad | 0.6 | 0.4 | 1.0 | 0.2 |
| Fish & chips | 0.4 | 1.0 | 0.1 | 0.7 |

The axes are continuous, so there are no fixed meal types. "Generous but high
protein" (turkey chilli) and "generous and rich" (tartiflette) sit in
different places, and someone can like one and not the other.

Distance between plates is a weighted Euclidean distance, with `rich` counting
most because that's where people differ most:
`w = { protein: 1, rich: 1.5, veg: 1, carb: 0.8 }`.

Recipes with unreadable nutrition have no plate vector. They're scored on
taste only and never shown in the quiz.

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
gradually.

## 3. The model: style + taste, fitted together

A person's expected frequency for recipe `r` is

```
F(r) = clamp( s(plate_r) + t(features_r), 0, 4 )
```

- `s(p)`: **style**, how often they want a plate like `p`, whatever's in it.
  A kernel smoother over plate space (Nadaraya–Watson):
  `s(p) = (Σ wᵢ·k(p, pᵢ)·yᵢ + λ·ȳ) / (Σ wᵢ·k(p, pᵢ) + λ)`,
  Gaussian kernel, bandwidth `h = 0.3`, prior strength `λ = 1`.
  Where there's no evidence it falls back to the person's mean answer.
- `t(f)`: **taste**, how much what's *in* the dish moves that up or down.
  The v1 per-feature weights, grouped and averaged the same way
  (`tasteScore`), scaled to ±1.5 frequency points. Plate-like features
  (`goal:*`, `intent:*`, cream / cheese sauces, deep-fried) are left out so they
  don't count twice.

**Fitting (backfitting).** A pass on a cod curry could be "no fish" (taste) or
"too rich" (style). The two are separated by fitting each on what the other
leaves unexplained, three rounds:

1. `t ← 0`
2. `s ←` smoother on `yᵢ − t(fᵢ)`
3. `t ←` feature means on `yᵢ − s(pᵢ)` (the v1 shrinkage, `PROFILE_PRIOR`)
4. Repeat steps 2–3 two more times.

This stays deterministic, in pure TS, and with ~30–300 signals it runs in
milliseconds. It replaces `buildProfile` as the source of the deck's scores.
`buildProfile` stays for the "what we learned" highlights.

**Contrast pairs** (quiz, below) are what tell the two apart most cleanly.
Both dishes share their protein and cuisine, so a choice between them is about
the plate. Each pair adds +0.75 to the chosen plate's residual and −0.75 to
the other's, and it only feeds `s`.

**What comes out**, per person:
- `F(r)` for every recipe.
- A **style summary** for display and editing. The plate space is cut into
  regions ("lean & balanced", "light", "generous high-protein",
  "rich & creamy", "fried / treat"). Each region gets the person's mean `s`,
  read back in words: *Regularly: lean & balanced, light. Now and then: rich &
  creamy. Rarely: fried.* The regions are labels only. Scores never use them.

**Editing.** On the summary screen people can move a region between Rarely,
Now and then and Regularly. Each move is a stated signal: a pseudo-answer at
the region's centre with weight 3, which fades like everything else. That way
stating a style and drifting from it are the same mechanism.

## 4. The quiz

About 32 decisions, around 4 minutes, with a progress bar. The person can stop
after card 20 ("That's enough for now"). Diet and never rules filter the pool,
as today. Cards with photos come first.

**Phase A: anchors (10 cards).** Farthest-point sampling on plate vectors: each
next card is the plate farthest from those already shown. Ties are broken by
v1's facet gain (`quizFacets`: protein, dish, sauce, heat, cuisine), so taste
gets covered too. This maps the whole plate space quickly, from salad to
tartiflette.

**Phase B: adaptive (16 cards).** After each answer the model is refitted, and
the next card is the one with the highest
`info(r) = 1.0·style_uncertainty(plate_r) + 0.6·taste_uncertainty(features_r) + 0.4·boundary(r)`:
- `style_uncertainty`: `1 / (1 + Σ k(p, pᵢ))`. Few answers near this plate.
- `taste_uncertainty`: v1's `uncertainty()` (little evidence on its dish,
  protein, sauce…).
- `boundary`: `F(r)` close to 0.5 or 2, the edges between not for me, now and
  then and regularly, where an answer changes what the deck does.

**Phase C: contrast pairs (6).** Two cards side by side: *"On a normal
weeknight, which one?"*, with *This one / This one / Either / Neither*. A pair is
two recipes that share a protein group (and a cuisine if possible), are far
apart on one plate axis and close on the others, and sit where `s` is least
certain. These pairs are what learn "chicken yes, but in a stir-fry rather
than a cream sauce".

**Then:** the style summary (section 3) with its regions, editable, and the
love / never items as today.

**Retaking** keeps the earlier answers (they fade like everything else) and
starts Phase A from what's least known, not from scratch.

Storage: pairs are a new `taste_signals` kind, `pair`, with `value` = the
chosen recipe id, `either` or `neither`, and the other recipe in a new
`other_recipe_id` column. That's one migration. Region edits are kind `style`,
with value = region and level.

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
| `classify.ts` | `plateVector(c)`, `plateVectorWithoutOptional(c)` (pure, no stored data) |
| `profile.ts` | frequency scale, `fitStyleTaste(signals)`: backfitting, kernel smoother, pair residuals, region summary; `pickStarterSet` → `nextQuizCard(state)` |
| `recommend.ts` | `expectedFrequency`, `softmin`, region definitions |
| `deck.ts` | occasional share in place of the treat slot; joint score for households; adjustable variant |
| `TasteQuiz.tsx` | new wording, the three phases, pair cards, early stop, summary screen |
| migration | `taste_signals`: `pair` and `style` kinds, `other_recipe_id` |
| tests | plate vectors for known dishes; the fit recovering a synthetic person (style + taste) from 30 answers; household softmin; deck mix shares |

**Validation before shipping:** simulate personas (mostly balanced; generous;
loves fish but only lean; vegetarian comfort lover), have each answer the quiz
from a hidden true `F`, and check that the fitted `F` ranks the library close
to the truth (Spearman ≥ 0.7 after 32 answers). The same harness tunes `h`,
`λ`, the info weights and the quiz length.

## Open points

- Plate thresholds (`0 at` / `1 at`) are first guesses. Check them against the
  library's spread once plate vectors exist.
- Whether 20 cards before the early stop is enough. The persona simulation will
  tell.
- Region names and boundaries for the summary, and translations.
