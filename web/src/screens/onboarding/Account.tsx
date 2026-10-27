// Email one-time code: works inside an installed iOS web app, where a magic
// link would open Safari and sign in the wrong context.
import { useState } from 'react';
import { Button, Field, Screen } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { supabase } from '../../lib/supabase.ts';

export function AccountScreen() {
  const { t, locale } = useI18n();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, data: { locale } },
    });
    setBusy(false);
    if (err) setError(err.message);
    else setSent(true);
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    // On success the session changes and the gate moves on.
    if (err) setError(t('account.wrongCode'));
  };

  if (!sent) {
    return (
      <Screen back="/welcome" title={t('account.title')} subtitle={t('account.subtitle')} plain>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <Field label={t('account.email')}>
            <input className="input" type="email" autoComplete="email" inputMode="email" required
              placeholder={t('account.emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error && <p className="error">{error}</p>}
          <Button block type="submit" disabled={busy || !email.includes('@')}>{t('account.sendCode')}</Button>
        </form>
      </Screen>
    );
  }

  return (
    <Screen title={t('account.codeTitle')} subtitle={t('account.codeSubtitle', { email })} plain>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void verify(); }}>
        <Field label={t('account.code')}>
          <input className="input input--code" inputMode="numeric" autoComplete="one-time-code" maxLength={8}
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
        </Field>
        {error && <p className="error">{error}</p>}
        <Button block type="submit" disabled={busy || code.length < 6}>{t('account.verify')}</Button>
        <Button block variant="text" disabled={busy} onClick={() => void send()}>{t('account.resend')}</Button>
      </form>
    </Screen>
  );
}
