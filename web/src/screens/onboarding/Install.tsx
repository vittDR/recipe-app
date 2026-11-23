// 02 Install: add the app to the Home Screen before creating the account (on
// iOS the Home Screen app doesn't share Safari's storage, so a session made in
// Safari would be lost). One variant per browser (lib/onboarding.ts); a pointer
// "Ici" bobs at the edge of the page, next to the browser's own button to
// tap. "Continuer dans le navigateur" skips it.
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Icon, type IconName } from '../../components/Icon.tsx';
import { Button, toast } from '../../components/ui.tsx';
import { useI18n, type MessageKey } from '../../i18n/index.tsx';
import { APP_HOST, INSTALL_VARIANTS, installVariant, type InstallVariant } from '../../lib/onboarding.ts';

/** One instruction: words, then the button it names (icon and label) as a little key. */
function Instruction({ n, before, keyIcon, keyLabel, after }: {
  n: number; before: ReactNode; keyIcon?: IconName; keyLabel?: ReactNode; after?: ReactNode;
}) {
  return (
    <li className="install__step">
      <span className="install__num">{n}</span>
      <span>{before}</span>
      {(keyIcon || keyLabel) && (
        <span className="install__key">{keyIcon && <Icon name={keyIcon} size={16} />}{keyLabel && <b>{keyLabel}</b>}</span>
      )}
      {after && <span>{after}</span>}
    </li>
  );
}

const Pointer = ({ className }: { className: string }) => {
  const { t } = useI18n();
  return <span className={`install__pointer ${className}`} aria-hidden>{t('ob.install.here')}</span>;
};

function AppIcon() {
  return <img className="install__icon" src="/favicon.svg" alt="" aria-hidden />;
}

const STEPS: Record<Exclude<InstallVariant, 'other'>, { before: MessageKey; icon?: IconName; label?: MessageKey; after?: MessageKey }[]> = {
  safari26: [
    { before: 'ob.install.tap', icon: 'lines', after: 'ob.install.inAddress' },
    { before: 'ob.install.then', icon: 'share', label: 'ob.install.share' },
    { before: 'ob.install.then', icon: 'more', label: 'ob.install.more' },
    { before: 'ob.install.and', icon: 'squarePlus', label: 'ob.install.onHomeScreen' },
  ],
  safari18: [
    { before: 'ob.install.tap', icon: 'share', after: 'ob.install.atBottom' },
    { before: 'ob.install.then', icon: 'squarePlus', label: 'ob.install.onHomeScreen' },
    { before: 'ob.install.andAdd' },
  ],
  chrome: [
    { before: 'ob.install.tap', icon: 'share', after: 'ob.install.topRight' },
    { before: 'ob.install.then', icon: 'squarePlus', label: 'ob.install.addToHomeScreen' },
    { before: 'ob.install.andAddPlain' },
  ],
};

export function InstallScreen() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // ?v= previews a variant on any device.
  const forced = params.get('v') as InstallVariant | null;
  const variant = forced && INSTALL_VARIANTS.includes(forced) ? forced : installVariant() ?? 'safari26';
  const browser = (
    <Button block variant="text" onClick={() => navigate('/signin')}>{t('ob.install.continueInBrowser')}</Button>
  );

  if (variant === 'other') {
    const url = `https://${APP_HOST}`;
    const copy = () => navigator.clipboard.writeText(url).then(() => toast(t('ob.install.copied')), () => undefined);
    return (
      <main className="screen screen--plain install install--other">
        <div className="install__icons" aria-hidden>
          <AppIcon />
          <Icon name="chevron" size={18} />
          <span className="install__safari"><Icon name="compass" size={40} strokeWidth={1.8} /></span>
        </div>
        <h1 className="install__title">{t('ob.install.openTitle')}</h1>
        <p className="install__subtitle">{t('ob.install.openSubtitle')}</p>
        <div className="card install__link">
          <Icon name="link" size={16} />
          <span className="install__url">{APP_HOST}</span>
          <Button small variant="secondary" onClick={() => void copy()}><Icon name="copy" size={16} /> {t('ob.install.copy')}</Button>
        </div>
        <p className="install__hint">{t('ob.install.openHint')}</p>
        <div className="spacer" />
        {/* iOS 17+; some in-app browsers block it, hence the copy-link fallback above. */}
        <Button block onClick={() => { location.href = `x-safari-${url}`; }}>
          <Icon name="compass" size={18} /> {t('ob.install.openInSafari')}
        </Button>
      </main>
    );
  }

  return (
    <main className={`screen screen--plain install install--${variant}`}>
      <AppIcon />
      <h1 className="install__title">{t('ob.install.title')}</h1>
      <p className="install__subtitle">{t('ob.install.subtitle')}</p>
      <ol className="card install__steps">
        {STEPS[variant].map((s, i) => (
          <Instruction key={i} n={i + 1} before={t(s.before)} keyIcon={s.icon} keyLabel={s.label && t(s.label)} after={s.after && t(s.after)} />
        ))}
      </ol>
      {browser}
      <div className="spacer" />
      {/* Points at the browser's own button, just outside the page: the share button at the
          top right in Chrome, at the bottom in Safari 18, the page menu in Safari 26's bar. */}
      <Pointer className={`install__pointer--${variant}`} />
    </main>
  );
}
