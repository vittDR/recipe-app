import { useState } from 'react';
import { useI18n } from '../i18n/index.tsx';
import { Icon } from './Icon.tsx';

/** Steps one at a time: type a step and add it; edit, move or remove the ones already there. */
export function StepEditor({ steps, onChange }: { steps: string[]; onChange: (steps: string[]) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState('');

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...steps, text]);
    setDraft('');
  };
  const edit = (i: number, text: string) => onChange(steps.map((s, j) => (j === i ? text : s)));
  const move = (i: number, by: -1 | 1) => {
    const next = [...steps];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    onChange(next);
  };

  return (
    <div className="stack">
      {steps.length > 0 && (
        <ol className="list step-list">
          {steps.map((s, i) => (
            <li key={i} className="list-row step-list__row">
              <span className="headline muted step-list__n">{i + 1}</span>
              <textarea className="input step-input" rows={2} value={s} aria-label={t('steps.step', { n: i + 1 })}
                onChange={(e) => edit(i, e.target.value)} onBlur={() => !s.trim() && onChange(steps.filter((_, j) => j !== i))} />
              <div className="step-list__tools">
                <button type="button" className="icon-btn" aria-label={t('steps.up')} disabled={i === 0} onClick={() => move(i, -1)}><Icon name="up" size={18} /></button>
                <button type="button" className="icon-btn" aria-label={t('steps.down')} disabled={i === steps.length - 1} onClick={() => move(i, 1)}><Icon name="down" size={18} /></button>
                <button type="button" className="icon-btn" aria-label={t('steps.remove')} onClick={() => onChange(steps.filter((_, j) => j !== i))}><Icon name="trash" size={18} /></button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="row">
        <textarea className="input step-input" rows={2} value={draft} placeholder={t('steps.addPlaceholder', { n: steps.length + 1 })}
          aria-label={t('steps.add')} onChange={(e) => setDraft(e.target.value)}
          // Enter adds the step; Shift+Enter starts a new line in it.
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); } }} />
        <button type="button" className="icon-btn icon-btn--filled" aria-label={t('steps.add')} disabled={!draft.trim()} onClick={add}>
          <Icon name="plus" />
        </button>
      </div>
    </div>
  );
}
