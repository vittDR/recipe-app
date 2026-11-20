// A person's style by kind of plate, in words, each one settable
// (docs/taste-profiles.md §3): at the end of the taste quiz and on the Us
// screen. The caller saves what's set as a style edit: taste_signals kind
// 'style', value '<region>:<level>', one per kind of plate.
import { STYLE_LEVELS, type StyleLevel } from '@logic/profile.ts';
import type { StyleRegion } from '@logic/style.ts';
import { useI18n } from '../i18n/index.tsx';
import { Section, Segmented } from './ui.tsx';

export function StyleRows({ summary, stated, onChange }: {
  /** The model's reading (style.ts styleSummary). */
  summary: { region: StyleRegion; level: StyleLevel }[];
  /** What the person set themselves: shown over the model's reading. */
  stated: Map<StyleRegion, StyleLevel>;
  onChange: (region: StyleRegion, level: StyleLevel) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="stack stack--lg style-rows">
      {summary.map(({ region, level }) => (
        <Section key={region} label={t(`quiz.region.${region}`)} hint={t(`quiz.region.${region}Hint`)} flush>
          <Segmented<StyleLevel> label={t(`quiz.region.${region}`)} value={stated.get(region) ?? level}
            onChange={(l) => onChange(region, l)}
            options={STYLE_LEVELS.map((l) => ({ value: l, label: t(`quiz.level.${l}`) }))} />
        </Section>
      ))}
    </div>
  );
}

