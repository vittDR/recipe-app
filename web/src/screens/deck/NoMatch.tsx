import { useState } from 'react';
import { useNavigate } from 'react-router';
import pastaCard from '../../assets/deck/pasta.webp';
import pizzaCard from '../../assets/deck/pizza.webp';
import { Icon } from '../../components/Icon.tsx';
import { Button } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useSave } from '../../lib/hooks.ts';
import { useSession } from '../../lib/session.tsx';
import { callFunction, supabase } from '../../lib/supabase.ts';
import type { DeckData } from './data.ts';

/**
 * No veto, no tie-break: nobody agreed, so deal a new deck with the same
 * settings. The server leaves this deck's cards out and leans towards what
 * anyone liked in it.
 */
export function NoMatchView({ data }: { data: DeckData }) {
  const { t } = useI18n();
  const { household } = useSession();
  const navigate = useNavigate();
  const save = useSave();
  const [dealing, setDealing] = useState(false);
  const { deck } = data;

  const deal = async () => {
    setDealing(true);
    try {
      const res = await callFunction<{ deck_id: string }>('deal-deck', {
        who_eating: deck.who_eating, max_minutes: deck.max_minutes, mood: deck.mood, for_date: deck.for_date,
      }, 30_000);
      navigate(`/deck/${res.deck_id}`, { replace: true });
    } catch {
      setDealing(false);
      navigate('/', { replace: true });
    }
  };

  // Not tonight: the evening is off on This week, and Ce soir moves on.
  const skip = async () => {
    await save(supabase.from('plan_dates').upsert({ household_id: household!.id, for_date: deck.for_date, cook_at_home: false }));
    navigate('/', { replace: true });
  };

  return (
    <main className="screen moment">
      <div className="moment__head moment__head--art no-match">
        <div className="no-match-art" aria-hidden>
          <img className="fan fan--left fan--art" src={pastaCard} alt="" />
          <img className="fan fan--right fan--art" src={pizzaCard} alt="" />
          <span className="no-match-art__x"><Icon name="x" size={22} strokeWidth={2.4} /></span>
        </div>
        <h1 className="t-title-m m-0">{t('noMatch.title')}</h1>
        <p className="t-callout muted m-0 no-match__sub">{t('noMatch.subtitle')}</p>
      </div>
      <div className="moment__actions">
        <Button block disabled={dealing} onClick={() => void deal()}>{dealing ? t('tonight.dealing') : t('noMatch.deal')}</Button>
        <Button variant="text" onClick={() => void skip()}>{t('noMatch.notTonight')}</Button>
      </div>
    </main>
  );
}
