// Tonight's deck settings: who eats, time, mood, and "more filters" (protein,
// cuisine, base, spice) in a second view of the same sheet. Secondary by
// design: a one-line summary on Ce soir opens them in a sheet.
import { useState } from 'react';
import {
  type DeckFilters, FILTER_BASES, FILTER_CUISINES, FILTER_PROTEINS, FILTER_SPICES, filterCount,
} from '@logic/deckFilters.ts';
import type { Mood } from '../lib/types.ts';
import { useI18n } from '../i18n/index.tsx';
import { Icon } from './Icon.tsx';
import { Button, Chip, ListRow, Section, Sheet, SheetHeader } from './ui.tsx';

export interface DeckSettings {
  who: 'both' | 'me';
  maxMinutes: number | null;
  mood: Mood;
  filters: DeckFilters;
}

export const TIMES = [20, 30, 40, 60, null] as const;
export const MOODS: Mood[] = ['any', 'comfort', 'light', 'healthy', 'quick', 'fancy'];

/** Up to this many choices are named in the summary; more read as "3 filters". */
const NAMED_FILTERS = 2;

export function useDeckLabels() {
  const { t } = useI18n();
  const time = (m: number | null) => (m === null ? t('tonight.anyTime') : m >= 60 ? t('tonight.underHour') : t('tonight.upTo', { n: m }));
  const who = (w: DeckSettings['who']) => (w === 'me' ? t('tonight.justMe') : t('tonight.both'));
  const mood = (m: Mood) => t(`tonight.moods.${m}`);
  /** Every choice made, by name, in the sheet's order. */
  const filterNames = (f: DeckFilters | null | undefined) => [
    ...(f?.proteins ?? []).map((p) => t(`tonight.filters.proteins.${p}`)),
    ...(f?.cuisines ?? []).map((c) => t(`tonight.filters.cuisines.${c}`)),
    ...(f?.bases ?? []).map((b) => t(`tonight.filters.bases.${b}`)),
    ...(f?.spice && f.spice !== 'any' ? [t(`tonight.filters.spices.${f.spice}`)] : []),
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
    summary: (s: DeckSettings, shared: boolean) =>
      [shared && who(s.who), time(s.maxMinutes), mood(s.mood), filters(s.filters)].filter(Boolean).join(' · '),
  };
}

/** The summary row: opens the sheet. */
export function DeckSummaryRow({ settings, shared, onClick }: { settings: DeckSettings; shared: boolean; onClick: () => void }) {
  const labels = useDeckLabels();
  return (
    <button type="button" className="card summary-row" onClick={onClick}>
      <Icon name={shared && settings.who === 'both' ? 'people' : 'person'} size={20} />
      <span className="summary-row__text">{labels.summary(settings, shared)}</span>
      <span className="chevron"><Icon name="chevron" size={18} /></span>
    </button>
  );
}

/** Adds or removes `v` from a row of choices; an emptied row is no filter. */
function toggle<T extends string>(list: T[] | undefined, v: T): T[] | undefined {
  const next = list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v];
  return next.length ? next : undefined;
}

export function DeckSettingsSheet({ open, onClose, settings, onChange, shared, onDeal, dealing, error }: {
  open: boolean;
  onClose: () => void;
  settings: DeckSettings;
  onChange: (s: DeckSettings) => void;
  /** Someone else in the household, so "who eats" is a question. */
  shared: boolean;
  onDeal: () => void;
  dealing: boolean;
  error: string | null;
}) {
  const { t } = useI18n();
  const labels = useDeckLabels();
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
    return (
      <Sheet open={open} onClose={close} label={t('tonight.filters.title')}>
        <SheetHeader
          title={(
            <span className="row">
              <button type="button" className="icon-btn" aria-label={t('app.back')} onClick={() => setView('main')}>
                <Icon name="back" />
              </button>
              {t('tonight.filters.title')}
            </span>
          )}
          action={count > 0 ? <Button small variant="text" onClick={() => setFilters({})}>{t('tonight.filters.clear')}</Button> : undefined}
        />
        <Section label={t('tonight.filters.protein')} hint={t('tonight.filters.anyHint')} flush>
          <div className="chips">
            {FILTER_PROTEINS.map((p) => (
              <Chip key={p} pressed={!!f.proteins?.includes(p)} onClick={() => setFilters({ ...f, proteins: toggle(f.proteins, p) })}>
                {t(`tonight.filters.proteins.${p}`)}
              </Chip>
            ))}
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
        {deal}
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={close} label={t('tonight.settingsTitle')}>
      <SheetHeader title={t('tonight.settingsTitle')} />
      {shared && (
        <Section label={t('tonight.whoEating')} flush>
          <div className="chips">
            {(['both', 'me'] as const).map((w) => (
              <Chip key={w} pressed={settings.who === w} onClick={() => onChange({ ...settings, who: w })}>
                {w === 'both' && <Icon name="people" size={18} />} {labels.who(w)}
              </Chip>
            ))}
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
