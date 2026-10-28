// Small pieces of the Groceries tab: the + / [quantity] [unit ▾] [trash]
// module, the quantity keypad, the unit picker, swipe to remove, the sync
// icon and the bold match in search results.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GROCERY_UNITS } from '@logic/products.ts';
import { useI18n } from '../i18n/index.tsx';
import type { SyncStatus } from '../lib/listQueue.ts';
import { useAmount } from '../lib/units.ts';
import { Icon } from './Icon.tsx';
import { Button, Chip, Sheet } from './ui.tsx';

/** The amount of an item on the list, edited in place. */
export interface Amount {
  quantity: number | null;
  unit: string | null;
}

/**
 * + when the item isn't on the list; once it is, the module that edits it.
 * Fixed size: it never shrinks, the name next to it wraps instead.
 */
export function AmountControl({
  name,
  amount,
  units,
  onAdd,
  onChange,
  onRemove,
}: {
  name: string;
  /** Null: not on the list. */
  amount: Amount | null;
  /** Units to suggest first. */
  units: string[];
  onAdd: () => void;
  onChange: (a: Amount) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const { number, unitLabel } = useAmount();
  const [editing, setEditing] = useState<'qty' | 'unit' | null>(null);

  if (!amount) {
    return (
      <button type="button" className="icon-btn icon-btn--filled amount-add" aria-label={t('groceries.addNamed', { name })} onClick={onAdd}>
        <Icon name="plus" />
      </button>
    );
  }
  return (
    <div className="amount" role="group" aria-label={name}>
      <button type="button" className="amount__field amount__qty" aria-label={t('groceries.setQuantity', { name })}
        onClick={() => setEditing('qty')}>
        {amount.quantity === null ? '–' : number(amount.quantity)}
      </button>
      <button type="button" className="amount__field amount__unit" aria-label={t('groceries.setUnit', { name })}
        onClick={() => setEditing('unit')}>
        <span>{amount.unit ? unitLabel(amount.unit, amount.quantity) : '–'}</span>
        <Icon name="caret" size={14} />
      </button>
      <button type="button" className="amount__trash" aria-label={t('groceries.removeItem')} onClick={onRemove}>
        <Icon name="trash" size={18} />
      </button>
      <KeypadSheet open={editing === 'qty'} title={t('groceries.setQuantity', { name })} value={amount.quantity}
        onClose={() => setEditing(null)} onDone={(quantity) => { setEditing(null); onChange({ ...amount, quantity }); }} />
      <UnitSheet open={editing === 'unit'} title={t('groceries.setUnit', { name })} value={amount.unit} units={units}
        onClose={() => setEditing(null)} onPick={(unit) => { setEditing(null); onChange({ ...amount, unit }); }} />
    </div>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'sep', '0', 'back'] as const;

/** Numeric keypad: decimals allowed, empty = no quantity. */
export function KeypadSheet({ open, title, value, onClose, onDone }: {
  open: boolean;
  title: string;
  value: number | null;
  onClose: () => void;
  onDone: (v: number | null) => void;
}) {
  const { t, locale } = useI18n();
  const sep = locale === 'fr' ? ',' : '.';
  const [text, setText] = useState('');
  // The current amount shows until the first key, which replaces it.
  const [fresh, setFresh] = useState(true);
  useEffect(() => {
    if (open) {
      setText(value === null ? '' : String(value).replace('.', sep));
      setFresh(true);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const press = (k: (typeof KEYS)[number]) => {
    navigator.vibrate?.(5);
    const s = fresh && k !== 'back' ? '' : text;
    setFresh(false);
    if (k === 'back') setText(s.slice(0, -1));
    else if (k === 'sep') setText(s.includes(sep) ? s : `${s || '0'}${sep}`);
    else setText((s === '0' ? k : `${s}${k}`).slice(0, 7));
  };
  const parsed = text ? Number(text.replace(',', '.')) : null;
  const done = () => onDone(parsed !== null && Number.isFinite(parsed) && parsed > 0 ? parsed : null);

  return (
    <Sheet open={open} onClose={onClose} label={title}>
      <h2 className="title3" style={{ marginBottom: 'var(--s-3)' }}>{title}</h2>
      <output className="keypad__value" aria-live="polite">{text || '–'}</output>
      <div className="keypad">
        {KEYS.map((k) => (
          <button key={k} type="button" className="keypad__key" onClick={() => press(k)}
            aria-label={k === 'back' ? t('app.delete') : k === 'sep' ? sep : k}>
            {k === 'back' ? <Icon name="backspace" /> : k === 'sep' ? sep : k}
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 'var(--s-4)' }}>
        <Button variant="secondary" style={{ flex: 1 }} onClick={() => onDone(null)}>{t('groceries.noQuantity')}</Button>
        <Button style={{ flex: 1 }} onClick={done}>{t('app.done')}</Button>
      </div>
    </Sheet>
  );
}

/** Suggested units for the item, then all units, then a free one. */
export function UnitSheet({ open, title, value, units, onClose, onPick }: {
  open: boolean;
  title: string;
  value: string | null;
  units: string[];
  onClose: () => void;
  onPick: (unit: string | null) => void;
}) {
  const { t } = useI18n();
  const { unitLabel } = useAmount();
  const [custom, setCustom] = useState('');
  useEffect(() => {
    if (open) setCustom('');
  }, [open]);
  const others = GROCERY_UNITS.filter((u) => !units.includes(u));
  const pickCustom = () => custom.trim() && onPick(custom.trim().toLowerCase());

  return (
    <Sheet open={open} onClose={onClose} label={title}>
      <h2 className="title3" style={{ marginBottom: 'var(--s-1)' }}>{title}</h2>
      <h3 className="section-label">{t('groceries.suggestedUnits')}</h3>
      <div className="chips">
        {units.map((u) => <Chip key={u} pressed={u === value} onClick={() => onPick(u)}>{unitLabel(u)}</Chip>)}
      </div>
      {others.length > 0 && (
        <>
          <h3 className="section-label">{t('groceries.allUnits')}</h3>
          <div className="chips">
            {others.map((u) => <Chip key={u} pressed={u === value} onClick={() => onPick(u)}>{unitLabel(u)}</Chip>)}
          </div>
        </>
      )}
      <h3 className="section-label">{t('groceries.customUnit')}</h3>
      <div className="row">
        <input className="input" value={custom} placeholder={t('groceries.customUnitPlaceholder')} aria-label={t('groceries.customUnit')}
          onChange={(e) => setCustom(e.target.value)} enterKeyHint="done"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); pickCustom(); } }} />
        <button type="button" className="icon-btn icon-btn--filled" aria-label={t('groceries.customUnit')}
          disabled={!custom.trim()} onClick={pickCustom}>
          <Icon name="check" />
        </button>
      </div>
    </Sheet>
  );
}

/** Dragged left past this (px), the row is removed. */
const SWIPE_REMOVE = 90;

/** A list row that swipes left to remove. Taps inside still work. */
export function SwipeRow({ children, onRemove, label, className = '' }: {
  children: ReactNode;
  onRemove: () => void;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; dx: number; active: boolean; id: number } | null>(null);
  const swiped = useRef(false);

  const place = (x: number, animate: boolean) => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 0.2s ease' : 'none';
    el.style.transform = x ? `translateX(${x}px)` : '';
  };

  return (
    <div className={`swipe ${className}`}>
      <div className="swipe__behind" aria-hidden><Icon name="trash" /></div>
      <div
        ref={ref}
        className="swipe__front list-row"
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse') return;
          drag.current = { x: e.clientX, y: e.clientY, dx: 0, active: false, id: e.pointerId };
          swiped.current = false;
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (!d.active) {
            if (Math.abs(dy) > 10) { drag.current = null; return; }
            if (dx > -10) return;
            d.active = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          d.dx = Math.min(0, dx);
          place(d.dx, false);
        }}
        onPointerUp={() => {
          const d = drag.current;
          drag.current = null;
          if (!d?.active) return;
          swiped.current = true;
          if (d.dx < -SWIPE_REMOVE) {
            place(-(ref.current?.offsetWidth ?? 400), true);
            window.setTimeout(onRemove, 180);
          } else {
            place(0, true);
          }
        }}
        onPointerCancel={() => {
          drag.current = null;
          place(0, true);
        }}
        onClickCapture={(e) => {
          // The click that ends a swipe isn't a tap.
          if (swiped.current) {
            e.stopPropagation();
            e.preventDefault();
            swiped.current = false;
          }
        }}
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}

/** Spins while changes are being saved; a warning to tap when some weren't. Hidden when all is saved. */
export function SyncIcon({ status, onRetry }: { status: SyncStatus; onRetry: () => void }) {
  const { t } = useI18n();
  if (status === 'idle') return null;
  if (status === 'syncing') {
    return (
      <span className="sync-icon sync-icon--busy" role="status" aria-label={t('groceries.syncSaving')}>
        <Icon name="sync" size={20} />
      </span>
    );
  }
  return (
    <button type="button" className="icon-btn sync-icon sync-icon--error" aria-label={t('groceries.syncError')} onClick={onRetry}>
      <Icon name="alert" size={20} />
    </button>
  );
}

const fold = (c: string) => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().charAt(0) || c;

/** The name with the part matching the query in bold (accents and case ignored, word starts first). */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = [...query.trim()].map(fold).join('');
  if (!q) return <>{text}</>;
  const chars = [...text];
  const folded = chars.map(fold).join('');
  let at = -1;
  for (let i = folded.indexOf(q); i !== -1; i = folded.indexOf(q, i + 1)) {
    if (i === 0 || /[\s'’-]/.test(folded[i - 1])) { at = i; break; }
    if (at === -1) at = i;
  }
  if (at === -1) return <>{text}</>;
  return (
    <>
      {chars.slice(0, at).join('')}
      <strong>{chars.slice(at, at + q.length).join('')}</strong>
      {chars.slice(at + q.length).join('')}
    </>
  );
}
