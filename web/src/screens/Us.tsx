import { useEffect, useState } from 'react';
import { detectPatterns, recipeFeatures, type PatternSuggestion } from '@logic/preferences.ts';
import { productName } from '@logic/products.ts';
import { Icon } from '../components/Icon.tsx';
import { MemberList } from '../components/Members.tsx';
import { Button, ListRow, Screen, Section } from '../components/ui.tsx';
import { LOCALE_NAMES, useI18n } from '../i18n/index.tsx';
import { useLive, useSave } from '../lib/hooks.ts';
import { useGroceryCatalog } from '../lib/products.ts';
import { pushState, type PushState } from '../lib/push.ts';
import { useSession } from '../lib/session.tsx';
import { must, supabase } from '../lib/supabase.ts';
import { useTags } from '../lib/tags.ts';
import type { LearnedPattern, TasteRule } from '../lib/types.ts';

interface SwipeRow {
  verdict: 'pass' | 'yes' | 'must';
  created_at: string;
  recipe: { tags: string[]; recipe_ingredients: { name: string; is_staple: boolean }[] } | null;
}

const samePattern = (a: { kind: string; value: string }, b: { kind: string; value: string }) =>
  a.kind === b.kind && a.value === b.value;

export function UsScreen() {
  const { t, tn, locale } = useI18n();
  const { userId, members, goals, household, signOut, isCatalogAdmin } = useSession();
  const save = useSave();
  const [push, setPush] = useState<PushState>('unsupported');
  const { data: catalog } = useGroceryCatalog(household!.id);
  const { tags } = useTags(household!.id);
  const { data, reload } = useLive<{ rules: TasteRule[]; suggestions: PatternSuggestion[] }>(`us:${userId}`, async () => {
    const [r, swipes, existing] = await Promise.all([
      supabase.from('taste_rules').select('*').eq('user_id', userId!),
      supabase.from('swipes').select('verdict, created_at, recipe:recipes(tags, recipe_ingredients(name, is_staple))')
        .eq('user_id', userId!).order('created_at', { ascending: false }).limit(300),
      supabase.from('learned_patterns').select('*').eq('user_id', userId!),
    ]);
    const rules = must(r) as TasteRule[];
    const exposures = (must(swipes) as unknown as SwipeRow[])
      .filter((s) => s.recipe)
      .map((s) => ({ verdict: s.verdict, createdAt: s.created_at, features: recipeFeatures(s.recipe!.tags, s.recipe!.recipe_ingredients) }));
    const known = (must(existing) as LearnedPattern[]).map((p) => p.pattern);
    const ruled = new Set(rules.map((x) => x.value));
    return {
      rules,
      suggestions: detectPatterns(exposures).filter((s) =>
        !known.some((k) => samePattern(k, s.pattern)) && !ruled.has(s.pattern.value)).slice(0, 3),
    };
  });
  const rules = data?.rules ?? [];

  useEffect(() => {
    void pushState().then(setPush).catch(() => setPush('unsupported'));
  }, []);

  const decide = async (s: PatternSuggestion, action: 'never' | 'less' | 'more' | 'ignore') => {
    if (action === 'never') {
      await save(supabase.from('taste_rules').upsert(
        { user_id: userId, kind: 'never', value: s.pattern.value, product_id: catalog?.index.ofIngredient(s.pattern.value)?.id ?? null, source: 'learned' },
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
    if (tags?.find(value)?.name === value) return tags.label(value, locale);
    const p = catalog?.index.ofIngredient(value);
    return p ? productName(p, locale) : value;
  };
  const nameOf = (r: TasteRule) => {
    const p = r.product_id ? catalog?.index.get(r.product_id) : undefined;
    return p ? productName(p, locale) : labelOf(r.value);
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

  return (
    <Screen title={t('us.title')}>
      <Section label={household?.name ?? t('us.members')} flush>
        <MemberList invite={members.length < 2} />
      </Section>

      <Section label={t('us.patterns')}>
        {shown.length === 0 ? <p className="muted small">{t('us.noPatterns')}</p> : (
          <div className="stack">
            {shown.map((s) => (
              <div key={`${s.pattern.kind}:${s.pattern.value}`} className="card stack">
                <span>{t(s.pattern.kind === 'avoid' ? 'us.patternAvoid' : 'us.patternPrefer', { value: labelOf(s.pattern.value), n: s.evidence, total: s.window })}</span>
                <div className="row row--wrap">
                  {s.pattern.kind === 'avoid' ? (
                    <>
                      <Button small variant="dark" onClick={() => void decide(s, 'never')}>{t('us.neverShow')}</Button>
                      <Button small variant="secondary" onClick={() => void decide(s, 'less')}>{t('us.showLess')}</Button>
                    </>
                  ) : (
                    <Button small variant="dark" onClick={() => void decide(s, 'more')}>{t('us.showMore')}</Button>
                  )}
                  <Button small variant="text" onClick={() => void decide(s, 'ignore')}>{t('us.ignore')}</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section label={t('app.you')}>
        <div className="list">
          <ListRow to="/us/goals" icon={<Icon name="star" />} title={t('us.yourGoals')}
            meta={goals && `${t(`goals.${goals.goal}`)} · ${goals.dinner_kcal} kcal · ${goals.dinner_protein_g} g · ${tn('recipe.servings', goals.servings)}`} />
          <ListRow to="/us/tastes" icon={<Icon name="heart" />} title={t('us.yourTastes')}
            meta={[diet && t(`tastes.${diet as 'pescatarian' | 'vegetarian'}`), never.length && `✕ ${never.slice(0, 3).join(', ')}`, love.length && `♥ ${love.slice(0, 3).join(', ')}`]
              .filter(Boolean).join(' · ') || undefined} />
          <ListRow to="/us/notifications" icon={<Icon name="bell" />} title={t('notifications.title')} meta={pushMeta} />
          <ListRow to="/us/profile" icon={<Icon name="person" />} title={t('profile.title')} meta={LOCALE_NAMES[locale]} />
        </div>
      </Section>

      <Section label={t('us.members')}>
        <div className="list">
          <ListRow to="/us/plan" icon={<Icon name="calendar" />} title={t('us.weeklyPlan')} />
          <ListRow to="/us/household" icon={<Icon name="gear" />} title={t('us.settings')} />
          {isCatalogAdmin && (
            <ListRow to="/us/catalog" icon={<Icon name="book" />} title={t('admin.entry')} meta={t('admin.entryHint')} />
          )}
        </div>
      </Section>

      <Button block variant="text" className="mt-6" onClick={() => void signOut()}>{t('us.signOut')}</Button>
    </Screen>
  );
}
