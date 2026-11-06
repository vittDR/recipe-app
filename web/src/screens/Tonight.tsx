import { useMemo, useState } from 'react';
import { RATINGS, type Rating } from '@logic/profile.ts';
import { Link, useNavigate } from 'react-router';
import pastaCard from '../assets/deck/pasta.webp';
import pizzaCard from '../assets/deck/pizza.webp';
import stirFryCard from '../assets/deck/stir-fry.webp';
import { AddToListSheet, loadProposals, type MealForList } from '../components/AddToListSheet.tsx';
import { DeckSettingsSheet, DeckSummaryRow, MOODS, useDeckLabels, type DeckSettings } from '../components/DeckSettings.tsx';
import { Icon } from '../components/Icon.tsx';
import { WeekStrip } from '../components/WeekStrip.tsx';
import {
  Avatar, AvatarPair, Button, Chip, ListRow, ProgressBar, RecipeThumb, Screen, Section, Spinner, Tag, TabHeader, imageStyle, recipeEmoji,
} from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import { recipeTitle } from '../lib/recipeText.ts';
import { todayIn, useLive, useSave } from '../lib/hooks.ts';
import { comingDays, cooksOn } from '../lib/plan.ts';
import { INGREDIENT_SELECT } from '../lib/products.ts';
import { useSession } from '../lib/session.tsx';
import { callFunction, must, supabase } from '../lib/supabase.ts';
import type { Deck, DeckMemberProgress, Meal, Mood, PlanDate, PlanDay, Recipe, RecipeIngredient, Verdict } from '../lib/types.ts';

type MealRecipe = Pick<Recipe, 'id' | 'title' | 'language' | 'translations' | 'image_path' | 'tags' | 'total_min' | 'difficulty'
  | 'protein_g_per_serving' | 'servings'>;
type PlannedMeal = Meal & { recipe: MealRecipe | null; deck: { who_eating: string[] } | null };
type RateMeal = { id: string; recipe_id: string; recipe: Pick<Recipe, 'title' | 'language' | 'translations'> | null };

interface TonightData {
  deck: Deck | null;
  progress: DeckMemberProgress[];
  /** Cards in the deck. */
  total: number;
  /** My yes and must-have swipes on an open deck, for the waiting state. */
  yeses: { recipe_id: string; verdict: Verdict; recipe: Pick<Recipe, 'title' | 'language' | 'translations' | 'image_path' | 'tags'> | null }[];
  meals: PlannedMeal[];
  plan: PlanDay[];
  dates: PlanDate[];
  /** A recent meal this person ate and hasn't said how it was. */
  toRate: RateMeal | null;
  /** The mood this person says yes to most, as the deck's silent default. */
  favouriteMood: Mood;
}

/** Meals from this many days back are offered for a rating. */
const RATE_DAYS = 3;
const daysBefore = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
const MEAL_RECIPE = 'id, title, language, translations, image_path, tags, total_min, difficulty, protein_g_per_serving, servings';

