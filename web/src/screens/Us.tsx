import { useEffect, useState } from 'react';
import { rowPlates } from '@logic/plate.ts';
import type { Plate } from '@logic/plate.ts';
import { fitStyle, observationsFor, styleSummary, type StyleRegion, withStyleEdits } from '@logic/style.ts';
import { classifyRow, CLASSIFY_COLUMNS, type ClassifiableRow } from '@logic/classify.ts';
import type { Mood } from '@logic/deck.ts';
import { normaliseFilters } from '@logic/deckFilters.ts';
import { recipeFeatures } from '@logic/preferences.ts';
import { APPLIANCES } from '@logic/facets.ts';
import { APPLIANCE_LABEL } from './onboarding/Equipment.tsx';
import { macrosOf, splitPot, targetsOf } from '@logic/portions.ts';
import {
  signalsFor, type MealRow, type PortionRow, type StyleLevel, type SwipeRow,
  type TasteSignalRow,
} from '@logic/profile.ts';
import { productName } from '@logic/products.ts';
import { AllergiesCard } from '../components/Allergies.tsx';
import { StyleRows } from '../components/StyleSummary.tsx';
import { Icon } from '../components/Icon.tsx';
import { Link } from 'react-router';
import { AvatarPair, Button, ListRow, Screen, TabHeader, Tag } from '../components/ui.tsx';
import { LOCALE_NAMES, useI18n } from '../i18n/index.tsx';
import { useCatalog, useLive, useSave } from '../lib/hooks.ts';
import { groupName, useGroceryCatalog, useIngredientGroups } from '../lib/products.ts';
import { pushState, type PushState } from '../lib/push.ts';
import { useSession } from '../lib/session.tsx';
import { must, supabase } from '../lib/supabase.ts';
import type { TasteRule } from '../lib/types.ts';

interface Loaded {
  rules: TasteRule[];
  /**
   * Their style by kind of plate (style.ts styleSummary), from everything they
   * chose, the same model the deck uses; with what they set themselves. Null
   * until there's something to read it from.
   */
  style: { summary: { region: StyleRegion; level: StyleLevel }[]; stated: [StyleRegion, StyleLevel][] } | null;
}

/** Choices the style is read from before the summary is shown: about a quiz's worth of a start. */
const STYLE_MIN_OBSERVATIONS = 5;

/**
 * The Nous tab; `preferences` is its sub-menu: allergies, tastes and goals, and
 * `advanced` is under that: how they like to eat, which most people never need to touch.
 */
