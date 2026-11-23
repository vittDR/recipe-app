// 03 Account: Apple, Google or e-mail; "Se connecter" for returning users.
// E-mail + password sends no e-mails (Supabase "Confirm email" off,
// docs/SETUP.md step 2). Apple and Google show only when their Supabase
// providers are set up and listed in VITE_AUTH_PROVIDERS ("apple,google").
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import mushroomRisotto from '../../assets/deck/mushroom-risotto.webp';
import pokeBowl from '../../assets/deck/poke-bowl.webp';
import roastChicken from '../../assets/deck/roast-chicken.webp';
import { Icon } from '../../components/Icon.tsx';
import { Button, Field } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { supabase } from '../../lib/supabase.ts';
import { Step } from './Step.tsx';

const MIN_PASSWORD = 8;
type Provider = 'apple' | 'google';
const PROVIDERS = ((import.meta.env.VITE_AUTH_PROVIDERS as string | undefined) ?? '')
  .split(',').map((p) => p.trim()).filter((p): p is Provider => p === 'apple' || p === 'google');

function AppleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM13.9 5c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3-1.5z" />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.8 14c-.2-.7-.4-1.3-.4-2s.1-1.4.4-2V7.1H2.1A11 11 0 0 0 1 12c0 1.8.4 3.4 1.1 4.9L5.8 14z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1L5.8 10c.9-2.7 3.3-4.6 6.2-4.6z" />
    </svg>
  );
}

export function AccountScreen() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const signingIn = params.get('mode') === 'signin';
  const withEmail = signingIn || params.get('with') === 'email';
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const oauth = async (provider: Provider) => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: location.origin } });
    if (err) setError(t('app.error'));
  };

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
        // handle_new_user() copies first_name onto the profile.
        options: { data: { locale, first_name: firstName.trim() } },
      });
      if (err) {
        setError(/already registered|already exists/i.test(err.message) ? t('account.emailTaken') : err.message);
      } else if (!data.session) {
        setError(data.user?.identities?.length === 0 ? t('account.emailTaken') : t('account.confirmationOn'));
      }
    }
    setBusy(false);
  };

  const providers = PROVIDERS.length > 0 && (
    <div className="stack stack--sm">
      {PROVIDERS.includes('apple') && (
        <Button block variant="dark" onClick={() => void oauth('apple')}><AppleLogo /> {t('ob.account.apple')}</Button>
      )}
      {PROVIDERS.includes('google') && (
        <Button block variant="secondary" onClick={() => void oauth('google')}><GoogleLogo /> {t('ob.account.google')}</Button>
      )}
    </div>
  );

  if (withEmail) {
    return (
      <Step back={signingIn ? '/welcome' : '/signin'}
        title={signingIn ? t('account.signInTitle') : t('ob.account.emailTitle')}
        subtitle={signingIn ? t('account.signInSubtitle') : undefined}>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          {signingIn && providers}
          {!signingIn && (
            <Field label={t('account.firstName')}>
              <input className="input" autoComplete="given-name" required value={firstName}
                placeholder={t('account.firstNamePlaceholder')} onChange={(e) => setFirstName(e.target.value)} />
            </Field>
          )}
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
          <Button block type="submit"
            disabled={busy || !email.includes('@') || !password || (!signingIn && !firstName.trim())}>
            {signingIn ? t('account.signIn') : t('account.create')}
          </Button>
          <Button block variant="text" onClick={() => navigate(signingIn ? '/signin' : '/signin?mode=signin', { replace: true })}>
            {signingIn ? t('account.noAccount') : t('account.haveAccount')}
          </Button>
        </form>
      </Step>
    );
  }

  return (
    <main className="screen screen--plain account">
      <div className="account__art" aria-hidden>
        <span className="account__card account__card--left" style={{ background: '#e7d9f7' }}><img src={pokeBowl} alt="" /></span>
        <span className="account__card account__card--right" style={{ background: '#fae1ce' }}><img src={roastChicken} alt="" /></span>
        <span className="account__card account__card--mid" style={{ background: '#d9aebb' }}><img src={mushroomRisotto} alt="" /></span>
      </div>
      <h1 className="account__title">{t('ob.account.title')}</h1>
      <div className="stack stack--sm">
        {providers}
        <Button block variant="secondary" onClick={() => navigate('/signin?with=email')}>
          <Icon name="mail" size={18} /> {t('ob.account.email')}
        </Button>
        {error && <p className="error">{error}</p>}
      </div>
      <p className="account__signin">
        {t('ob.account.already')}{' '}
        <button type="button" className="link-btn" onClick={() => navigate('/signin?mode=signin')}>{t('ob.account.signIn')}</button>
      </p>
      <div className="spacer" />
    </main>
  );
}
