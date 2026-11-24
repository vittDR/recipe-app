// Tonight's deck settings: who eats (members and extra eaters, one tile
// each), time, mood, and "more filters" (protein,
// cuisine, base, spice, calories and protein per serving) in a second view of
// the same sheet. Secondary by
// design: a one-line summary on Ce soir opens them in a sheet.
import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  type DeckFilters, FILTER_BASES, FILTER_EFFORTS, FILTER_CUISINES, FILTER_SPICES, filterCount, MAX_KCAL_LIMIT, MIN_PROTEIN_LIMIT, proteinsForDiet,
} from '@logic/deckFilters.ts';
import type { Diet, Mood } from '../lib/types.ts';
import { useI18n } from '../i18n/index.tsx';
import { Icon, type IconName } from './Icon.tsx';
import { EATER_COLOR, usePortionTotal } from '../lib/eaters.ts';
import { Avatar, Button, Section, Sheet, SheetHeader } from './ui.tsx';

export interface DeckSettings {
  /** Members eating, who swipe; always includes the person dealing. */
  members: string[];
  /** Extra eaters at the table (household_eaters ids): they change portions, never swipe. */
  eaters: string[];
  maxMinutes: number | null;
  mood: Mood;
  filters: DeckFilters;
}

export const TIMES = [20, 30, 40, 60, null] as const;
export const MOODS: Mood[] = ['any', 'comfort', 'light', 'healthy', 'quick', 'fancy'];
/** How much work: the minimum (easy only), some (nothing hard), anything. Kept in the filters. */
export const EFFORTS = [...FILTER_EFFORTS, 'any'] as const;

/** Everyone who could eat tonight: the members (you first), then the household's extra eaters. */
export interface Table {
  me: string;
  members: { id: string; name: string; color: string }[];
  eaters: { id: string; name: string; portion: number }[];
}

/** Someone besides you could eat, so "who eats" is a question. */
export const hasOthers = (table: Table) => table.members.length > 1 || table.eaters.length > 0;

/** Everyone in the household: the first deck's selection. */
export const everyone = (table: Table) => ({ members: table.members.map((m) => m.id), eaters: table.eaters.map((e) => e.id) });

/** Portions at the table: 1 per member, each extra eater their portion. */
export const tablePortions = (s: Pick<DeckSettings, 'members' | 'eaters'>, table: Table) =>
  s.members.length + table.eaters.filter((e) => s.eaters.includes(e.id)).reduce((sum, e) => sum + e.portion, 0);

/** Up to this many choices are named in the summary; more read as "3 filters". */
const NAMED_FILTERS = 2;

export function useDeckLabels() {
  const { t, tn } = useI18n();
  const time = (m: number | null) => (m === null ? t('tonight.anyTime') : m >= 60 ? t('tonight.underHour') : t('tonight.upTo', { n: m }));
  /**
   * Who eats, in a word (handoff v2 §4): exactly two members and no one else
   * "Nous deux", everyone with extra eaters "Tout le monde", only you "Juste
   * moi", anything else "N personnes" (heads, not portions).
   */
  const who = (s: Pick<DeckSettings, 'members' | 'eaters'>, table: Table) => {
    const heads = s.members.length + s.eaters.length;
    if (heads === 1 && s.members.includes(table.me)) return t('tonight.justMe');
    if (s.eaters.length === 0 && s.members.length === 2) return t('tonight.both');
    const all = table.members.every((m) => s.members.includes(m.id)) && table.eaters.every((e) => s.eaters.includes(e.id));
    if (all) return t('tonight.everyone');
    return tn('tonight.people', heads);
  };
  const mood = (m: Mood) => t(`tonight.moods.${m}`);
  /** Every choice made, by name, in the sheet's order. */
  const filterNames = (f: DeckFilters | null | undefined) => [
    ...(f?.proteins ?? []).map((p) => t(`tonight.filters.proteins.${p}`)),
    ...(f?.cuisines ?? []).map((c) => t(`tonight.filters.cuisines.${c}`)),
    ...(f?.bases ?? []).map((b) => t(`tonight.filters.bases.${b}`)),
    ...(f?.spice && f.spice !== 'any' ? [t(`tonight.filters.spices.${f.spice}`)] : []),
    ...(f?.maxKcal ? [t('tonight.filters.kcalShort', { n: f.maxKcal })] : []),
    ...(f?.minProteinG ? [t('tonight.filters.proteinShort', { n: f.minProteinG })] : []),
  ];
  const filters = (f: DeckFilters | null | undefined) => {
    const names = filterNames(f);
    if (names.length === 0) return null;
    return names.length <= NAMED_FILTERS ? names.join(', ') : t('tonight.filters.count', { n: names.length });
  };
  return {
    time,
    who,
    mood,
    filters,
    /** "Nous deux · Moins d'1 h · Réconfort · Poulet"; who only when there is someone to eat with. */
    summary: (s: DeckSettings, table: Table) =>
      [hasOthers(table) && who(s, table), time(s.maxMinutes), s.filters.effort && t(`tonight.efforts.${s.filters.effort}`), mood(s.mood),
        filters(s.filters)].filter(Boolean).join(' · '),
  };
}

