// Email + password: no emails are ever sent, so no mail service is needed.
// Requires "Confirm email" to be off in Supabase (docs/SETUP.md, step 2).
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button, Field, Screen } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { supabase } from '../../lib/supabase.ts';

const MIN_PASSWORD = 8;

export function AccountScreen() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const signingIn = params.get('mode') === 'signin';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!signingIn && password.length < MIN_PASSWORD) {
      setError(t('account.tooShort'));
      return;
    }
    setBusy(true);
    // On success the session changes and the gate moves on.
    if (signingIn) {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) setError(t('account.wrongPassword'));
    } else {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { locale } },
      });
      if (err) {
        setError(/already registered|already exists/i.test(err.message) ? t('account.emailTaken') : err.message);
      } else if (!data.session) {
        // Supabase still wants an email confirmation; with confirmation off a session comes back.
        setError(data.user?.identities?.length === 0 ? t('account.emailTaken') : t('account.confirmationOn'));
      }
    }
    setBusy(false);
  };

  const switchMode = () => navigate(signingIn ? '/signin' : '/signin?mode=signin', { replace: true });

  return (
    <Screen
      back="/welcome"
      title={signingIn ? t('account.signInTitle') : t('account.title')}
      subtitle={signingIn ? t('account.signInSubtitle') : t('account.subtitle')}
      plain
    >
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label={t('account.email')}>
          <input className="input" type="email" autoComplete="email" inputMode="email" required autoCapitalize="none"
            placeholder={t('account.emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t('account.password')} hint={signingIn ? undefined : t('account.passwordHint')}>
          <input className="input" type={show ? 'text' : 'password'} required
            autoComplete={signingIn ? 'current-password' : 'new-password'}
            minLength={signingIn ? undefined : MIN_PASSWORD}
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <label className="row small muted">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          {t('account.showPassword')}
        </label>
        {error && <p className="error">{error}</p>}
        <Button block type="submit" disabled={busy || !email.includes('@') || !password}>
          {signingIn ? t('account.signIn') : t('account.create')}
        </Button>
        <Button block variant="text" onClick={switchMode}>
          {signingIn ? t('account.noAccount') : t('account.haveAccount')}
        </Button>
      </form>
    </Screen>
  );
}
