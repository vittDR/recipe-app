// 10 Notifications: the permission prompt only works in the installed app,
// so this step is skipped elsewhere (lib/onboarding.ts setupSteps). Reminders
// go out at the household's prompt time (17:30 by default) on cook days.
import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon.tsx';
import { Button } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useSetup } from '../../lib/onboarding.ts';
import { enablePush } from '../../lib/push.ts';
import { useSession } from '../../lib/session.tsx';
import { supabase } from '../../lib/supabase.ts';
import { DIETS, type Diet } from '../../lib/types.ts';
import { Step } from './Step.tsx';

function Banner({ title, time, body, back }: { title: string; time: string; body: string; back?: boolean }) {
  return (
    <div className={`notif-banner${back ? ' notif-banner--back' : ''}`}>
      <span className="notif-banner__icon"><Icon name="bowl" size={20} /></span>
      <span className="notif-banner__text">
        <span className="notif-banner__head"><b>{title}</b><span>{time}</span></span>
        <span>{body}</span>
      </span>
    </div>
  );
}

export function NotifyScreen() {
  const { t } = useI18n();
  const { userId, partners } = useSession();
  const setup = useSetup('notifications');
  const [busy, setBusy] = useState(false);
  const partner = partners[0]?.profile.first_name || t('ob.notify.partner');
  // The example dinner matches what this person eats (no roast chicken for a vegetarian).
  const [diet, setDiet] = useState<Diet>('everything');
  useEffect(() => {
    void supabase.from('taste_rules').select('value').eq('user_id', userId!).eq('kind', 'diet').maybeSingle()
      .then(({ data }) => { if (data && DIETS.includes(data.value as Diet)) setDiet(data.value as Diet); });
  }, [userId]);

  const enable = async () => {
    setBusy(true);
    await enablePush(userId!).catch(() => 'off');
    setBusy(false);
    setup.next();
  };

  return (
    <Step back progress={setup} title={t('ob.notify.title')} subtitle={t('ob.notify.subtitle')}
      action={{ label: t('ob.notify.enable'), icon: <Icon name="bell" size={18} />, onClick: () => void enable(), disabled: busy }}
      footer={<Button block variant="text" onClick={setup.next}>{t('ob.notify.later')}</Button>}>
      <div className="notif-preview" aria-hidden>
        <Banner title={t('ob.notify.promptTitle')} time="17:31" body={t('ob.notify.promptBody', { name: partner })} />
        <Banner back title={t('ob.notify.decidedTitle')} time="18:02" body={t(`ob.notify.decidedBody.${diet}`)} />
      </div>
    </Step>
  );
}
