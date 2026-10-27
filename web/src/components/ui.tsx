// Household Warm components: Button, Chip, Segmented, ListRow, Checkbox,
// Avatar, Screen, Field, Stepper, Sheet, Toast.

import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '../i18n/index.tsx';
import { Icon } from './Icon.tsx';

type ButtonVariant = 'primary' | 'dark' | 'secondary' | 'text';

export function Button({
  variant = 'primary',
  block,
  small,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; block?: boolean; small?: boolean }) {
  const cls = ['btn', `btn--${variant}`, block && 'btn--block', small && 'btn--small', className].filter(Boolean).join(' ');
  return <button type="button" className={cls} {...rest} />;
}

export function Chip({
  pressed,
  onClick,
  children,
  onRemove,
  removeLabel,
}: {
  pressed?: boolean;
  onClick?: () => void;
  children: ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  if (onRemove) {
    return (
      <span className="chip">
        {children}
        <button type="button" className="chip__remove" onClick={onRemove} aria-label={removeLabel}>
          <Icon name="x" size={16} />
        </button>
      </span>
    );
  }
  return (
    <button type="button" className="chip" aria-pressed={pressed ?? false} onClick={onClick}>
      {children}
    </button>
  );
}

export function Tag({ children, tone }: { children: ReactNode; tone?: 'success' | 'warning' }) {
  return <span className={`chip chip--tag${tone ? ` chip--${tone}` : ''}`}>{children}</span>;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  color,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      type="button"
      className="checkbox-hit"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span className="checkbox" aria-checked={checked} style={color ? ({ '--check-color': color } as React.CSSProperties) : undefined}>
        {checked && <Icon name="check" size={16} strokeWidth={3} />}
      </span>
    </button>
  );
}

export function Avatar({ name, color, size }: { name: string; color: string; size?: 'sm' | 'lg' }) {
  return (
    <span className={`avatar${size ? ` avatar--${size}` : ''}`} style={{ background: color }} aria-hidden>
      {(name || '?').slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Screen({
  title,
  subtitle,
  back,
  right,
  plain,
  children,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean | string;
  right?: ReactNode;
  plain?: boolean;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { t } = useI18n();
  return (
    <main className={`screen${plain ? ' screen--plain' : ''}`}>
      {(back || right) && (
        <div className="screen__bar">
          {back ? (
            <button
              type="button"
              className="icon-btn"
              aria-label={t('app.back')}
              onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
            >
              <Icon name="back" />
            </button>
          ) : (
            <span />
          )}
          {right}
        </div>
      )}
      {title && <h1 className="screen__title">{title}</h1>}
      {subtitle && <p className="screen__subtitle">{subtitle}</p>}
      {children}
    </main>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="small muted">{hint}</span>}
    </label>
  );
}

export function Stepper({
  value,
  onChange,
  step,
  min,
  max,
  unit,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  max: number;
  unit: string;
  label: string;
}) {
  return (
    <div className="stepper card" role="group" aria-label={label}>
      <button type="button" className="icon-btn icon-btn--filled" aria-label={`${label} −`}
        onClick={() => onChange(Math.max(min, value - step))}>
        <Icon name="down" />
      </button>
      <div className="center">
        <div className="small muted">{label}</div>
        <div className="stepper__value">
          {value} <span className="small muted">{unit}</span>
        </div>
      </div>
      <button type="button" className="icon-btn icon-btn--filled" aria-label={`${label} +`}
        onClick={() => onChange(Math.min(max, value + step))}>
        <Icon name="up" />
      </button>
    </div>
  );
}

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="sheet__grabber" />
        {children}
      </div>
    </>
  );
}

let showToastImpl: ((msg: string) => void) | null = null;

/** Shows a short confirmation at the top of the screen. */
export function toast(msg: string) {
  showToastImpl?.(msg);
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    showToastImpl = (m) => {
      setMsg(m);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMsg(null), 2400);
    };
    return () => {
      showToastImpl = null;
      window.clearTimeout(timer);
    };
  }, []);
  return msg ? (
    <div className="toast" role="status" aria-live="polite">
      {msg}
    </div>
  ) : null;
}

export function Spinner() {
  const { t } = useI18n();
  return <div className="spinner" role="progressbar" aria-label={t('app.loading')} />;
}

/** Emoji placeholder for recipes without a photo, stable per title. */
export function recipeEmoji(title: string, tags: string[] = []): string {
  const t = `${title} ${tags.join(' ')}`.toLowerCase();
  const table: [RegExp, string][] = [
    [/curry|dal|dahl/, '🍛'], [/taco|burrito|mexic/, '🌮'], [/pasta|linguine|spaghetti|pâtes|penne/, '🍝'],
    [/salmon|saumon|cod|cabillaud|fish|poisson/, '🐟'], [/prawn|crevette|shrimp/, '🍤'], [/soup|soupe/, '🍲'],
    [/salad|salade|bowl/, '🥗'], [/egg|œuf|oeuf|omelette|shakshuka/, '🍳'], [/chicken|poulet/, '🍗'],
    [/beef|bœuf|boeuf|steak/, '🥩'], [/pork|porc/, '🥓'], [/tofu|noodle|nouille|stir/, '🥢'],
    [/pizza/, '🍕'], [/burger/, '🍔'], [/rice|riz|risotto/, '🍚'], [/veg|légume|traybake/, '🥘'],
  ];
  return table.find(([re]) => re.test(t))?.[1] ?? '🍽️';
}

export function imageStyle(path: string | null): React.CSSProperties | undefined {
  return path && /^https?:\/\//.test(path) ? { backgroundImage: `url("${path.replace(/"/g, '%22')}")` } : undefined;
}
