// Taste quiz (docs/taste-profiles.md §4): "How often would you want this for
// dinner?" on 26 dishes, then 6 "On a normal weeknight, which one?" pairs. Each
// next dish is the one whose answer teaches the model most about the rest of
// the library (logic/style.ts nextQuizCard), starting from earlier answers when
// the quiz is retaken; pairs are two dishes with the same protein on different
// plates (nextQuizPair). After 20 decisions people may stop. The end is a
// summary of their style by kind of plate, which they can correct (style
// edits). Answers are taste_signals: starter, pair and style.
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router';
import { classifyRow, CLASSIFY_COLUMNS, type ClassifiableRow, type RecipeClassification } from '@logic/classify.ts';
import { dietClassOf } from '@logic/ingredients.ts';
import { rowPlates } from '@logic/plate.ts';
import { recipeFeatures } from '@logic/preferences.ts';
import { quizFacets, STYLE_LEVELS, type PairValue, type StarterVerdict, type StyleLevel } from '@logic/profile.ts';
import {
  fitStyle, FREQUENCY, nextQuizCard, nextQuizPair, type PairObservation, QUIZ_CARDS, QUIZ_MIN, QUIZ_PAIRS, type QuizCandidate,
  styleSummary, type StyleRegion, withStyleEdits,
} from '@logic/style.ts';
import { Icon } from '../../components/Icon.tsx';
import { StyleRows } from '../../components/StyleSummary.tsx';
import { Button, ModeBar, ProgressBar, Screen, Spinner, Tag, imageStyle, recipeEmoji } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { classificationChips } from '../../lib/classes.ts';
import { useCatalog, useLive, useSave } from '../../lib/hooks.ts';
import { recipeTitle } from '../../lib/recipeText.ts';
import { useSession } from '../../lib/session.tsx';
import { must, supabase } from '../../lib/supabase.ts';
import type { Recipe, TasteRule } from '../../lib/types.ts';

const SWIPE_X = 100;
const SWIPE_UP = 120;
const TOTAL = QUIZ_CARDS + QUIZ_PAIRS;

type Row = Omit<ClassifiableRow, 'recipe_ingredients' | 'steps'> & Pick<Recipe, 'id' | 'image_path' | 'language' | 'translations' | 'title' | 'tags' | 'steps'> & {
  recipe_ingredients: (ClassifiableRow['recipe_ingredients'][number] & { product_id: string | null })[];
};
/** A dish the quiz can show: the picker's candidate, and what the card displays. */
type Dish = QuizCandidate & { row: Row; classification: RecipeClassification };
type SignalRow = { recipe_id: string | null; other_recipe_id: string | null; kind: 'starter' | 'pair' | 'style'; value: string };

/** One decision this visit, with what it replaced (to put back on undo). */
type Decision =
  | { kind: 'card'; dish: Dish; value: StarterVerdict; before?: string }
  | { kind: 'pair'; a: Dish; b: Dish; value: PairValue; before?: string };

