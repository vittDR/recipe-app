import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { ListProposal } from '@logic/groceries.ts';
import { PASS_REASONS, type PassReason } from '@logic/profile.ts';
import { loadProposalsMany } from '../../components/AddToListSheet.tsx';
import { Icon } from '../../components/Icon.tsx';
import { RecipeBody, RecipeFacts } from '../../components/RecipeBody.tsx';
import { AvatarPair, Chip, TabHeader, imageStyle, photoUrl, recipeEmoji, toast } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useLive } from '../../lib/hooks.ts';
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

/** The one glass badge a card may carry. */
function useBadge(card: DeckCard, data: DeckData) {
  const { t } = useI18n();
  const { userId } = useSession();
  const shared = data.deck.who_eating.length > 1;
  const fitsMe = data.fits.get(card.recipe_id)?.get(userId!) ?? data.portions.get(card.recipe_id)?.fits;
  if (shared) return card.fits_all ? t('swipe.perfectBoth') : null;
  return fitsMe ? t('swipe.perfectYou') : null;
}

function CardFace({ card, data, details, drag }: {
  card: DeckCard; data: DeckData; details: CardDetails | null; drag?: { dx: number; dy: number };
}) {
  const { t, locale } = useI18n();
  const r = card.recipe;
  const portion = data.portions.get(card.recipe_id);
  const plate = portion?.kcal != null ? { kcal: portion.kcal, protein_g: portion.protein_g ?? 0 } : null;
  const badge = useBadge(card, data);
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
        {badge && <span className="glass-badge"><span className="dot" />{badge}</span>}
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

export function SwipeView({ data, onDone }: { data: DeckData; onDone: () => Promise<void> }) {
  const { t, locale } = useI18n();
  const { userId, partners, memberName, memberColor } = useSession();
  const plateOf = (id: string) => {
    const p = data.portions.get(id);
    return p?.kcal != null ? { kcal: p.kcal, protein_g: p.protein_g ?? 0 } : null;
  };
  const details = useCardDetails(data) ?? null;
  const [swiped, setSwiped] = useState<Set<string>>(() => new Set(data.mySwipes.map((s) => s.recipe_id)));
  // Choices made on this screen, newest last: what undo takes back.
  const [history, setHistory] = useState<string[]>([]);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [leaving, setLeaving] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [undoing, setUndoing] = useState(false);
  // The card just passed on, to say why if the person wants to (optional, never blocks swiping).
  const [lastPass, setLastPass] = useState<{ recipeId: string; reason: PassReason | null } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  // Fetch every card's photo up front, so each card shows at once when it comes to the top.
  useEffect(() => {
    for (const c of data.cards) {
      const url = photoUrl(c.recipe.image_path);
      if (url) new Image().src = url;
    }
  }, [data.cards]);

  const remaining = data.cards.filter((c) => !swiped.has(c.recipe_id));
  const top = remaining[0];
  const total = data.cards.length;
  const done = total - remaining.length;

  // Saves run one at a time, in order: the server counts each member's swipes
  // to tell when they are done, and parallel inserts could each miss the other.
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
      setSwiped((s) => {
        const next = new Set(s);
        next.delete(recipeId);
        return next;
      });
      setHistory((h) => h.filter((id) => id !== recipeId));
      toast(t('app.error'));
    });
    queue.current = run;
    return run;
  };

  const decide = (verdict: Verdict) => {
    if (!top || leaving) return;
    const off = verdict === 'yes' ? { dx: 600, dy: 0 } : verdict === 'pass' ? { dx: -600, dy: 0 } : { dx: 0, dy: -800 };
    setExpanded(false);
    setLeaving({ id: top.recipe_id, ...off });
    setDrag(null);
    setLastPass(verdict === 'pass' ? { recipeId: top.recipe_id, reason: null } : null);
    navigator.vibrate?.(10);
    const saved = save(top.recipe_id, verdict);
    const last = remaining.length === 1;
    window.setTimeout(() => {
      setSwiped((s) => new Set(s).add(top.recipe_id));
      setHistory((h) => [...h, top.recipe_id]);
      setLeaving(null);
      if (last) void saved.then(onDone);
    }, 220);
  };

  const undo = async () => {
    if (!history.length || undoing) return;
    setUndoing(true);
    setLastPass(null);
    await queue.current;
    const { data: back, error } = await supabase.rpc('undo_swipe', { p_deck: data.deck.id });
    setUndoing(false);
    if (error || !back) {
      toast(t('app.error'));
      return;
    }
    setHistory((h) => h.filter((id) => id !== back));
    setSwiped((s) => {
      const next = new Set(s);
      next.delete(back as string);
      return next;
    });
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!start.current) return;
    setDrag({ dx: e.clientX - start.current.x, dy: e.clientY - start.current.y });
  };
  const onPointerUp = () => {
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

  const transformFor = (id: string) => {
    if (leaving?.id === id) return `translate(${leaving.dx}px, ${leaving.dy}px) rotate(${leaving.dx / 20}deg)`;
    if (drag && top?.recipe_id === id) return `translate(${drag.dx}px, ${drag.dy}px) rotate(${drag.dx / 20}deg)`;
    return undefined;
  };

  const people = [userId!, ...partners.map((p) => p.user_id)].filter((id) => data.deck.who_eating.includes(id))
    .map((id) => ({ id, name: memberName(id), color: memberColor(id) }));
  const canUndo = history.length > 0 && !undoing;

  return (
    <main className="screen swipe-screen">
      <TabHeader overline={t('swipe.progress', { n: Math.min(done + 1, total), total })} title={t('tonight.title')}
        right={<AvatarPair people={people} />} />
      <div className="segments" aria-hidden>
        {data.cards.map((c, k) => <span key={c.recipe_id} className={k < done ? 'segments__on' : undefined} />)}
      </div>

      <div className="deck">
        {remaining.slice(0, 2).reverse().map((card, i, arr) => {
          const isTop = i === arr.length - 1;
          return (
            <article
              key={card.recipe_id}
              className={`swipe-card${isTop ? '' : ' swipe-card--peek'}`}
              style={{
                transform: transformFor(card.recipe_id),
                transition: drag && isTop ? 'none' : 'transform 0.25s ease, opacity 0.25s ease',
              }}
              aria-hidden={!isTop}
              onPointerDown={isTop ? onPointerDown : undefined}
              onPointerMove={isTop ? onPointerMove : undefined}
              onPointerUp={isTop ? onPointerUp : undefined}
              onPointerCancel={isTop ? () => { start.current = null; setDrag(null); } : undefined}
            >
              {isTop && <CardFace card={card} data={data} details={details} drag={drag ?? undefined} />}
            </article>
          );
        })}
      </div>

      <div className="swipe-why" aria-label={t('swipe.why')}>
        {lastPass && (
          <div className="chips chips--scroll">
            {PASS_REASONS.map((reason) => (
              <Chip key={reason} pressed={lastPass.reason === reason} onClick={() => {
                setLastPass({ ...lastPass, reason });
                // Saved after the swipe itself, which the reason belongs to.
                void queue.current.then(() => supabase.from('taste_signals').upsert(
                  { user_id: userId, recipe_id: lastPass.recipeId, kind: 'reason', value: reason, deck_id: data.deck.id },
                  { onConflict: 'user_id,key' },
                ));
              }}>{t(`swipe.reasons.${reason}`)}</Chip>
            ))}
          </div>
        )}
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
  const badge = useBadge(card, data);
  return badge ? <span className="glass-badge recipe-photo__badge"><span className="dot" />{badge}</span> : null;
}
