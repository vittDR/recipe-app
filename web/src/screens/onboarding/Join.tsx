import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button, Field, Screen } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { clearPendingInvite, rememberInvite } from '../../lib/invite.ts';
import { useSession } from '../../lib/session.tsx';
import { supabase } from '../../lib/supabase.ts';

interface Preview {
  household_name: string;
  inviter_name: string;
  inviter_color: string;
  member_count: number;
}

const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

export function JoinScreen() {
  const { t, tn } = useI18n();
  const params = useParams();
  const navigate = useNavigate();
  const { session, profile, household, refresh } = useSession();
  const [code, setCode] = useState((params.code ?? '').toUpperCase());
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signed-out visitors keep the code while they create an account.
  useEffect(() => {
    if (!session && CODE_RE.test(code)) {
      rememberInvite(code);
    }
  }, [session, code]);

  const lookUp = async (c = code) => {
    if (!session || !profile?.first_name) {
      rememberInvite(c);
      navigate('/signin');
      return;
    }
    setBusy(true);
    setError(null);
    const { data } = await supabase.rpc('preview_invite', { p_code: c });
    setBusy(false);
    const p = (data as Preview[] | null)?.[0];
    if (!p) setError(t('join.invalid'));
    setPreview(p ?? null);
  };

  useEffect(() => {
    if (params.code && CODE_RE.test(params.code.toUpperCase()) && session && profile?.first_name) {
      void lookUp(params.code.toUpperCase());
    }
  }, [params.code, session, profile?.first_name]);

  const join = async () => {
    setBusy(true);
    const { error: err } = await supabase.rpc('redeem_invite', { p_code: code });
    setBusy(false);
    if (err) {
      setError(err.message.includes('already_in_household') ? t('join.alreadyIn') : t('join.invalid'));
      return;
    }
    clearPendingInvite();
    await refresh();
    navigate('/onboarding/goals', { replace: true });
  };

  if (household) {
    return (
      <Screen back="/" title={t('join.title')}>
        <p className="notice">{t('join.alreadyIn')}</p>
      </Screen>
    );
  }

  return (
    <Screen back title={t('join.title')} subtitle={t('join.subtitle')} plain>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void (preview ? join() : lookUp()); }}>
        <Field label={t('join.code')}>
          <input className="input input--code" maxLength={6} autoCapitalize="characters" autoComplete="off" value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setPreview(null); }} />
        </Field>
        {preview && (
          <div className="card stack center">
            <span className="title3">{t('join.preview', { name: preview.inviter_name, household: preview.household_name })}</span>
            <span className="small muted">{tn('join.members', preview.member_count)}</span>
          </div>
        )}
        {error && <p className="error">{error}</p>}
        <Button block type="submit" disabled={busy || !CODE_RE.test(code)}>
          {preview ? t('join.confirm', { household: preview.household_name }) : t('join.lookUp')}
        </Button>
      </form>
    </Screen>
  );
}
