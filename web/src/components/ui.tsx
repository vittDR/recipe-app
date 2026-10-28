// Household Warm components: Button, Chip, Segmented, ListRow, Checkbox,
// Avatar, Screen, Field, Stepper, Sheet, Toast.

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
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

/** Dragged this far down (px), or flicked faster than this (px/ms), the sheet closes. */
const SHEET_CLOSE_DISTANCE = 120;
const SHEET_CLOSE_SPEED = 0.6;

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Swipe down to close: from the top of the sheet's content, a downward drag
  // moves the sheet instead of scrolling it. Non-passive listeners, so the
  // drag can stop the page from scrolling underneath.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!open || !sheet) return;
    let startY = 0;
    let dy = 0;
    // Recent positions, to measure the flick at the end of the drag.
    let samples: { y: number; t: number }[] = [];
    let dragging = false;
    let atTop = false;
    const place = (y: number, animate: boolean) => {
      sheet.style.transition = animate ? 'transform 0.22s ease' : 'none';
      sheet.style.transform = y ? `translate(-50%, ${y}px)` : '';
      if (backdropRef.current) backdropRef.current.style.opacity = y ? String(Math.max(0, 1 - y / 400)) : '';
    };
    const onStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      samples = [{ y: startY, t: e.timeStamp }];
      dy = 0;
      dragging = false;
      atTop = sheet.scrollTop <= 0;
    };
    const onMove = (e: TouchEvent) => {
      dy = e.touches[0].clientY - startY;
      samples = [...samples.filter((s) => e.timeStamp - s.t < 100), { y: e.touches[0].clientY, t: e.timeStamp }];
      if (!dragging && atTop && dy > 6) dragging = true;
      if (!dragging) return;
      e.preventDefault();
      place(Math.max(0, dy), false);
    };
    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      const first = samples[0];
      const last = samples[samples.length - 1];
      const speed = (last.y - first.y) / Math.max(16, last.t - first.t);
      if (dy > SHEET_CLOSE_DISTANCE || speed > SHEET_CLOSE_SPEED) {
        place(sheet.offsetHeight, true);
        window.setTimeout(() => closeRef.current(), 180);
      } else {
        place(0, true);
      }
    };
    sheet.addEventListener('touchstart', onStart, { passive: true });
    sheet.addEventListener('touchmove', onMove, { passive: false });
    sheet.addEventListener('touchend', onEnd);
    sheet.addEventListener('touchcancel', onEnd);
    return () => {
      sheet.removeEventListener('touchstart', onStart);
      sheet.removeEventListener('touchmove', onMove);
      sheet.removeEventListener('touchend', onEnd);
      sheet.removeEventListener('touchcancel', onEnd);
    };
  }, [open]);

  if (!open) return null;
  return (
    <>
      <div className="sheet-backdrop" ref={backdropRef} onClick={onClose} />
      <div className="sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-label={label}>
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

/** The photo's URL when it can be shown: absolute URLs, or photos served by the app itself ("/recipe-photos/…"). */
export function photoUrl(path: string | null): string | null {
  return path && /^(https?:\/\/|\/(?!\/))/.test(path) ? path : null;
}

export function imageStyle(path: string | null): React.CSSProperties | undefined {
  const url = photoUrl(path);
  return url ? { backgroundImage: `url("${url.replace(/"/g, '%22')}")` } : undefined;
}

/** The small copy of a seed photo (scripts/make_thumbnails.py); other photos as they are. */
export function thumbUrl(path: string | null): string | null {
  return photoUrl(path)?.replace(/^\/recipe-photos\/(?!thumb\/)/, '/recipe-photos/thumb/') ?? null;
}

/** Photo for grids and lists: a thumbnail, fetched only when scrolled near. */
export function RecipeThumb({ recipe }: { recipe: { title: string; tags: string[]; image_path: string | null } }) {
  const src = thumbUrl(recipe.image_path);
  return src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <span aria-hidden>{recipeEmoji(recipe.title, recipe.tags)}</span>;
}
