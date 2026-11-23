// 08 Goals: per dinner, private. Calories and protein on by default; carbs,
// fat and fibre off, their slider shows once switched on. Off = no target
// (null); a target of 0 would read as off too, so no slider goes down to 0.
// Carbs and fat are ceilings, fibre a floor (logic/portions.ts).
// Also Us > Goals (`editing`), with servings.
import { useLayoutEffect, useRef, useState } from 'react';
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
  { key: 'carbs', label: 'goals.carbs', unit: 'goals.gramsUnit', min: 5, max: 250, step: 5, value: 80, on: false },
  { key: 'fat', label: 'goals.fat', unit: 'goals.gramsUnit', min: 5, max: 120, step: 5, value: 30, on: false },
  { key: 'fibre', label: 'goals.fibre', unit: 'goals.gramsUnit', min: 1, max: 50, step: 1, value: 10, on: false },
];

type State = Record<Macro, { on: boolean; value: number }>;

function initial(goals: MemberGoals | null): State {
  return Object.fromEntries(MACROS.map((m) => {
    if (!goals) return [m.key, { on: m.on, value: m.value }];
    const saved = goals[COLUMN[m.key]];
    return [m.key, { on: saved != null, value: saved ?? m.value }];
  })) as State;
}

/**
 * The target, typed: tap the number to edit it. Saved when you leave the
 * field or press Enter; kept within the slider's range, and an empty or
 * unreadable entry puts the previous value back.
 */
function MacroValue({ value, min, max, unit, label, onValue }: {
  value: number; min: number; max: number; unit: string; label: string; onValue: (v: number) => void;
}) {
  const { locale } = useI18n();
  const [draft, setDraft] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const selectAll = useRef(false);
  // Right after editing starts ("2 000" becomes "2000"), select it all, so typing replaces it.
  useLayoutEffect(() => {
    if (selectAll.current && draft !== null) {
      field.current?.select();
      selectAll.current = false;
    }
  }, [draft]);
  const shown = draft ?? value.toLocaleString(locale);
  const commit = () => {
    if (draft === null) return;
    const n = Number.parseInt(draft.replace(/\D/g, ''), 10);
    if (Number.isFinite(n)) onValue(Math.min(max, Math.max(min, n)));
    setDraft(null);
  };
  return (
    <span className="macro__value">
      <input ref={field} className="macro__input tabular" type="text" inputMode="numeric" enterKeyHint="done" aria-label={`${label} (${unit})`}
        value={shown} style={{ width: `${Math.max(2, shown.length) + 0.4}ch` }}
        onFocus={(e) => { selectAll.current = true; setDraft(String(value)); e.target.select(); }}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
      {' '}{unit}
    </span>
  );
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
        {on && <MacroValue value={value} min={macro.min} max={macro.max} unit={t(macro.unit)} label={label} onValue={onValue} />}
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
