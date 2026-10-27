import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { detectPatterns, recipeFeatures, type PatternSuggestion } from '@logic/preferences.ts';
import { Icon } from '../components/Icon.tsx';
import { Avatar, Button, Screen, Segmented } from '../components/ui.tsx';
import { LOCALES, useI18n, type Locale } from '../i18n/index.tsx';
import { enablePush, pushState, type PushState } from '../lib/push.ts';
import { useSession } from '../lib/session.tsx';
import { supabase } from '../lib/supabase.ts';
import type { LearnedPattern, TasteRule } from '../lib/types.ts';

interface SwipeRow {
  verdict: 'pass' | 'yes' | 'must';
  created_at: string;
  recipe: { tags: string[]; recipe_ingredients: { name: string; is_staple: boolean }[] } | null;
}

const samePattern = (a: { kind: string; value: string }, b: { kind: string; value: string }) =>
  a.kind === b.kind && a.value === b.value;

export function UsScreen() {
  const { t, locale, setLocale } = useI18n();
  const { userId, members, goals, household, signOut } = useSession();
  const [rules, setRules] = useState<TasteRule[]>([]);
  const [suggestions, setSuggestions] = useState<PatternSuggestion[]>([]);
  const [push, setPush] = useState<PushState>('unsupported');

  const load = async () => {
    const [r, swipes, existing] = await Promise.all([
      supabase.from('taste_rules').select('*').eq('user_id', userId!),
      supabase.from('swipes').select('verdict, created_at, recipe:recipes(tags, recipe_ingredients(name, is_staple))')
        .eq('user_id', userId!).order('created_at', { ascending: false }).limit(300),
      supabase.from('learned_patterns').select('*').eq('user_id', userId!),
    ]);
    const myRules = (r.data ?? []) as TasteRule[];
    setRules(myRules);
    const exposures = ((swipes.data ?? []) as unknown as SwipeRow[])
      .filter((s) => s.recipe)
      .map((s) => ({ verdict: s.verdict, createdAt: s.created_at, features: recipeFeatures(s.recipe!.tags, s.recipe!.recipe_ingredients) }));
    const known = ((existing.data ?? []) as LearnedPattern[]).map((p) => p.pattern);
    const ruled = new Set(myRules.map((x) => x.value));
    setSuggestions(detectPatterns(exposures).filter((s) =>
      !known.some((k) => samePattern(k, s.pattern)) && !ruled.has(s.pattern.value)).slice(0, 3));
  };

  useEffect(() => {
    void load();
    void pushState().then(setPush).catch(() => setPush('unsupported'));
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (s: PatternSuggestion, action: 'never' | 'less' | 'more' | 'ignore') => {
    if (action === 'never') {
      await supabase.from('taste_rules').upsert(
        { user_id: userId, kind: 'never', value: s.pattern.value, source: 'learned' }, { onConflict: 'user_id,kind,value' });
    }
    await supabase.from('learned_patterns').insert({
      user_id: userId,
      pattern: s.pattern,
      evidence_count: s.evidence,
      status: action === 'ignore' ? 'dismissed' : 'accepted',
      weight: action === 'less' ? -0.5 : action === 'more' ? 0.5 : 0,
    });
    await load();
  };

  const never = rules.filter((r) => r.kind === 'never').map((r) => r.value);
  const love = rules.filter((r) => r.kind === 'love').map((r) => r.value);
  const diet = rules.find((r) => r.kind === 'diet')?.value;

  return (
    <Screen title={t('us.title')}>
      <h2 className="section-label">{household?.name ?? t('us.members')}</h2>
      <div className="list">
        {members.map((m) => (
          <div key={m.user_id} className="list-row">
            <Avatar name={m.profile.first_name} color={m.profile.color} />
            <span className="list-row__main">{m.profile.first_name}{m.user_id === userId ? ` (${t('app.you')})` : ''}</span>
          </div>
        ))}
        {members.length < 2 && (
          <Link to="/invite" className="list-row" style={{ color: 'var(--c-accent)' }}>
            <Icon name="plus" /> <span className="list-row__main">{t('settings.invite')}</span>
          </Link>
        )}
      </div>

      <h2 className="section-label">{t('us.patterns')}</h2>
      {suggestions.length === 0 ? <p className="muted small">{t('us.noPatterns')}</p> : (
        <div className="stack">
          {suggestions.map((s) => (
            <div key={`${s.pattern.kind}:${s.pattern.value}`} className="card stack">
              <span>{t(s.pattern.kind === 'avoid' ? 'us.patternAvoid' : 'us.patternPrefer', { value: s.pattern.value, n: s.evidence, total: s.window })}</span>
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

      <h2 className="section-label">{t('app.you')}</h2>
      <div className="list">
        <Link to="/us/goals" className="list-row">
          <span className="list-row__main">
            <span className="list-row__title">{t('us.yourGoals')}</span>
            {goals && <span className="list-row__meta">{t(`goals.${goals.goal}`)} · {goals.dinner_kcal} kcal · {goals.dinner_protein_g} g</span>}
          </span>
          <span className="chevron"><Icon name="chevron" size={18} /></span>
        </Link>
        <Link to="/us/tastes" className="list-row">
          <span className="list-row__main">
            <span className="list-row__title">{t('us.yourTastes')}</span>
            <span className="list-row__meta">
              {[diet && t(`tastes.${diet as 'pescatarian' | 'vegetarian'}`), never.length && `✕ ${never.slice(0, 3).join(', ')}`, love.length && `♥ ${love.slice(0, 3).join(', ')}`]
                .filter(Boolean).join(' · ')}
            </span>
          </span>
          <span className="chevron"><Icon name="chevron" size={18} /></span>
        </Link>
      </div>

      <h2 className="section-label">{t('us.notifications')}</h2>
      <div className="card stack">
        {push === 'on' && <span style={{ color: 'var(--c-success)' }}>✓ {t('us.notificationsOn')}</span>}
        {push === 'denied' && <span className="muted">{t('us.notificationsDenied')}</span>}
        {push === 'unsupported' && <span className="muted">{t('us.notificationsUnsupported')}</span>}
        {push === 'off' && (
          <Button variant="secondary" onClick={() => void enablePush(userId!).then(setPush).catch(() => setPush('off'))}>
            <Icon name="bell" /> {t('us.enableNotifications')}
          </Button>
        )}
      </div>

      <h2 className="section-label">{t('account.language')}</h2>
      <Segmented<Locale> label={t('account.language')} value={locale} onChange={setLocale}
        options={LOCALES.map((l) => ({ value: l, label: l === 'fr' ? 'Français' : 'English' }))} />

      <div className="list" style={{ marginTop: 'var(--s-6)' }}>
        <Link to="/plan" className="list-row">
          <Icon name="calendar" /> <span className="list-row__main">{t('us.weeklyPlan')}</span>
          <span className="chevron"><Icon name="chevron" size={18} /></span>
        </Link>
        <Link to="/settings" className="list-row">
          <Icon name="gear" /> <span className="list-row__main">{t('us.settings')}</span>
          <span className="chevron"><Icon name="chevron" size={18} /></span>
        </Link>
      </div>
      <Button block variant="text" onClick={() => void signOut()} style={{ marginTop: 'var(--s-4)' }}>{t('us.signOut')}</Button>
    </Screen>
  );
}
