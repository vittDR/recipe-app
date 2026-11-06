import { useEffect, useState } from 'react';
import { canonicalFeature, classifyRow, CLASSIFY_COLUMNS, type ClassifiableRow } from '@logic/classify.ts';
import type { Mood } from '@logic/deck.ts';
import { detectPatterns, recipeFeatures, type PatternSuggestion } from '@logic/preferences.ts';
import { splitPot } from '@logic/portions.ts';
import {
  buildProfile, DIET_FEATURE, profileHighlights, signalsFor, type MealRow, type PortionRow, type SwipeRow, type TasteSignalRow,
} from '@logic/profile.ts';
import { dietAdherence } from '@logic/recommend.ts';
import { productName } from '@logic/products.ts';
import { AllergiesCard } from '../components/Allergies.tsx';
import { Icon } from '../components/Icon.tsx';
import { Link } from 'react-router';
import { AvatarPair, Button, ListRow, Screen, TabHeader, Tag } from '../components/ui.tsx';
import { LOCALE_NAMES, useI18n } from '../i18n/index.tsx';
import { classLabel } from '../lib/classes.ts';
import { useCatalog, useLive, useSave } from '../lib/hooks.ts';
import { inSentence, useGroceryCatalog } from '../lib/products.ts';
import { pushState, type PushState } from '../lib/push.ts';
import { useSession } from '../lib/session.tsx';
import { must, supabase } from '../lib/supabase.ts';
import { useTags } from '../lib/tags.ts';
import type { LearnedPattern, TasteRule } from '../lib/types.ts';

interface Loaded {
  rules: TasteRule[];
  suggestions: PatternSuggestion[];
  profile: ReturnType<typeof profileHighlights>;
  /** 0..1, how much this person sticks to their goals (recommend.ts). */
  adherence: number;
  quizDone: boolean;
}

const samePattern = (a: { kind: string; value: string }, b: { kind: string; value: string }) =>
  a.kind === b.kind && a.value === b.value;

