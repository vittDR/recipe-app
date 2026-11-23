// 12 Done: onboarding is over; "Lancer mon premier deck" opens Ce soir. A
// joiner whose partner already launched a deck lands on that deck's state there.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import greekSalad from '../../assets/deck/greek-salad.webp';
import herbOmelette from '../../assets/deck/herb-omelette.webp';
import mushroomRisotto from '../../assets/deck/mushroom-risotto.webp';
import pokeBowl from '../../assets/deck/poke-bowl.webp';
import salmon from '../../assets/deck/salmon.webp';
import steak from '../../assets/deck/steak.webp';
import { Button } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { finishOnboarding } from '../../lib/onboarding.ts';
import { useSession } from '../../lib/session.tsx';
import { supabase } from '../../lib/supabase.ts';
import { DIETS, type Diet } from '../../lib/types.ts';

/** The fan, front card last, matching what this person eats: salmon and potatoes in front, unless vegetarian. */
const FAN: Record<Diet, [string, string, string]> = {
  everything: [steak, herbOmelette, salmon],
  flexitarian: [mushroomRisotto, herbOmelette, salmon],
  pescatarian: [pokeBowl, herbOmelette, salmon],
  vegetarian: [greekSalad, herbOmelette, mushroomRisotto],
};

const CONFETTI = [
  { l: 6, t: 10, c: 'var(--accent)', w: 9, h: 15, r: 20 },
  { l: 22, t: 4, c: 'var(--star)', w: 7, h: 7, r: 0 },
  { l: 48, t: 2, c: 'var(--sage)', w: 8, h: 8, r: 0 },
  { l: 70, t: 4, c: 'var(--iris)', w: 6, h: 6, r: 0 },
  { l: 86, t: 5, c: 'var(--line-strong)', w: 8, h: 8, r: 0 },
  { l: 92, t: 14, c: 'var(--sage)', w: 9, h: 14, r: 30 },
  { l: 4, t: 30, c: 'var(--star)', w: 7, h: 12, r: 15 },
  { l: 96, t: 28, c: 'var(--accent)', w: 9, h: 9, r: 40 },
];

export function DoneScreen() {
  const { t } = useI18n();
  const { userId, refresh } = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [diet, setDiet] = useState<Diet>('everything');
  useEffect(() => {
    void supabase.from('taste_rules').select('value').eq('user_id', userId!).eq('kind', 'diet').maybeSingle()
      .then(({ data }) => { if (data && DIETS.includes(data.value as Diet)) setDiet(data.value as Diet); });
  }, [userId]);
  const [left, right, front] = FAN[diet];

  const start = async () => {
    setBusy(true);
    await finishOnboarding(userId!);
    await refresh();
    navigate('/', { replace: true });
  };

  return (
    <main className="screen screen--plain done">
      <div className="done__confetti" aria-hidden>
        {CONFETTI.map((c, i) => (
          <span key={i} style={{ left: `${c.l}%`, top: `${c.t}%`, width: c.w, height: c.h, background: c.c, transform: `rotate(${c.r}deg)` }} />
        ))}
      </div>
      <div className="ob-fan" aria-hidden>
        <img className="fan fan--left fan--art" src={left} alt="" />
        <img className="fan fan--right fan--art" src={right} alt="" />
        <img className="fan fan--mid fan--art" src={front} alt="" />
      </div>
      <h1 className="done__title">{t('ob.done.title')}</h1>
      <p className="done__subtitle">{t('ob.done.subtitle')}</p>
      <div className="spacer" />
      <Button block disabled={busy} onClick={() => void start()}>{t('ob.done.start')}</Button>
    </main>
  );
}
