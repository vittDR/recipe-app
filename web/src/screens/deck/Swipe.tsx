import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '../../components/Icon.tsx';
import { Tag, imageStyle, recipeEmoji } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useSession } from '../../lib/session.tsx';
import { supabase } from '../../lib/supabase.ts';
import type { DeckCard, Verdict } from '../../lib/types.ts';
import type { DeckData } from './data.ts';

const SWIPE_X = 100;
const SWIPE_UP = 120;

function CardFace({ card, data, drag }: { card: DeckCard; data: DeckData; drag?: { dx: number; dy: number } }) {
  const { t } = useI18n();
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
        <h2 className="title2">{r.title}</h2>
        <div className="row row--wrap">
          {r.total_min && <Tag><Icon name="clock" size={14} /> {t('swipe.minutes', { n: r.total_min })}</Tag>}
          {shared && card.fits_all && <Tag tone="success">{t('swipe.fitsBoth')}</Tag>}
          {!(shared && card.fits_all) && fitsMe && <Tag tone="success">{t('swipe.fitsYou')}</Tag>}
          {fitsMe === false && <Tag>{t('swipe.notFit')}</Tag>}
          {r.tags.slice(0, 2).map((tag) => <Tag key={tag}>{tag}</Tag>)}
        </div>
        {plate?.kcal != null && (
          <div className="macros">
            <span className="macros__label">{t('swipe.yourPlate')}</span>
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
  const { userId } = useSession();
  const navigate = useNavigate();
  const [swiped, setSwiped] = useState<Set<string>>(() => new Set(data.mySwipes.map((s) => s.recipe_id)));
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [leaving, setLeaving] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const remaining = data.cards.filter((c) => !swiped.has(c.recipe_id));
  const top = remaining[0];
  const total = data.cards.length;
  const done = total - remaining.length;

  const decide = async (verdict: Verdict) => {
    if (!top || leaving) return;
    const off = verdict === 'yes' ? { dx: 600, dy: 0 } : verdict === 'pass' ? { dx: -600, dy: 0 } : { dx: 0, dy: -800 };
    setLeaving({ id: top.recipe_id, ...off });
    setDrag(null);
    navigator.vibrate?.(10);
    const { error: err } = await supabase.from('swipes')
      .insert({ deck_id: data.deck.id, recipe_id: top.recipe_id, user_id: userId, verdict });
    // A duplicate means this card was already swiped (e.g. on another device).
    if (err && err.code !== '23505') {
      setError(t('app.error'));
      setLeaving(null);
      return;
    }
    window.setTimeout(() => {
      setSwiped((s) => new Set(s).add(top.recipe_id));
      setLeaving(null);
      if (remaining.length === 1) void onDone();
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
    if (drag.dy < -SWIPE_UP && Math.abs(drag.dx) < 60) void decide('must');
    else if (drag.dx > SWIPE_X) void decide('yes');
    else if (drag.dx < -SWIPE_X) void decide('pass');
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
              <CardFace card={card} data={data} drag={isTop ? drag ?? undefined : undefined} />
            </article>
          );
        })}
      </div>

      {error && <p className="notice">{error}</p>}
      <div className="swipe-actions">
        <button type="button" className="btn btn--round btn--lg pass" aria-label={t('swipe.pass')} onClick={() => void decide('pass')}>
          <Icon name="x" size={30} strokeWidth={2.5} />
        </button>
        <button type="button" className="btn btn--round must" aria-label={t('swipe.must')} onClick={() => void decide('must')}>
          <Icon name="star" size={26} />
        </button>
        <button type="button" className="btn btn--round btn--lg yes" aria-label={t('swipe.yes')} onClick={() => void decide('yes')}>
          <Icon name="heart" size={30} strokeWidth={2.5} />
        </button>
      </div>
    </main>
  );
}
