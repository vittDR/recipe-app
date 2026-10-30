// Household Warm components: Button, Chip, Segmented, ListRow, Section,
// Checkbox, Switch, Avatar, Screen, Field, SearchField, Stepper, ProgressBar,
// Sheet, SheetHeader, Toast and confirmation sheets.

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router';
import { useI18n } from '../i18n/index.tsx';
import { Icon } from './Icon.tsx';

/** `danger`: a text button for destructive actions (leave, remove, delete). */
type ButtonVariant = 'primary' | 'dark' | 'secondary' | 'text' | 'danger';

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

/**
 * One row of a `.list`: an optional leading icon or avatar, a title and a
 * line of detail, then trailing controls or a chevron. A link with `to`, a
 * button with `onClick`, otherwise a plain row (its controls are in `trailing`).
 */
export function ListRow({
  icon,
  title,
  meta,
  to,
  state,
  onClick,
  trailing,
  chevron = !!to,
  accent,
  className = '',
  role,
  selected,
}: {
  icon?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  to?: string;
  /** Router state for `to`, e.g. `{ back: '/' }` to override the next screen's back target. */
  state?: unknown;
  onClick?: () => void;
  trailing?: ReactNode;
  chevron?: boolean;
  /** Accent-coloured, for an action row such as "Invite someone". */
  accent?: boolean;
  className?: string;
  role?: 'option' | 'listitem';
  selected?: boolean;
}) {
  const cls = ['list-row', accent && 'list-row--accent', className].filter(Boolean).join(' ');
  const body = (
    <>
      {icon && <span className="list-row__icon">{icon}</span>}
      <span className="list-row__main">
        <span className="list-row__title">{title}</span>
        {meta && <span className="list-row__meta">{meta}</span>}
      </span>
      {trailing}
      {chevron && <span className="chevron"><Icon name="chevron" size={18} /></span>}
    </>
  );
  if (to) return <Link to={to} state={state} className={cls}>{body}</Link>;
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} role={role}
        aria-selected={role === 'option' ? (selected ?? false) : undefined}>
        {body}
      </button>
    );
  }
  return <div className={cls} role={role}>{body}</div>;
}

/** "Create “…”": the dashed row under search results when nothing matches exactly. */
export function CreateRow({ title, meta, onClick, chevron }: { title: string; meta?: string; onClick: () => void; chevron?: boolean }) {
  return (
    <button type="button" className="create-row" onClick={onClick}>
      <Icon name="squarePlus" />
      <span className="list-row__main">
        <span className="list-row__title">{title}</span>
        {meta && <span className="list-row__meta">{meta}</span>}
      </span>
      {chevron ? <span className="chevron"><Icon name="chevron" size={18} /></span> : <Icon name="plus" size={20} />}
    </button>
  );
}

