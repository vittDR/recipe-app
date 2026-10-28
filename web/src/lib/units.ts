// Quantities and units as shown on the list: "2 l", "6 pcs", "3 bottles".
// Known units are translated; others (typed by someone) show as typed.

import { GROCERY_UNITS } from '@logic/products.ts';
import { useI18n } from '../i18n/index.tsx';

type KnownUnit = (typeof GROCERY_UNITS)[number];
const isKnown = (u: string): u is KnownUnit => (GROCERY_UNITS as readonly string[]).includes(u);

export function useAmount() {
  const { t, locale } = useI18n();
  const number = (q: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(q);
  const unitLabel = (unit: string, quantity: number | null = 1) =>
    isKnown(unit) ? t(`groceries.${quantity !== null && quantity > 1 ? 'unitsPlural' : 'units'}.${unit}`) : unit;
  /** "800 g"; '' without a quantity (the row then shows the name only). */
  const amount = (quantity: number | null, unit: string | null) =>
    quantity === null ? '' : unit ? `${number(quantity)} ${unitLabel(unit, quantity)}` : number(quantity);
  return { number, unitLabel, amount };
}