/** The summary row: opens the sheet. */
export function DeckSummaryRow({ settings, table, onClick }: { settings: DeckSettings; table: Table; onClick: () => void }) {
  const labels = useDeckLabels();
  return (
    <button type="button" className="card summary-row" onClick={onClick}>
      <Icon name={settings.members.length + settings.eaters.length > 1 ? 'people' : 'person'} size={20} />
      <span className="summary-row__text">{labels.summary(settings, table)}</span>
      <span className="chevron"><Icon name="chevron" size={18} /></span>
    </button>
  );
}

/** A line icon per mood, drawn above its name like an avatar on a who tile. */
const MOOD_ICONS: Record<Mood, IconName> = {
  any: 'compass', comfort: 'pot', light: 'leaf', healthy: 'sprout', quick: 'bolt', fancy: 'utensils',
};

/**
 * A grid of tiles in the who-tile style, one choice per tile: a short value
 * (an icon, a number) over its name. One-of (no check badge); the selected
 * tile takes the accent ring and soft fill.
 */
export function ChoiceTiles<T extends string | number | null>({ options, value, onChange, cols, label }: {
  options: { value: T; label: string; icon?: IconName; big?: string }[];
  value: T;
  onChange: (v: T) => void;
  cols: number;
  label: string;
}) {
  return (
    <div className="choice-grid" role="group" aria-label={label} style={{ '--cols': cols } as CSSProperties}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" className="choice-tile" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={o.icon} size={22} />}
          {o.big && <span className="choice-tile__big">{o.big}</span>}
          <span className="choice-tile__label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/** A choice in a many-of row: the who-tile look as a pill, with its check when on. */
function PickChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="pick-chip" aria-pressed={on} onClick={onClick}>
      {on && <span className="pick-chip__check" aria-hidden><Icon name="check" size={10} strokeWidth={3.6} /></span>}
      {children}
    </button>
  );
}

/** Adds or removes `v` from a row of choices; an emptied row is no filter. */
function toggle<T extends string>(list: T[] | undefined, v: T): T[] | undefined {
  const next = list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v];
  return next.length ? next : undefined;
}

/** A whole number typed in a box with its unit after it; emptied, it is no filter. */
function AmountInput({ label, unit, value, max, onChange }: {
  label: string;
  unit: string;
  value: number | undefined;
  max: number;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <label className="field amount-field">
      <span className="field__label">{label}</span>
      <span className={value ? 'amount-input amount-input--set' : 'amount-input'}>
        <input className="input tabular" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="—"
          value={value ?? ''}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value.replace(/\D/g, ''), 10);
            onChange(Number.isFinite(n) && n > 0 ? Math.min(n, max) : undefined);
          }} />
        <span className="amount-input__unit" aria-hidden>{unit}</span>
      </span>
    </label>
  );
}

