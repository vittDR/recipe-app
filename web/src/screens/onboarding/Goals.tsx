import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Screen, Segmented, Stepper } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useSession } from '../../lib/session.tsx';
import { supabase } from '../../lib/supabase.ts';
import type { Goal } from '../../lib/types.ts';

const DEFAULTS: Record<Goal, { kcal: number; protein: number }> = {
  lean: { kcal: 550, protein: 40 },
  maintain: { kcal: 700, protein: 40 },
  build: { kcal: 850, protein: 55 },
};

export function GoalsScreen({ editing }: { editing?: boolean }) {
  const { t } = useI18n();
  const { userId, goals, refresh } = useSession();
  const navigate = useNavigate();
  const [goal, setGoal] = useState<Goal>(goals?.goal ?? 'maintain');
  const [kcal, setKcal] = useState(goals?.dinner_kcal ?? DEFAULTS.maintain.kcal);
  const [protein, setProtein] = useState(goals?.dinner_protein_g ?? DEFAULTS.maintain.protein);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickGoal = (g: Goal) => {
    setGoal(g);
    setKcal(DEFAULTS[g].kcal);
    setProtein(DEFAULTS[g].protein);
  };

  const save = async () => {
    setBusy(true);
    const { error: err } = await supabase.from('member_goals').upsert({
      user_id: userId, goal, dinner_kcal: kcal, dinner_protein_g: protein, updated_at: new Date().toISOString(),
    });
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    await refresh();
    if (editing) navigate(-1);
    else navigate('/onboarding/tastes', { replace: true });
  };

  return (
    <Screen back={editing} title={t('goals.title')} subtitle={t('goals.subtitle')} plain>
      <div className="stack stack--lg">
        <Segmented<Goal> label={t('goals.title')} value={goal} onChange={pickGoal} options={[
          { value: 'lean', label: t('goals.lean') },
          { value: 'maintain', label: t('goals.maintain') },
          { value: 'build', label: t('goals.build') },
        ]} />
        <Stepper label={t('goals.kcal')} unit={t('goals.kcalUnit')} value={kcal} onChange={setKcal} step={25} min={250} max={2000} />
        <Stepper label={t('goals.protein')} unit={t('goals.gramsUnit')} value={protein} onChange={setProtein} step={5} min={0} max={200} />
        <p className="notice notice--info small">🔒 {t('goals.privacy')}</p>
        {error && <p className="error">{error}</p>}
      </div>
      <div className="spacer" />
      <Button block disabled={busy} onClick={() => void save()}>{editing ? t('app.save') : t('app.continue')}</Button>
    </Screen>
  );
}
