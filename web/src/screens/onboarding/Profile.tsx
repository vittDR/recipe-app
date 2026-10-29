import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Avatar, Button, Field, Screen, Segmented } from '../../components/ui.tsx';
import { LOCALE_NAMES, LOCALES, useI18n, type Locale } from '../../i18n/index.tsx';
import { pendingInviteCode } from '../../lib/invite.ts';
import { MEMBER_COLORS } from '../../lib/colors.ts';
import { useSession } from '../../lib/session.tsx';
import { supabase } from '../../lib/supabase.ts';

export function ProfileScreen() {
  const { t, locale, setLocale } = useI18n();
  const { userId, profile, refresh } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.first_name ?? '');
  const [color, setColor] = useState(profile?.color ?? MEMBER_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    const { error: err } = await supabase.from('profiles')
      .update({ first_name: name.trim(), color, locale }).eq('id', userId!);
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    await refresh();
    const code = pendingInviteCode();
    navigate(code ? `/join/${code}` : '/onboarding/household', { replace: true });
  };

  return (
    <Screen title={t('account.profileTitle')} plain>
      <form className="stack stack--lg" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div className="row">
          <Avatar name={name} color={color} size="lg" />
          <Field label={t('account.firstName')}>
            <input className="input" autoComplete="given-name" required value={name}
              placeholder={t('account.firstNamePlaceholder')} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <div className="stack">
          <span className="field__label">{t('account.color')}</span>
          <div className="swatches">
            {MEMBER_COLORS.map((c) => (
              <button key={c} type="button" className="swatch" style={{ background: c }} aria-pressed={c === color}
                aria-label={c} onClick={() => setColor(c)} />
            ))}
          </div>
          <span className="small muted">{t('account.colorHint')}</span>
        </div>
        <div className="stack">
          <span className="field__label">{t('account.language')}</span>
          <Segmented<Locale> label={t('account.language')} value={locale} onChange={setLocale}
            options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] }))} />
        </div>
        {error && <p className="error">{error}</p>}
        <Button block type="submit" disabled={busy || !name.trim()}>{t('app.continue')}</Button>
      </form>
    </Screen>
  );
}
