// 08 Goals: per dinner, private. Calories and protein on by default; carbs,
// fat and fibre off, their slider shows once switched on. Off = no target
// (null). Also Us > Goals (`editing`), with servings.
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '../../components/Icon.tsx';
import { Stepper, Switch } from '../../components/ui.tsx';
import { useI18n, type MessageKey } from '../../i18n/index.tsx';
import { useSetup } from '../../lib/onboarding.ts';
import { useSession } from '../../lib/session.tsx';
import { supabase } from '../../lib/supabase.ts';
import type { MemberGoals } from '../../lib/types.ts';
import { Step } from './Step.tsx';

type Macro = 'kcal' | 'protein' | 'carbs' | 'fat' | 'fibre';
const COLUMN = {
  kcal: 'dinner_kcal', protein: 'dinner_protein_g', carbs: 'dinner_carbs_g', fat: 'dinner_fat_g', fibre: 'dinner_fibre_g',
} as const satisfies Record<Macro, keyof MemberGoals>;

const MACROS: { key: Macro; label: MessageKey; unit: MessageKey; min: number; max: number; step: number; value: number; on: boolean }[] = [
  { key: 'kcal', label: 'goals.kcal', unit: 'goals.kcalUnit', min: 300, max: 2000, step: 25, value: 750, on: true },
  { key: 'protein', label: 'goals.protein', unit: 'goals.gramsUnit', min: 10, max: 150, step: 5, value: 45, on: true },
  { key: 'carbs', label: 'goals.carbs', unit: 'goals.gramsUnit', min: 0, max: 250, step: 5, value: 80, on: false },
  { key: 'fat', label: 'goals.fat', unit: 'goals.gramsUnit', min: 0, max: 120, step: 5, value: 30, on: false },
  { key: 'fibre', label: 'goals.fibre', unit: 'goals.gramsUnit', min: 0, max: 50, step: 1, value: 10, on: false },
];

type State = Record<Macro, { on: boolean; value: number }>;

function initial(goals: MemberGoals | null): State {
  return Object.fromEntries(MACROS.map((m) => {
    if (!goals) return [m.key, { on: m.on, value: m.value }];
    const saved = goals[COLUMN[m.key]];
    return [m.key, { on: saved != null, value: saved ?? m.value }];
  })) as State;
}

function MacroCard({ macro, on, value, onToggle, onValue }: {
  macro: (typeof MACROS)[number]; on: boolean; value: number; onToggle: (v: boolean) => void; onValue: (v: number) => void;
}) {
  const { t, locale } = useI18n();
  const formatNumber = (n: number) => n.toLocaleString(locale);
  const label = t(macro.label);
  const pct = ((value - macro.min) / (macro.max - macro.min)) * 100;
  return (
    <div className={`card macro${on ? ' macro--on' : ''}`}>
      <div className="macro__head">
        <span className="macro__label">{label}</span>
        {on && <span className="macro__value"><b className="tabular">{formatNumber(value)}</b> {t(macro.unit)}</span>}
        <Switch checked={on} onChange={onToggle} label={label} />
      </div>
      {on && (
        <>
          <input type="range" className="slider" min={macro.min} max={macro.max} step={macro.step} value={value}
            aria-label={label} aria-valuetext={`${value} ${t(macro.unit)}`}
            style={{ '--fill': `${pct}%` } as React.CSSProperties}
            onChange={(e) => onValue(Number(e.target.value))} />
          <div className="macro__range"><span>{formatNumber(macro.min)}</span><span>{formatNumber(macro.max)}</span></div>
        </>
      )}
    </div>
  );
}

export function GoalsScreen({ editing }: { editing?: boolean }) {
  const { t } = useI18n();
  const { userId, goals, refresh } = useSession();
  const navigate = useNavigate();
  const setup = useSetup('goals');
  const [state, setState] = useState<State>(() => initial(goals));
  const [servings, setServings] = useState(goals?.servings ?? 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    const row = Object.fromEntries(MACROS.map((m) => [COLUMN[m.key], state[m.key].on ? state[m.key].value : null]));
    const { error: err } = await supabase.from('member_goals').upsert({
      user_id: userId, ...row, servings, updated_at: new Date().toISOString(),
    });
    if (err) {
      setError(t('app.error'));
      setBusy(false);
      return;
    }
    await refresh();
    if (editing) navigate(-1);
    else setup.next();
  };

  return (
    <Step back progress={editing ? undefined : setup} onSkip={editing ? undefined : setup.next}
      title={t('goals.title')}
      subtitle={<span className="ob__lock"><Icon name="lock" size={16} /> {t('goals.privacy')}</span>}
      action={{ label: editing ? t('app.save') : undefined, onClick: () => void save(), disabled: busy }}>
      <div className="stack stack--sm">
        {MACROS.map((m) => (
          <MacroCard key={m.key} macro={m} on={state[m.key].on} value={state[m.key].value}
            onToggle={(on) => setState({ ...state, [m.key]: { ...state[m.key], on } })}
            onValue={(value) => setState({ ...state, [m.key]: { ...state[m.key], value } })} />
        ))}
        {editing && (
          <div className="card macro">
            <Stepper label={t('goals.servings')} unit={t('goals.servingsUnit')} value={servings} onChange={setServings} step={0.25} min={0.25} max={4} />
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </Step>
  );
}
