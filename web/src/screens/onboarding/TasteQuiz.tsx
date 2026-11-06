// Taste quiz: 20 varied recipes swiped once, so the first decks already know
// something. Answers are taste_signals of kind 'starter' (logic/profile.ts);
// retaking it shows recipes not answered yet first and replaces old answers.
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router';
import { classifyRow, CLASSIFY_COLUMNS, type ClassifiableRow } from '@logic/classify.ts';
import { dietClassOf } from '@logic/ingredients.ts';
import { pickStarterSet, STARTER_SIZE } from '@logic/profile.ts';
import { Icon } from '../../components/Icon.tsx';
import { Button, ModeBar, ProgressBar, Screen, Spinner, Tag, imageStyle, recipeEmoji } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { classificationChips } from '../../lib/classes.ts';
import { useCatalog, useLive, useSave } from '../../lib/hooks.ts';
import { recipeTitle } from '../../lib/recipeText.ts';
import { useSession } from '../../lib/session.tsx';
import { must, supabase } from '../../lib/supabase.ts';
import type { Recipe, TasteRule, Verdict } from '../../lib/types.ts';

const SWIPE_X = 100;
const SWIPE_UP = 120;

type Row = Omit<ClassifiableRow, 'recipe_ingredients' | 'steps'> & Pick<Recipe, 'id' | 'image_path' | 'language' | 'translations' | 'title' | 'tags' | 'steps'> & {
  recipe_ingredients: (ClassifiableRow['recipe_ingredients'][number] & { product_id: string | null })[];
};

export function TasteQuizScreen({ editing }: { editing?: boolean }) {
  const { t, locale } = useI18n();
  const { userId } = useSession();
  const catalog = useCatalog();
  const navigate = useNavigate();
  const save = useSave();
  const finish = () => (editing ? navigate(-1) : navigate('/', { replace: true }));

  const { data } = useLive<{ recipes: Row[]; rules: TasteRule[]; answered: Set<string> }>(`quiz:${userId}`, async () => {
    const [r, rules, answered] = await Promise.all([
      supabase.from('library_recipes').select(`id, image_path, language, ${CLASSIFY_COLUMNS.replace('recipe_ingredients(', 'recipe_ingredients(product_id, ')}`),
      supabase.from('taste_rules').select('*').eq('user_id', userId!),
      supabase.from('taste_signals').select('recipe_id').eq('user_id', userId!).eq('kind', 'starter'),
    ]);
    return {
      recipes: must(r) as unknown as Row[],
      rules: must(rules) as TasteRule[],
      answered: new Set((must(answered) as { recipe_id: string }[]).map((x) => x.recipe_id)),
    };
  });

  // Chosen once per visit: varied dishes the person could actually be offered (diet and never rules).
  const cards = useMemo(() => {
    if (!data || !catalog) return null;
    const diet = data.rules.find((x) => x.kind === 'diet')?.value ?? 'everything';
    const never = new Set(data.rules.filter((x) => x.kind === 'never').map((x) => x.product_id));
    const allowed = data.recipes.filter((r) => {
      const cls = dietClassOf(r.recipe_ingredients.map((i) => catalog.find(i.name)));
      if (diet === 'vegetarian' && cls !== 'veg') return false;
      if (diet === 'pescatarian' && cls === 'meat') return false;
      return !r.recipe_ingredients.some((i) => !i.optional && i.product_id && never.has(i.product_id));
    }).map((r) => ({ ...r, classification: classifyRow(r, catalog), hasPhoto: !!r.image_path }));
    const fresh = pickStarterSet(allowed.filter((r) => !data.answered.has(r.id)));
    const again = fresh.length < STARTER_SIZE ? pickStarterSet(allowed.filter((r) => data.answered.has(r.id)), STARTER_SIZE - fresh.length) : [];
    return [...fresh, ...again];
  }, [data, catalog]);

  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  if (!cards) return <Screen back={editing}><Spinner /></Screen>;
  const card = cards[index];
  const done = index >= cards.length;

  const decide = (verdict: Verdict) => {
    if (!card) return;
    setDrag(null);
    navigator.vibrate?.(10);
    // In the background: a lost answer only makes the profile a little thinner.
    void save(supabase.from('taste_signals').upsert(
      { user_id: userId, recipe_id: card.id, kind: 'starter', value: verdict },
      { onConflict: 'user_id,key' },
    ));
    setIndex((i) => i + 1);
  };

  const onPointerUp = () => {
    start.current = null;
    if (!drag) return;
    if (drag.dy < -SWIPE_UP && Math.abs(drag.dx) < 60) decide('must');
    else if (drag.dx > SWIPE_X) decide('yes');
    else if (drag.dx < -SWIPE_X) decide('pass');
    else setDrag(null);
  };

  if (done || cards.length === 0) {
    return (
      <Screen title={t('quiz.doneTitle')} subtitle={t('quiz.doneText')} plain>
        <Button block onClick={finish}>{editing ? t('app.done') : t('app.continue')}</Button>
      </Screen>
    );
  }

  const chips = catalog ? classificationChips(card.classification, t).slice(0, 3) : [];
  return (
    <main className="screen swipe-screen">
      <ModeBar title={t('quiz.progress', { n: index + 1, total: cards.length })} onClose={finish} />
      <ProgressBar value={index} max={cards.length} />
      {index === 0 && <p className="muted small m-0">{t('quiz.intro')}</p>}
      <div className="deck">
        <article
          key={card.id}
          className="swipe-card"
          style={{
            transform: drag ? `translate(${drag.dx}px, ${drag.dy}px) rotate(${drag.dx / 20}deg)` : undefined,
            transition: drag ? 'none' : 'transform 0.25s ease',
          }}
          onPointerDown={(e: ReactPointerEvent) => {
            start.current = { x: e.clientX, y: e.clientY };
            (e.target as Element).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e: ReactPointerEvent) => start.current && setDrag({ dx: e.clientX - start.current.x, dy: e.clientY - start.current.y })}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { start.current = null; setDrag(null); }}
        >
          <div className="swipe-card__photo" style={imageStyle(card.image_path)}>
            {!imageStyle(card.image_path) && <span aria-hidden>{recipeEmoji(card.title, card.tags ?? [])}</span>}
          </div>
          <div className="swipe-card__body">
            <h2 className="t-title-s m-0">{recipeTitle(card, locale)}</h2>
            <div className="row row--wrap">{chips.map((c) => <Tag key={c}>{c}</Tag>)}</div>
          </div>
        </article>
      </div>
      <div className="swipe-actions">
        <button type="button" className="swipe-btn" aria-label={t('swipe.pass')} onClick={() => decide('pass')}>
          <Icon name="x" size={26} strokeWidth={2.4} />
        </button>
        <button type="button" className="swipe-btn swipe-btn--like" aria-label={t('swipe.yes')} onClick={() => decide('yes')}>
          <Icon name="heart" filled size={28} />
        </button>
        <button type="button" className="swipe-btn swipe-btn--small swipe-btn--star" aria-label={t('swipe.must')} onClick={() => decide('must')}>
          <Icon name="star" filled size={20} />
        </button>
      </div>
      <Button block variant="text" onClick={finish}>{t('quiz.skip')}</Button>
    </main>
  );
}
