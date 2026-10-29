import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '../../components/Icon.tsx';
import { Tag, imageStyle, photoUrl, recipeEmoji } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { recipeTitle } from '../../lib/recipeText.ts';
import { useSession } from '../../lib/session.tsx';
import { supabase } from '../../lib/supabase.ts';
import { useTags } from '../../lib/tags.ts';
import type { DeckCard, Verdict } from '../../lib/types.ts';
import type { TagCatalog } from '@logic/tags.ts';
import type { DeckData } from './data.ts';

const SWIPE_X = 100;
const SWIPE_UP = 120;
const SAVE_TIMEOUT_MS = 15_000;
const SAVE_RETRIES = 2;

/** Aborts a request that hangs, so a stalled connection fails fast and is retried. */
function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  const ctrl = new AbortController();
  window.setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

function CardFace({ card, data, tags, drag }: {
  card: DeckCard; data: DeckData; tags: TagCatalog | null; drag?: { dx: number; dy: number };
}) {
  const { t, tn, locale } = useI18n();
  const { userId } = useSession();
  const r = card.recipe;
  const plate = data.portions.get(card.recipe_id);
  const shared = data.deck.who_eating.length > 1;
  const fitsMe = data.fits.get(card.recipe_id)?.get(userId!) ?? plate?.fits;
  const pantryItem = card.reason?.startsWith('pantry:') ? card.reason.slice(7) : null;

  const yes = drag ? Math.max(0, Math.min(1, drag.dx / SWIPE_X)) : 0;
  const pass = drag ? Math.max(0, Math.min(1, -drag.dx / SWIPE_X)) : 0;
  const must = drag ? Math.max(0, Math.min(1, -drag.dy / SWIPE_UP)) * (Math.abs(drag.dx) < 60 ? 1 : 0) : 0;

  return (
    <>
      <div className="recipe-card__image" style={imageStyle(r.image_path)}>
        {!imageStyle(r.image_path) && <span aria-hidden>{recipeEmoji(r.title, r.tags)}</span>}
      </div>
      <div className="recipe-card__body">
        <h2 className="title2">{recipeTitle(r, locale)}</h2>
        <div className="row row--wrap">
          {r.total_min && <Tag><Icon name="clock" size={14} /> {t('swipe.minutes', { n: r.total_min })}</Tag>}
          {shared && card.fits_all && <Tag tone="success">{t('swipe.fitsBoth')}</Tag>}
          {!(shared && card.fits_all) && fitsMe && <Tag tone="success">{t('swipe.fitsYou')}</Tag>}
          {fitsMe === false && <Tag>{t('swipe.notFit')}</Tag>}
          {r.tags.slice(0, 2).map((tag) => <Tag key={tag}>{tags?.label(tag, locale) ?? tag}</Tag>)}
        </div>
        {plate?.kcal != null && (
          <div className="macros">
            <span className="macros__label">{t('swipe.yourPlate')}{plate.servings != null && plate.servings !== 1 && ` · ${tn('recipe.servings', plate.servings)}`}</span>
            <span><strong>{plate.kcal}</strong> kcal</span>
            <span><strong>{plate.protein_g}</strong> g {t('swipe.protein')}</span>
            {r.macros_estimated && <span className="muted small">({t('swipe.estimated')})</span>}
          </div>
        )}
        {pantryItem && <span className="small" style={{ color: 'var(--c-success)' }}>{t('swipe.pantry', { item: pantryItem })}</span>}
        {card.reason === 'love' && <span className="small" style={{ color: 'var(--c-accent)' }}>{t('swipe.loved')}</span>}
      </div>
      <span className="recipe-card__stamp recipe-card__stamp--yes" style={{ opacity: yes }}>{t('swipe.yes')}</span>
      <span className="recipe-card__stamp recipe-card__stamp--pass" style={{ opacity: pass }}>{t('swipe.pass')}</span>
      <span className="recipe-card__stamp recipe-card__stamp--must" style={{ opacity: must }}>{t('swipe.must')}</span>
    </>
  );
}

export function SwipeView({ data, onDone }: { data: DeckData; onDone: () => Promise<void> }) {
  const { t } = useI18n();
  const { userId, household } = useSession();
  const { tags } = useTags(household!.id);
  const navigate = useNavigate();
  const [swiped, setSwiped] = useState<Set<string>>(() => new Set(data.mySwipes.map((s) => s.recipe_id)));
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [leaving, setLeaving] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      setError(t('app.error'));
    });
    queue.current = run;
    return run;
  };

  const decide = (verdict: Verdict) => {
    if (!top || leaving) return;
    const off = verdict === 'yes' ? { dx: 600, dy: 0 } : verdict === 'pass' ? { dx: -600, dy: 0 } : { dx: 0, dy: -800 };
    setLeaving({ id: top.recipe_id, ...off });
    setDrag(null);
    setError(null);
    navigator.vibrate?.(10);
    const saved = save(top.recipe_id, verdict);
    const last = remaining.length === 1;
    window.setTimeout(() => {
      setSwiped((s) => new Set(s).add(top.recipe_id));
      setLeaving(null);
      if (last) void saved.then(onDone);
    }, 220);
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
    if (!drag) return;
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

  return (
    <main className="screen">
      <div className="screen__bar">
        <button type="button" className="icon-btn" aria-label={t('app.close')} onClick={() => navigate('/')}>
          <Icon name="x" />
        </button>
        <span className="headline">{t('swipe.progress', { n: Math.min(done + 1, total), total })}</span>
        <span style={{ width: 44 }} />
      </div>
      <div className="progress" aria-hidden><div style={{ width: `${(done / total) * 100}%` }} /></div>

      <div className="deck">
        {remaining.slice(0, 3).reverse().map((card, i, arr) => {
          const depth = arr.length - 1 - i;
          const isTop = depth === 0;
          return (
            <article
              key={card.recipe_id}
              className={`recipe-card${depth === 1 ? ' recipe-card--peek' : depth === 2 ? ' recipe-card--peek2' : ''}`}
              style={{
                transform: transformFor(card.recipe_id),
                transition: drag && isTop ? 'none' : 'transform 0.25s ease, opacity 0.25s ease',
              }}
              aria-hidden={!isTop}
              onPointerDown={isTop ? onPointerDown : undefined}
              onPointerMove={isTop ? onPointerMove : undefined}
              onPointerUp={isTop ? onPointerUp : undefined}
              onPointerCancel={isTop ? () => { start.current = null; setDrag(null); } : undefined}
              onDoubleClick={isTop ? () => navigate(`/recipes/${card.recipe_id}`) : undefined}
            >
              <CardFace card={card} data={data} tags={tags} drag={isTop ? drag ?? undefined : undefined} />
            </article>
          );
        })}
      </div>

      {error && <p className="notice">{error}</p>}
      <div className="swipe-actions">
        <button type="button" className="btn btn--round btn--lg pass" aria-label={t('swipe.pass')} onClick={() => decide('pass')}>
          <Icon name="x" size={30} strokeWidth={2.5} />
        </button>
        <button type="button" className="btn btn--round must" aria-label={t('swipe.must')} onClick={() => decide('must')}>
          <Icon name="star" size={26} />
        </button>
        <button type="button" className="btn btn--round btn--lg yes" aria-label={t('swipe.yes')} onClick={() => decide('yes')}>
          <Icon name="heart" size={30} strokeWidth={2.5} />
        </button>
      </div>
    </main>
  );
}
