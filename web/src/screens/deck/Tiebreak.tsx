import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '../../components/Icon.tsx';
import { Avatar, Button, RecipeThumb, Tag } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useLive, useSave } from '../../lib/hooks.ts';
import { recipeTitle } from '../../lib/recipeText.ts';
import { useSession } from '../../lib/session.tsx';
import { must, supabase } from '../../lib/supabase.ts';
import type { DeckData } from './data.ts';

interface Option {
  recipe_id: string;
  votes: number;
  score: number;
  liked_by: string[] | null;
}

/**
 * No recipe got everyone's yes: the three closest calls (Must-have counts
 * double). Same pick wins, otherwise the best fit for everyone; or deal again.
 */
export function TiebreakView({ data }: { data: DeckData }) {
  const { t, locale } = useI18n();
  const { userId, memberName, memberColor } = useSession();
  const navigate = useNavigate();
  const save = useSave();
  const [busy, setBusy] = useState(false);
  const deckId = data.deck.id;
  // The partner's pick shows up live.
  const { data: live, set } = useLive<{ options: Option[]; picks: { user_id: string; recipe_id: string }[] }>(`tiebreak:${deckId}`, async () => {
    const [o, p] = await Promise.all([
      supabase.rpc('tiebreak_options', { p_deck: deckId }),
      supabase.from('tiebreak_picks').select('user_id, recipe_id').eq('deck_id', deckId),
    ]);
    return { options: must(o) as Option[], picks: must(p) as { user_id: string; recipe_id: string }[] };
  }, [{ table: 'tiebreak_picks', filter: `deck_id=eq.${deckId}` }]);
  const options = live?.options ?? [];
  const picks = live?.picks ?? [];

  const myPick = picks.find((p) => p.user_id === userId)?.recipe_id;
  const waitingFor = data.deck.who_eating.filter((u) => u !== userId && !picks.some((p) => p.user_id === u));

  const pick = async (recipeId: string) => {
    setBusy(true);
    if (await save(supabase.from('tiebreak_picks').upsert({ deck_id: deckId, user_id: userId, recipe_id: recipeId }))) {
      set((d) => d && { ...d, picks: [...d.picks.filter((p) => p.user_id !== userId), { user_id: userId!, recipe_id: recipeId }] });
    }
    setBusy(false);
  };

  // Closing the deck frees the evening: Ce soir offers a new one.
  const fresh = async () => {
    if (await save(supabase.rpc('close_deck', { p_deck: deckId }))) navigate('/', { replace: true });
  };

  return (
    <main className="screen moment">
      <button type="button" className="icon-btn icon-btn--filled moment__close" aria-label={t('app.close')} onClick={() => navigate('/')}>
        <Icon name="x" />
      </button>
      <div className="moment__head moment__head--art">
        <div className="no-match-art" aria-hidden>
          <span className="fan fan--left" /><span className="fan fan--right" />
          <span className="no-match-art__x"><Icon name="x" size={22} strokeWidth={2.4} /></span>
        </div>
        <h1 className="t-title-m m-0">{t('tiebreak.title')}</h1>
        <p className="t-callout muted m-0">{t('tiebreak.subtitle')}</p>
      </div>

      <div className="list">
        {options.map((o) => {
          const card = data.cards.find((c) => c.recipe_id === o.recipe_id);
          if (!card) return null;
          const mine = myPick === o.recipe_id;
          const pickers = picks.filter((p) => p.recipe_id === o.recipe_id && p.user_id !== userId).map((p) => p.user_id);
          return (
            <div key={o.recipe_id} className={`list-row option${mine ? ' option--picked' : ''}`}>
              <span className="row-thumb"><RecipeThumb recipe={card.recipe} /></span>
              <span className="list-row__main">
                <span className="list-row__title headline">{recipeTitle(card.recipe, locale)}</span>
                <span className="row option__likes">
                  {(o.liked_by ?? []).map((u) => <Avatar key={u} name={memberName(u)} color={memberColor(u)} size="sm" />)}
                  {pickers.map((u) => <Tag key={u} tone="iris"><Icon name="check" size={12} /> {memberName(u)}</Tag>)}
                </span>
              </span>
              <Button small variant={mine ? 'primary' : 'secondary'} disabled={busy} onClick={() => void pick(o.recipe_id)}>
                {mine ? <><Icon name="check" size={16} /> {t('tiebreak.picked')}</> : t('tiebreak.pick')}
              </Button>
            </div>
          );
        })}
      </div>
      {myPick && waitingFor.length > 0 && (
        <p className="t-callout text-iris center">{t('tiebreak.waiting', { name: waitingFor.map(memberName).join(', ') })}</p>
      )}
      <div className="moment__actions">
        <Button variant="text" onClick={() => void fresh()}>{t('tiebreak.fresh')}</Button>
      </div>
    </main>
  );
}
