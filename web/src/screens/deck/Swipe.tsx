import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { ListProposal } from '@logic/groceries.ts';
import { loadProposalsMany } from '../../components/AddToListSheet.tsx';
import { Icon } from '../../components/Icon.tsx';
import { RecipeBody, RecipeFacts } from '../../components/RecipeBody.tsx';
import { AvatarPair, TabHeader, imageStyle, photoUrl, recipeEmoji, toast } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { todayIn, useLive } from '../../lib/hooks.ts';
import { useEveningName } from '../../lib/plan.ts';
import { groupIngredients, INGREDIENT_SELECT } from '../../lib/products.ts';
import { recipeTitle } from '../../lib/recipeText.ts';
import { useSession } from '../../lib/session.tsx';
import { must, supabase } from '../../lib/supabase.ts';
import type { DeckCard, RecipeIngredient, Verdict } from '../../lib/types.ts';
import type { DeckData } from './data.ts';

const SWIPE_X = 100;
const SWIPE_UP = 120;
/** Moved less than this (px) between press and release: a tap, which opens the card. */
const TAP = 8;
const SAVE_TIMEOUT_MS = 15_000;
/** How long a card takes to leave (matches .swipe-card--leaving / --fav in app.css). */
const LEAVE_MS = 300;
const FAV_MS = 480;
const SAVE_RETRIES = 2;

/** Aborts a request that hangs, so a stalled connection fails fast and is retried. */
function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  const ctrl = new AbortController();
  window.setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

/** Every card's ingredients, and which are probably at home. */
interface CardDetails {
  ingredients: Map<string, RecipeIngredient[]>;
  atHome: Map<string, Set<string>>;
}

function useCardDetails(data: DeckData) {
  const { household } = useSession();
  return useLive<CardDetails>(`deck-details:${data.deck.id}`, async () => {
    const ids = data.cards.map((c) => c.recipe_id);
    const rows = must(await supabase.from('recipe_ingredients').select(INGREDIENT_SELECT).in('recipe_id', ids).order('position')) as RecipeIngredient[];
    const per = ids.map((id) => rows.filter((r) => r.recipe_id === id));
    const proposals = await loadProposalsMany(household!.id, per);
    const home = (ps: ListProposal<RecipeIngredient>[]) => new Set(ps.filter((p) => !p.add).map((p) => p.ingredient.id));
    return {
      ingredients: new Map(ids.map((id, k) => [id, per[k]])),
      atHome: new Map(ids.map((id, k) => [id, home(proposals[k])])),
    };
  }).data;
}

/** Partners who made this card a must-have, said as "{name} wants this". */
function useWantedBy(card: DeckCard, data: DeckData): string | null {
  const { t } = useI18n();
  const { memberName } = useSession();
  const who = data.partnerMusts.get(card.recipe_id);
  if (!who?.length) return null;
  return who.length === 1
    ? t('swipe.partnerWants', { name: memberName(who[0]) })
    : t('swipe.partnersWant', { names: who.map(memberName).join(' & ') });
}

/** The one glass badge a card may carry. */
function useBadge(card: DeckCard, data: DeckData) {
  const { t } = useI18n();
  const { userId, memberName } = useSession();
  const wanted = useWantedBy(card, data);
  // A partner's must-have says it loudest.
  if (wanted) return wanted;
  // The deck's tier says it best when it has something to say (logic/deck.ts).
  if (card.reason === 'treat') return t('swipe.treat');
  if (card.reason === 'wildcard') return t('swipe.wildcard');
  if (card.reason === 'season') return t('swipe.inSeason');
  if (card.reason === 'adjustable') return t('swipe.adjustable');
  if (card.reason?.startsWith('leans:')) {
    const who = card.reason.slice(6);
    return who === userId ? t('swipe.leansYou') : t('swipe.leansPartner', { name: memberName(who) });
  }
  const shared = data.deck.who_eating.length > 1;
  const fitsMe = data.fits.get(card.recipe_id)?.get(userId!) ?? data.portions.get(card.recipe_id)?.fits;
  if (shared) return card.fits_all ? t('swipe.perfectBoth') : null;
  return fitsMe ? t('swipe.perfectYou') : null;
}

