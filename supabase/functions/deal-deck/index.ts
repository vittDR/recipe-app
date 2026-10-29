// Deals tonight's deck for the household: filters on everyone's hard rules,
// scores the library and stores 12 cards plus each eater's private plate.
// Body: { who_eating: uuid[], max_minutes?: number, mood?: Mood, for_date?: 'YYYY-MM-DD' }

import { corsHeaders, json, requireMember, serviceClient } from '../_shared/http.ts';
import { buildDeck, type CandidateRecipe, type DeckMember, type Diet, type Mood, type RecipeHistory } from '../_shared/logic/deck.ts';
import { recipeFeatures, softWeights, type Exposure } from '../_shared/logic/preferences.ts';

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
    .eq('household_id', householdId).eq('for_date', forDate).in('status', ['open', 'tiebreak'])
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (open) return json({ deck_id: open.id, existing: true });

  const { data: memberRows } = await admin.from('household_members').select('user_id').eq('household_id', householdId);
  const householdUsers = (memberRows ?? []).map((m) => m.user_id as string);
  const requested: string[] = Array.isArray(body.who_eating) ? body.who_eating : householdUsers;
  const eaters = [...new Set([userId, ...requested])].filter((u) => householdUsers.includes(u));

  const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
  const [goals, rules, patterns, swipes, recipes, meals, pantry, catalog] = await Promise.all([
    admin.from('member_goals').select('*').in('user_id', eaters),
    admin.from('taste_rules').select('user_id, kind, value, product_id').in('user_id', eaters),
    admin.from('learned_patterns').select('user_id, pattern, weight').in('user_id', eaters).eq('status', 'accepted'),
    admin.from('swipes').select('user_id, recipe_id, verdict, created_at, decks!inner(household_id)')
      .eq('decks.household_id', householdId).order('created_at', { ascending: false }).limit(1000),
    admin.from('recipes')
      .select('id, title, tags, total_min, kcal_per_serving, protein_g_per_serving, household_id, copied_from, recipe_ingredients(name, is_staple)')
      .or(`household_id.is.null,household_id.eq.${householdId}`),
    admin.from('meals').select('recipe_id, for_date, status').eq('household_id', householdId),
    admin.from('grocery_items').select('name').eq('household_id', householdId).gte('checked_at', since(PANTRY_DAYS)),
    admin.from('ingredient_catalog').select('name, diet_class'),
  ]);
  for (const r of [goals, rules, patterns, swipes, recipes, meals, pantry, catalog]) {
    if (r.error) return json({ error: r.error.message }, 500);
  }

  const dietOf = new Map((catalog.data ?? []).map((c) => [c.name as string, c.diet_class as 'veg' | 'fish' | 'meat']));

  // Seed recipes the household copied are replaced by their copy.
  const copied = new Set((recipes.data ?? []).filter((r) => r.copied_from).map((r) => r.copied_from as string));
  const library = (recipes.data ?? []).filter((r) => !(r.household_id === null && copied.has(r.id)));

  const featuresById = new Map<string, string[]>();
  const candidates: CandidateRecipe[] = library.map((r) => {
    const ings = (r.recipe_ingredients ?? []) as { name: string; is_staple: boolean; product_id: string | null }[];
    const names = ings.filter((i) => !i.is_staple).map((i) => i.name.toLowerCase());
    featuresById.set(r.id, recipeFeatures(r.tags ?? [], ings));
    const classes = ings.map((i) => dietOf.get(i.name));
    return {
      id: r.id,
      title: r.title,
      tags: r.tags ?? [],
      ingredientNames: names,
      productIds: ings.flatMap((i) => (i.product_id ? [i.product_id] : [])),
      dietClass: classes.includes('meat') ? 'meat' : classes.includes('fish') ? 'fish' : 'veg',
      totalMin: r.total_min,
      kcalPerServing: r.kcal_per_serving,
      proteinGPerServing: r.protein_g_per_serving,
    };
  });

  const members: DeckMember[] = eaters.map((uid) => {
    const g = (goals.data ?? []).find((x) => x.user_id === uid);
    const mine = (rules.data ?? []).filter((x) => x.user_id === uid);
    const exposures: Exposure[] = (swipes.data ?? [])
      .filter((s) => s.user_id === uid)
      .slice(0, 300)
      .map((s) => ({ verdict: s.verdict, features: featuresById.get(s.recipe_id) ?? [], createdAt: s.created_at }));
    const weights = softWeights(exposures);
    for (const p of (patterns.data ?? []).filter((x) => x.user_id === uid)) {
      const value = String(p.pattern?.value ?? '').toLowerCase();
      if (value) weights.set(value, (weights.get(value) ?? 0) + Number(p.weight ?? 0));
    }
    return {
      userId: uid,
      dinnerKcal: g?.dinner_kcal ?? null,
      dinnerProteinG: g?.dinner_protein_g ?? null,
      servings: g?.servings ?? null,
      never: mine.filter((x) => x.kind === 'never' && !x.product_id).map((x) => x.value),
      loves: mine.filter((x) => x.kind === 'love' && !x.product_id).map((x) => x.value),
      neverProducts: mine.filter((x) => x.kind === 'never' && x.product_id).map((x) => x.product_id as string),
      loveProducts: mine.filter((x) => x.kind === 'love' && x.product_id).map((x) => x.product_id as string),
      diet: (mine.find((x) => x.kind === 'diet')?.value ?? 'everything') as Diet,
      weights,
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

  const cards = buildDeck(candidates, members, history, {
    mood,
    maxMinutes,
    recentlyCooked,
    pantry: (pantry.data ?? []).map((p) => p.name),
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
    await admin.from('push_outbox').insert(others.map((u) => ({
      user_id: u, kind: 'deck_dealt', payload: { deck_id: deck.id, name: me?.first_name ?? '' },
    })));
  }
  return json({ deck_id: deck.id, existing: false, cards: cards.length });
});
