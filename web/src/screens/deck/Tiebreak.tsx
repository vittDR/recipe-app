import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '../../components/Icon.tsx';
import { Button, RecipeThumb, Screen } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useSession } from '../../lib/session.tsx';
import { supabase } from '../../lib/supabase.ts';
import type { DeckData } from './data.ts';

interface Option {
  recipe_id: string;
  votes: number;
  score: number;
  liked_by: string[] | null;
}

export function TiebreakView({ data }: { data: DeckData }) {
  const { t } = useI18n();
  const { userId, memberName } = useSession();
  const navigate = useNavigate();
  const [options, setOptions] = useState<Option[]>([]);
  const [picks, setPicks] = useState<{ user_id: string; recipe_id: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const [o, p] = await Promise.all([
        supabase.rpc('tiebreak_options', { p_deck: data.deck.id }),
        supabase.from('tiebreak_picks').select('user_id, recipe_id').eq('deck_id', data.deck.id),
      ]);
      setOptions((o.data ?? []) as Option[]);
      setPicks((p.data ?? []) as { user_id: string; recipe_id: string }[]);
    })();
    // data changes (realtime) re-run this: partner's pick shows up.
  }, [data]);

  const myPick = picks.find((p) => p.user_id === userId)?.recipe_id;
  const waitingFor = data.deck.who_eating.filter((u) => u !== userId && !picks.some((p) => p.user_id === u));

  const pick = async (recipeId: string) => {
    setBusy(true);
    await supabase.from('tiebreak_picks').upsert({ deck_id: data.deck.id, user_id: userId, recipe_id: recipeId });
    setPicks((ps) => [...ps.filter((p) => p.user_id !== userId), { user_id: userId!, recipe_id: recipeId }]);
    setBusy(false);
  };

  const fresh = async () => {
    await supabase.rpc('close_deck', { p_deck: data.deck.id });
    navigate('/', { replace: true });
  };

  return (
    <Screen back="/" title={t('tiebreak.title')} subtitle={t('tiebreak.subtitle')}>
      <div className="stack">
        {options.map((o) => {
          const card = data.cards.find((c) => c.recipe_id === o.recipe_id);
          if (!card) return null;
          const mine = myPick === o.recipe_id;
          return (
            <div key={o.recipe_id} className="card card--flush" style={mine ? { boxShadow: 'inset 0 0 0 2px var(--c-accent), var(--shadow-card)' } : undefined}>
              <div className="row" style={{ padding: 'var(--s-3)' }}>
                <div className="tile__image" style={{ width: 72, aspectRatio: '1', borderRadius: 'var(--r-md)', fontSize: 32 }}>
                  <RecipeThumb recipe={card.recipe} />
                </div>
                <div className="list-row__main stack" style={{ gap: 2 }}>
                  <span className="headline">{card.recipe.title}</span>
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
