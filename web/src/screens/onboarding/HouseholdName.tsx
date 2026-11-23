// 04b Household name (creator only). Empty at first, with dashed suggestions.
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Chip } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useSession } from '../../lib/session.tsx';
import { supabase } from '../../lib/supabase.ts';
import { Step } from './Step.tsx';

export function HouseholdNameScreen() {
  const { t, list } = useI18n();
  const { refresh } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
    const { error: err } = await supabase.rpc('create_household', { p_name: name.trim(), p_timezone: timezone });
    if (err) {
      setError(t('app.error'));
      setBusy(false);
      return;
    }
    await refresh();
    navigate('/onboarding/invite', { replace: true });
  };

  return (
    <Step back="/onboarding/household" title={t('household.nameTitle')}
      action={{ onClick: () => void create(), disabled: busy || !name.trim() }}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (name.trim()) void create(); }}>
        <input className="input input--large" required maxLength={60} value={name} aria-label={t('household.name')}
          placeholder={t('household.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
        <div className="chips">
          {list('household.suggestions').map((s) => (
            <Chip key={s} variant="dashed" onClick={() => setName(s)}>{s}</Chip>
          ))}
        </div>
        {error && <p className="error">{error}</p>}
      </form>
    </Step>
  );
}
