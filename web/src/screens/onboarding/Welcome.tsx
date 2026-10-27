import { useNavigate } from 'react-router';
import { Button, Screen } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { isIosBrowserTab } from '../../lib/push.ts';

export function WelcomeScreen() {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <Screen plain>
      <div className="welcome">
        <div className="big-emoji" aria-hidden>🧨</div>
        <div className="logo">{t('app.name')}</div>
        <p className="title3" style={{ maxWidth: 300 }}>{t('welcome.tagline')}</p>
      </div>
      <div className="stack">
        {isIosBrowserTab() && <p className="notice notice--info small">{t('welcome.install')}</p>}
        <Button block onClick={() => navigate('/signin')}>{t('welcome.getStarted')}</Button>
        <Button block variant="secondary" onClick={() => navigate('/signin?mode=signin')}>{t('welcome.signIn')}</Button>
        <Button block variant="text" onClick={() => navigate('/join')}>{t('welcome.haveCode')}</Button>
      </div>
    </Screen>
  );
}
