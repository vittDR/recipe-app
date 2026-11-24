// 01 Landing: a deck swiped by itself (four cards, then a match), 12 s on a
// loop, pure CSS (app.css "Landing"). Reduced motion shows the match, still.
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import croqueMonsieur from '../../assets/deck/croque-monsieur.webp';
import greekSalad from '../../assets/deck/greek-salad.webp';
import mushroomRisotto from '../../assets/deck/mushroom-risotto.webp';
import springRolls from '../../assets/deck/spring-rolls.webp';
import steak from '../../assets/deck/steak.webp';
import { APP_WORDMARK } from '../../brand.ts';
import { AvatarPair, Button } from '../../components/ui.tsx';
import { useI18n, type MessageKey } from '../../i18n/index.tsx';
import { installVariant } from '../../lib/onboarding.ts';

/** In swipe order; the last one is the match. `bg` is the illustration's own pastel. */
const CARDS: { img: string; bg: string; name: MessageKey; meta: MessageKey; swipe?: 'left' | 'right'; tilt: number }[] = [
  { img: croqueMonsieur, bg: '#fbdad1', name: 'ob.landing.cards.croque', meta: 'ob.landing.cards.croqueMeta', swipe: 'left', tilt: -3 },
  { img: greekSalad, bg: '#e2f2e3', name: 'ob.landing.cards.salad', meta: 'ob.landing.cards.saladMeta', swipe: 'right', tilt: 2 },
  { img: steak, bg: '#d9a19b', name: 'ob.landing.cards.steak', meta: 'ob.landing.cards.steakMeta', swipe: 'left', tilt: -1.5 },
  { img: springRolls, bg: '#ceece9', name: 'ob.landing.cards.rolls', meta: 'ob.landing.cards.rollsMeta', swipe: 'right', tilt: 2.5 },
  { img: mushroomRisotto, bg: '#d9aebb', name: 'ob.landing.cards.risotto', meta: 'ob.landing.cards.risottoMeta', tilt: 0 },
];

const CONFETTI = [
  { left: 60, top: 60, w: 9, h: 16, c: 'var(--accent)', d: 0 },
  { left: 318, top: 70, w: 8, h: 8, c: 'var(--star)', d: 0.1 },
  { left: 40, top: 250, w: 8, h: 14, c: 'var(--sage)', d: 0.2 },
  { left: 330, top: 230, w: 10, h: 10, c: 'var(--iris)', d: 0.05 },
  { left: 90, top: 380, w: 8, h: 8, c: 'var(--star)', d: 0.15 },
  { left: 300, top: 370, w: 9, h: 15, c: 'var(--accent)', d: 0.25 },
];

export function LandingDeck({ you, partner }: { you: string; partner: string }) {
  const { t } = useI18n();
  return (
    <div className="landing__stage" aria-hidden>
      <div className="landing__deck">
        {CONFETTI.map((c, i) => (
          <span key={i} className="landing__confetti"
            style={{ left: `calc(50% + ${c.left - 195}px)`, top: c.top, width: c.w, height: c.h, background: c.c, animationDelay: `${c.d}s` }} />
        ))}
        <div className="landing__match">
          <AvatarPair people={[
            { id: 'you', name: you, color: 'var(--person-1)' },
            { id: 'partner', name: partner, color: 'var(--iris)' },
          ]} />
          {t('ob.landing.match')}
        </div>
        {CARDS.map((card, i) => (
          <div key={card.name}
            className={`landing__card${card.swipe ? ` landing__card--swipe landing__card--${i}` : ' landing__card--match'}`}
            style={{ background: card.bg, zIndex: CARDS.length - i, '--tilt': `${card.tilt}deg` } as CSSProperties}>
            <img src={card.img} alt="" />
            <div className="landing__card-text">
              <b>{t(card.name)}</b>
              <span>{t(card.meta)}</span>
            </div>
            {card.swipe && (
              <span className={`landing__stamp landing__stamp--${card.swipe === 'right' ? 'yes' : 'no'}`}>
                {t(card.swipe === 'right' ? 'ob.landing.yes' : 'ob.landing.no')}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LandingScreen() {
  const { t } = useI18n();
  const navigate = useNavigate();
  // Install comes before the account: on iOS the Home Screen app doesn't share Safari's storage.
  const start = () => navigate(installVariant() ? '/install' : '/signin');
  return (
    <main className="screen screen--plain landing">
      <LandingDeck you="V" partner="P" />
      <div className="landing__text">
        <div className="landing__brand">
          <img src="/favicon.svg" alt="" aria-hidden />
          <span>{APP_WORDMARK}</span>
        </div>
        <h1 className="landing__title">{t('ob.landing.title')}</h1>
        <p className="landing__subtitle">{t('ob.landing.subtitle')}</p>
        <Button block onClick={start}>{t('ob.landing.start')}</Button>
        <Button block variant="text" onClick={() => navigate('/signin?mode=signin')}>{t('ob.landing.haveAccount')}</Button>
      </div>
    </main>
  );
}
