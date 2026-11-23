// Taste quiz (docs/taste-profiles.md §4): "How often would you want this for
// dinner?" on 26 dishes, laid out like a deck. Each next dish is the one whose
// answer teaches the model most about the rest of the library (logic/style.ts
// nextQuizCard), starting from earlier answers when the quiz is retaken. After
// 20 answers people may stop. The end is a summary of their style by kind of
// plate, which they can correct (style edits). Answers are taste_signals:
// starter and style (pair answers from the earlier version still count).
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router';
import { classifyRow, CLASSIFY_COLUMNS, type ClassifiableRow, type RecipeClassification } from '@logic/classify.ts';
import { dietClassOf } from '@logic/ingredients.ts';
import { rowPlates } from '@logic/plate.ts';
import { recipeFeatures } from '@logic/preferences.ts';
import { quizFacets, STYLE_LEVELS, type PairValue, type StarterVerdict, type StyleLevel } from '@logic/profile.ts';
import {
  fitStyle, FREQUENCY, nextQuizCard, type PairObservation, QUIZ_CARDS, QUIZ_MIN, type QuizCandidate,
  styleSummary, type StyleRegion, withStyleEdits,
} from '@logic/style.ts';
import { Icon } from '../../components/Icon.tsx';
import { StyleRows } from '../../components/StyleSummary.tsx';
import pasta from '../../assets/deck/pasta.webp';
import pokeBowl from '../../assets/deck/poke-bowl.webp';
import tacos from '../../assets/deck/tacos.webp';
import { RecipeFacts } from '../../components/RecipeBody.tsx';
import { Button, Screen, Spinner, imageStyle, recipeEmoji } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useCatalog, useLive, useSave } from '../../lib/hooks.ts';
import { recipeTitle } from '../../lib/recipeText.ts';
import { useSetup } from '../../lib/onboarding.ts';
import { useSession } from '../../lib/session.tsx';
import { StepBar } from './Step.tsx';
import { must, supabase } from '../../lib/supabase.ts';
import type { Recipe, TasteRule } from '../../lib/types.ts';

const SWIPE_X = 100;
const SWIPE_UP = 120;
const TOTAL = QUIZ_CARDS;

type Row = Omit<ClassifiableRow, 'recipe_ingredients' | 'steps'> & Pick<Recipe, 'id' | 'image_path' | 'language' | 'translations' | 'title' | 'tags' | 'steps'> & {
  recipe_ingredients: (ClassifiableRow['recipe_ingredients'][number] & { product_id: string | null })[];
};
/** A dish the quiz can show: the picker's candidate, and what the card displays. */
type Dish = QuizCandidate & { row: Row; classification: RecipeClassification };
type SignalRow = { recipe_id: string | null; other_recipe_id: string | null; kind: 'starter' | 'pair' | 'style'; value: string };

/** One answer this visit. */
type Decision = { dish: Dish; value: StarterVerdict };

