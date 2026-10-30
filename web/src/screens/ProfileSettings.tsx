import { useState } from 'react';
import { Button, Field, Screen, Section, Segmented, toast } from '../components/ui.tsx';
import { LOCALE_NAMES, LOCALES, useI18n, type Locale } from '../i18n/index.tsx';
import { supabase } from '../lib/supabase.ts';
import { THEMES, getTheme, setTheme, type Theme } from '../lib/theme.ts';

export function ProfileSettingsScreen() {
  const { t, locale, setLocale } = useI18n();
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const chooseTheme = (next: Theme) => {
    setThemeState(next);
    setTheme(next);
  };

  const changePassword = async () => {
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError(t('account.tooShort'));
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordError(error.message);
      return;
    }
    setNewPassword('');
    toast(t('us.passwordChanged'));
  };

  return (
    <Screen back="/us" title={t('profile.title')}>
      <Section label={t('account.language')} flush>
        <Segmented<Locale> label={t('account.language')} value={locale} onChange={setLocale}
          options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] }))} />
      </Section>

      <Section label={t('profile.appearance')} hint={t('profile.appearanceHint')}>
        <Segmented<Theme> label={t('profile.appearance')} value={theme} onChange={chooseTheme}
          options={THEMES.map((v) => ({ value: v, label: t(`profile.themes.${v}`) }))} />
      </Section>

      <Section label={t('us.changePassword')}>
        <form className="row row--end" onSubmit={(e) => { e.preventDefault(); void changePassword(); }}>
          <Field label={t('us.newPassword')}>
            <input className="input" type="password" autoComplete="new-password" minLength={8} value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
          <Button small variant="secondary" type="submit" disabled={!newPassword}>{t('app.save')}</Button>
        </form>
        {passwordError && <p className="error">{passwordError}</p>}
      </Section>
    </Screen>
  );
}
