// 04e "Qui mange à la maison ?" (creator, after the invite; no progress bar,
// like the other household screens): who chooses the recipes (members, and
// the invitation sent), who also eats (extra eaters, lib/eaters.ts), and the
// portions recipes are worked out for, live.
import { useNavigate } from 'react-router';
import { EaterList } from '../../components/EaterList.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Avatar, Button, ListRow } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useEaters, usePortionTotal } from '../../lib/eaters.ts';
import { useSession } from '../../lib/session.tsx';
import { Step } from './Step.tsx';

export function EatersScreen() {
  const { t } = useI18n();
  const { userId, household, members, memberColor } = useSession();
  const navigate = useNavigate();
  const { data: eaters } = useEaters();
  const portions = usePortionTotal();
  const next = () => navigate('/onboarding/diet');

  // Someone was just invited: they'll choose too, so they count before they join.
  const pending = members.length < 2;
  const total = members.length + (pending ? 1 : 0) + (eaters ?? []).reduce((s, e) => s + e.portion, 0);
  const none = (eaters ?? []).length === 0;

  return (
    <Step back="/onboarding/invite" overline={household?.name} title={t('eaters.title')} subtitle={t('eaters.subtitle')}
      action={{ onClick: next }}
      footer={none && (
        <Button block variant="text" onClick={next}>
          {members.length + (pending ? 1 : 0) === 2 ? t('eaters.justUsTwo') : t('eaters.noOneElse')}
        </Button>
      )}>
      <div className="stack">
        <section className="ob-group">
          <h2 className="ob-group__label">{t('eaters.choose')}</h2>
          <div className="list">
            {members.map((m) => (
              <ListRow key={m.user_id} icon={<Avatar name={m.profile.first_name} color={memberColor(m.user_id)} />}
                title={m.profile.first_name} meta={m.user_id === userId ? t('app.you') : undefined} />
            ))}
            {pending && (
              <ListRow icon={<span className="avatar avatar--pending" aria-hidden><Icon name="person" size={16} /></span>}
                title={t('eaters.invited')} meta={t('eaters.invitedMeta')} />
            )}
          </div>
        </section>
        <section className="ob-group">
          <h2 className="ob-group__label">{t('eaters.alsoEat')}</h2>
          <EaterList />
        </section>
        <p className="eaters-total"><Icon name="people" size={16} /> {t('eaters.recipesFor', { portions: portions(total) })}</p>
      </div>
    </Step>
  );
}
