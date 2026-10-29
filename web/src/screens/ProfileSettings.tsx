import { useState } from 'react';
import { Button, Field, Screen, Segmented, toast } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import { supabase } from '../lib/supabase.ts';
import { THEMES, getTheme, setTheme, type Theme } from '../lib/theme.ts';

export function ProfileSettingsScreen() {
  const { t } = useI18n();
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
    <Screen back title={t('profile.title')}>
      <h2 className="section-label">{t('profile.appearance')}</h2>
      <Segmented<Theme> label={t('profile.appearance')} value={theme} onChange={chooseTheme}
        options={THEMES.map((v) => ({ value: v, label: t(`profile.themes.${v}`) }))} />
      <p className="small muted">{t('profile.appearanceHint')}</p>

      <h2 className="section-label">{t('us.changePassword')}</h2>
      <form className="row" onSubmit={(e) => { e.preventDefault(); void changePassword(); }}>
        <Field label={t('us.newPassword')}>
          <input className="input" type="password" autoComplete="new-password" minLength={8} value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)} />
        </Field>
        <Button small variant="secondary" type="submit" disabled={!newPassword} style={{ alignSelf: 'flex-end', marginBottom: 8 }}>
          {t('app.save')}
        </Button>
      </form>
      {passwordError && <p className="error">{passwordError}</p>}
    </Screen>
  );
}
