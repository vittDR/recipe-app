// 04a Household: create one (then name it and invite) or join with a code.
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '../../components/Icon.tsx';
import { ListRow } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { pendingInviteCode } from '../../lib/invite.ts';
import { Step } from './Step.tsx';

export function HouseholdScreen() {
  const { t } = useI18n();
  const navigate = useNavigate();
  // Opened from an invite link: straight to joining with that code.
  useEffect(() => {
    const code = pendingInviteCode();
    if (code) navigate(`/join/${code}`, { replace: true });
  }, [navigate]);

  return (
    <Step back={false} title={t('household.title')} subtitle={t('household.subtitle')}>
      <div className="stack stack--sm">
        <ListRow className="card ob-choice" tile="accent" icon={<Icon name="home" size={20} />} chevron
          title={t('household.createRow')} meta={t('household.createMeta')} onClick={() => navigate('/onboarding/household/name')} />
        <ListRow className="card ob-choice" tile="iris" icon={<Icon name="people" size={20} />} chevron
          title={t('household.joinRow')} meta={t('household.joinMeta')} onClick={() => navigate('/join')} />
      </div>
    </Step>
  );
}
