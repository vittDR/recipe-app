// Tonight's deck settings: who eats, time, mood. Secondary by design: a
// one-line summary on Ce soir opens them in a sheet.
import type { Mood } from '../lib/types.ts';
import { useI18n } from '../i18n/index.tsx';
import { Icon } from './Icon.tsx';
import { Button, Chip, Section, Sheet, SheetHeader } from './ui.tsx';

export interface DeckSettings {
  who: 'both' | 'me';
  maxMinutes: number | null;
  mood: Mood;
}

export const TIMES = [20, 40, 60, null] as const;
export const MOODS: Mood[] = ['any', 'comfort', 'light', 'quick', 'fancy'];

export function useDeckLabels() {
  const { t } = useI18n();
  const time = (m: number | null) => (m === null ? t('tonight.anyTime') : m >= 60 ? t('tonight.underHour') : t('tonight.upTo', { n: m }));
  const who = (w: DeckSettings['who']) => (w === 'me' ? t('tonight.justMe') : t('tonight.both'));
  const mood = (m: Mood) => t(`tonight.moods.${m}`);
  return {
    time,
    who,
    mood,
    /** "Nous deux · Moins d'1 h · Réconfort"; who only when there is someone to eat with. */
    summary: (s: DeckSettings, shared: boolean) => [shared && who(s.who), time(s.maxMinutes), mood(s.mood)].filter(Boolean).join(' · '),
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
  return (
    <Sheet open={open} onClose={onClose} label={t('tonight.settingsTitle')}>
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
      {error && <p className="notice mt-4">{error}</p>}
      <Button className="sheet__actions" block disabled={dealing} onClick={onDeal}>
        {dealing ? t('tonight.dealing') : t('tonight.deal')}
      </Button>
    </Sheet>
  );
}
