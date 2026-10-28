import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Icon } from '../components/Icon.tsx';
import { Avatar, Button, Chip, Screen, Segmented, Spinner } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import { isoWeekday, todayIn, useLive } from '../lib/hooks.ts';
import { useSession } from '../lib/session.tsx';
import { callFunction, must, supabase } from '../lib/supabase.ts';
import type { Deck, DeckMemberProgress, Meal, Mood, PlanDay } from '../lib/types.ts';

const TIMES = [null, 20, 30, 45, 60] as const;
const MOODS: Mood[] = ['any', 'comfort', 'light', 'quick', 'fancy'];

interface TonightData {
  deck: Deck | null;
  progress: DeckMemberProgress[];
  meals: (Meal & { recipe: { title: string } | null })[];
  plan: PlanDay[];
}

export function TonightScreen() {
  const { t, list } = useI18n();
  const { userId, profile, household, partners, memberName, memberColor } = useSession();
  const navigate = useNavigate();
  const tz = household!.timezone;
  const today = todayIn(tz);

  const [who, setWho] = useState<'both' | 'me'>('both');
  const [maxMinutes, setMaxMinutes] = useState<number | null>(null);
  const [mood, setMood] = useState<Mood>('any');
  const [dealing, setDealing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Monday of this week through Sunday.
  const weekStart = todayIn(tz, 1 - isoWeekday(today));
  const weekEnd = todayIn(tz, 7 - isoWeekday(today));

  const { data, loading } = useLive<TonightData>(
    `tonight:${household!.id}:${today}`,
    async () => {
      const [decks, meals, plan] = await Promise.all([
        supabase.from('decks').select('*').eq('household_id', household!.id).eq('for_date', today)
          .neq('status', 'closed').order('created_at', { ascending: false }).limit(1),
        supabase.from('meals').select('id, for_date, recipe_id, status, deck_id, recipe:recipes(title)')
          .eq('household_id', household!.id).gte('for_date', weekStart).lte('for_date', weekEnd),
        supabase.from('plan_days').select('*').eq('household_id', household!.id),
      ]);
      const deck = (must(decks) as Deck[])[0] ?? null;
      const progress = deck
        ? (must(await supabase.from('deck_members').select('*').eq('deck_id', deck.id)) as DeckMemberProgress[])
        : [];
      return { deck, progress, meals: must(meals) as unknown as TonightData['meals'], plan: must(plan) as PlanDay[] };
    },
    [
      { table: 'decks', filter: `household_id=eq.${household!.id}` },
      { table: 'meals', filter: `household_id=eq.${household!.id}` },
    ],
  );

  const deal = async () => {
    setDealing(true);
    setError(null);
    try {
      const whoEating = who === 'me' || partners.length === 0 ? [userId] : [userId, ...partners.map((p) => p.user_id)];
      const res = await callFunction<{ deck_id: string }>('deal-deck', {
        who_eating: whoEating, max_minutes: maxMinutes, mood, for_date: today,
      }, 30_000);
      navigate(`/deck/${res.deck_id}`);
    } catch (e) {
      setError(e instanceof Error && e.message === 'no_recipes' ? t('tonight.noRecipes') : t('app.error'));
      setDealing(false);
    }
  };

  if (loading && !data) return <Screen title={t('tonight.title')}><Spinner /></Screen>;

  const deck = data?.deck ?? null;
  const tonightMeal = data?.meals.find((m) => m.for_date === today && m.status !== 'skipped');
  const myProgress = deck && data?.progress.find((p) => p.user_id === userId);
  const iAmEating = !!deck && deck.who_eating.includes(userId!);
  const days = list('plan.days');

  return (
    <Screen>
      <div className="screen__bar">
        <span className="muted">{t('tonight.greeting', { name: profile?.first_name ?? '' })}</span>
        <div className="avatars">
          {[...(profile ? [profile] : []), ...partners.map((p) => p.profile)].map((p) => (
            <Avatar key={p.id} name={p.first_name} color={p.color} size="sm" />
          ))}
        </div>
      </div>
      <h1 className="screen__title">{t('tonight.title')}</h1>

      {tonightMeal && deck?.status !== 'open' && deck?.status !== 'tiebreak' ? (
        <div className="card stack">
          <span className="title3">{t('tonight.decided', { title: tonightMeal.recipe?.title ?? '' })}</span>
          <Button block onClick={() => navigate(tonightMeal.deck_id ? `/deck/${tonightMeal.deck_id}` : `/recipes/${tonightMeal.recipe_id}`)}>
            {t('tonight.seeMatch')}
          </Button>
        </div>
      ) : deck && (deck.status === 'open' || deck.status === 'tiebreak') ? (
        <div className="card stack">
          {deck.started_by !== userId && (
            <div className="row">
              <Avatar name={memberName(deck.started_by)} color={memberColor(deck.started_by)} />
              <span className="headline">{t('tonight.partnerDeck', { name: memberName(deck.started_by) })}</span>
            </div>
          )}
          <Button block onClick={() => navigate(`/deck/${deck.id}`)}>
            {iAmEating && !myProgress?.finished_at && deck.status === 'open'
              ? myProgress?.swiped_count ? t('tonight.continueDeck') : t('tonight.join')
              : t('app.continue')}
          </Button>
        </div>
      ) : (
        <div className="stack stack--lg">
          {partners.length > 0 ? (
            <section className="stack">
              <h2 className="section-label" style={{ margin: 0 }}>{t('tonight.whoEating')}</h2>
              <Segmented label={t('tonight.whoEating')} value={who} onChange={setWho} options={[
                { value: 'both', label: t('tonight.both') },
                { value: 'me', label: t('tonight.justMe') },
              ]} />
            </section>
          ) : (
            <Link to="/invite" className="notice notice--info row" style={{ textDecoration: 'none' }}>
              <Icon name="people" /> <span className="spacer">{t('tonight.noPartner')}</span> <Icon name="chevron" />
            </Link>
          )}
          <section className="stack">
            <h2 className="section-label" style={{ margin: 0 }}>{t('tonight.time')}</h2>
            <div className="chips chips--scroll">
              {TIMES.map((m) => (
                <Chip key={m ?? 'any'} pressed={maxMinutes === m} onClick={() => setMaxMinutes(m)}>
                  {m ? t('tonight.minutes', { n: m }) : t('tonight.anyTime')}
                </Chip>
              ))}
            </div>
          </section>
          <section className="stack">
            <h2 className="section-label" style={{ margin: 0 }}>{t('tonight.mood')}</h2>
            <div className="chips chips--scroll">
              {MOODS.map((m) => (
                <Chip key={m} pressed={mood === m} onClick={() => setMood(m)}>{t(`tonight.moods.${m}`)}</Chip>
              ))}
            </div>
          </section>
          {error && <p className="notice">{error}</p>}
          <Button block onClick={() => void deal()} disabled={dealing}>
            <Icon name="flame" /> {dealing ? t('tonight.dealing') : t('tonight.deal')}
          </Button>
        </div>
      )}

      <h2 className="section-label">{t('tonight.week')}</h2>
      <Link to="/plan" className="week" style={{ textDecoration: 'none' }} aria-label={t('us.weeklyPlan')}>
        {days.map((label, i) => {
          const date = todayIn(tz, i + 1 - isoWeekday(today));
          const meal = data?.meals.find((m) => m.for_date === date);
          const cook = data?.plan.find((p) => p.weekday === i + 1)?.cook_at_home ?? true;
          const dot = meal?.status === 'cooked' ? 'week__dot--done' : meal || cook ? 'week__dot--cook' : '';
          return (
            <div key={label} className={`week__day${date === today ? ' week__day--today' : ''}`}
              title={meal?.recipe?.title ?? (cook ? '' : t('tonight.off'))}>
              <span>{label}</span>
              <span className="headline">{Number(date.slice(8))}</span>
              <span className={`week__dot ${dot}`} style={meal ? undefined : { opacity: cook ? 0.35 : 1 }} />
            </div>
          );
        })}
      </Link>
    </Screen>
  );
}
