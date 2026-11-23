// The frame of an onboarding screen: back, the progress bar and "Passer" in
// the top bar, a question as the title, one optional subtitle, and one
// terracotta button at the bottom.
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '../../components/Icon.tsx';
import { Button } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';

/**
 * Back, the progress segments and an action on the right ("Passer"). `fill`
 * fills the current segment part way (the taste quiz, card by card).
 */
export function StepBar({ back = true, progress, right }: {
  back?: boolean | string;
  progress?: { index: number; count: number; fill?: number };
  right?: ReactNode;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <div className="ob__bar">
      {back ? (
        <button type="button" className="icon-btn icon-btn--filled" aria-label={t('app.back')}
          onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}>
          <Icon name="back" />
        </button>
      ) : <span className="ob__bar-gap" />}
      {progress && (
        <div className="ob__progress" role="progressbar" aria-valuemin={1} aria-valuemax={progress.count}
          aria-valuenow={progress.index + 1} aria-label={t('ob.progress', { n: progress.index + 1, total: progress.count })}>
          {Array.from({ length: progress.count }, (_, i) => (
            <span key={i} className={i < progress.index || (i === progress.index && progress.fill == null) ? 'on' : undefined}>
              {i === progress.index && progress.fill != null && <i style={{ width: `${Math.round(progress.fill * 100)}%` }} />}
            </span>
          ))}
        </div>
      )}
      {right ?? (progress ? <span className="ob__bar-gap" /> : null)}
    </div>
  );
}

export function Step({
  title,
  subtitle,
  overline,
  progress,
  back = true,
  onSkip,
  action,
  footer,
  children,
  className = '',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  overline?: ReactNode;
  /** Which segment is current (0-based) out of how many; none on account and household screens. */
  progress?: { index: number; count: number };
  /** true: go back in history; a path: go there; false: no back button. */
  back?: boolean | string;
  /** Shows "Passer" in the top bar. */
  onSkip?: () => void;
  /** The bottom button: "Continuer" unless given a label. */
  action?: { label?: ReactNode; onClick: () => void; disabled?: boolean; icon?: ReactNode };
  /** Under the bottom button (a text link). */
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <main className={`screen screen--plain ob ${className}`}>
      <StepBar back={back} progress={progress}
        right={onSkip && <button type="button" className="ob__skip" onClick={onSkip}>{t('ob.skip')}</button>} />
      {overline && <span className="ob__overline">{overline}</span>}
      <h1 className="ob__title">{title}</h1>
      {subtitle && <p className="ob__subtitle">{subtitle}</p>}
      {children}
      <div className="spacer spacer--gap" />
      {action && (
        <Button block onClick={action.onClick} disabled={action.disabled}>
          {action.icon}{action.label ?? t('app.continue')}
        </Button>
      )}
      {footer}
    </main>
  );
}