export function TonightScreen() {
  const { t, locale } = useI18n();
  const { userId, household, partners, members, memberName, memberColor } = useSession();
  const navigate = useNavigate();
  const save = useSave();
  const labels = useDeckLabels();
  const tz = household!.timezone;
  const today = todayIn(tz);
  const shared = partners.length > 0;

  const [picked, setPicked] = useState<DeckSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [dealing, setDealing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nudged, setNudged] = useState(false);
  const [rated, setRated] = useState<string | null>(null);

  // Tonight and the six evenings after it.
  const week = comingDays(tz);

  const { data, loading } = useLive<TonightData>(
    `tonight:${household!.id}:${today}`,
    async () => {
      const [decks, meals, plan, dates, recent, rated, liked] = await Promise.all([
        supabase.from('decks').select('*').eq('household_id', household!.id).eq('for_date', today)
          .neq('status', 'closed').order('created_at', { ascending: false }).limit(1),
        supabase.from('meals').select(`id, for_date, recipe_id, status, deck_id, deck:decks(who_eating), recipe:recipes(${MEAL_RECIPE})`)
          .eq('household_id', household!.id).gte('for_date', week[0]).lte('for_date', week[6]),
        supabase.from('plan_days').select('*').eq('household_id', household!.id),
        supabase.from('plan_dates').select('*').eq('household_id', household!.id).gte('for_date', week[0]).lte('for_date', week[6]),
        supabase.from('meals').select('id, for_date, recipe_id, status, deck:decks(who_eating), recipe:recipes(title, language, translations)')
          .eq('household_id', household!.id).gte('for_date', daysBefore(today, RATE_DAYS)).lte('for_date', today)
          .neq('status', 'skipped').order('for_date', { ascending: false }),
        supabase.from('taste_signals').select('meal_id').eq('user_id', userId!).eq('kind', 'rating')
          .gte('created_at', `${daysBefore(today, RATE_DAYS + 7)}T00:00:00Z`),
        supabase.from('swipes').select('deck:decks(mood)').eq('user_id', userId!).neq('verdict', 'pass')
          .order('created_at', { ascending: false }).limit(150),
      ]);
      const ratedMeals = new Set((must(rated) as { meal_id: string }[]).map((x) => x.meal_id));
      type RecentMeal = RateMeal & { for_date: string; status: string; deck: { who_eating: string[] } | null };
      // Eaten: an earlier day, or cooked tonight; by this person when the deck says who ate.
      const toRate = (must(recent) as unknown as RecentMeal[]).find((m) => !ratedMeals.has(m.id)
        && (m.for_date < today || m.status === 'cooked') && (!m.deck || m.deck.who_eating.includes(userId!))) ?? null;
      const deck = (must(decks) as Deck[])[0] ?? null;
      const [progress, yeses, cards] = deck
        ? await Promise.all([
          supabase.from('deck_members').select('*').eq('deck_id', deck.id),
          supabase.from('swipes').select('recipe_id, verdict, created_at, recipe:recipes(title, language, translations, image_path, tags)')
            .eq('deck_id', deck.id).eq('user_id', userId!).neq('verdict', 'pass').order('created_at'),
          supabase.from('deck_cards').select('recipe_id', { count: 'exact', head: true }).eq('deck_id', deck.id),
        ])
        : [{ data: [], error: null }, { data: [], error: null }, { count: 0 }];
      // Most-liked mood over recent swipes, when it stands out; otherwise anything.
      const counts = new Map<Mood, number>();
      for (const s of must(liked) as unknown as { deck: { mood: Mood | null } | null }[]) {
        const m = s.deck?.mood;
        if (m && m !== 'any' && MOODS.includes(m)) counts.set(m, (counts.get(m) ?? 0) + 1);
      }
      const [top, second] = [...counts].sort((a, b) => b[1] - a[1]);
      return {
        deck,
        progress: must(progress) as DeckMemberProgress[],
        total: cards.count ?? 12,
        yeses: must(yeses) as unknown as TonightData['yeses'],
        meals: must(meals) as unknown as PlannedMeal[],
        plan: must(plan) as PlanDay[],
        dates: must(dates) as PlanDate[],
        toRate: toRate && { id: toRate.id, recipe_id: toRate.recipe_id, recipe: toRate.recipe },
        // Only a clear preference: enough yeses, and well ahead of the next mood.
        favouriteMood: top && top[1] >= 8 && top[1] >= 2 * (second?.[1] ?? 0) ? top[0] : 'any',
      };
    },
    [
      { table: 'decks', filter: `household_id=eq.${household!.id}` },
      { table: 'meals', filter: `household_id=eq.${household!.id}` },
      { table: 'plan_dates', filter: `household_id=eq.${household!.id}` },
    ],
  );

  // Deck defaults are silent: both of us, under an hour, the favourite mood.
  const settings: DeckSettings = picked ?? { who: 'both', maxMinutes: 60, mood: data?.favouriteMood ?? 'any' };

  // Meals still to cook this week, tonight first: what the groceries card covers.
  const planned = useMemo(() => (data?.meals ?? [])
    .filter((m) => m.recipe && m.status !== 'skipped' && m.status !== 'cooked')
    .sort((a, b) => a.for_date.localeCompare(b.for_date)), [data?.meals]);
  const plannedKey = planned.map((m) => m.id).join(',');

  const { data: groceries } = useLive<{ meals: MealForList[]; total: number; toBuy: number }>(
    plannedKey ? `tonight-groceries:${plannedKey}` : null,
    async () => {
      const ingredients = must(await supabase.from('recipe_ingredients').select(INGREDIENT_SELECT)
        .in('recipe_id', planned.map((m) => m.recipe_id)).order('position')) as RecipeIngredient[];
      // One pot: the servings of everyone eating, as on the match screen.
      const pots = await Promise.all(planned.map((m) => supabase.rpc('my_portion', {
        p_recipe: m.recipe_id, p_eaters: m.deck?.who_eating ?? members.map((x) => x.user_id),
      })));
      const lists = planned.map((m, k) => ({
        recipe: m.recipe as Recipe,
        ingredients: ingredients.filter((i) => i.recipe_id === m.recipe_id),
        potServings: ((pots[k].data ?? []) as { pot_servings: number }[])[0]?.pot_servings ?? null,
        label: `${dayLabel(m.for_date)} · ${recipeTitle(m.recipe!, locale)}`,
      }));
      const proposals = await Promise.all(lists.map((l) => loadProposals(household!.id, l.ingredients)));
      return { meals: lists, total: proposals.flat().length, toBuy: proposals.flat().filter((p) => p.add).length };
    },
  );

  const deal = async () => {
    setDealing(true);
    setError(null);
    try {
      const whoEating = settings.who === 'me' || !shared ? [userId] : [userId, ...partners.map((p) => p.user_id)];
      const res = await callFunction<{ deck_id: string }>('deal-deck', {
        who_eating: whoEating, max_minutes: settings.maxMinutes, mood: settings.mood, for_date: today,
      }, 30_000);
      navigate(`/deck/${res.deck_id}`);
    } catch (e) {
      setError(e instanceof Error && e.message === 'no_recipes' ? t('tonight.noRecipes') : t('app.error'));
      setSettingsOpen(true);
      setDealing(false);
    }
  };

  const rate = async (meal: RateMeal, rating: Rating) => {
    setRated(meal.id);
    await save(supabase.from('taste_signals').upsert(
      { user_id: userId, recipe_id: meal.recipe_id, kind: 'rating', value: rating, meal_id: meal.id },
      { onConflict: 'user_id,key' },
    ));
  };

  const nudge = async (deckId: string) => {
    const res = await supabase.rpc('nudge', { p_deck: deckId });
    if (await save(Promise.resolve(res))) setNudged(res.data !== false);
  };

  const cook = async (meal: PlannedMeal) => {
    await save(supabase.from('meals').update({ status: 'cooked' }).eq('id', meal.id));
    navigate(`/recipes/${meal.recipe_id}/cook`);
  };

  const dayFormat = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', timeZone: 'UTC' });
  const longFormat = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  function dayLabel(date: string) {
    return cap(dayFormat.format(new Date(`${date}T12:00:00Z`)));
  }

  const people = [userId!, ...partners.map((p) => p.user_id)].map((id) => ({ id, name: memberName(id), color: memberColor(id) }));
  const header = (
    <TabHeader overline={cap(longFormat.format(new Date(`${today}T12:00:00Z`)))} title={t('tonight.title')}
      right={members.length > 0 ? <AvatarPair people={people} /> : undefined} />
  );

  if (loading && !data) return <Screen>{header}<Spinner /></Screen>;

  const deck = data?.deck ?? null;
  const open = deck?.status === 'open';
  const tonightMeal = (data?.meals ?? []).find((m) => m.for_date === today && m.status !== 'skipped' && m.recipe);
  const upcoming = planned.filter((m) => m.for_date > today);
  const myProgress = deck ? data?.progress.find((p) => p.user_id === userId) : undefined;
  const iAmEating = !!deck && deck.who_eating.includes(userId!);
  const iSwipe = open && iAmEating && !myProgress?.finished_at;
  const total = data?.total || 12;
  const deckSummary = deck && labels.summary({ who: deck.who_eating.length > 1 ? 'both' : 'me', maxMinutes: deck.max_minutes, mood: deck.mood }, shared);

  const strip = (
    <WeekStrip today={today} days={week.map((date) => {
      const meal = data?.meals.find((m) => m.for_date === date && m.status !== 'skipped');
      return {
        date,
        together: cooksOn(date, data?.plan, data?.dates),
        meal: meal && { cooked: meal.status === 'cooked', image_path: meal.recipe?.image_path ?? null },
      };
    })} />
  );

  const rating = data?.toRate && rated !== data.toRate.id && (
    <section className="card stack" aria-label={t('rating.title')}>
      <span className="card__title">
        {t('rating.question', { title: data.toRate.recipe ? recipeTitle(data.toRate.recipe, locale) : '' })}
      </span>
      <div className="chips">
        {[...RATINGS, 'not_eaten' as const].map((r) => (
          <Chip key={r} onClick={() => void rate(data.toRate!, r)}>{t(`rating.${r}`)}</Chip>
        ))}
      </div>
    </section>
  );

  const upcomingSection = upcoming.length > 0 && (
    <Section label={t('tonight.upcoming')}>
      <div className="stack stack--sm">
        {upcoming.map((m) => (
          <Link key={m.id} to={`/recipes/${m.recipe_id}`} className="card meal-row">
            <span className="meal-row__thumb"><RecipeThumb recipe={m.recipe!} /></span>
            <span className="grow">
              <span className="t-label muted d-block">{dayLabel(m.for_date)}</span>
              <span className="headline d-block">{recipeTitle(m.recipe!, locale)}</span>
            </span>
            <span className="chevron"><Icon name="chevron" size={18} /></span>
          </Link>
        ))}
      </div>
    </Section>
  );

  const groceriesCard = planned.length > 0 && groceries && (
    <section className="card card--sage groceries-card">
      <span className="icon-tile icon-tile--sage icon-tile--white"><Icon name="basket" size={20} /></span>
      <span className="grow">
        <span className="card__title d-block">{t('tonight.groceries')}</span>
        <span className="t-callout text-sage d-block">
          {groceries.toBuy === 0 ? t('tonight.groceriesNone')
            : planned.length > 1 ? t('tonight.groceriesMany', { recipes: planned.length, n: groceries.toBuy })
              : t('tonight.groceriesOne', { n: groceries.total, home: groceries.total - groceries.toBuy })}
        </span>
      </span>
      {groceries.toBuy > 0 && <Button small variant="sage" onClick={() => setListOpen(true)}>{t('tonight.groceriesAdd')}</Button>}
    </section>
  );

  let main: React.ReactNode;
  if (tonightMeal && !open) {
    // Decided: tonight first, then what's coming, then one groceries card for all.
    const r = tonightMeal.recipe!;
    const cooked = tonightMeal.status === 'cooked';
    const facts = [
      r.total_min && t('swipe.minutes', { n: r.total_min }),
      r.difficulty && t(`recipe.${r.difficulty}`),
      r.protein_g_per_serving && t('tonight.protein', { n: Math.round(r.protein_g_per_serving) }),
    ].filter(Boolean).join(' · ');
    main = (
      <>
        <article className="card card--flush decided">
          <Link to={`/recipes/${r.id}`} className="decided__photo" style={imageStyle(r.image_path)}>
            {!imageStyle(r.image_path) && <span aria-hidden>{recipeEmoji(r.title, r.tags)}</span>}
            <span className="glass-badge"><Icon name="check" size={16} strokeWidth={2.4} />
              {cooked ? t('tonight.cookedBadge') : t('tonight.decidedBadge')}</span>
          </Link>
          <div className="decided__body">
            <h2 className="t-title-s m-0">{recipeTitle(r, locale)}</h2>
            {facts && <p className="muted m-0">{facts}</p>}
            {cooked
              ? <Button block variant="secondary" onClick={() => navigate(`/recipes/${r.id}`)}>{t('match.viewRecipe')}</Button>
              : <Button block onClick={() => void cook(tonightMeal)}><Icon name="pot" /> {t('tonight.startCooking')}</Button>}
          </div>
        </article>
        {upcomingSection}
        {groceriesCard}
      </>
    );
  } else if (deck && open && iSwipe) {
    // A deck is running and I still have cards: only "start swiping".
    const starter = deck.started_by !== userId && !myProgress?.swiped_count;
    const others = deck.who_eating.filter((u) => u !== userId);
    main = (
      <article className="card card--flush join-card">
        <div className={`join-card__art${starter ? ' join-card__art--iris' : ''}`} aria-hidden>
          <img className="fan fan--left fan--art" src={pastaCard} alt="" />
          <img className="fan fan--mid fan--art" src={stirFryCard} alt="" />
        </div>
        <div className="join-card__body">
          <div className="row">
            {starter
              ? <Avatar name={memberName(deck.started_by)} color={memberColor(deck.started_by)} size="lg" />
              : <span className="icon-tile"><Icon name="heart" filled size={18} /></span>}
            <span className="grow">
              <span className="card__title d-block">{starter ? t('tonight.partnerLaunched', { name: memberName(deck.started_by) }) : t('tonight.yourDeck')}</span>
              <span className="muted d-block">{deckSummary}</span>
            </span>
          </div>
          {others.map((u) => {
            const n = data?.progress.find((p) => p.user_id === u)?.swiped_count ?? 0;
            return (
              <div key={u} className="person-progress">
                <span className="t-label text-iris">{memberName(u)}</span>
                <ProgressBar value={n} max={total} />
                <span className="t-callout tabular">{n} / {total}</span>
              </div>
            );
          })}
          <Button block onClick={() => navigate(`/deck/${deck.id}`)}>
            <Icon name="heart" filled size={20} /> {myProgress?.swiped_count ? t('tonight.continueDeck') : t('tonight.startSwiping')}
          </Button>
        </div>
      </article>
    );
  } else if (deck && open) {
    // I'm done (or not eating): waiting for the others.
    const waitingFor = deck.who_eating.filter((u) => u !== userId && !data?.progress.find((p) => p.user_id === u)?.finished_at);
    const names = waitingFor.map(memberName).join(', ');
    main = (
      <>
        {waitingFor.map((u) => {
          const n = data?.progress.find((p) => p.user_id === u)?.swiped_count ?? 0;
          return (
            <section key={u} className="card card--iris waiting-card">
              <div className="row">
                <Avatar name={memberName(u)} color={memberColor(u)} size="lg" />
                <span className="grow">
                  <span className="card__title d-block">{n ? t('tonight.swiping', { name: memberName(u) }) : t('tonight.notStarted', { name: memberName(u) })}</span>
                  <span className="text-iris d-block">{t('tonight.justThem', { name: memberName(u) })}</span>
                </span>
              </div>
              {n > 0 && (
                <div className="person-progress">
                  <ProgressBar value={n} max={total} />
                  <span className="t-callout tabular text-iris">{n} / {total}</span>
                </div>
              )}
            </section>
          );
        })}
        {waitingFor.length > 0 && (
          <Button block variant="iris" disabled={nudged} onClick={() => void nudge(deck.id)}>
            <Icon name="bell" /> {nudged ? t('waiting.nudged') : t('waiting.nudge', { name: names })}
          </Button>
        )}
        {(data?.yeses.length ?? 0) > 0 && (
          <Section label={t('tonight.yourYes', { n: data!.yeses.length })}>
            <div className="list">
              {data!.yeses.map((s) => (
                <ListRow key={s.recipe_id} to={`/recipes/${s.recipe_id}`} chevron={false}
                  icon={s.recipe && <span className="row-thumb"><RecipeThumb recipe={s.recipe} /></span>}
                  title={s.recipe ? recipeTitle(s.recipe, locale) : ''}
                  trailing={s.verdict === 'must' && <Tag tone="warning"><Icon name="star" filled size={12} /> {t('swipe.must')}</Tag>} />
              ))}
            </div>
          </Section>
        )}
      </>
    );
  } else {
    // No deck yet: dealing the deck is the only big action.
    main = (
      <>
        <section className="deal-hero">
          <div className="deal-hero__art" aria-hidden>
            <img className="fan fan--left fan--art" src={pastaCard} alt="" />
            <img className="fan fan--right fan--art" src={pizzaCard} alt="" />
            <img className="fan fan--mid fan--art" src={stirFryCard} alt="" />
          </div>
          <h2 className="deal-hero__title">{deck?.status === 'no_match' ? t('noMatch.again') : t('tonight.ask')}</h2>
          <button type="button" className="btn btn--block deal-hero__btn" disabled={dealing} onClick={() => void deal()}>
            {dealing ? t('tonight.dealing') : t('tonight.deal')}
          </button>
        </section>
        {error && !settingsOpen && <p className="notice">{error}</p>}
        <DeckSummaryRow settings={settings} shared={shared} onClick={() => setSettingsOpen(true)} />
        {!shared && (
          <div className="list">
            <ListRow to="/us/invite" tile="accent" icon={<Icon name="people" size={18} />} title={t('tonight.noPartner')} />
          </div>
        )}
        {upcomingSection}
        {groceriesCard}
      </>
    );
  }

  return (
    <Screen>
      <div className="tonight">
        {header}
        {strip}
        {rating}
        {main}
      </div>
      <DeckSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onChange={setPicked}
        shared={shared} dealing={dealing} error={error} onDeal={() => void deal()} />
      {groceries && (
        <AddToListSheet open={listOpen} onClose={() => setListOpen(false)} meals={groceries.meals} />
      )}
    </Screen>
  );
}