/** Seeded, so the same answers pick the same next dish (undo then re-answer shows the same card). */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function TasteQuizScreen({ editing }: { editing?: boolean }) {
  const { t } = useI18n();
  const { userId } = useSession();
  const catalog = useCatalog();
  const navigate = useNavigate();
  const save = useSave();
  const finish = () => (editing ? navigate(-1) : navigate('/', { replace: true }));

  const { data } = useLive<{ recipes: Row[]; rules: TasteRule[]; signals: SignalRow[] }>(`quiz:${userId}`, async () => {
    const [r, rules, signals] = await Promise.all([
      supabase.from('library_recipes').select(`id, image_path, language, ${CLASSIFY_COLUMNS.replace('recipe_ingredients(', 'recipe_ingredients(product_id, ')}`),
      supabase.from('taste_rules').select('*').eq('user_id', userId!),
      supabase.from('taste_signals').select('recipe_id, other_recipe_id, kind, value').eq('user_id', userId!).in('kind', ['starter', 'pair', 'style']),
    ]);
    return { recipes: must(r) as unknown as Row[], rules: must(rules) as TasteRule[], signals: must(signals) as SignalRow[] };
  });

  // Dishes the person could actually be offered (diet and never rules), with their plates and features.
  const pool = useMemo(() => {
    if (!data || !catalog) return null;
    const diet = data.rules.find((x) => x.kind === 'diet')?.value ?? 'everything';
    const never = new Set(data.rules.filter((x) => x.kind === 'never').map((x) => x.product_id));
    const dishes: Dish[] = [];
    for (const r of data.recipes) {
      const cls = dietClassOf(r.recipe_ingredients.map((i) => catalog.find(i.name)));
      if (diet === 'vegetarian' && cls !== 'veg') continue;
      if (diet === 'pescatarian' && cls === 'meat') continue;
      if (r.recipe_ingredients.some((i) => !i.optional && i.product_id && never.has(i.product_id))) continue;
      const classification = classifyRow(r, catalog);
      const plates = rowPlates(r, catalog, classification);
      if (!plates.length) continue;
      dishes.push({
        id: r.id, row: r, classification, plate: plates[0], hasPhoto: !!r.image_path,
        features: recipeFeatures(r.tags ?? [], r.recipe_ingredients, classification), facets: quizFacets(classification),
      });
    }
    return dishes;
  }, [data, catalog]);
  const byId = useMemo(() => new Map((pool ?? []).map((d) => [d.id, d])), [pool]);

  const [seed] = useState(() => Math.floor(Math.random() * 1e9));
  const [history, setHistory] = useState<Decision[]>([]);
  const [summary, setSummary] = useState(false);
  const [edits, setEdits] = useState<Map<StyleRegion, StyleLevel>>(new Map());
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  // Earlier answers (a retaken quiz builds on them), as this visit leaves them.
  const earlier = useMemo(() => {
    const cards = new Map<string, string>();
    const pairs = new Map<string, { a: string; b: string; value: string }>();
    const styles = new Map<StyleRegion, StyleLevel>();
    for (const s of data?.signals ?? []) {
      if (s.kind === 'starter' && s.recipe_id) cards.set(s.recipe_id, s.value);
      if (s.kind === 'pair' && s.recipe_id && s.other_recipe_id) pairs.set(`${s.recipe_id}:${s.other_recipe_id}`, { a: s.recipe_id, b: s.other_recipe_id, value: s.value });
      if (s.kind === 'style') {
        const [region, level] = s.value.split(':');
        if (STYLE_LEVELS.includes(level as StyleLevel)) styles.set(region as StyleRegion, level as StyleLevel);
      }
    }
    return { cards, pairs, styles };
  }, [data]);

  /** Every quiz answer so far, earlier ones and this visit's, as the model reads them. */
  const answers = useMemo(() => {
    const cards = new Map([...earlier.cards].map(([id, v]) => [id, v as StarterVerdict]));
    const pairs = new Map([...earlier.pairs].map(([k, p]) => [k, { ...p, value: p.value as PairValue }]));
    for (const d of history) {
      if (d.kind === 'card') cards.set(d.dish.id, d.value);
      else pairs.set(`${d.a.id}:${d.b.id}`, { a: d.a.id, b: d.b.id, value: d.value });
    }
    const shown = [...cards].flatMap(([id, v]) => {
      const dish = byId.get(id);
      return dish ? [{ candidate: dish as QuizCandidate, y: FREQUENCY[v] }] : [];
    });
    const pairObs: PairObservation[] = [...pairs.values()].flatMap((p) => {
      const a = byId.get(p.a);
      const b = byId.get(p.b);
      return a && b ? [{ a: a.plate, b: b.plate, choice: p.value }] : [];
    });
    return { cards, pairs, shown, pairObs };
  }, [earlier, history, byId]);

  const cardsDone = history.filter((d) => d.kind === 'card').length;
  const pairsDone = history.length - cardsDone;

  // What to ask next: a dish, a pair, or nothing left.
  const next = useMemo((): { kind: 'card'; dish: Dish } | { kind: 'pair'; a: Dish; b: Dish } | null => {
    if (!pool || summary) return null;
    const random = seeded(seed + history.length);
    if (cardsDone < QUIZ_CARDS) {
      // Dishes not answered before first; on a quiz retaken many times, earlier ones again.
      const thisVisit = new Set(history.flatMap((d) => (d.kind === 'card' ? [d.dish.id] : [])));
      const fresh = nextQuizCard(pool, answers.shown, answers.pairObs, random);
      const again = fresh ?? nextQuizCard(pool.filter((d) => !thisVisit.has(d.id)),
        answers.shown.filter((s) => thisVisit.has(s.candidate.id)), answers.pairObs, random);
      if (again) return { kind: 'card', dish: again as Dish };
    }
    if (pairsDone < QUIZ_PAIRS) {
      const used = new Set([...answers.cards.keys(), ...[...answers.pairs.values()].flatMap((p) => [p.a, p.b])]);
      const model = fitStyle(answers.shown.map((s) => ({ plate: s.candidate.plate, features: s.candidate.features, y: s.y })), answers.pairObs);
      const pair = nextQuizPair(pool, used, model, random);
      if (pair) return { kind: 'pair', a: pair[0] as Dish, b: pair[1] as Dish };
    }
    return null;
  }, [pool, summary, seed, history, cardsDone, pairsDone, answers]);

  if (!pool) return <Screen back={editing}><Spinner /></Screen>;

  const decideCard = (dish: Dish, value: StarterVerdict) => {
    setDrag(null);
    navigator.vibrate?.(10);
    setHistory((h) => [...h, { kind: 'card', dish, value, before: answers.cards.get(dish.id) }]);
    // In the background: a lost answer only makes the profile a little thinner.
    void save(supabase.from('taste_signals').upsert(
      { user_id: userId, recipe_id: dish.id, kind: 'starter', value },
      { onConflict: 'user_id,key' },
    ));
  };
  const decidePair = (a: Dish, b: Dish, value: PairValue) => {
    navigator.vibrate?.(10);
    setHistory((h) => [...h, { kind: 'pair', a, b, value, before: answers.pairs.get(`${a.id}:${b.id}`)?.value }]);
    void save(supabase.from('taste_signals').upsert(
      { user_id: userId, recipe_id: a.id, other_recipe_id: b.id, kind: 'pair', value },
      { onConflict: 'user_id,key' },
    ));
  };

  // Takes back the last decision: what it replaced comes back, otherwise it goes.
  const undo = async () => {
    const last = history[history.length - 1];
    if (!last || busy) return;
    setBusy(true);
    if (last.kind === 'card') {
      await save(last.before
        ? supabase.from('taste_signals').upsert({ user_id: userId, recipe_id: last.dish.id, kind: 'starter', value: last.before }, { onConflict: 'user_id,key' })
        : supabase.from('taste_signals').delete().eq('user_id', userId!).eq('kind', 'starter').eq('recipe_id', last.dish.id));
    } else {
      await save(last.before
        ? supabase.from('taste_signals').upsert({ user_id: userId, recipe_id: last.a.id, other_recipe_id: last.b.id, kind: 'pair', value: last.before }, { onConflict: 'user_id,key' })
        : supabase.from('taste_signals').delete().eq('user_id', userId!).eq('kind', 'pair').eq('recipe_id', last.a.id).eq('other_recipe_id', last.b.id));
    }
    setHistory((h) => h.slice(0, -1));
    setBusy(false);
  };

  const setLevel = (region: StyleRegion, level: StyleLevel) => {
    setEdits((e) => new Map(e).set(region, level));
    void save(supabase.from('taste_signals').upsert({ user_id: userId, kind: 'style', value: `${region}:${level}` }, { onConflict: 'user_id,key' }));
  };

  const answered = answers.shown.length > 0;
  if (summary || (!next && history.length > 0)) {
    if (!answered) {
      return (
        <Screen title={t('quiz.doneTitle')} subtitle={t('quiz.doneText')} plain>
          <Button block onClick={finish}>{editing ? t('app.done') : t('app.continue')}</Button>
        </Screen>
      );
    }
    return <StyleSummary answers={answers} stated={new Map([...earlier.styles, ...edits])} onChange={setLevel}
      onDone={finish} editing={editing} />;
  }
  if (!next) {
    return (
      <Screen title={t('quiz.doneTitle')} subtitle={t('quiz.doneText')} plain>
        <Button block onClick={finish}>{editing ? t('app.done') : t('app.continue')}</Button>
      </Screen>
    );
  }

  const step = history.length;
  const footer = (
    <div className="quiz-footer">
      <button type="button" className="swipe-btn swipe-btn--small" aria-label={t('swipe.undo')} disabled={step === 0 || busy}
        onClick={() => void undo()}>
        <Icon name="undo" size={20} />
      </button>
      {step >= QUIZ_MIN
        ? <Button variant="text" onClick={() => setSummary(true)}>{t('quiz.enough')}</Button>
        : <Button variant="text" onClick={finish}>{t('quiz.skip')}</Button>}
    </div>
  );

  if (next.kind === 'pair') {
    const { a, b } = next;
    return (
      <main className="screen swipe-screen">
        <ModeBar title={t('quiz.progress', { n: step + 1, total: TOTAL })} onClose={finish} />
        <ProgressBar value={step} max={TOTAL} />
        <h2 className="t-title-s m-0 quiz-question">{t('quiz.pairQuestion')}</h2>
        <div className="quiz-pair">
          {[a, b].map((d, i) => (
            <PairCard key={d.id} dish={d} onPick={() => decidePair(a, b, i === 0 ? 'a' : 'b')} />
          ))}
        </div>
        <div className="quiz-answers">
          <Button variant="secondary" onClick={() => decidePair(a, b, 'either')}>{t('quiz.either')}</Button>
          <Button variant="secondary" onClick={() => decidePair(a, b, 'neither')}>{t('quiz.neither')}</Button>
        </div>
        {footer}
      </main>
    );
  }

  const card = next.dish;
  const onPointerUp = () => {
    start.current = null;
    if (!drag) return;
    if (drag.dy < -SWIPE_UP && Math.abs(drag.dx) < 60) decideCard(card, 'must');
    else if (drag.dx > SWIPE_X) decideCard(card, 'yes');
    else if (drag.dx < -SWIPE_X) decideCard(card, 'pass');
    else setDrag(null);
  };
  return (
    <main className="screen swipe-screen">
      <ModeBar title={t('quiz.progress', { n: step + 1, total: TOTAL })} onClose={finish} />
      <ProgressBar value={step} max={TOTAL} />
      {step === 0 && <p className="muted small m-0">{t('quiz.intro')}</p>}
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
          <DishFace dish={card} />
        </article>
      </div>
      <h2 className="t-headline m-0 quiz-question">{t('quiz.question')}</h2>
      <div className="quiz-answers">
        <Button variant="secondary" onClick={() => decideCard(card, 'pass')}><Icon name="x" size={18} /> {t('quiz.pass')}</Button>
        <Button variant="secondary" onClick={() => decideCard(card, 'sometimes')}><Icon name="clock" size={18} /> {t('quiz.sometimes')}</Button>
        <Button variant="secondary" onClick={() => decideCard(card, 'yes')}><Icon name="heart" size={18} /> {t('quiz.yes')}</Button>
        <Button variant="secondary" onClick={() => decideCard(card, 'must')}><Icon name="star" size={18} /> {t('quiz.must')}</Button>
      </div>
      {footer}
    </main>
  );
}

