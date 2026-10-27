import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Field, Screen } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useSession } from '../../lib/session.tsx';
import { supabase } from '../../lib/supabase.ts';

export function HouseholdScreen() {
  const { t } = useI18n();
  const { refresh } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
    const { error: err } = await supabase.rpc('create_household', { p_name: name.trim(), p_timezone: timezone });
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    await refresh();
    navigate('/onboarding/invite', { replace: true });
  };

  return (
    <Screen title={t('household.title')} subtitle={t('household.subtitle')} plain>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void create(); }}>
        <Field label={t('household.name')}>
          <input className="input" required maxLength={60} value={name} placeholder={t('household.namePlaceholder')}
            onChange={(e) => setName(e.target.value)} />
        </Field>
        {error && <p className="error">{error}</p>}
        <Button block type="submit" disabled={busy || !name.trim()}>{t('household.create')}</Button>
        <Button block variant="text" onClick={() => navigate('/join')}>{t('household.join')}</Button>
      </form>
    </Screen>
  );
}
