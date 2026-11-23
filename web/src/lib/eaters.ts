// People who eat at home but don't choose (children, a grandparent, a
// flatmate who just eats): design handoff v2 §4. They change portions and
// their exclusions filter decks; they never swipe. Stored in household_eaters.

import { useI18n } from '../i18n/index.tsx';
import { useLive } from './hooks.ts';
import { useSession } from './session.tsx';
import { must, supabase } from './supabase.ts';

export const AGE_BANDS = ['4-8', '9-13', '14+'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

/** The portion an age band starts from; the stepper can change it. No 0-3: babies eat baby food. */
export const DEFAULT_PORTION: Record<AgeBand, number> = { '4-8': 0.5, '9-13': 0.75, '14+': 1 };

export const PORTION_STEP = 0.25;
export const PORTION_MIN = 0.25;
export const PORTION_MAX = 2;

export interface Eater {
  id: string;
  household_id: string;
  name: string;
  age_band: AgeBand;
  portion: number;
  /** Allergen keys (public.allergens). */
  allergens: string[];
  /** Catalogue products they don't eat. */
  never_products: string[];
  created_at: string;
}

/** The household's extra eaters, oldest first, kept live. */
export function useEaters() {
  const { household } = useSession();
  return useLive<Eater[]>(`eaters:${household!.id}`, async () =>
    must(await supabase.from('household_eaters').select('*').eq('household_id', household!.id).order('created_at')) as Eater[],
  [{ table: 'household_eaters', filter: `household_id=eq.${household!.id}` }]);
}

const FRACTIONS: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾' };

/** A portion as people say it: ½, ¾, 1, 1¼… */
export function portionText(p: number): string {
  const whole = Math.floor(p + 1e-9);
  const frac = FRACTIONS[Math.round((p - whole) * 100) / 100];
  return whole === 0 ? frac ?? String(p) : frac ? `${whole}${frac}` : String(whole);
}

/** "2,5 portions" / "2.5 servings": a total, with the locale's decimal mark. */
export function usePortionTotal() {
  const { tn, locale } = useI18n();
  return (total: number) => tn('eaters.portions', total, { n: total.toLocaleString(locale, { maximumFractionDigits: 2 }) });
}

/** The extra eaters' colour: sage, "eats, doesn't choose". */
export const EATER_COLOR = 'var(--sage)';
