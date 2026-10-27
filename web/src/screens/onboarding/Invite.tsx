import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Avatar, Button, Screen, toast } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useSession } from '../../lib/session.tsx';
import { supabase } from '../../lib/supabase.ts';

export function InviteScreen({ editing }: { editing?: boolean }) {
  const { t, formatRelative } = useI18n();
  const { partners, goals } = useSession();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<{ code: string; expires_at: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const next = () => {
    if (editing) navigate(-1);
    else navigate(goals ? '/' : '/onboarding/goals', { replace: true });
  };

  const newCode = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('create_invite');
    if (err) setError(err.message);
    else setInvite((data as { code: string; expires_at: string }[])[0]);
  }, []);

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
      await navigator.clipboard.writeText(text);
      toast(t('invite.copied'));
    }
  };

  const joined = partners[partners.length - 1];

  return (
    <Screen back={editing} title={t('invite.title')} subtitle={t('invite.subtitle')} plain>
      <div className="stack stack--lg">
        <div className="card center stack">
          <div className="input--code" style={{ fontSize: 40, padding: 'var(--s-4) 0' }} aria-live="polite">
            {invite?.code ?? '······'}
          </div>
          {invite && <span className="small muted">{t('invite.expires', { time: formatRelative(invite.expires_at) })}</span>}
          <div className="row" style={{ justifyContent: 'center' }}>
            <Button small variant="secondary" disabled={!invite}
              onClick={() => invite && navigator.clipboard.writeText(invite.code).then(() => toast(t('invite.copied')))}>
              {t('invite.copy')}
            </Button>
            <Button small variant="text" onClick={() => void newCode()}>{t('invite.newCode')}</Button>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        {joined ? (
          <div className="notice notice--success row">
            <Avatar name={joined.profile.first_name} color={joined.profile.color} />
            {t('invite.joined', { name: joined.profile.first_name })}
          </div>
        ) : (
          <p className="muted center small">{t('invite.waiting')}</p>
        )}
      </div>
      <div className="spacer" />
      <div className="stack">
        <Button block onClick={() => void share()} disabled={!invite}>{t('invite.share')}</Button>
        <Button block variant="text" onClick={next}>{joined ? t('app.continue') : t('invite.later')}</Button>
      </div>
    </Screen>
  );
}