/** The badge: a partner's must-have gets the star. */
function Badge({ card, data, className = '' }: { card: DeckCard; data: DeckData; className?: string }) {
  const badge = useBadge(card, data);
  if (!badge) return null;
  return data.partnerMusts.has(card.recipe_id)
    ? <span className={`glass-badge glass-badge--star ${className}`}><Icon name="star" filled size={14} />{badge}</span>
    : <span className={`glass-badge ${className}`}><span className="dot" />{badge}</span>;
}

function CardFace({ card, data, details, drag }: {
  card: DeckCard; data: DeckData; details: CardDetails | null; drag?: { dx: number; dy: number };
}) {
  const { t, locale } = useI18n();
  const r = card.recipe;
  const portion = data.portions.get(card.recipe_id);
  const plate = portion?.kcal != null ? { kcal: portion.kcal, protein_g: portion.protein_g ?? 0 } : null;
  const lines = details ? groupIngredients(details.ingredients.get(card.recipe_id) ?? []) : [];
  const home = details?.atHome.get(card.recipe_id);
  const homeCount = home ? lines.filter((g) => g.some((l) => home.has(l.id))).length : 0;

  const yes = drag ? Math.max(0, Math.min(1, drag.dx / SWIPE_X)) : 0;
  const pass = drag ? Math.max(0, Math.min(1, -drag.dx / SWIPE_X)) : 0;
  const mustHave = drag ? Math.max(0, Math.min(1, -drag.dy / SWIPE_UP)) * (Math.abs(drag.dx) < 60 ? 1 : 0) : 0;

  return (
    <>
      <div className="swipe-card__photo" style={imageStyle(r.image_path)}>
        {!imageStyle(r.image_path) && <span aria-hidden>{recipeEmoji(r.title, r.tags)}</span>}
        <Badge card={card} data={data} />
      </div>
      <div className="swipe-card__body">
        <h2 className="t-title-s m-0">{recipeTitle(r, locale)}</h2>
        <RecipeFacts recipe={r} plate={plate} max={3} />
        {homeCount > 0 && (
          <span className="row text-sage t-callout swipe-card__home">
            <Icon name="home" size={18} /> {t('swipe.atHome', { home: homeCount, n: lines.length })}
          </span>
        )}
      </div>
      <span className="swipe-card__stamp swipe-card__stamp--yes" style={{ opacity: yes }}>{t('swipe.yes')}</span>
      <span className="swipe-card__stamp swipe-card__stamp--pass" style={{ opacity: pass }}>{t('swipe.pass')}</span>
      <span className="swipe-card__stamp swipe-card__stamp--must" style={{ opacity: mustHave }}>{t('swipe.must')}</span>
    </>
  );
}

/** Undo, pass, like, indispensable: the same row under the card and over the expanded recipe. */
function Actions({ onDecide, onUndo, canUndo }: { onDecide: (v: Verdict) => void; onUndo: () => void; canUndo: boolean }) {
  const { t } = useI18n();
  return (
    <div className="swipe-actions">
      <button type="button" className="swipe-btn swipe-btn--small" aria-label={t('swipe.undo')} disabled={!canUndo} onClick={onUndo}>
        <Icon name="undo" size={20} />
      </button>
      <button type="button" className="swipe-btn" aria-label={t('swipe.pass')} onClick={() => onDecide('pass')}>
        <Icon name="x" size={26} strokeWidth={2.4} />
      </button>
      <button type="button" className="swipe-btn swipe-btn--like" aria-label={t('swipe.yes')} onClick={() => onDecide('yes')}>
        <Icon name="heart" filled size={28} />
      </button>
      <button type="button" className="swipe-btn swipe-btn--small swipe-btn--star" aria-label={t('swipe.must')} onClick={() => onDecide('must')}>
        <Icon name="star" filled size={20} />
      </button>
    </div>
  );
}

/** Where a card ends up when it leaves for a verdict: the way it was dragged, or straight out. */
function offFor(verdict: Verdict, drag: { dx: number; dy: number } | null) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (verdict === 'must') return { x: drag?.dx ?? 0, y: -h * 1.15, r: 0 };
  const sign = verdict === 'yes' ? 1 : -1;
  const x = sign * (w * 1.15 + 120);
  // Keep the angle of the throw, a little upward when there was none.
  const y = drag && Math.abs(drag.dx) > 1 ? Math.max(-h / 2, Math.min(h / 2, (drag.dy * x) / drag.dx)) : -40;
  return { x, y, r: sign * 22 };
}

