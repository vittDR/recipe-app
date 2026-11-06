import { Navigate, useParams } from 'react-router';
import { Screen, Spinner } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useLive } from '../../lib/hooks.ts';
import { useSession } from '../../lib/session.tsx';
import { loadDeck, type DeckData } from './data.ts';
import { MatchView } from './Match.tsx';
import { SwipeView } from './Swipe.tsx';
import { NoMatchView } from './NoMatch.tsx';

/** One route for the whole deck: shows whichever step the deck is at. */
export function DeckScreen() {
  const { id } = useParams();
  const { userId } = useSession();
  const { t } = useI18n();
  const { data, loading, error, reload } = useLive<DeckData>(
    id ? `deck:${id}` : null,
    () => loadDeck(id!, userId!),
    [
      { table: 'decks', filter: `id=eq.${id}` },
      { table: 'deck_members', filter: `deck_id=eq.${id}` },
    ],
  );

  if (loading && !data) return <Screen back="/"><Spinner /></Screen>;
  if (error || !data) return <Screen back="/"><p className="notice">{t('app.error')}</p></Screen>;

  const { deck } = data;
  if (deck.status === 'closed') return <Navigate to="/" replace />;
  if (deck.status === 'matched') return <MatchView data={data} />;
  if (deck.status === 'no_match') return <NoMatchView data={data} />;

  const mine = data.progress.find((p) => p.user_id === userId);
  const swiping = deck.who_eating.includes(userId!) && !mine?.finished_at && data.mySwipes.length < data.cards.length;
  // Done swiping: Ce soir shows the wait (who's still swiping, your yeses, the nudge).
  return swiping ? <SwipeView data={data} onDone={reload} /> : <Navigate to="/" replace />;
}
