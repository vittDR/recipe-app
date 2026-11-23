// 12 Done: onboarding is over; "Lancer mon premier deck" opens Ce soir. A
// joiner whose partner already launched a deck lands on that deck's state there.
import { useState } from 'react';
import { useNavigate } from 'react-router';
import herbOmelette from '../../assets/deck/herb-omelette.webp';
import roastChicken from '../../assets/deck/roast-chicken.webp';
import scallops from '../../assets/deck/scallops.webp';
import { Button } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { finishOnboarding } from '../../lib/onboarding.ts';
import { useSession } from '../../lib/session.tsx';

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
      <div className="done__art" aria-hidden>
        <span className="done__card done__card--left" style={{ background: '#cde2ef' }}><img src={scallops} alt="" /></span>
        <span className="done__card done__card--right" style={{ background: '#fae7b4' }}><img src={herbOmelette} alt="" /></span>
        <span className="done__card done__card--mid" style={{ background: '#fae1ce' }}><img src={roastChicken} alt="" /></span>
      </div>
      <h1 className="done__title">{t('ob.done.title')}</h1>
      <p className="done__subtitle">{t('ob.done.subtitle')}</p>
      <div className="spacer" />
      <Button block disabled={busy} onClick={() => void start()}>{t('ob.done.start')}</Button>
    </main>
  );
}