const without = (s: Set<string>, id: string) => {
  const next = new Set(s);
  next.delete(id);
  return next;
};

type Role = 'top' | 'peek' | 'leaving';

export function SwipeView({ data, onDone }: { data: DeckData; onDone: () => Promise<void> }) {
  const { t, locale } = useI18n();
  const { userId, household, partners, memberName, memberColor } = useSession();
  const eveningName = useEveningName();
  const plateOf = (id: string) => {
    const p = data.portions.get(id);
    return p?.kcal != null ? { kcal: p.kcal, protein_g: p.protein_g ?? 0 } : null;
  };
  const details = useCardDetails(data) ?? null;
  const [swiped, setSwiped] = useState<Set<string>>(() => new Set(data.mySwipes.map((s) => s.recipe_id)));
  // Choices made on this screen, newest last: what undo takes back (and which way it comes back from).
  const [history, setHistory] = useState<{ id: string; verdict: Verdict }[]>([]);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [leaving, setLeaving] = useState<{ id: string; verdict: Verdict; x: number; y: number; r: number; from: { dx: number; dy: number } } | null>(null);
  // A card undo is bringing back, flying in from where it left.
  const [returning, setReturning] = useState<{ id: string; x: number; y: number; r: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  // Saves that failed: their card is already back, so undo must not take back another.
  const failed = useRef(new Set<string>());

  // Fetch every card's photo up front, so each card shows at once when it comes to the top.
  useEffect(() => {
    for (const c of data.cards) {
      const url = photoUrl(c.recipe.image_path);
      if (url) new Image().src = url;
    }
  }, [data.cards]);

  // A partner's must-haves come first, in deck order.
  const ordered = useMemo(() => {
    const wanted = (c: DeckCard) => data.partnerMusts.has(c.recipe_id);
    return [...data.cards.filter(wanted), ...data.cards.filter((c) => !wanted(c))];
  }, [data.cards, data.partnerMusts]);
  // The card on top stays on top when a partner's must-have arrives mid-deck.
  const [pinned, setPinned] = useState<string | null>(null);
  let remaining = ordered.filter((c) => !swiped.has(c.recipe_id));
  const at = remaining.findIndex((c) => c.recipe_id === pinned);
  if (at > 0) remaining = [remaining[at], ...remaining.slice(0, at), ...remaining.slice(at + 1)];
  if ((remaining[0]?.recipe_id ?? null) !== pinned) setPinned(remaining[0]?.recipe_id ?? null);
  const top = remaining[0];
  const total = data.cards.length;
  const done = total - remaining.length;

  // Saves (and undos) run one at a time, in order: the server counts each member's
  // swipes to tell when they are done, and parallel inserts could each miss the other.
  const queue = useRef<Promise<void>>(Promise.resolve());

  /** Saves a verdict in the background; on failure the card comes back. */
  const save = (recipeId: string, verdict: Verdict): Promise<void> => {
    const run = queue.current.then(async () => {
      for (let attempt = 0; ; attempt++) {
        const { error: err } = await supabase.from('swipes')
          .insert({ deck_id: data.deck.id, recipe_id: recipeId, user_id: userId, verdict })
          .abortSignal(timeoutSignal(SAVE_TIMEOUT_MS));
        // A duplicate means this card was already swiped (e.g. on another device).
        if (!err || err.code === '23505') return;
        if (attempt === SAVE_RETRIES) throw err;
        await new Promise((r) => window.setTimeout(r, 1000 * 2 ** attempt));
      }
    }).catch(() => {
      failed.current.add(recipeId);
      setSwiped((s) => without(s, recipeId));
      setHistory((h) => h.filter((x) => x.id !== recipeId));
      toast(t('app.error'));
    });
    queue.current = run;
    return run;
  };

  const decide = (verdict: Verdict) => {
    if (!top || leaving) return;
    const from = drag ?? { dx: 0, dy: 0 };
    setExpanded(false);
    setReturning(null);
    setLeaving({ id: top.recipe_id, verdict, from, ...offFor(verdict, drag) });
    setDrag(null);
    navigator.vibrate?.(verdict === 'must' ? [8, 40, 14] : 10);
    failed.current.delete(top.recipe_id);
    const saved = save(top.recipe_id, verdict);
    const last = remaining.length === 1;
    window.setTimeout(() => {
      setSwiped((s) => new Set(s).add(top.recipe_id));
      setHistory((h) => [...h, { id: top.recipe_id, verdict }]);
      setLeaving(null);
      if (last) void saved.then(onDone);
    }, verdict === 'must' ? FAV_MS : LEAVE_MS);
  };

  const undo = async () => {
    const last = history.at(-1);
    if (!last || undoing || leaving) return;
    setUndoing(true);
    // Bring it back at once; the server catches up behind.
    setPinned(last.id);
    setHistory((h) => h.slice(0, -1));
    setSwiped((s) => without(s, last.id));
    setReturning({ id: last.id, ...offFor(last.verdict, null) });
    navigator.vibrate?.(8);
    const run = queue.current.then(async (): Promise<{ back: unknown; error: unknown }> => {
      if (failed.current.has(last.id)) return { back: last.id, error: null };
      const { data: back, error } = await supabase.rpc('undo_swipe', { p_deck: data.deck.id });
      return { back, error };
    }).catch((error: unknown) => ({ back: null, error }));
    queue.current = run.then(() => undefined);
    const { back, error } = await run;
    setUndoing(false);
    if (error || !back) {
      setSwiped((s) => new Set(s).add(last.id));
      setHistory((h) => [...h, last]);
      setReturning(null);
      toast(t('app.error'));
      return;
    }
    if (back !== last.id) {
      // The server took back a different choice (made on another device): show that one instead.
      setSwiped((s) => without(new Set(s).add(last.id), back as string));
      setHistory((h) => [...h.filter((x) => x.id !== back), last]);
      setReturning(null);
      setPinned(back as string);
    }
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (leaving) return;
    setReturning(null);
    start.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!start.current) return;
    setDrag({ dx: e.clientX - start.current.x, dy: e.clientY - start.current.y });
  };
  const onPointerUp = () => {
    if (!start.current) return;
    start.current = null;
    if (!drag || (Math.abs(drag.dx) < TAP && Math.abs(drag.dy) < TAP)) {
      setDrag(null);
      setExpanded(true);
      return;
    }
    if (drag.dy < -SWIPE_UP && Math.abs(drag.dx) < 60) decide('must');
    else if (drag.dx > SWIPE_X) decide('yes');
    else if (drag.dx < -SWIPE_X) decide('pass');
    else setDrag(null);
  };

  // How far the top card is towards a verdict, 0..1: the card behind rises with it.
  const pull = drag ? Math.min(1, Math.max(Math.abs(drag.dx) / SWIPE_X, -drag.dy / SWIPE_UP, 0)) : 0;

  const cardStyle = (id: string, role: Role): CSSProperties | undefined => {
    if (role === 'leaving' && leaving) {
      if (leaving.verdict === 'must') {
        return { '--fx': `${leaving.from.dx}px`, '--fy': `${leaving.from.dy}px`, '--fr': `${leaving.from.dx / 20}deg` } as CSSProperties;
      }
      return { transform: `translate(${leaving.x}px, ${leaving.y}px) rotate(${leaving.r}deg)` };
    }
    if (role === 'top' && drag && id === top?.recipe_id) {
      return { transform: `translate(${drag.dx}px, ${drag.dy}px) rotate(${drag.dx / 20}deg)` };
    }
    if (role === 'top' && returning?.id === id) {
      return { '--fx': `${returning.x}px`, '--fy': `${returning.y}px`, '--fr': `${returning.r}deg` } as CSSProperties;
    }
    if (role === 'peek' && pull > 0) {
      return { transform: `translateY(${10 - 6 * pull}px) scale(${0.95 + 0.03 * pull})` };
    }
    return undefined;
  };

  const people = [userId!, ...partners.map((p) => p.user_id)].filter((id) => data.deck.who_eating.includes(id))
    .map((id) => ({ id, name: memberName(id), color: memberColor(id) }));
  const canUndo = history.length > 0 && !undoing && !leaving;

  // While a card leaves, the next one is already rising into its place and a new one slides in behind.
  const stack = remaining.slice(0, leaving ? 3 : 2).map((card, k): [DeckCard, Role] =>
    [card, k === 0 ? (leaving ? 'leaving' : 'top') : k === 1 && leaving ? 'top' : 'peek']);
  // The stamp a card leaves with, even when a button sent it.
  const leaveTilt = leaving && (leaving.verdict === 'must' ? { dx: 0, dy: -SWIPE_UP }
    : { dx: leaving.verdict === 'yes' ? SWIPE_X : -SWIPE_X, dy: 0 });

  return (
    <main className="screen swipe-screen">
      <TabHeader overline={t('swipe.progress', { n: Math.min(done + 1, total), total })} title={eveningName(data.deck.for_date, todayIn(household!.timezone))}
        right={<AvatarPair people={people} />} />
      <div className="segments" aria-hidden>
        {data.cards.map((c, k) => <span key={c.recipe_id} className={k < done ? 'segments__on' : undefined} />)}
      </div>

      <div className="deck">
        {stack.slice().reverse().map(([card, role]) => {
          const interactive = role === 'top' && !leaving;
          const classes = ['swipe-card'];
          if (role === 'peek') classes.push('swipe-card--peek');
          if (data.partnerMusts.has(card.recipe_id)) classes.push('swipe-card--wanted');
          if (role === 'top' && drag) classes.push('swipe-card--dragging');
          if (role === 'top' && returning?.id === card.recipe_id) classes.push('swipe-card--return');
          if (role === 'leaving') classes.push(leaving?.verdict === 'must' ? 'swipe-card--fav' : 'swipe-card--leaving');
          return (
            <article
              key={card.recipe_id}
              className={classes.join(' ')}
              style={cardStyle(card.recipe_id, role)}
              aria-hidden={!interactive}
              onPointerDown={interactive ? onPointerDown : undefined}
              onPointerMove={interactive ? onPointerMove : undefined}
              onPointerUp={interactive ? onPointerUp : undefined}
              onPointerCancel={interactive ? () => { start.current = null; setDrag(null); } : undefined}
              onAnimationEnd={(e) => {
                if (e.target === e.currentTarget && e.animationName === 'card-return') setReturning(null);
              }}
            >
              <CardFace card={card} data={data} details={details}
                drag={role === 'leaving' ? leaveTilt || undefined : role === 'top' ? drag ?? undefined : undefined} />
              {role === 'leaving' && leaving?.verdict === 'must' && <span className="swipe-card__shimmer" aria-hidden />}
            </article>
          );
        })}
      </div>

      <Actions onDecide={decide} onUndo={() => void undo()} canUndo={canUndo} />

      {expanded && top && (
        <div className="expanded" role="dialog" aria-modal="true" aria-label={recipeTitle(top.recipe, locale)}>
          <div className="expanded__scroll">
            <div className="recipe-photo" style={imageStyle(top.recipe.image_path)}>
              {!imageStyle(top.recipe.image_path) && <span aria-hidden>{recipeEmoji(top.recipe.title, top.recipe.tags)}</span>}
              <button type="button" className="icon-btn icon-btn--glass recipe-photo__left" aria-label={t('swipe.collapse')} onClick={() => setExpanded(false)}>
                <Icon name="caret" />
              </button>
              <ExpandedBadge card={top} data={data} />
            </div>
            <div className="recipe-sheet">
              <RecipeBody recipe={top.recipe} ingredients={details?.ingredients.get(top.recipe_id) ?? []}
                atHome={details?.atHome.get(top.recipe_id)} plate={plateOf(top.recipe_id)} />
            </div>
          </div>
          <div className="expanded__actions">
            <Actions onDecide={decide} onUndo={() => { setExpanded(false); void undo(); }} canUndo={canUndo} />
          </div>
        </div>
      )}
    </main>
  );
}

function ExpandedBadge({ card, data }: { card: DeckCard; data: DeckData }) {
  return <Badge card={card} data={data} className="recipe-photo__badge" />;
}
