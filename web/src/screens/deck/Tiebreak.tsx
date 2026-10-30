import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '../../components/Icon.tsx';
import { Button, RecipeThumb, Screen } from '../../components/ui.tsx';
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

export function TiebreakView({ data }: { data: DeckData }) {
  const { t, locale } = useI18n();
  const { userId, memberName } = useSession();
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

  const fresh = async () => {
    if (await save(supabase.rpc('close_deck', { p_deck: deckId }))) navigate('/', { replace: true });
  };

  return (
    <Screen back="/" title={t('tiebreak.title')} subtitle={t('tiebreak.subtitle')}>
      <div className="stack">
        {options.map((o) => {
          const card = data.cards.find((c) => c.recipe_id === o.recipe_id);
          if (!card) return null;
          const mine = myPick === o.recipe_id;
          return (
            <div key={o.recipe_id} className={`card card--flush${mine ? ' card--picked' : ''}`}>
              <div className="row option-row">
                <div className="tile__image option-row__image">
                  <RecipeThumb recipe={card.recipe} />
                </div>
                <div className="list-row__main stack-lines">
                  <span className="headline">{recipeTitle(card.recipe, locale)}</span>
                  <span className="small muted">
                    {t('tiebreak.liked', { names: (o.liked_by ?? []).map((u) => (u === userId ? t('app.you') : memberName(u))).join(', ') })}
                  </span>
                </div>
                <Button small variant={mine ? 'primary' : 'secondary'} disabled={busy} onClick={() => void pick(o.recipe_id)}>
                  {mine ? <><Icon name="check" size={16} /> {t('tiebreak.picked')}</> : t('tiebreak.pick')}
                </Button>
              </div>
            </div>
          );
        })}
        {myPick && waitingFor.length > 0 && (
          <p className="muted center">{t('tiebreak.waiting', { name: waitingFor.map(memberName).join(', ') })}</p>
        )}
        <Button block variant="text" onClick={() => void fresh()}>{t('tiebreak.fresh')}</Button>
      </div>
    </Screen>
  );
}
