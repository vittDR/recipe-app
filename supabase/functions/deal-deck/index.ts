// Deals tonight's deck for the household: filters on everyone's hard rules,
// scores the library and stores 12 cards plus each eater's private plate.
// Body: { who_eating: uuid[], max_minutes?: number, mood?: Mood, for_date?: 'YYYY-MM-DD' }

import { corsHeaders, json, requireMember, serviceClient } from '../_shared/http.ts';
import { buildDeck, OCCASIONAL_DAYS, type CandidateRecipe, type DeckMember, type Diet, type Mood, type RecipeHistory } from '../_shared/logic/deck.ts';
import { classifyRow, CLASSIFY_COLUMNS, storedClassification, type ClassifiableRow } from '../_shared/logic/classify.ts';
import { Catalog, type CatalogEntry } from '../_shared/logic/ingredients.ts';
import { recipeFeatures } from '../_shared/logic/preferences.ts';
import { splitPot } from '../_shared/logic/portions.ts';
import {
  buildProfile, signalsFor, weightsOf, type MealRow, type PortionRow, type SwipeRow, type TasteSignalRow, kindKeys, occasionalKinds } from '../_shared/logic/profile.ts';
import { dietAdherence } from '../_shared/logic/recommend.ts';

const MOODS: Mood[] = ['any', 'comfort', 'light', 'quick', 'fancy'];
const RECENT_COOK_DAYS = 10;
const PANTRY_DAYS = 7;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const caller = await requireMember(req);
  if (caller instanceof Response) return caller;
  const { userId, householdId } = caller;
  const admin = serviceClient();

  const body = await req.json().catch(() => ({}));
  const mood: Mood = MOODS.includes(body.mood) ? body.mood : 'any';
  const maxMinutes = Number.isFinite(body.max_minutes) && body.max_minutes > 0 ? Math.round(body.max_minutes) : null;

  const { data: household } = await admin.from('households').select('timezone').eq('id', householdId).single();
  const forDate: string = /^\d{4}-\d{2}-\d{2}$/.test(body.for_date ?? '')
    ? body.for_date
    : new Intl.DateTimeFormat('en-CA', { timeZone: household?.timezone ?? 'Europe/Paris' }).format(new Date());

  // Someone already dealt tonight: join that deck instead of dealing a second one.
  const { data: open } = await admin.from('decks').select('id')
    .eq('household_id', householdId).eq('for_date', forDate).eq('status', 'open')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (open) return json({ deck_id: open.id, existing: true });

  const { data: memberRows } = await admin.from('household_members').select('user_id').eq('household_id', householdId);
  const householdUsers = (memberRows ?? []).map((m) => m.user_id as string);
  const requested: string[] = Array.isArray(body.who_eating) ? body.who_eating : householdUsers;
  const eaters = [...new Set([userId, ...requested])].filter((u) => householdUsers.includes(u));

  // Tonight's decks that ended without a match: the new deck leaves their cards
  // out and leans towards what anyone said yes to in them.
  const { data: failedDecks } = await admin.from('decks').select('id, deck_cards(recipe_id), swipes(recipe_id, verdict)')
    .eq('household_id', householdId).eq('for_date', forDate).eq('status', 'no_match');
  const exclude = new Set((failedDecks ?? []).flatMap((d) => ((d.deck_cards ?? []) as { recipe_id: string }[]).map((c) => c.recipe_id)));
  const likedBefore = new Set((failedDecks ?? []).flatMap((d) => ((d.swipes ?? []) as { recipe_id: string; verdict: string }[])
    .filter((x) => x.verdict !== 'pass').map((x) => x.recipe_id)));

  const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
  const [goals, rules, swipes, recipes, meals, pantry, catalog, signals, allergies, allergenLinks] = await Promise.all([
    admin.from('member_goals').select('*').in('user_id', eaters),
    admin.from('taste_rules').select('user_id, kind, value, product_id').in('user_id', eaters),
    admin.from('swipes').select('user_id, deck_id, recipe_id, verdict, created_at, decks!inner(household_id, mood)')
      .eq('decks.household_id', householdId).order('created_at', { ascending: false }).limit(1000),
    admin.from('recipes')
      .select(`id, kcal_per_serving, protein_g_per_serving, household_id, copied_from, ${CLASSIFY_COLUMNS.replace('recipe_ingredients(', 'recipe_ingredients(product_id, ')}`)
      .or(`household_id.is.null,household_id.eq.${householdId}`),
    admin.from('meals').select('id, recipe_id, for_date, status, deck:decks(who_eating)').eq('household_id', householdId),
    admin.from('grocery_items').select('name, product:products(ingredient)').eq('household_id', householdId)
      .gte('checked_at', since(PANTRY_DAYS)),
    admin.from('ingredient_catalog').select('*'),
    // Quiz answers, pass reasons and ratings (logic/profile.ts).
    admin.from('taste_signals').select('user_id, recipe_id, kind, value, deck_id, meal_id, created_at')
      .in('user_id', eaters).order('created_at', { ascending: false }).limit(2000),
    admin.from('member_allergies').select('user_id, allergen, ingredient').in('user_id', eaters),
    admin.from('allergen_ingredients').select('allergen, ingredient'),
  ]);
  for (const r of [goals, rules, swipes, recipes, meals, pantry, catalog, signals, allergies, allergenLinks]) {
    if (r.error) return json({ error: r.error.message }, 500);
  }
  // Whether each swiped card fit each eater when it was dealt: what lets the diet explain a pass away.
  const swipedDecks = [...new Set((swipes.data ?? []).filter((s) => eaters.includes(s.user_id)).map((s) => s.deck_id as string))];
  const portions = swipedDecks.length
    ? await admin.from('member_portions').select('deck_id, recipe_id, user_id, fits').in('deck_id', swipedDecks).in('user_id', eaters)
    : { data: [], error: null };
  if (portions.error) return json({ error: portions.error.message }, 500);

  const dietOf = new Map((catalog.data ?? []).map((c) => [c.name as string, c.diet_class as 'veg' | 'fish' | 'meat']));
  const { data: versions } = await admin.rpc('catalog_version');
  const ingredientCatalog = new Catalog((catalog.data ?? []) as CatalogEntry[], (versions as { ingredients?: string } | null)?.ingredients ?? null);
  // Classifications worked out now, to store for next time.
  const fresh: { id: string; classification: unknown; classified_with: string }[] = [];

  // Seed recipes the household copied are replaced by their copy.
  const copied = new Set((recipes.data ?? []).filter((r) => r.copied_from).map((r) => r.copied_from as string));
  const library = (recipes.data ?? []).filter((r) => !(r.household_id === null && copied.has(r.id)));

  const featuresById = new Map<string, string[]>();
  const candidates: CandidateRecipe[] = library.map((r) => {
    const ings = (r.recipe_ingredients ?? []) as { name: string; is_staple: boolean; product_id: string | null; optional: boolean }[];
    const names = ings.filter((i) => !i.is_staple).map((i) => i.name.toLowerCase());
    const required = ings.filter((i) => !i.optional);
    const optional = ings.filter((i) => i.optional);
    // What the dish is, from its ingredients, steps and tags (logic/classify.ts).
    const row = r as unknown as ClassifiableRow;
    const classification = classifyRow(row, ingredientCatalog);
    if (ingredientCatalog.version && !storedClassification(row, ingredientCatalog)) {
      fresh.push({ id: r.id, classification, classified_with: ingredientCatalog.version });
    }
    const features = recipeFeatures(r.tags ?? [], ings, classification);
    featuresById.set(r.id, features);
    // Swipes and ratings made on the seed recipe before the household copied it count for the copy.
    if (r.copied_from) featuresById.set(r.copied_from as string, features);
    const classes = ings.map((i) => dietOf.get(i.name));
    return {
      allIngredients: ings.map((i) => i.name.toLowerCase()),
      id: r.id,
      title: r.title,
      tags: r.tags ?? [],
      ingredientNames: names,
      productIds: ings.flatMap((i) => (i.product_id ? [i.product_id] : [])),
      optionalProductIds: optional.flatMap((i) => (i.product_id && !required.some((x) => x.product_id === i.product_id) ? [i.product_id] : [])),
      dietClass: classes.includes('meat') ? 'meat' : classes.includes('fish') ? 'fish' : 'veg',
      totalMin: r.total_min,
      kcalPerServing: r.kcal_per_serving,
      proteinGPerServing: r.protein_g_per_serving,
      features,
      intents: classification.meal_intents,
    };
  });

  const one = <T>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const signalRows = {
    swipes: (swipes.data ?? []).map((s) => ({ ...s, mood: one(s.decks as { mood: Mood | null } | null)?.mood ?? null })) as SwipeRow[],
    tasteSignals: (signals.data ?? []) as TasteSignalRow[],
    meals: (meals.data ?? []).map((m) => ({ ...m, who_eating: one(m.deck as { who_eating: string[] } | null)?.who_eating ?? null })) as MealRow[],
    portions: (portions.data ?? []) as PortionRow[],
  };
  const macrosById = new Map((recipes.data ?? []).map((r) => [r.id as string, {
    kcalPerServing: r.kcal_per_serving as number | null, proteinGPerServing: r.protein_g_per_serving as number | null,
  }]));
  for (const r of recipes.data ?? []) if (r.copied_from) macrosById.set(r.copied_from as string, macrosById.get(r.id)!);

  const members: DeckMember[] = eaters.map((uid) => {
    const g = (goals.data ?? []).find((x) => x.user_id === uid);
    const mine = (rules.data ?? []).filter((x) => x.user_id === uid);
    // Quiz answers have no deck: whether the dish fits this person's goals now.
    const fitsNow = (id: string) => {
      const macros = macrosById.get(id);
      const plate = macros && splitPot(macros, [{ userId: uid, dinnerKcal: g?.dinner_kcal ?? null, dinnerProteinG: g?.dinner_protein_g ?? null, servings: g?.servings ?? null }]);
      return plate ? plate.plates[0].fits : null;
    };
    // Everything this person chose, weighed by what it says, with the diet explained away (logic/profile.ts).
    const memberSignals = signalsFor(uid, signalRows, (id) => featuresById.get(id), fitsNow);
    const profile = buildProfile(memberSignals);
    const weights = weightsOf(profile);
    return {
      userId: uid,
      dinnerKcal: g?.dinner_kcal ?? null,
      dinnerProteinG: g?.dinner_protein_g ?? null,
      servings: g?.servings ?? null,
      never: mine.filter((x) => x.kind === 'never').map((x) => x.product_id as string),
      loves: mine.filter((x) => x.kind === 'love').map((x) => x.product_id as string),
      diet: (mine.find((x) => x.kind === 'diet')?.value ?? 'everything') as Diet,
      // An allergen stands for every ingredient and preparation linked to it.
      allergies: (allergies.data ?? []).filter((a) => a.user_id === uid).flatMap((a) => (a.ingredient
        ? [a.ingredient as string]
        : (allergenLinks.data ?? []).filter((l) => l.allergen === a.allergen).map((l) => l.ingredient as string))),
      weights,
      profile,
      adherence: dietAdherence(memberSignals),
      occasional: occasionalKinds(memberSignals),
    };
  });

  const history = new Map<string, RecipeHistory>();
  for (const s of swipes.data ?? []) {
    const h = history.get(s.recipe_id) ?? { yes: 0, pass: 0, cooked: 0 };
    if (s.verdict === 'pass') h.pass += 1;
    else h.yes += 1;
    history.set(s.recipe_id, h);
  }
  const recentCutoff = new Date(Date.now() - RECENT_COOK_DAYS * 86_400_000).toISOString().slice(0, 10);
  const recentlyCooked = new Set<string>();
  for (const m of meals.data ?? []) {
    if (m.status === 'skipped') continue;
    const h = history.get(m.recipe_id) ?? { yes: 0, pass: 0, cooked: 0 };
    if (m.status === 'cooked') h.cooked += 1;
    history.set(m.recipe_id, h);
    if (m.for_date >= recentCutoff && m.for_date < forDate) recentlyCooked.add(m.recipe_id);
  }

  // Specific features only (protein, dish, cuisine…): "dinner" or a staple says nothing about taste.
  const lean = new Set([...likedBefore].flatMap((id) => featuresById.get(id) ?? []).filter((f) => f.includes(':')));
  // Kept on the recipes; cleared by the database when a recipe or its ingredients change.
  if (fresh.length) await admin.rpc('store_classifications', { p_rows: fresh });

  // "Not often" dishes wait while one of their kind was eaten, or is planned, within two weeks.
  const dayMs = 86_400_000;
  const recentKinds = new Set((meals.data ?? [])
    .filter((m) => m.status !== 'skipped' && m.for_date !== forDate
      && Math.abs(Date.parse(`${m.for_date}T12:00:00Z`) - Date.parse(`${forDate}T12:00:00Z`)) < OCCASIONAL_DAYS * dayMs)
    .flatMap((m) => kindKeys(m.recipe_id, featuresById.get(m.recipe_id))));

  const cards = buildDeck(candidates, members, history, {
    mood,
    maxMinutes,
    recentlyCooked,
    exclude,
    lean,
    recentKinds,
    // Recipe lines are named by catalogue ingredient ("chicken breast"); list
    // lines by their French product name, so compare on the product's ingredient.
    pantry: (pantry.data ?? []).map((p) => {
      const product = p.product as { ingredient: string | null } | { ingredient: string | null }[] | null;
      return (Array.isArray(product) ? product[0] : product)?.ingredient ?? p.name;
    }),
  });
  if (cards.length === 0) return json({ error: 'no_recipes' }, 422);

  const { data: deck, error: deckErr } = await admin.from('decks').insert({
    household_id: householdId, for_date: forDate, started_by: userId, who_eating: eaters,
    max_minutes: maxMinutes, mood,
  }).select('id').single();
  if (deckErr) return json({ error: deckErr.message }, 500);

  const inserts = await Promise.all([
    admin.from('deck_cards').insert(cards.map((c) => ({
      deck_id: deck.id, recipe_id: c.recipeId, position: c.position, score: c.score,
      fit_score: c.fitScore, fits_all: c.fitsAll, reason: c.reason,
    }))),
    admin.from('member_portions').insert(cards.flatMap((c) => (c.split?.plates ?? []).map((p) => ({
      deck_id: deck.id, recipe_id: c.recipeId, user_id: p.userId,
      kcal: Math.round(p.kcal), protein_g: Math.round(p.proteinG), servings: Math.round(p.servings * 100) / 100, fits: p.fits,
    })))),
    admin.from('deck_members').insert(eaters.map((u) => ({ deck_id: deck.id, user_id: u }))),
  ]);
  const failed = inserts.find((r) => r.error);
  if (failed) {
    await admin.from('decks').delete().eq('id', deck.id);
    return json({ error: failed.error!.message }, 500);
  }

  const { data: me } = await admin.from('profiles').select('first_name').eq('id', userId).single();
  const others = eaters.filter((u) => u !== userId);
  if (others.length) {
    // Through enqueue_push, which skips people who turned this kind off.
    await admin.rpc('enqueue_push', {
      p_users: others, p_kind: 'deck_dealt', p_payload: { deck_id: deck.id, name: me?.first_name ?? '' },
    });
  }
  return json({ deck_id: deck.id, existing: false, cards: cards.length });
});
