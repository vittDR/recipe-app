// 04c Invite (creator): a 6-character code, valid 48 h, single use, shared
// with the share sheet. Also Us > Invite someone (`editing`).
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '../../components/Icon.tsx';
import { Avatar, Button, toast } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useSession } from '../../lib/session.tsx';
import { supabase } from '../../lib/supabase.ts';
import { Step } from './Step.tsx';

export function InviteScreen({ editing }: { editing?: boolean }) {
  const { t } = useI18n();
  const { household, partners, memberColor } = useSession();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<{ code: string; expires_at: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const newCode = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('create_invite');
    if (err) setError(t('app.error'));
    else setInvite((data as { code: string; expires_at: string }[])[0]);
  }, [t]);

  useEffect(() => {
    void newCode();
  }, [newCode]);

  const link = invite ? `${location.origin}/join/${invite.code}` : '';
  const share = async () => {
    if (!invite) return;
    const text = t('invite.shareText', { link, code: invite.code });
    if (navigator.share) {
      await navigator.share({ title: t('app.name'), text, url: link }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(text).catch(() => undefined);
      toast(t('invite.copied'));
    }
  };

  const joined = partners[partners.length - 1];
  const code = invite?.code ?? '';

  return (
    <Step back={editing ? true : false} overline={household?.name} title={t('invite.title')} subtitle={t('invite.subtitle')}
      action={{ label: editing ? t('app.done') : undefined, onClick: () => (editing ? navigate(-1) : navigate('/onboarding/diet')) }}>
      <div className="stack">
        <div className="invite-code" aria-live="polite" aria-label={code}>
          <div className="code-boxes" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => <span key={i} className="code-box">{code[i] ?? ''}</span>)}
          </div>
          <span className="invite-code__rule">{t('invite.rule')}</span>
        </div>
        <Button block variant="secondary" onClick={() => void share()} disabled={!invite}>
          <Icon name="link" size={18} /> {t('invite.share')}
        </Button>
        {editing && <Button block variant="text" onClick={() => void newCode()}>{t('invite.newCode')}</Button>}
        {error && <p className="error">{error}</p>}
        {joined && (
          <div className="notice notice--success row">
            <Avatar name={joined.profile.first_name} color={memberColor(joined.user_id)} />
            {t('invite.joined', { name: joined.profile.first_name })}
          </div>
        )}
      </div>
    </Step>
  );
}
