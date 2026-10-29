// The household's members, as listed in Us and in Household settings.
import { useI18n } from '../i18n/index.tsx';
import { useSession } from '../lib/session.tsx';
import { Icon } from './Icon.tsx';
import { Avatar, Button, ListRow } from './ui.tsx';

export function MemberList({ onRemove, invite = true }: {
  /** Shown to the owner next to the other members. */
  onRemove?: (userId: string, name: string) => void;
  /** The "Invite someone" row at the end. */
  invite?: boolean;
}) {
  const { t } = useI18n();
  const { userId, household, members } = useSession();
  const isOwner = household?.owner_id === userId;
  return (
    <div className="list">
      {members.map((m) => (
        <ListRow key={m.user_id}
          icon={<Avatar name={m.profile.first_name} color={m.profile.color} />}
          title={m.user_id === userId ? `${m.profile.first_name} (${t('app.you')})` : m.profile.first_name}
          meta={m.user_id === household?.owner_id ? t('settings.owner') : undefined}
          trailing={onRemove && isOwner && m.user_id !== userId && (
            <Button small variant="danger" onClick={() => onRemove(m.user_id, m.profile.first_name)}>{t('settings.remove')}</Button>
          )} />
      ))}
      {invite && <ListRow to="/us/invite" accent chevron={false} icon={<Icon name="plus" />} title={t('settings.invite')} />}
    </div>
  );
}