export function DeckSettingsSheet({ open, onClose, title, settings, onChange, table, diet, onDeal, dealing, error }: {
  open: boolean;
  onClose: () => void;
  /** The evening the deck is for: "Tonight’s deck", "Tomorrow’s deck", "Thursday’s deck". */
  title: string;
  settings: DeckSettings;
  onChange: (s: DeckSettings) => void;
  /** Who could eat tonight. */
  table: Table;
  /** The dealer's diet: only the proteins it allows are offered. */
  diet: Diet;
  onDeal: () => void;
  dealing: boolean;
  error: string | null;
}) {
  const { t, tn } = useI18n();
  const labels = useDeckLabels();
  const portions = usePortionTotal();
  const shared = hasOthers(table);
  const [view, setView] = useState<'main' | 'filters'>('main');
  const close = () => {
    setView('main');
    onClose();
  };
  const f = settings.filters;
  const setFilters = (next: DeckFilters) => onChange({ ...settings, filters: next });
  const count = filterCount(f);

  const deal = (
    <>
      {error && <p className="notice mt-4">{error}</p>}
      <Button className="sheet__actions" block disabled={dealing} onClick={onDeal}>
        {dealing ? t('tonight.dealing') : t('tonight.deal')}
      </Button>
    </>
  );

  if (view === 'filters') {
    // A list that only selects: "OK" in the title row takes you back to the deck.
    return (
      <Sheet open={open} onClose={close} label={t('tonight.filters.heading')} depth={1} className="deck-sheet">
        <SheetHeader title={t('tonight.filters.heading')}
          action={<Button small variant="text" onClick={() => setView('main')}>{t('app.done')}</Button>} />
        <Section label={t('tonight.filters.protein')} flush>
          <div className="chips">
            {proteinsForDiet(diet).map((p) => (
              <PickChip key={p} on={!!f.proteins?.includes(p)} onClick={() => setFilters({ ...f, proteins: toggle(f.proteins, p) })}>
                {t(`tonight.filters.proteins.${p}`)}
              </PickChip>
            ))}
          </div>
        </Section>
        <section className="section">
          <div className="amount-fields">
            <AmountInput label={t('tonight.filters.maxKcal')} unit={t('tonight.filters.kcalPerServing')} value={f.maxKcal} max={MAX_KCAL_LIMIT}
              onChange={(v) => setFilters({ ...f, maxKcal: v })} />
            <AmountInput label={t('tonight.filters.minProtein')} unit={t('tonight.filters.gPerServing')} value={f.minProteinG} max={MIN_PROTEIN_LIMIT}
              onChange={(v) => setFilters({ ...f, minProteinG: v })} />
          </div>
        </section>
        <Section label={t('tonight.filters.cuisine')}>
          <div className="chips">
            {FILTER_CUISINES.map((c) => (
              <PickChip key={c} on={!!f.cuisines?.includes(c)} onClick={() => setFilters({ ...f, cuisines: toggle(f.cuisines, c) })}>
                {t(`tonight.filters.cuisines.${c}`)}
              </PickChip>
            ))}
          </div>
        </Section>
        <Section label={t('tonight.filters.base')}>
          <div className="chips">
            {FILTER_BASES.map((b) => (
              <PickChip key={b} on={!!f.bases?.includes(b)} onClick={() => setFilters({ ...f, bases: toggle(f.bases, b) })}>
                {t(`tonight.filters.bases.${b}`)}
              </PickChip>
            ))}
          </div>
        </Section>
        <Section label={t('tonight.filters.spice')}>
          <ChoiceTiles cols={FILTER_SPICES.length} label={t('tonight.filters.spice')} value={f.spice ?? 'any'}
            options={FILTER_SPICES.map((v) => ({ value: v, label: t(`tonight.filters.spices.${v}`) }))}
            onChange={(v) => setFilters({ ...f, spice: v === 'any' ? undefined : v })} />
        </Section>
        {count > 0 && (
          <Button className="mt-4" variant="text" onClick={() => setFilters({})}>{t('tonight.filters.clearAll')}</Button>
        )}
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={close} label={title} className="deck-sheet">
      <SheetHeader title={title} />
      {shared && (
        <Section label={t('tonight.whoEating')} flush
          action={<span className="who-count">
            {tn('tonight.people', settings.members.length + settings.eaters.length)} · {portions(tablePortions(settings, table))}
          </span>}>
          <div className="who-tiles">
            {table.members.map((m) => {
              const on = settings.members.includes(m.id);
              // You deal, so you swipe: your tile stays on. Leaving the others out makes a solo deck.
              const fixed = m.id === table.me;
              return (
                <button key={m.id} type="button" className="who-tile" aria-pressed={on} aria-disabled={fixed}
                  onClick={() => !fixed && onChange({ ...settings, members: on ? settings.members.filter((x) => x !== m.id) : [...settings.members, m.id] })}>
                  {on && <span className="who-tile__check" aria-hidden><Icon name="check" size={10} strokeWidth={3.6} /></span>}
                  <Avatar name={m.name} color={m.color} />
                  <span className="who-tile__name">{m.id === table.me ? t('app.you') : m.name}</span>
                </button>
              );
            })}
            {table.eaters.map((e) => {
              const on = settings.eaters.includes(e.id);
              return (
                <button key={e.id} type="button" className="who-tile" aria-pressed={on}
                  onClick={() => onChange({ ...settings, eaters: on ? settings.eaters.filter((x) => x !== e.id) : [...settings.eaters, e.id] })}>
                  {on && <span className="who-tile__check" aria-hidden><Icon name="check" size={10} strokeWidth={3.6} /></span>}
                  <Avatar name={e.name} color={EATER_COLOR} />
                  <span className="who-tile__name">{e.name}</span>
                </button>
              );
            })}
          </div>
        </Section>
      )}
      <Section label={t('tonight.timeLabel')} flush={!shared}>
        <ChoiceTiles cols={TIMES.length} label={t('tonight.timeLabel')} value={settings.maxMinutes}
          options={TIMES.map((m) => (m === null
            ? { value: m, label: t('tonight.anyTime') }
            : m >= 60
              ? { value: m, big: String(m / 60), label: t('tonight.timeUnits.h') }
              : { value: m, big: String(m), label: t('tonight.timeUnits.min') }))}
          onChange={(m) => onChange({ ...settings, maxMinutes: m })} />
      </Section>
      <Section label={t('tonight.effortLabel')}>
        <ChoiceTiles cols={EFFORTS.length} label={t('tonight.effortLabel')} value={f.effort ?? 'any'}
          options={EFFORTS.map((e) => ({ value: e, label: t(`tonight.efforts.${e}`) }))}
          onChange={(e) => onChange({ ...settings, filters: { ...f, effort: e === 'any' ? undefined : e } })} />
      </Section>
      <Section label={t('tonight.mood')}>
        <ChoiceTiles cols={3} label={t('tonight.mood')} value={settings.mood}
          options={MOODS.map((m) => ({ value: m, label: labels.mood(m), icon: MOOD_ICONS[m] }))}
          onChange={(m) => onChange({ ...settings, mood: m })} />
      </Section>
      <button type="button" className="more-filters" aria-pressed={count > 0} onClick={() => setView('filters')}>
        <span className="more-filters__icon"><Icon name="sliders" size={18} /></span>
        <span className="more-filters__main">
          <span className="more-filters__title">{t('tonight.filters.title')}</span>
          <span className="more-filters__meta">{labels.filters(f) ?? t('tonight.filters.none')}</span>
        </span>
        {count > 0 && <span className="more-filters__count tabular">{count}</span>}
        <span className="chevron"><Icon name="chevron" size={18} /></span>
      </button>
      {deal}
    </Sheet>
  );
}