/** The Nous tab; `preferences` is its sub-menu: allergies, tastes and goals. */
export function UsScreen({ view = 'main' }: { view?: 'main' | 'preferences' }) {
  const { t, tn, locale } = useI18n();
  const { userId, members, goals, household, signOut, isCatalogAdmin, memberColor } = useSession();
  const save = useSave();
  const [push, setPush] = useState<PushState>('unsupported');
  const { data: catalog } = useGroceryCatalog(household!.id);
  const { tags } = useTags(household!.id);
  const ingredientCatalog = useCatalog();
  const { data, reload } = useLive<Loaded>(`us:${userId}:${ingredientCatalog ? 'c' : ''}`, async () => {
    const [r, swipes, existing, signals, meals, portions] = await Promise.all([
      supabase.from('taste_rules').select('*').eq('user_id', userId!),
      supabase.from('swipes').select('user_id, deck_id, recipe_id, verdict, created_at, deck:decks(mood)')
        .eq('user_id', userId!).order('created_at', { ascending: false }).limit(300),
      supabase.from('learned_patterns').select('*').eq('user_id', userId!),
      supabase.from('taste_signals').select('user_id, recipe_id, kind, value, deck_id, meal_id, created_at')
        .eq('user_id', userId!).order('created_at', { ascending: false }).limit(1000),
      supabase.from('meals').select('id, recipe_id, for_date, status, deck:decks(who_eating)')
        .eq('household_id', household!.id).eq('status', 'cooked').order('for_date', { ascending: false }).limit(200),
      // Own rows only (RLS): whether each card fit this person when it was dealt.
      supabase.from('member_portions').select('deck_id, recipe_id, user_id, fits').eq('user_id', userId!).limit(5000),
    ]);
    const one = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
    const rows = {
      swipes: (must(swipes) as unknown as (SwipeRow & { deck: unknown })[])
        .map((x) => ({ ...x, mood: one(x.deck as { mood: Mood | null } | null)?.mood ?? null })),
      tasteSignals: must(signals) as TasteSignalRow[],
      meals: (must(meals) as unknown as (MealRow & { deck: unknown })[])
        .map((m) => ({ ...m, who_eating: one(m.deck as { who_eating: string[] } | null)?.who_eating ?? null })),
      portions: must(portions) as PortionRow[],
    };
    // Every recipe a choice was about, described the same way as for the deck.
    const ids = [...new Set([...rows.swipes, ...rows.tasteSignals, ...rows.meals].map((x) => x.recipe_id))];
    const recipes = ids.length
      ? must(await supabase.from('recipes').select(`id, kcal_per_serving, protein_g_per_serving, ${CLASSIFY_COLUMNS}`).in('id', ids)) as unknown as
        (ClassifiableRow & { id: string; tags: string[]; kcal_per_serving: number | null; protein_g_per_serving: number | null })[]
      : [];
    const features = new Map(recipes.map((x) => [x.id, recipeFeatures(x.tags, x.recipe_ingredients,
      ingredientCatalog ? classifyRow(x, ingredientCatalog) : null)]));
    const rules = must(r) as TasteRule[];
    const exposures = rows.swipes.filter((x) => features.has(x.recipe_id))
      .map((x) => ({ verdict: x.verdict, createdAt: x.created_at, mood: x.mood, features: features.get(x.recipe_id)! }));
    // Patterns accepted on a tag ("curry") cover the classified feature it now is ("dish:curry").
    const known = (must(existing) as LearnedPattern[]).map((p) => ({ ...p.pattern, value: canonicalFeature(p.pattern.value) }));
    const ruled = new Set(rules.map((x) => x.value));
    return {
      rules,
      suggestions: detectPatterns(exposures).filter((x) =>
        !known.some((k) => samePattern(k, x.pattern)) && !ruled.has(x.pattern.value)).slice(0, 3),
      ...(() => {
        // The same profile the deck uses: quiz answers judged against today's goals.
        const byId = new Map(recipes.map((x) => [x.id, x]));
        const fitsNow = (id: string) => {
          const x = byId.get(id);
          const split = x && splitPot({ kcalPerServing: x.kcal_per_serving, proteinGPerServing: x.protein_g_per_serving },
            [{ userId: userId!, dinnerKcal: goals?.dinner_kcal ?? null, dinnerProteinG: goals?.dinner_protein_g ?? null, servings: goals?.servings ?? null }]);
          return split ? split.plates[0].fits : null;
        };
        const mySignals = signalsFor(userId!, rows, (id) => features.get(id), fitsNow);
        const full = buildProfile(mySignals);
        // Shown as tastes: what a dish does for the diet is the goals' business.
        const tastes = new Map([...full].filter(([f]) => !DIET_FEATURE.test(f)));
        return { profile: profileHighlights(tastes, { limit: 5 }), adherence: dietAdherence(mySignals) };
      })(),
      quizDone: rows.tasteSignals.some((x) => x.kind === 'starter'),
    };
  });
  const rules = data?.rules ?? [];

  useEffect(() => {
    void pushState().then(setPush).catch(() => setPush('unsupported'));
  }, []);

  // An ingredient's catalogue item; tags (moods, dishes) have none.
  const itemOf = (value: string) => (tags?.find(value)?.name === value ? undefined : catalog?.index.ofIngredient(value));

  const decide = async (s: PatternSuggestion, action: 'never' | 'less' | 'more' | 'ignore') => {
    const item = itemOf(s.pattern.value);
    if (action === 'never' && item) {
      await save(supabase.from('taste_rules').upsert(
        { user_id: userId, kind: 'never', value: item.name_fr, product_id: item.id, source: 'learned' },
        { onConflict: 'user_id,kind,value' }));
    }
    await save(supabase.from('learned_patterns').insert({
      user_id: userId,
      pattern: s.pattern,
      evidence_count: s.evidence,
      status: action === 'ignore' ? 'dismissed' : 'accepted',
      weight: action === 'less' ? -0.5 : action === 'more' ? 0.5 : 0,
    }));
    await reload();
  };

  // Tags, ingredients and rules on catalogue items read in the app's language.
  const labelOf = (value: string) => {
    const classified = classLabel(value, t);
    if (classified) return classified;
    if (tags?.find(value)?.name === value) return tags.label(value, locale);
    const p = catalog?.index.ofIngredient(value);
    return p ? productName(p, locale) : value;
  };
  const nameOf = (r: TasteRule) => {
    const p = r.product_id ? catalog?.index.get(r.product_id) : undefined;
    return p ? productName(p, locale) : r.value;
  };
  // A rule on an item already covers the pattern on its ingredient.
  const ruledIngredients = new Set(rules.map((r) => (r.product_id ? catalog?.index.get(r.product_id)?.ingredient : null)));
  const shown = (data?.suggestions ?? []).filter((s) => !ruledIngredients.has(s.pattern.value));
  const never = rules.filter((r) => r.kind === 'never').map(nameOf);
  const love = rules.filter((r) => r.kind === 'love').map(nameOf);
  const diet = rules.find((r) => r.kind === 'diet')?.value;
  const pushMeta = push === 'on' ? t('us.notificationsOn')
    : push === 'denied' ? t('us.notificationsDenied')
      : push === 'unsupported' ? t('us.notificationsUnsupported') : undefined;

  const people = members.map((m) => ({ id: m.user_id, name: m.profile.first_name, color: memberColor(m.user_id) }));
  const tasteChips = [
    ...(diet ? [{ key: 'diet', label: t(`tastes.${diet as 'pescatarian' | 'vegetarian'}`), tone: undefined }] : []),
    ...never.map((n) => ({ key: `n:${n}`, label: t('us.without', { item: n }), tone: undefined })),
    ...love.map((n) => ({ key: `l:${n}`, label: n, tone: 'accent' as const })),
    ...(data?.profile.likes ?? []).map((x) => ({ key: `p:${x.feature}`, label: labelOf(x.feature), tone: 'accent' as const })),
  ];

  if (view === 'preferences') {
    return (
      <Screen back="/us" title={t('us.preferences')}>
        <div className="stack stack--blocks">
        <AllergiesCard />

        <section className="card stack">
          <div className="row row--between">
            <span className="card__title">{t('us.yourTastes')}</span>
            <Link to="/us/tastes" className="t-callout accent-link">{t('us.edit')}</Link>
          </div>
          {tasteChips.length > 0 ? (
            <div className="chips">
              {tasteChips.map((c) => (
                <Tag key={c.key} tone={c.tone}>{c.tone === 'accent' && <Icon name="heart" filled size={11} />} {c.label}</Tag>
              ))}
            </div>
          ) : <p className="muted t-callout m-0">{t('us.profileEmpty')}</p>}
          {data && data.adherence >= 0.6 && <p className="t-callout muted m-0">{t('us.dietMinded')}</p>}
          {data && data.adherence <= 0.3 && <p className="t-callout muted m-0">{t('us.dietRelaxed')}</p>}
          <Link to="/us/quiz" className="t-callout accent-link">{data?.quizDone ? t('us.quizAgain') : t('us.quiz')} ›</Link>
        </section>
          <div className="list">
          <ListRow to="/us/goals" tile="plain" icon={<Icon name="star" size={18} />} title={t('us.yourGoals')}
            meta={goals && `${t(`goals.${goals.goal}`)} · ${goals.dinner_kcal} kcal · ${goals.dinner_protein_g} g · ${tn('recipe.servings', goals.servings)}`} />
          </div>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <TabHeader title={t('us.title')} />
      <div className="stack stack--blocks">
        <Link to="/us/household" className="card household-row">
          <AvatarPair people={people} />
          <span className="grow">
            <span className="card__title d-block">{household?.name}</span>
            <span className="t-label muted d-block">{tn('us.householdMeta', members.length)}</span>
          </span>
          <span className="chevron"><Icon name="chevron" size={18} /></span>
        </Link>
        {members.length < 2 && (
          <ListRow to="/us/invite" className="card" accent chevron={false} icon={<Icon name="plus" />} title={t('settings.invite')} />
        )}


        {shown.map((s) => {
          const value = inSentence(labelOf(s.pattern.value), locale);
          const avoid = s.pattern.kind === 'avoid';
          return (
            <section key={`${s.pattern.kind}:${s.pattern.value}`} className="card card--accent stack insight">
              <span className="row t-label text-accent"><Icon name="sparkle" filled size={14} /> {t('us.patterns')}</span>
              <span>{t(avoid ? 'us.askLess' : 'us.askMore', { value })}</span>
              <div className="row">
                <Button small onClick={() => void decide(s, avoid ? 'less' : 'more')}>{t('us.yes')}</Button>
                <Button small variant="secondary" onClick={() => void decide(s, 'ignore')}>{t('us.noThanks')}</Button>
              </div>
            </section>
          );
        })}

        <div className="list">
          <ListRow to="/us/preferences" tile="accent" icon={<Icon name="heart" size={18} />} title={t('us.preferences')}
            meta={t('us.preferencesHint')} />
          <ListRow to="/us/notifications" tile="accent" icon={<Icon name="bell" size={18} />} title={t('notifications.title')} meta={pushMeta} />
        </div>

        <div className="list">
          <ListRow to="/us/profile" tile="plain" icon={<Icon name="person" size={18} />} title={t('profile.title')} meta={LOCALE_NAMES[locale]} />
          {isCatalogAdmin && (
            <ListRow to="/us/catalog" tile="plain" icon={<Icon name="book" size={18} />} title={t('admin.entry')} meta={t('admin.entryHint')} />
          )}
        </div>

        <Button variant="text" className="self-center" onClick={() => void signOut()}>{t('us.signOut')}</Button>
      </div>
    </Screen>
  );
}
