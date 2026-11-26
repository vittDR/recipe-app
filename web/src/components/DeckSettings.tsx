// Tonight's deck settings: who eats (members and extra eaters, one tile
// each), time, mood, and "more filters" (protein,
// cuisine, base, spice, calories and protein per serving) in a second view of
// the same sheet. On Ce soir a bar under the deal card shows who, time and
// mood and opens them in a sheet.
import { useState } from 'react';
import {
  type DeckFilters, FILTER_BASES, FILTER_EFFORTS, FILTER_CUISINES, FILTER_SPICES, filterCount, MAX_KCAL_LIMIT, MIN_PROTEIN_LIMIT, proteinsForDiet,
} from '@logic/deckFilters.ts';
import type { Diet, Mood } from '../lib/types.ts';
import { useI18n } from '../i18n/index.tsx';
import { Icon, type IconName } from './Icon.tsx';
import { EATER_COLOR, usePortionTotal } from '../lib/eaters.ts';
import { Avatar, Button, Chip, ListRow, Section, Sheet, SheetHeader } from './ui.tsx';

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

/** Up to this many eating, the bar's "who" cell shows their faces; more, just how many. */
const BAR_FACES = 4;

/**
 * Tonight's settings as a bar under the deal card: who eats (when there is
 * anyone else), time and mood each open the sheet; the sliders open its more
 * filters, badged with how many are on.
 */
export function DeckSettingsBar({ settings, table, onOpen }: {
  settings: DeckSettings;
  table: Table;
  onOpen: (view: 'main' | 'filters') => void;
}) {
  const { t } = useI18n();
  const labels = useDeckLabels();
  const faces = [
    ...table.members.filter((m) => settings.members.includes(m.id)),
    ...table.eaters.filter((e) => settings.eaters.includes(e.id)).map((e) => ({ id: e.id, name: e.name, color: EATER_COLOR })),
  ];
  const count = filterCount(settings.filters);
  const m = settings.maxMinutes;
  return (
    <div className="card deck-bar">
      {hasOthers(table) && (
        <button type="button" className="deck-bar__cell" onClick={() => onOpen('main')}>
          <span className="deck-bar__label">{t('tonight.whoShort')}</span>
          <span className="deck-bar__value">
            {faces.length <= BAR_FACES ? (
              <span className="avatars" role="img" aria-label={faces.map((f) => f.name).join(', ')}>
                {faces.map((f) => <Avatar key={f.id} name={f.name} color={f.color} />)}
              </span>
            ) : <span className="tabular">{faces.length}</span>}
          </span>
        </button>
      )}
      <button type="button" className="deck-bar__cell" onClick={() => onOpen('main')}>
        <span className="deck-bar__label">{t('tonight.timeLabel')}</span>
        <span className="deck-bar__value">{m === null ? <Icon name="infinity" size={24} label={t('tonight.anyTime')} /> : t('tonight.minutes', { n: m })}</span>
      </button>
      <button type="button" className="deck-bar__cell" onClick={() => onOpen('main')}>
        <span className="deck-bar__label">{t('tonight.mood')}</span>
        <span className="deck-bar__value">{labels.mood(settings.mood)}</span>
      </button>
      <button type="button" className="deck-bar__filters" onClick={() => onOpen('filters')}
        aria-label={count ? `${t('tonight.filters.title')} (${count})` : t('tonight.filters.title')}>
        <Icon name="sliders" size={22} />
        {count > 0 && <span className="deck-bar__badge tabular">{count}</span>}
      </button>
    </div>
  );
}

/** Adds or removes `v` from a row of choices; an emptied row is no filter. */
function toggle<T extends string>(list: T[] | undefined, v: T): T[] | undefined {
  const next = list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v];
  return next.length ? next : undefined;
}

/**
 * The stepper's value, typed directly: tapping it opens the numeric keypad.
 * Only the number is typed (the unit stays after it); it applies on blur or
 * Enter, capped at `max`, and an empty field or 0 lifts the limit.
 */
function AmountValue({ label, unit, value, max, onChange }: {
  label: string;
  unit: string;
  value: number;
  max: number;
  onChange: (v: number | undefined) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);
  const commit = () => {
    if (draft === null) return;
    const n = Number.parseInt(draft, 10);
    onChange(Number.isFinite(n) && n > 0 ? Math.min(n, max) : undefined);
    setDraft(null);
  };
  return (
    <label className="nutrition-row__value tabular">
      <input className="nutrition-row__input" type="text" inputMode="numeric" pattern="[0-9]*" enterKeyHint="done"
        aria-label={label} value={shown} style={{ width: `${Math.max(shown.length, 1)}ch` }}
        onFocus={(e) => { setDraft(String(value)); e.target.select(); }}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
      {' '}{unit}
    </label>
  );
}

/**
 * A nutrition limit as a settings row: icon tile, name, "per serving", then a
 * − value + stepper whose value can be typed. Unset, the stepper is a "No limit" pill that starts it at
 * `start`; stepping below `min` lifts the limit again.
 */