export function UsScreen({ view = 'main' }: { view?: 'main' | 'preferences' | 'advanced' }) {
  const { t, tn, locale } = useI18n();
  const { userId, members, goals, household, signOut, isCatalogAdmin, memberColor } = useSession();
  const [push, setPush] = useState<PushState>('unsupported');
  const { data: catalog } = useGroceryCatalog(household!.id);
  const { data: groups } = useIngredientGroups();
  const ingredientCatalog = useCatalog();
  const save = useSave();
  const [edited, setEdited] = useState<Map<StyleRegion, StyleLevel>>(new Map());
  const { data, reload } = useLive<Loaded>(`us:${userId}:${ingredientCatalog ? 'c' : ''}`, async () => {
    const [r, swipes, signals, meals, portions] = await Promise.all([
      supabase.from('taste_rules').select('*').eq('user_id', userId!),
      supabase.from('swipes').select('user_id, deck_id, recipe_id, verdict, created_at, deck:decks(mood, filters)')
        .eq('user_id', userId!).order('created_at', { ascending: false }).limit(300),
      supabase.from('taste_signals').select('user_id, recipe_id, other_recipe_id, kind, value, deck_id, meal_id, created_at')
        .eq('user_id', userId!).order('created_at', { ascending: false }).limit(1000),
      supabase.from('meals').select('id, recipe_id, for_date, status, deck:decks(who_eating)')
        .eq('household_id', household!.id).eq('status', 'cooked').order('for_date', { ascending: false }).limit(200),
      // Own rows only (RLS): whether each card fit this person when it was dealt.
      supabase.from('member_portions').select('deck_id, recipe_id, user_id, fits').eq('user_id', userId!).limit(5000),
    ]);
    const one = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
    const rows = {
      swipes: (must(swipes) as unknown as (SwipeRow & { deck: unknown })[])
        .map((x) => {
          const d = one(x.deck as { mood: Mood | null; filters: unknown } | null);
          return { ...x, mood: d?.mood ?? null, filters: normaliseFilters(d?.filters) };
        }),
      tasteSignals: must(signals) as TasteSignalRow[],
      meals: (must(meals) as unknown as (MealRow & { deck: unknown })[])
        .map((m) => ({ ...m, who_eating: one(m.deck as { who_eating: string[] } | null)?.who_eating ?? null })),
      portions: must(portions) as PortionRow[],
    };
    // Every recipe a choice was about, described the same way as for the deck (style edits are about none).
    const ids = [...new Set([
      ...[...rows.swipes, ...rows.meals].map((x) => x.recipe_id),
      ...rows.tasteSignals.flatMap((x) => [x.recipe_id, x.other_recipe_id ?? null]),
    ].filter((id): id is string => !!id))];
    const recipes = ids.length
      ? must(await supabase.from('recipes').select(`id, kcal_per_serving, protein_g_per_serving, ${CLASSIFY_COLUMNS}`).in('id', ids)) as unknown as
        (ClassifiableRow & { id: string; tags: string[]; kcal_per_serving: number | null; protein_g_per_serving: number | null })[]
      : [];
    const classes = new Map(recipes.map((x) => [x.id, ingredientCatalog ? classifyRow(x, ingredientCatalog) : null]));
    const features = new Map(recipes.map((x) => [x.id, recipeFeatures(x.tags, x.recipe_ingredients, classes.get(x.id))]));
    const plates = new Map<string, Plate[]>(ingredientCatalog
      ? recipes.map((x) => [x.id, rowPlates(x, ingredientCatalog, classes.get(x.id) ?? undefined)])
      : []);
    const rules = must(r) as TasteRule[];
    return {
      rules,
      ...(() => {
        // The same profile the deck uses: quiz answers judged against today's goals.
        const byId = new Map(recipes.map((x) => [x.id, x]));
        const fitsNow = (id: string) => {
          const x = byId.get(id);
          const split = x && splitPot(macrosOf(x, classes.get(id)?.nutrition), [targetsOf(userId!, goals)]);
          return split ? split.plates[0].fits : null;
        };
        const mySignals = signalsFor(userId!, rows, (id) => features.get(id), fitsNow);
        // The same model the deck uses (style.ts styleModelFor), and what they set themselves.
        const { observations, pairs, edits } = observationsFor(mySignals, (id) => plates.get(id));
        const style = ingredientCatalog && (observations.length >= STYLE_MIN_OBSERVATIONS || edits.length > 0)
          ? {
            summary: styleSummary(withStyleEdits(fitStyle(observations, pairs), edits)),
            stated: edits.map((e): [StyleRegion, StyleLevel] => [e.region, e.level]),
          }
          : null;
        // What was learned isn't shown as tastes: only what they said themselves (rules, the style edits).
        return { style };
      })(),
    };
  });
  const rules = data?.rules ?? [];
  const setStyle = async (region: StyleRegion, level: StyleLevel) => {
    setEdited((e) => new Map(e).set(region, level));
    // The other kinds of plate move a little with it: read them again once it's saved.
    if (await save(supabase.from('taste_signals').upsert({ user_id: userId, kind: 'style', value: `${region}:${level}` }, { onConflict: 'user_id,key' }))) await reload();
  };

  useEffect(() => {
    void pushState().then(setPush).catch(() => setPush('unsupported'));
  }, []);

  // Rules on catalogue items read in the app's language.
  const nameOf = (r: TasteRule) => {
    const g = r.group_key ? groups?.find((x) => x.key === r.group_key) : undefined;
    if (g) return groupName(g, locale);
    const p = r.product_id ? catalog?.index.get(r.product_id) : undefined;
    return p ? productName(p, locale) : r.value;
  };
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
  ];

  if (view === 'advanced') {
    return (
      <Screen back="/us/preferences" title={t('us.advanced')}>
        <div className="stack stack--blocks">
          <section className="card stack">
            <span className="card__title">{t('quiz.summaryTitle')}</span>
            <p className="t-callout muted m-0">{t('us.styleHint')}</p>
            {data?.style ? (
              <StyleRows summary={data.style.summary} stated={new Map([...data.style.stated, ...edited])}
                onChange={(region, level) => void setStyle(region, level)} />
            ) : data && <p className="t-callout muted m-0">{t('us.styleEmpty')}</p>}
          </section>
        </div>
      </Screen>
    );
  }

  if (view === 'preferences') {
    return (
      <Screen back="/us" title={t('us.preferences')}>
        <div className="stack stack--blocks">
        <AllergiesCard />

        <Link to="/us/tastes" className="card stack tastes-card">
          <div className="row row--between">
            <span className="card__title">{t('us.yourTastes')}</span>
            <span className="chevron"><Icon name="chevron" size={18} /></span>
          </div>
          {tasteChips.length > 0 ? (
            <div className="chips">
              {tasteChips.map((c) => (
                <Tag key={c.key} tone={c.tone}>{c.tone === 'accent' && <Icon name="heart" filled size={11} />} {c.label}</Tag>
              ))}
            </div>
          ) : <p className="muted t-callout m-0">{t('us.profileEmpty')}</p>}
        </Link>

          <div className="list">
          <ListRow to="/us/goals" tile="plain" icon={<Icon name="star" size={18} />} title={t('us.yourGoals')}
            meta={goals ? [
              goals.dinner_kcal != null && `${goals.dinner_kcal} ${t('goals.kcalUnit')}`,
              goals.dinner_protein_g != null && `${goals.dinner_protein_g} ${t('goals.gramsUnit')} ${t('goals.proteinShort')}`,
              tn('recipe.servings', goals.servings),
            ].filter(Boolean).join(' · ') : t('goals.none')} />
          <ListRow to="/us/equipment" tile="plain" icon={<Icon name="pot" size={18} />} title={t('us.equipment')}
            meta={household?.equipment
              ? (household.equipment.length
                ? APPLIANCES.filter((a) => household.equipment!.includes(a))
                  .map((a) => t(`ob.equipment.items.${APPLIANCE_LABEL[a]}`)).join(', ')
                : t('us.equipmentNone'))
              : t('us.equipmentAll')} />
          </div>
          <div className="list">
            <ListRow to="/us/preferences/advanced" tile="plain" icon={<Icon name="sliders" size={18} />} title={t('us.advanced')}
              meta={t('us.advancedHint')} />
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
          <div className="list">
            <ListRow to="/us/invite" accent chevron={false} icon={<Icon name="plus" />} title={t('settings.invite')} />
          </div>
        )}


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
