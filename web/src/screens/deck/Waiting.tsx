import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '../../components/Icon.tsx';
import { Avatar, Button, ListRow, ProgressBar, Screen, Section } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { recipeTitle } from '../../lib/recipeText.ts';
import { useSession } from '../../lib/session.tsx';
import { useSave } from '../../lib/hooks.ts';
import { supabase } from '../../lib/supabase.ts';
import type { DeckData } from './data.ts';

export function WaitingView({ data }: { data: DeckData }) {
  const { t, locale } = useI18n();
  const { userId, memberName, memberColor } = useSession();
  const navigate = useNavigate();
  const save = useSave();
  const [nudged, setNudged] = useState(false);
  const total = data.cards.length;
  const others = data.deck.who_eating.filter((u) => u !== userId);
  const waitingFor = others.filter((u) => !data.progress.find((p) => p.user_id === u)?.finished_at);
  const names = waitingFor.map(memberName).join(', ');
  const yeses = data.mySwipes.filter((s) => s.verdict !== 'pass');

  const nudge = async () => {
    const res = await supabase.rpc('nudge', { p_deck: data.deck.id });
    if (await save(Promise.resolve(res))) setNudged(res.data !== false);
  };

  return (
    <Screen back="/" plain>
      <div className="center stack mt-6">
        <div className="big-emoji" aria-hidden>⏳</div>
        <h1 className="title2">{t('waiting.title')}</h1>
        <p className="muted">{t('waiting.subtitle', { name: names })}</p>
      </div>

      <div className="stack mt-6">
        {waitingFor.map((u) => {
          const p = data.progress.find((x) => x.user_id === u);
          const n = p?.swiped_count ?? 0;
          return (
            <div key={u} className="card stack">
              <div className="row">
                <Avatar name={memberName(u)} color={memberColor(u)} />
                <span className="headline">{t('waiting.progress', { name: memberName(u), n, total })}</span>
              </div>
              <ProgressBar value={n} max={total} />
            </div>
          );
        })}
      </div>

      {yeses.length > 0 && (
        <Section label={t('waiting.yourYes')}>
          <div className="list">
            {yeses.map((s) => {
              const card = data.cards.find((c) => c.recipe_id === s.recipe_id);
              return (
                <ListRow key={s.recipe_id} icon={<Icon name={s.verdict === 'must' ? 'star' : 'heart'} size={18} />}
                  title={card ? recipeTitle(card.recipe, locale) : ''} chevron onClick={() => navigate(`/recipes/${s.recipe_id}`)} />
              );
            })}
          </div>
        </Section>
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