function DishFace({ dish, compact }: { dish: Dish; compact?: boolean }) {
  const { t, locale } = useI18n();
  const chips = classificationChips(dish.classification, t).slice(0, compact ? 2 : 3);
  return (
    <>
      <div className="swipe-card__photo" style={imageStyle(dish.row.image_path)}>
        {!imageStyle(dish.row.image_path) && <span aria-hidden>{recipeEmoji(dish.row.title, dish.row.tags ?? [])}</span>}
      </div>
      <div className="swipe-card__body">
        <h3 className={`${compact ? 't-callout' : 't-title-s'} m-0`}>{recipeTitle(dish.row, locale)}</h3>
        <div className="row row--wrap">{chips.map((c) => <Tag key={c}>{c}</Tag>)}</div>
      </div>
    </>
  );
}

function PairCard({ dish, onPick }: { dish: Dish; onPick: () => void }) {
  const { t, locale } = useI18n();
  return (
    <button type="button" className="quiz-pair__card" onClick={onPick}
      aria-label={t('quiz.pick', { title: recipeTitle(dish.row, locale) })}>
      <DishFace dish={dish} compact />
    </button>
  );
}

/** The person's style by kind of plate, in words; each one can be set. */
function StyleSummary({ answers, stated, onChange, onDone, editing }: {
  answers: { shown: { candidate: QuizCandidate; y: number }[]; pairObs: PairObservation[] };
  stated: Map<StyleRegion, StyleLevel>;
  onChange: (region: StyleRegion, level: StyleLevel) => void;
  onDone: () => void;
  editing?: boolean;
}) {
  const { t } = useI18n();
  // The model of the quiz answers, with what they set here on top (style.ts withStyleEdits).
  const model = useMemo(() => withStyleEdits(
    fitStyle(answers.shown.map((s) => ({ plate: s.candidate.plate, features: s.candidate.features, y: s.y })), answers.pairObs),
    [...stated].map(([region, level]) => ({ region, level })),
  ), [answers, stated]);
  return (
    <Screen title={t('quiz.summaryTitle')} subtitle={t('quiz.summaryText')} plain>
      <StyleRows summary={styleSummary(model)} stated={stated} onChange={onChange} />
      <div className="spacer spacer--gap" />
      <Button block onClick={onDone}>{editing ? t('app.done') : t('app.continue')}</Button>
    </Screen>
  );
}
