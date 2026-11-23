// 04d Join (joiner): six boxes, typing moves on by itself; "Rejoindre" once
// all six are in. A link /join/CODE fills them. Signed out, the code is kept
// for after the account (lib/invite.ts).
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Button } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { clearPendingInvite, rememberInvite } from '../../lib/invite.ts';
import { useSession } from '../../lib/session.tsx';
import { supabase } from '../../lib/supabase.ts';
import { Step } from './Step.tsx';

const ALLOWED = /[A-HJ-NP-Z2-9]/g;
const LENGTH = 6;

export function JoinScreen() {
  const { t } = useI18n();
  const params = useParams();
  const navigate = useNavigate();
  const { session, household, refresh } = useSession();
  const clean = (s: string) => (s.toUpperCase().match(ALLOWED) ?? []).join('').slice(0, LENGTH);
  const [code, setCode] = useState(clean(params.code ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session && code.length === LENGTH) rememberInvite(code);
  }, [session, code]);

  if (!session) return <Navigate to="/welcome" replace />;
  if (household) return <Navigate to="/" replace />;

  const join = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('redeem_invite', { p_code: code });
    setBusy(false);
    if (err) {
      // Expired, already used or mistyped all read the same to the server.
      setError(err.message.includes('already_in_household') ? t('join.alreadyIn') : t('join.invalid'));
      return;
    }
    clearPendingInvite();
    await refresh();
    navigate('/onboarding/diet', { replace: true });
  };

  // One real input under the six boxes: paste, autofill and the keyboard all just work.
  return (
    <Step back="/onboarding/household" title={t('join.title')} subtitle={t('join.subtitle')}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (code.length === LENGTH) void join(); }}>
        <label className="code-entry" onClick={() => input.current?.focus()}>
          <input ref={input} className="code-entry__input" value={code} autoFocus autoComplete="one-time-code"
            autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={LENGTH} aria-label={t('join.code')}
            onChange={(e) => { setCode(clean(e.target.value)); setError(null); }} />
          <span className="code-boxes" aria-hidden>
            {Array.from({ length: LENGTH }, (_, i) => (
              <span key={i} className={`code-box${i === Math.min(code.length, LENGTH - 1) ? ' code-box--current' : ''}${error ? ' code-box--error' : ''}`}>
                {code[i] ?? ''}
              </span>
            ))}
          </span>
        </label>
        {error && <p className="error">{error}</p>}
        <Button block type="submit" disabled={busy || code.length < LENGTH}>{t('join.confirmShort')}</Button>
      </form>
    </Step>
  );
}
