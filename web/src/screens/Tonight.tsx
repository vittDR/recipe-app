import { useMemo, useState } from 'react';
import { combineProposals, scaleQuantity } from '@logic/groceries.ts';
import { filtersForDiet } from '@logic/deckFilters.ts';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AddToListSheet, loadProposalsMany, type MealForList } from '../components/AddToListSheet.tsx';
import { DeckSettingsBar, DeckSettingsSheet, everyone, MOODS, type Table, useDeckLabels, type DeckSettings } from '../components/DeckSettings.tsx';
import { Icon } from '../components/Icon.tsx';
import { PickRecipeSheet } from '../components/PickRecipeSheet.tsx';
import { HOUSEHOLD_RECIPE, RateSheet, Stars } from '../components/Rating.tsx';
import { WeekSheet, WeekStrip, type StripDay } from '../components/WeekStrip.tsx';
import {
  Avatar, AvatarPair, Button, ListRow, ProgressBar, RecipeThumb, Screen, Section, Spinner, Tag, TabHeader, imageStyle, recipeEmoji,
} from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import { pickDeckArt } from '../lib/deckArt.ts';
import { useDiet } from '../lib/diet.ts';
import { useEaters } from '../lib/eaters.ts';
import { householdDefaults, loadLastSettings, saveLastSettings, type LastSettings } from '../lib/deckSettings.ts';
import { recipeTitle } from '../lib/recipeText.ts';
import { daysBetween, isDate, weekOf } from '../lib/dates.ts';
import { isoWeekday, todayIn, useLive, useSave } from '../lib/hooks.ts';
import { comingDays, cooksOn, eveningPath, useEveningName } from '../lib/plan.ts';
import { INGREDIENT_SELECT } from '../lib/products.ts';
import { useSession } from '../lib/session.tsx';
import { callFunction, must, supabase } from '../lib/supabase.ts';
import type {
  Deck, DeckMemberProgress, HouseholdRecipe, Meal, Mood, PlanDate, PlanDay, Recipe, RecipeIngredient, Verdict,
} from '../lib/types.ts';

type MealRecipe = Pick<Recipe, 'id' | 'title' | 'language' | 'translations' | 'image_path' | 'tags' | 'total_min' | 'difficulty'
  | 'protein_g_per_serving' | 'servings'>;
type PlannedMeal = Meal & { listed_at: string | null; recipe: MealRecipe | null; deck: { who_eating: string[]; extra_eaters: string[] } | null };
type RateMeal = { id: string; recipe_id: string; for_date: string; recipe: MealRecipe | null };

interface TonightData {
  /** The evening the deck part was loaded for. */
  forDate: string;
  deck: Deck | null;
  progress: DeckMemberProgress[];
  /** Cards in the deck. */
  total: number;
  /** My yes and must-have swipes on an open deck, for the waiting state. */
  yeses: { recipe_id: string; verdict: Verdict; recipe: Pick<Recipe, 'title' | 'language' | 'translations' | 'image_path' | 'tags'> | null }[];
  meals: PlannedMeal[];
  plan: PlanDay[];
  dates: PlanDate[];
  /** The household's ratings and hearts. */
  marks: HouseholdRecipe[];
  /** The mood this person says yes to most, as the deck's silent default when nothing was picked before. */
  favouriteMood: Mood;
  /** The settings of the last deck this person dealt, on any device. */
  lastDeck: LastSettings | null;
  /** Who ate at the household's last deck (anyone's): tonight starts from them. */
  lastWho: { members: string[]; eaters: string[] } | null;
}

const MEAL_RECIPE = 'id, title, language, translations, image_path, tags, total_min, difficulty, protein_g_per_serving, servings';

