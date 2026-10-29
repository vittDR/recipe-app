import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '../../components/Icon.tsx';
import { Avatar, Button, Screen } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { recipeTitle } from '../../lib/recipeText.ts';
import { useSession } from '../../lib/session.tsx';
import { supabase } from '../../lib/supabase.ts';
import type { DeckData } from './data.ts';

export function WaitingView({ data }: { data: DeckData }) {
  const { t, locale } = useI18n();
  const { userId, memberName, memberColor } = useSession();
  const navigate = useNavigate();
  const [nudged, setNudged] = useState(false);
  const total = data.cards.length;
  const others = data.deck.who_eating.filter((u) => u !== userId);
  const waitingFor = others.filter((u) => !data.progress.find((p) => p.user_id === u)?.finished_at);
  const names = waitingFor.map(memberName).join(', ');
  const yeses = data.mySwipes.filter((s) => s.verdict !== 'pass');

  const nudge = async () => {
    const { data: ok } = await supabase.rpc('nudge', { p_deck: data.deck.id });
    setNudged(ok !== false);
  };

  return (
    <Screen back="/" plain>
      <div className="center stack" style={{ marginTop: 'var(--s-6)' }}>
        <div className="big-emoji" aria-hidden>⏳</div>
        <h1 className="title2">{t('waiting.title')}</h1>
        <p className="muted">{t('waiting.subtitle', { name: names })}</p>
      </div>

      <div className="stack" style={{ marginTop: 'var(--s-6)' }}>
        {waitingFor.map((u) => {
          const p = data.progress.find((x) => x.user_id === u);
          const n = p?.swiped_count ?? 0;
          return (
            <div key={u} className="card stack">
              <div className="row">
                <Avatar name={memberName(u)} color={memberColor(u)} />
                <span className="headline">{t('waiting.progress', { name: memberName(u), n, total })}</span>
              </div>
              <div className="progress"><div style={{ width: `${(n / total) * 100}%` }} /></div>
            </div>
          );
        })}
      </div>

      {yeses.length > 0 && (
        <>
          <h2 className="section-label">{t('waiting.yourYes')}</h2>
          <div className="list">
            {yeses.map((s) => {
              const card = data.cards.find((c) => c.recipe_id === s.recipe_id);
              return (
                <button key={s.recipe_id} type="button" className="list-row" onClick={() => navigate(`/recipes/${s.recipe_id}`)}>
                  <Icon name={s.verdict === 'must' ? 'star' : 'heart'} size={18} />
                  <span className="list-row__main list-row__title">{card && recipeTitle(card.recipe, locale)}</span>
                  <span className="chevron"><Icon name="chevron" size={18} /></span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="spacer spacer--gap" />
      {waitingFor.length > 0 && (
        <Button block variant="secondary" disabled={nudged} onClick={() => void nudge()}>
          <Icon name="bell" /> {nudged ? t('waiting.nudged') : t('waiting.nudge', { name: names })}
        </Button>
      )}
    </Screen>
  );
}