/** A labelled part of a screen: the small uppercase label, an optional hint, then its content. */
export function Section({ label, hint, action, children, flush }: {
  label: string;
  hint?: string;
  /** A small button on the label's line, e.g. "Add to list". */
  action?: ReactNode;
  children: ReactNode;
  /** No space above the label, e.g. the first section in a card or sheet. */
  flush?: boolean;
}) {
  return (
    <section className={`section${flush ? ' section--flush' : ''}`}>
      {action ? (
        <div className="section__head">
          <h2 className="section-label">{label}</h2>
          {action}
        </div>
      ) : <h2 className="section-label">{label}</h2>}
      {hint && <p className="section-hint">{hint}</p>}
      {children}
    </section>
  );
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

export function Switch({ checked, onChange, label, disabled }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button type="button" role="switch" className="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}>
      <span className="switch__knob" />
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
  // A link can override the back target via router state, e.g. `state={{ back: '/' }}`.
  const target = (useLocation().state as { back?: string } | null)?.back ?? back;
  return (
    <main className={`screen${plain ? ' screen--plain' : ''}`}>
      {(back || right) && (
        <div className="screen__bar">
          {back ? (
            <button
              type="button"
              className="icon-btn"
              aria-label={t('app.back')}
              onClick={() => (typeof target === 'string' ? navigate(target) : navigate(-1))}
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

/** The bar of a full-screen mode (cooking, swiping): close on the left, what's on screen in the middle. */
export function ModeBar({ title, onClose }: { title: ReactNode; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className="screen__bar">
      <button type="button" className="icon-btn" aria-label={t('app.close')} onClick={onClose}><Icon name="x" /></button>
      <span className="headline">{title}</span>
      <span className="screen__bar-end" />
    </div>
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

/** The search box: a magnifier, the field, Enter to pick the first result. */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  onEnter,
  onFocus,
  autoFocus,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  onEnter?: () => void;
  onFocus?: () => void;
  autoFocus?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <label className="input search-field">
      <Icon name="search" size={18} />
      <input ref={inputRef} type="search" value={value} placeholder={placeholder} aria-label={label}
        autoComplete="off" enterKeyHint="done" autoFocus={autoFocus} onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); } }} />
    </label>
  );
}

/** A thin bar filled to value / max. `reserve` keeps its space while it is empty. */
export function ProgressBar({ value, max, label, reserve }: { value: number; max: number; label?: string; reserve?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="progress" role={label ? 'progressbar' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      aria-valuemin={label ? 0 : undefined} aria-valuemax={label ? max : undefined} aria-valuenow={label ? value : undefined}
      style={reserve && value === 0 ? { visibility: 'hidden' } : undefined}>
      <div style={{ width: `${pct}%` }} />
    </div>
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

let scrollLocks = 0;

/** Freezes the page behind open sheets: .scroller is the app's scroller. */
function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const scroller = document.querySelector<HTMLElement>('.scroller');
    if (scrollLocks++ === 0 && scroller) scroller.style.overflow = 'hidden';
    return () => {
      if (--scrollLocks === 0 && scroller) scroller.style.overflow = '';
    };
  }, [active]);
}

/** Dragged this far down (px), or flicked faster than this (px/ms), the sheet closes. */
const SHEET_CLOSE_DISTANCE = 120;
const SHEET_CLOSE_SPEED = 0.6;

export function Sheet({ open, onClose, children, label, className = '' }: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  /** e.g. sheet--fixed: full height whatever the content. */
  className?: string;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useScrollLock(open);

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
  // On <body>, so a sheet opened from inside another (a keypad over the
  // usuals) isn't positioned against the first one's transform.
  return createPortal(
    <>
      <div className="sheet-backdrop" ref={backdropRef} onClick={onClose} />
      <div className={`sheet ${className}`} ref={sheetRef} role="dialog" aria-modal="true" aria-label={label}>
        <div className="sheet__grabber" />
        {children}
      </div>
    </>,
    document.body,
  );
}

/** The title of a sheet and an optional line under it. */
export function SheetHeader({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <header className="sheet__header">
      <h2 className="title2">{title}</h2>
      {subtitle && <p className="muted small">{subtitle}</p>}
    </header>
  );
}

interface ConfirmOptions {
  /** The button that goes ahead, e.g. "Leave". */
  confirmLabel: string;
  /** A line under the question. */
  detail?: string;
}

let confirmImpl: ((question: string, opts: ConfirmOptions) => Promise<boolean>) | null = null;

/**
 * Asks before something that can't be undone (things that can be undone get
 * an Undo toast instead). Resolves true when the person goes ahead.
 */
export function confirmSheet(question: string, opts: ConfirmOptions): Promise<boolean> {
  return confirmImpl ? confirmImpl(question, opts) : Promise.resolve(false);
}

export function ConfirmHost() {
  const { t } = useI18n();
  const [current, setCurrent] = useState<{ question: string; opts: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null);
  useEffect(() => {
    confirmImpl = (question, opts) => new Promise((resolve) => setCurrent({ question, opts, resolve }));
    return () => {
      confirmImpl = null;
    };
  }, []);
  const answer = (ok: boolean) => {
    current?.resolve(ok);
    setCurrent(null);
  };
  return (
    <Sheet open={!!current} onClose={() => answer(false)} label={current?.question ?? ''}>
      {current && (
        <>
          <SheetHeader title={current.question} subtitle={current.opts.detail} />
          <div className="stack sheet__actions">
            <Button block variant="danger" onClick={() => answer(true)}>{current.opts.confirmLabel}</Button>
            <Button block variant="secondary" onClick={() => answer(false)}>{t('app.cancel')}</Button>
          </div>
        </>
      )}
    </Sheet>
  );
}

interface ToastOptions {
  /** A button in the toast, e.g. Undo or Retry; tapping it closes the toast. */
  action?: { label: string; onClick: () => void };
  /** How long it stays, in ms. */
  duration?: number;
}

let showToastImpl: ((msg: string, opts: ToastOptions) => void) | null = null;
let hideToastImpl: ((msg: string) => void) | null = null;

/** Shows a short confirmation at the top of the screen. */
export function toast(msg: string, opts: ToastOptions = {}) {
  showToastImpl?.(msg, opts);
}

/** Hides the toast showing now, if its message is `msg`. */
export function dismissToast(msg: string) {
  hideToastImpl?.(msg);
}

export function ToastHost() {
  const [current, setCurrent] = useState<{ msg: string; opts: ToastOptions } | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    hideToastImpl = (msg) => setCurrent((c) => (c?.msg === msg ? null : c));
    showToastImpl = (msg, opts) => {
      setCurrent({ msg, opts });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setCurrent(null), opts.duration ?? (opts.action ? 5000 : 2400));
    };
    return () => {
      showToastImpl = null;
      hideToastImpl = null;
      window.clearTimeout(timer);
    };
  }, []);
  if (!current) return null;
  const { msg, opts } = current;
  return (
    <div className={`toast${opts.action ? ' toast--action' : ''}`} role="status" aria-live="polite">
      <span>{msg}</span>
      {opts.action && (
        <button type="button" className="toast__action" onClick={() => {
          setCurrent(null);
          opts.action!.onClick();
        }}>
          {opts.action.label}
        </button>
      )}
    </div>
  );
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