export function TonightScreen() {
  const { t, list, locale } = useI18n();
  const { userId, profile, household, partners, members, memberName, memberColor } = useSession();
  const navigate = useNavigate();
  const save = useSave();
  const labels = useDeckLabels();
  const { data: eaters } = useEaters();
  const tz = household!.timezone;
  const today = todayIn(tz);
  const shared = partners.length > 0;

  const [picked, setPicked] = useState<DeckSettings | null>(null);
  const [remembered, setRemembered] = useState(() => loadLastSettings(userId!));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<'main' | 'filters'>('main');
  const openSettings = (view: 'main' | 'filters') => {
    setSettingsView(view);
    setSettingsOpen(true);
  };
  const [listOpen, setListOpen] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);
  const [dealing, setDealing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nudged, setNudged] = useState(false);
  const [rateOpen, setRateOpen] = useState<{ meal: RateMeal; stars?: number } | null>(null);
  const [pickOpen, setPickOpen] = useState(false);

  // Any evening, from the strip or the calendar (/?day=). The strip shows tonight and the
  // six evenings after it, or, for an evening outside those, Monday to Sunday of its week.
  const coming = comingDays(tz);
  const [params, setParams] = useSearchParams();
  const day = params.get('day');
  const selected = isDate(day) ? day : today;
  const week = coming.includes(selected) ? coming : weekOf(selected);
  const isToday = selected === today;
  const isPast = selected < today;
  const eveningName = useEveningName();
  const { tn } = useI18n();
  // The title: Tonight, Tomorrow, a weekday this week, Yesterday, In 8 days, 9 days ago.
  const titleOf = (date: string) => {
    if (coming.includes(date)) return eveningName(date, today);
    const n = daysBetween(today, date);
    return n === -1 ? t('calendar.yesterday') : n > 0 ? tn('calendar.inDays', n) : tn('calendar.daysAgo', -n);
  };
  const selectDay = (date: string) => {
    if (date === selected) return;
    setPicked(null);
    setError(null);
    setNudged(false);
    setParams(date === today ? {} : { day: date }, { replace: true });
  };
  const backToTonight = () => {
    setPicked(null);
    setError(null);
    setNudged(false);
    setParams({}, { replace: true });
  };

  // The art, the protein choices and the deck follow this person's diet.
  const diet = useDiet();
  const { data, loading, set } = useLive<TonightData>(
    `tonight:${household!.id}:${today}:${selected}`,
    async () => {
      // The strip's week, and the coming one This week switches.
      const days = [...new Set([...week, ...coming])];
      const [decks, meals, plan, dates, marks, liked, mine, lastAny] = await Promise.all([
        supabase.from('decks').select('*').eq('household_id', household!.id).eq('for_date', selected)
          .neq('status', 'closed').order('created_at', { ascending: false }).limit(1),
        supabase.from('meals').select(`id, for_date, recipe_id, status, deck_id, listed_at, deck:decks(who_eating, extra_eaters), recipe:recipes(${MEAL_RECIPE})`)
          .eq('household_id', household!.id).in('for_date', days),
        supabase.from('plan_days').select('*').eq('household_id', household!.id),
        supabase.from('plan_dates').select('*').eq('household_id', household!.id).in('for_date', days),
        supabase.from('household_recipes').select(HOUSEHOLD_RECIPE).eq('household_id', household!.id),
        supabase.from('swipes').select('deck:decks(mood)').eq('user_id', userId!).neq('verdict', 'pass')
          .order('created_at', { ascending: false }).limit(150),
        supabase.from('decks').select('max_minutes, mood, filters, created_at').eq('household_id', household!.id)
          .eq('started_by', userId!).order('created_at', { ascending: false }).limit(1),
        supabase.from('decks').select('who_eating, extra_eaters').eq('household_id', household!.id)
          .order('created_at', { ascending: false }).limit(1),
      ]);
      const householdMarks = must(marks) as HouseholdRecipe[];
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
      const last = (must(mine) as Pick<Deck, 'max_minutes' | 'mood' | 'filters' | 'created_at'>[])[0];
      return {
        forDate: selected,
        deck,
        progress: must(progress) as DeckMemberProgress[],
        total: cards.count ?? 12,
        yeses: must(yeses) as unknown as TonightData['yeses'],
        meals: must(meals) as unknown as PlannedMeal[],
        plan: must(plan) as PlanDay[],
        dates: must(dates) as PlanDate[],
        marks: householdMarks,
        // Only a clear preference: enough yeses, and well ahead of the next mood.
        favouriteMood: top && top[1] >= 8 && top[1] >= 2 * (second?.[1] ?? 0) ? top[0] : 'any',
        lastDeck: last ? { maxMinutes: last.max_minutes, mood: last.mood ?? 'any', filters: last.filters ?? {}, at: last.created_at } : null,
        lastWho: ((w) => (w ? { members: w.who_eating, eaters: w.extra_eaters ?? [] } : null))(
          (must(lastAny) as Pick<Deck, 'who_eating' | 'extra_eaters'>[])[0]),
      };
    },
    [
      { table: 'decks', filter: `household_id=eq.${household!.id}` },
      { table: 'meals', filter: `household_id=eq.${household!.id}` },
      { table: 'plan_dates', filter: `household_id=eq.${household!.id}` },
      { table: 'household_recipes', filter: `household_id=eq.${household!.id}` },
    ],
  );

  // Deck defaults are silent: both of us, with the time, mood and filters this
  // person last picked (here, or in the last deck they dealt anywhere, whichever
  // is newer); the first time, the household's weeknight defaults (onboarding),
  // with the favourite mood when they didn't pick one.

  // Who could eat tonight: members (you first), then the extra eaters.
  const table: Table = useMemo(() => ({
    me: userId!,
    members: [...members].sort((a, b) => (a.user_id === userId ? -1 : b.user_id === userId ? 1 : 0))
      .map((m) => ({ id: m.user_id, name: m.profile.first_name, color: memberColor(m.user_id) })),
    eaters: (eaters ?? []).map((e) => ({ id: e.id, name: e.name, portion: e.portion })),
  }), [members, eaters, userId, memberColor]);
  // Whoever ate last time, still in the household (you always); the first time, everyone.
  const who = data?.lastWho
    ? {
      members: table.members.map((m) => m.id).filter((id) => id === userId || data.lastWho!.members.includes(id)),
      eaters: table.eaters.map((e) => e.id).filter((id) => data.lastWho!.eaters.includes(id)),
    }
    : everyone(table);

  // Picks from before onboarding was (last) finished don't count: the weeknight defaults chosen then win.
  const since = profile?.onboarded_at ? Date.parse(profile.onboarded_at) : 0;
  const last = [remembered, data?.lastDeck].filter((x): x is LastSettings => !!x && Date.parse(x.at) >= since)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  const chosen: DeckSettings = picked ?? (last
    ? { ...who, maxMinutes: last.maxMinutes, mood: last.mood, filters: last.filters }
    : { ...who, ...householdDefaults(household), ...(household?.deck_defaults?.mood ? {} : { mood: data?.favouriteMood ?? 'any' }) });
  // A protein picked before the diet changed (chicken, now vegetarian) would leave nothing to deal.
  const settings: DeckSettings = { ...chosen, filters: filtersForDiet(chosen.filters, diet ?? 'everything') };
  const pick = (s: DeckSettings) => {
    setPicked(s);
    setRemembered(saveLastSettings(userId!, s));
  };

  // Meals still to cook this week, tonight first: what the groceries card covers.
  const planned = useMemo(() => (data?.meals ?? [])
    .filter((m) => m.recipe && m.status !== 'skipped' && m.status !== 'cooked' && m.for_date >= today)
    .sort((a, b) => a.for_date.localeCompare(b.for_date)), [data?.meals, today]);
  // The groceries card only counts meals whose ingredients haven't gone to the list yet.
  const unlisted = useMemo(() => planned.filter((m) => !m.listed_at), [planned]);
  const unlistedKey = unlisted.map((m) => m.id).join(',');
  const shortDays = list('plan.days');

  const { data: groceries } = useLive<{ meals: MealForList[]; total: number; toBuy: number }>(
    unlistedKey ? `tonight-groceries:${unlistedKey}` : null,
    async () => {
      const ingredients = must(await supabase.from('recipe_ingredients').select(INGREDIENT_SELECT)
        .in('recipe_id', unlisted.map((m) => m.recipe_id)).order('position')) as RecipeIngredient[];
      // One pot: the servings of everyone eating, as on the match screen.
      const pots = await Promise.all(unlisted.map((m) => supabase.rpc('my_portion', {
        p_recipe: m.recipe_id, p_eaters: m.deck?.who_eating ?? members.map((x) => x.user_id), p_extra: m.deck?.extra_eaters ?? null,
      })));
      const lists: MealForList[] = unlisted.map((m, k) => ({
        recipe: m.recipe as Recipe,
        ingredients: ingredients.filter((i) => i.recipe_id === m.recipe_id),
        potServings: ((pots[k].data ?? []) as { pot_servings: number }[])[0]?.pot_servings ?? null,
        mealId: m.id,
        day: shortDays[isoWeekday(m.for_date) - 1],
      }));
      // Counted as the sheet shows them: one line per product, whatever the number of meals.
      const lines = combineProposals(await loadProposalsMany(household!.id, lists.map((l) => l.ingredients)),
        (k, i) => scaleQuantity(i.quantity, lists[k].recipe.servings, lists[k].potServings ?? lists[k].recipe.servings));
      return { meals: lists, total: lines.length, toBuy: lines.filter((l) => l.add).length };
    },
  );

  // Switched on the week strip: shown at once, saved in the background.
  const toggleDay = async (date: string, cook: boolean) => {
    set((d) => d && { ...d, dates: [...d.dates.filter((x) => x.for_date !== date), { household_id: household!.id, for_date: date, cook_at_home: cook }] });
    await save(supabase.from('plan_dates').upsert({ household_id: household!.id, for_date: date, cook_at_home: cook }));
  };

  const deal = async () => {
    setDealing(true);
    setError(null);
    try {
      const res = await callFunction<{ deck_id: string }>('deal-deck', {
        who_eating: settings.members, extra_eaters: settings.eaters, max_minutes: settings.maxMinutes, mood: settings.mood, filters: settings.filters, for_date: selected,
      }, 30_000);
      navigate(`/deck/${res.deck_id}`);
    } catch (e) {
      setError(e instanceof Error && e.message === 'no_recipes' ? t('tonight.noRecipes') : t('app.error'));
      openSettings('main');
      setDealing(false);
    }
  };

  // A past evening with nothing logged: what was eaten, as cooked (it was).
  const logMeal = async (recipeId: string) => {
    setPickOpen(false);
    await save(supabase.from('meals').upsert(
      { household_id: household!.id, for_date: selected, recipe_id: recipeId, status: 'cooked' },
      { onConflict: 'household_id,for_date' },
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
    <TabHeader overline={cap(longFormat.format(new Date(`${selected}T12:00:00Z`)))} title={titleOf(selected)}
      right={(
        <span className="tab-header__actions">
          {/* The calendar button; on another evening than tonight it extends into "Today". */}
          <span className={`day-switch${isToday ? '' : ' day-switch--away'}`}>
            <button type="button" className="day-switch__cal" aria-label={t('week.open')} onClick={() => setWeekOpen(true)}>
              <Icon name="calendar" size={20} />
            </button>
            <span className="day-switch__more" aria-hidden={isToday}>
              <span className="day-switch__inner">
                <span className="day-switch__rule" />
                <button type="button" className="day-switch__today" tabIndex={isToday ? -1 : undefined} onClick={backToTonight}>
                  <Icon name="undo" size={16} strokeWidth={2.4} /> {t('calendar.today')}
                </button>
              </span>
            </span>
          </span>
          {/* Away from tonight the header keeps to the date and the way back. */}
          {members.length > 0 && isToday && <AvatarPair people={people} />}
        </span>
      )} />
  );

  // The week (strip, meals) carries over while another evening's deck loads.
  const dayLoading = !data || data.forDate !== selected;
  if ((loading && !data) || !diet) return <Screen>{header}<Spinner /></Screen>;

  const deck = dayLoading ? null : data?.deck ?? null;
  const open = deck?.status === 'open';
  const dayMeal = (data?.meals ?? []).find((m) => m.for_date === selected && m.status !== 'skipped' && m.recipe);
  // Everything else still to cook this week, today included when looking at another evening.
  const upcoming = planned.filter((m) => m.for_date !== selected);
  const myProgress = deck ? data?.progress.find((p) => p.user_id === userId) : undefined;
  const iAmEating = !!deck && deck.who_eating.includes(userId!);
  const iSwipe = open && iAmEating && !myProgress?.finished_at;
  const total = data?.total || 12;
  const deckSummary = deck && labels.summary({
    members: deck.who_eating, eaters: deck.extra_eaters ?? [], maxMinutes: deck.max_minutes, mood: deck.mood, filters: deck.filters ?? {},
  }, table);

  const stripDays: StripDay[] = week.map((date) => {
    const chosen = !!data?.meals.some((m) => m.for_date === date && m.status !== 'skipped');
    // A past evening is what happened: a dinner logged, or nothing.
    return { date, chosen, together: date < today ? chosen : cooksOn(date, data?.plan, data?.dates) };
  });
  // This week's sheet switches tonight and the next six evenings, whatever the strip shows.
  const weekDays: StripDay[] = coming.map((date) => ({
    date,
    together: cooksOn(date, data?.plan, data?.dates),
    chosen: !!data?.meals.some((m) => m.for_date === date && m.status !== 'skipped'),
  }));
  const strip = <WeekStrip today={today} selected={selected} onSelect={selectDay} days={stripDays} />;

  const markOf = (recipeId: string) => data?.marks.find((x) => x.recipe_id === recipeId) ?? null;

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

  const weekday = (date: string) => new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  const groceriesLine = () => {
    if (unlisted.length === 0) return t('tonight.groceriesListed');
    if (!groceries) return null;
    if (groceries.toBuy === 0) return t('tonight.groceriesNone');
    if (unlisted.length > 1) return t('tonight.groceriesMany', { recipes: unlisted.length, n: groceries.toBuy });
    const d = unlisted[0].for_date;
    return d === today ? t('tonight.groceriesTonight', { n: groceries.toBuy })
      : d === coming[1] ? t('tonight.groceriesTomorrow', { n: groceries.toBuy })
        : t('tonight.groceriesOn', { day: weekday(d), n: groceries.toBuy });
  };
  const groceriesCard = planned.length > 0 && (unlisted.length === 0 || groceries) && (
    <section className="card card--sage groceries-card">
      <span className="icon-tile icon-tile--sage icon-tile--white"><Icon name="basket" size={20} /></span>
      <span className="grow">
        <span className="card__title d-block">{t('tonight.groceries')}</span>
        <span className="t-callout text-sage d-block">{groceriesLine()}</span>
      </span>
      {unlisted.length > 0 && groceries && groceries.toBuy > 0 && (
        <Button small variant="sage" onClick={() => setListOpen(true)}>{t('tonight.groceriesAdd')}</Button>
      )}
    </section>
  );

  let main: React.ReactNode;
  if (dayLoading) {
    main = <Spinner />;
  } else if (dayMeal && !open && (isPast || dayMeal.status === 'cooked')) {
    // Eaten (a past evening, or tonight once cooked): what we ate, who ate, and the household's
    // rating, with Rate right in the card. The picture opens the recipe.
    const r = dayMeal.recipe!;
    const mark = markOf(r.id);
    const ate = dayMeal.deck?.who_eating ?? members.map((m) => m.user_id);
    const portions = ate.length + (dayMeal.deck?.extra_eaters?.length ?? 0);
    const facts = [r.total_min && t('swipe.minutes', { n: r.total_min }), portions > 0 && tn('calendar.portions', portions)]
      .filter(Boolean).join(' · ');
    const eaters = ate.map((id) => ({ id, name: memberName(id), color: memberColor(id) }));
    const openRate = () => setRateOpen({ meal: { id: dayMeal.id, recipe_id: r.id, for_date: dayMeal.for_date, recipe: r } });
    main = (
      <>
      <article className="card past-day">
        <Link to={`/recipes/${r.id}`} className="past-day__photo" style={imageStyle(r.image_path)} aria-label={recipeTitle(r, locale)}>
          {!imageStyle(r.image_path) && <span aria-hidden>{recipeEmoji(r.title, r.tags)}</span>}
          {isToday && <span className="glass-badge"><Icon name="check" size={16} strokeWidth={2.4} />{t('tonight.cookedBadge')}</span>}
        </Link>
        <div className="past-day__body">
          <h2 className="t-title-s m-0">{recipeTitle(r, locale)}</h2>
          <span className="past-day__facts muted">
            {eaters.length > 0 && <AvatarPair people={eaters} />}
            {facts}
          </span>
          {mark?.stars ? (
            <span className="past-day__rating">
              <Stars value={mark.stars} size={20} />
              {mark.favorite && <Tag tone="accent"><Icon name="heart" filled size={12} /> {t('rating.favorite')}</Tag>}
            </span>
          ) : (
            <button type="button" className="past-day__rating past-day__rating--empty" aria-label={t('rating.rate')} onClick={openRate}>
              <Stars value={null} size={20} />
            </button>
          )}
          {mark?.stars
            ? <Button block variant="secondary" onClick={openRate}>{t('rating.edit')}</Button>
            : <Button block onClick={openRate}><Icon name="star" size={20} /> {t('rating.rate')}</Button>}
        </div>
      </article>
      {!isPast && upcomingSection}
      {!isPast && groceriesCard}
      </>
    );
  } else if (isPast) {
    // Nothing logged that evening (not designed yet): a way to add what we ate.
    main = (
      <section className="card past-day past-day--empty">
        <span className="icon-tile"><Icon name="utensils" size={20} /></span>
        <h2 className="t-title-s m-0">{t('calendar.nothing')}</h2>
        <p className="muted m-0">{t('calendar.nothingHint')}</p>
        <Button block variant="secondary" onClick={() => setPickOpen(true)}><Icon name="plus" size={20} /> {t('calendar.add')}</Button>
      </section>
    );
  } else if (dayMeal && !open) {
    // Decided: this evening first, then what's coming, then one groceries card for all.
    const r = dayMeal.recipe!;
    const cooked = dayMeal.status === 'cooked';
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
              {cooked ? t('tonight.cookedBadge')
                : isToday ? t('tonight.decidedBadge') : t('tonight.decidedOn', { day: eveningName(selected, today) })}</span>
          </Link>
          <div className="decided__body">
            <h2 className="t-title-s m-0">{recipeTitle(r, locale)}</h2>
            {facts && <p className="muted m-0">{facts}</p>}
            {cooked || !isToday
              ? <Button block variant="secondary" onClick={() => navigate(`/recipes/${r.id}`)}>{t('match.viewRecipe')}</Button>
              : <Button block onClick={() => void cook(dayMeal)}><Icon name="pot" /> {t('tonight.startCooking')}</Button>}
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
    // Same cards as this deck's no-match screen, should it come to that.
    const [front, back] = pickDeckArt(deck.id, 2, deck.mood, diet ?? undefined);
    main = (
      <article className="card card--flush join-card">
        <div className={`join-card__art${starter ? ' join-card__art--iris' : ''}`} aria-hidden>
          <img className="fan fan--left fan--art" src={back} alt="" />
          <img className="fan fan--mid fan--art" src={front} alt="" />
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
    // No deck yet: dealing the deck is the only big action. New cards each
    // evening, to the mood about to be dealt; the best fit in front. The art
    // takes what height is left, so the button sits above the tab bar.
    const [mid, left, right] = pickDeckArt(selected, 3, settings.mood, diet ?? undefined);
    const ask = isToday ? t('tonight.ask')
      : selected === coming[1] ? t('tonight.askTomorrow') : t('tonight.askOn', { day: weekday(selected) });
    main = (
      <>
        <section className="card deal-card">
          <div className="deal-hero" aria-hidden>
            <div className="deal-hero__art">
              <img className="fan fan--left fan--art" src={left} alt="" />
              <img className="fan fan--right fan--art" src={right} alt="" />
              <img className="fan fan--mid fan--art" src={mid} alt="" />
            </div>
          </div>
          {(() => {
            const question = deck?.status === 'no_match' ? t('noMatch.again') : ask;
            return <h2 className="deal-hero__title" style={{ '--title-len': question.length } as React.CSSProperties}>{question}</h2>;
          })()}
          <DeckSettingsBar settings={settings} table={table} onOpen={openSettings} />
          <Button block className="deal-hero__btn" disabled={dealing} onClick={() => void deal()}>
            {dealing ? t('tonight.dealing') : t('tonight.deal')}
          </Button>
        </section>
        {error && !settingsOpen && <p className="notice">{error}</p>}
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
      <div className={`tonight${isToday ? '' : ' tonight--away'}`}>
        {header}
        {strip}
        {main}
      </div>
      <DeckSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} startOn={settingsView}
        title={isToday ? t('tonight.settingsTitle')
          : selected === coming[1] ? t('tonight.settingsTitleTomorrow') : t('tonight.settingsTitleOn', { day: weekday(selected) })}
        settings={settings} onChange={pick}
        table={table} diet={diet} dealing={dealing} error={error} onDeal={() => void deal()} />
      <WeekSheet open={weekOpen} onClose={() => setWeekOpen(false)} days={weekDays} today={today} selected={selected}
        onToggle={(d, c) => void toggleDay(d, c)} back={eveningPath(selected, today)} />
      {rateOpen?.meal.recipe && (
        <RateSheet open onClose={() => setRateOpen(null)} recipe={rateOpen.meal.recipe} initialStars={rateOpen.stars}
          dateLabel={cap(longFormat.format(new Date(`${rateOpen.meal.for_date}T12:00:00Z`)))} rating={markOf(rateOpen.meal.recipe_id)} />
      )}
      <PickRecipeSheet open={pickOpen} onClose={() => setPickOpen(false)} onPick={(id) => void logMeal(id)} />
      {groceries && (
        <AddToListSheet open={listOpen} onClose={() => setListOpen(false)} meals={groceries.meals} />
      )}
    </Screen>
  );
}