function NutritionRow({ icon, label, unit, value, start, step, min, max, onChange }: {
  icon: IconName;
  label: string;
  unit: string;
  value: number | undefined;
  start: number;
  step: number;
  min: number;
  max: number;
  onChange: (v: number | undefined) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="list-row nutrition-row" role="group" aria-label={label}>
      <span className="icon-tile icon-tile--plain"><Icon name={icon} size={18} /></span>
      <span className="list-row__main">
        <span className="list-row__title">{label}</span>
        <span className="list-row__meta">{t('recipe.perServing')}</span>
      </span>
      {value == null ? (
        <button type="button" className="nutrition-row__none" onClick={() => onChange(start)}>{t('tonight.filters.noLimit')}</button>
      ) : (
        <span className="nutrition-row__stepper">
          <button type="button" className="nutrition-row__step" aria-label={`${label} −`}
            onClick={() => onChange(value - step < min ? undefined : value - step)}>
            <Icon name="minus" size={18} />
          </button>
          <AmountValue label={label} unit={unit} value={value} max={max} onChange={onChange} />
          <button type="button" className="nutrition-row__step" aria-label={`${label} +`} disabled={value >= max}
            onClick={() => onChange(Math.min(max, value + step))}>
            <Icon name="plus" size={18} />
          </button>
        </span>
      )}
    </div>
  );
}

export function DeckSettingsSheet({ open, onClose, title, settings, onChange, table, diet, onDeal, dealing, error, startOn = 'main' }: {
  open: boolean;
  /** The view the sheet opens on: the deck settings, or straight to more filters. */
  startOn?: 'main' | 'filters';
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
  // Null until the person moves between views: the sheet shows `startOn`.
  const [moved, setView] = useState<'main' | 'filters' | null>(null);
  const view = moved ?? startOn;
  const close = () => {
    setView(null);
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
    // A list that only selects: "OK" in the title row takes you back to the
    // deck, or closes the sheet when it opened straight here.
    return (
      <Sheet open={open} onClose={close} label={t('tonight.filters.heading')} depth={1}>
        <SheetHeader title={t('tonight.filters.heading')}
          action={<Button small variant="text" onClick={() => (startOn === 'filters' && !moved ? close() : setView('main'))}>{t('app.done')}</Button>} />
        <Section label={t('tonight.filters.protein')} flush>
          <div className="chips">
            {proteinsForDiet(diet).map((p) => (
              <Chip key={p} pressed={!!f.proteins?.includes(p)} onClick={() => setFilters({ ...f, proteins: toggle(f.proteins, p) })}>
                {t(`tonight.filters.proteins.${p}`)}
              </Chip>
            ))}
          </div>
        </Section>
        <Section label={t('tonight.filters.nutrition')}>
          <div className="list">
            <NutritionRow icon="flame" label={t('tonight.filters.maxKcal')} unit="kcal" value={f.maxKcal}
              start={700} step={50} min={200} max={MAX_KCAL_LIMIT} onChange={(v) => setFilters({ ...f, maxKcal: v })} />
            <NutritionRow icon="dumbbell" label={t('tonight.filters.minProtein')} unit="g" value={f.minProteinG}
              start={30} step={5} min={5} max={MIN_PROTEIN_LIMIT} onChange={(v) => setFilters({ ...f, minProteinG: v })} />
          </div>
        </Section>
        <Section label={t('tonight.filters.cuisine')}>
          <div className="chips">
            {FILTER_CUISINES.map((c) => (
              <Chip key={c} pressed={!!f.cuisines?.includes(c)} onClick={() => setFilters({ ...f, cuisines: toggle(f.cuisines, c) })}>
                {t(`tonight.filters.cuisines.${c}`)}
              </Chip>
            ))}
          </div>
        </Section>
        <Section label={t('tonight.filters.base')}>
          <div className="chips">
            {FILTER_BASES.map((b) => (
              <Chip key={b} pressed={!!f.bases?.includes(b)} onClick={() => setFilters({ ...f, bases: toggle(f.bases, b) })}>
                {t(`tonight.filters.bases.${b}`)}
              </Chip>
            ))}
          </div>
        </Section>
        <Section label={t('tonight.filters.spice')}>
          <div className="chips">
            {FILTER_SPICES.map((s) => (
              <Chip key={s} pressed={(f.spice ?? 'any') === s}
                onClick={() => setFilters({ ...f, spice: s === 'any' ? undefined : s })}>
                {t(`tonight.filters.spices.${s}`)}
              </Chip>
            ))}
          </div>
        </Section>
        {count > 0 && (
          <Button className="mt-4" variant="text" onClick={() => setFilters({})}>{t('tonight.filters.clearAll')}</Button>
        )}
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={close} label={title}>
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
        <div className="chips">
          {TIMES.map((m) => (
            <Chip key={m ?? 'any'} pressed={settings.maxMinutes === m} onClick={() => onChange({ ...settings, maxMinutes: m })}>
              {labels.time(m)}
            </Chip>
          ))}
        </div>
      </Section>
      <Section label={t('tonight.effortLabel')}>
        <div className="chips">
          {EFFORTS.map((e) => (
            <Chip key={e} pressed={(f.effort ?? 'any') === e}
              onClick={() => onChange({ ...settings, filters: { ...f, effort: e === 'any' ? undefined : e } })}>
              {t(`tonight.efforts.${e}`)}
            </Chip>
          ))}
        </div>
      </Section>
      <Section label={t('tonight.mood')}>
        <div className="chips">
          {MOODS.map((m) => (
            <Chip key={m} pressed={settings.mood === m} onClick={() => onChange({ ...settings, mood: m })}>{labels.mood(m)}</Chip>
          ))}
        </div>
      </Section>
      <div className="list mt-4">
        <ListRow icon={<Icon name="sliders" size={18} />} title={t('tonight.filters.title')}
          meta={labels.filters(f) ?? t('tonight.filters.none')} onClick={() => setView('filters')} chevron />
      </div>
      {deal}
    </Sheet>
  );
}