/** Seeded, so the same answers pick the same next dish. */
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
  const setup = useSetup('quiz');
  const finish = () => (editing ? navigate(-1) : navigate('/onboarding/done'));

  const { data } = useLive<{ recipes: Row[]; rules: TasteRule[]; signals: SignalRow[] }>(`quiz:${userId}`, async () => {
    const [r, rules, signals] = await Promise.all([
      supabase.from('library_recipes').select(`id, image_path, language, kcal_per_serving, protein_g_per_serving, ${CLASSIFY_COLUMNS.replace('recipe_ingredients(', 'recipe_ingredients(product_id, ')}`),
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
  // The intro shows first.
  const [started, setStarted] = useState(false);
  // The card flying out after a choice, as on a deck.
  const [leaving, setLeaving] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [history, setHistory] = useState<Decision[]>([]);
  const [summary, setSummary] = useState(false);
  const [edits, setEdits] = useState<Map<StyleRegion, StyleLevel>>(new Map());
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
    for (const d of history) cards.set(d.dish.id, d.value);
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

  const cardsDone = history.length;

  // What to ask next: a dish, or nothing left.
  const next = useMemo((): { kind: 'card'; dish: Dish } | null => {
    if (!pool || summary) return null;
    const random = seeded(seed + history.length);
    if (cardsDone < QUIZ_CARDS) {
      // Dishes not answered before first; on a quiz retaken many times, earlier ones again.
      const thisVisit = new Set(history.map((d) => d.dish.id));
      const fresh = nextQuizCard(pool, answers.shown, answers.pairObs, random);
      const again = fresh ?? nextQuizCard(pool.filter((d) => !thisVisit.has(d.id)),
        answers.shown.filter((s) => thisVisit.has(s.candidate.id)), answers.pairObs, random);
      if (again) return { kind: 'card', dish: again as Dish };
    }
    return null;
  }, [pool, summary, seed, history, cardsDone, answers]);

  if (!pool) return <Screen back={editing}><Spinner /></Screen>;

  const decideCard = (dish: Dish, value: StarterVerdict) => {
    setDrag(null);
    navigator.vibrate?.(10);
    setHistory((h) => [...h, { dish, value }]);
    // In the background: a lost answer only makes the profile a little thinner.
    void save(supabase.from('taste_signals').upsert(
      { user_id: userId, recipe_id: dish.id, kind: 'starter', value },
      { onConflict: 'user_id,key' },
    ));
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
  // Onboarding: its last segment fills card by card. Settings: one bar for the quiz.
  const fill = Math.min(1, step / TOTAL);
  const progress = editing ? { index: 0, count: 1, fill } : { index: setup.index, count: setup.count, fill };
  const right = step >= QUIZ_MIN
    ? <button type="button" className="ob__skip" onClick={() => setSummary(true)}>{t('quiz.finish')}</button>
    : !editing && <button type="button" className="ob__skip" onClick={finish}>{t('ob.skip')}</button>;
  const bar = <StepBar progress={progress} right={right || undefined} />;

  if (!started && step === 0) {
    return (
      <main className="screen screen--plain ob quiz-intro">
        <StepBar progress={editing ? undefined : { index: setup.index, count: setup.count, fill: 0 }}
          right={!editing ? <button type="button" className="ob__skip" onClick={finish}>{t('ob.skip')}</button> : undefined} />
        <div className="ob-fan" aria-hidden>
          <img className="fan fan--left fan--art" src={pokeBowl} alt="" />
          <img className="fan fan--right fan--art" src={tacos} alt="" />
          <img className="fan fan--mid fan--art" src={pasta} alt="" />
        </div>
        <h1 className="ob__title quiz-intro__title">{t('quiz.introTitle')}</h1>
        <p className="quiz-intro__text">{t('quiz.introText')}</p>
        <div className="spacer spacer--gap" />
        <Button block onClick={() => setStarted(true)}>{t('quiz.start')}</Button>
      </main>
    );
  }

  const card = next.dish;
  // As on a deck: the card flies off the way it was sent, then the answer is kept.
  const answer = (value: StarterVerdict, dx = value === 'pass' ? -500 : value === 'must' ? 0 : 500, dy = value === 'must' ? -700 : 40) => {
    if (leaving) return;
    setLeaving({ id: card.id, dx, dy });
    window.setTimeout(() => {
      setLeaving(null);
      decideCard(card, value);
    }, 200);
  };
  const onPointerUp = () => {
    start.current = null;
    if (!drag) return;
    if (drag.dy < -SWIPE_UP && Math.abs(drag.dx) < 60) answer('must', drag.dx, -700);
    else if (drag.dx > SWIPE_X) answer('yes', 500, drag.dy);
    else if (drag.dx < -SWIPE_X) answer('pass', -500, drag.dy);
    else setDrag(null);
  };
  const motion = leaving?.id === card.id ? leaving : drag;
  const choices: { value: StarterVerdict; icon: 'x' | 'clock' | 'heart' | 'star'; cls: string }[] = [
    { value: 'pass', icon: 'x', cls: '' },
    { value: 'sometimes', icon: 'clock', cls: ' swipe-btn--sometimes' },
    { value: 'yes', icon: 'heart', cls: ' swipe-btn--like' },
    { value: 'must', icon: 'star', cls: ' swipe-btn--star' },
  ];
  return (
    <main className="screen swipe-screen quiz">
      {bar}
      <div className="deck">
        <article className="swipe-card swipe-card--peek" aria-hidden />
        <article
          key={card.id}
          className="swipe-card"
          style={{
            transform: motion ? `translate(${motion.dx}px, ${motion.dy}px) rotate(${motion.dx / 20}deg)` : undefined,
            transition: drag && !leaving ? 'none' : 'transform 0.2s ease',
          }}
          onPointerDown={(e: ReactPointerEvent) => {
            start.current = { x: e.clientX, y: e.clientY };
            (e.target as Element).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e: ReactPointerEvent) => start.current && setDrag({ dx: e.clientX - start.current.x, dy: e.clientY - start.current.y })}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { start.current = null; setDrag(null); }}
        >
          <DishFace dish={card} drag={drag ?? undefined} />
        </article>
      </div>
      <div className="quiz-actions">
        <div className="quiz-actions__row">
          {choices.map((x) => (
            <button key={x.value} type="button" className="quiz-answer" onClick={() => answer(x.value)}>
              <span className={`swipe-btn${x.cls}`} aria-hidden>
                <Icon name={x.icon} size={x.value === 'yes' ? 26 : 22} filled={x.value === 'yes' || x.value === 'must'}
                  strokeWidth={x.value === 'pass' ? 2.4 : 2} />
              </span>
              <span className="quiz-answer__label">{t(`quiz.answers.${x.value}`)}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

function DishFace({ dish, drag }: { dish: Dish; drag?: { dx: number; dy: number } }) {
  const { t, locale } = useI18n();
  const yes = drag ? Math.max(0, Math.min(1, drag.dx / SWIPE_X)) : 0;
  const pass = drag ? Math.max(0, Math.min(1, -drag.dx / SWIPE_X)) : 0;
  const must = drag ? Math.max(0, Math.min(1, -drag.dy / SWIPE_UP)) * (Math.abs(drag.dx) < 60 ? 1 : 0) : 0;
  return (
    <>
      <div className="swipe-card__photo" style={imageStyle(dish.row.image_path)}>
        {!imageStyle(dish.row.image_path) && <span aria-hidden>{recipeEmoji(dish.row.title, dish.row.tags ?? [])}</span>}
      </div>
      <div className="swipe-card__body">
        <h3 className="t-title-s m-0">{recipeTitle(dish.row, locale)}</h3>
        <RecipeFacts recipe={dish.row as unknown as Recipe} max={3} />
      </div>
      <span className="swipe-card__stamp swipe-card__stamp--yes" style={{ opacity: yes }}>{t('quiz.answers.yes')}</span>
      <span className="swipe-card__stamp swipe-card__stamp--pass" style={{ opacity: pass }}>{t('quiz.answers.pass')}</span>
      <span className="swipe-card__stamp swipe-card__stamp--must" style={{ opacity: must }}>{t('quiz.answers.must')}</span>
    </>
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
