// Quantities and units as shown in the app: "2 l", "6 pcs", "3 bottles",
// "1 c. à s.". Known units (the list's and the ones recipes are read in) are
// translated; others (typed by someone) show as typed.

import { GROCERY_UNITS } from '@logic/products.ts';
import { useI18n } from '../i18n/index.tsx';

/** Units recipe lines are read in (parseIngredientLine) that the list doesn't offer. */
const RECIPE_UNITS = ['tbsp', 'tsp', 'cup', 'oz', 'lb', 'clove', 'pinch', 'slice'] as const;
const KNOWN_UNITS = [...GROCERY_UNITS, ...RECIPE_UNITS] as const;

type KnownUnit = (typeof KNOWN_UNITS)[number];
const isKnown = (u: string): u is KnownUnit => (KNOWN_UNITS as readonly string[]).includes(u);

export function useAmount() {
  const { t, locale } = useI18n();
  const number = (q: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(q);
  // Singular follows the language: "1,5 kg" / "1,5 paquet" in French, "1.5 packs" in English.
  const plural = new Intl.PluralRules(locale);
  const unitLabel = (unit: string, quantity: number | null = 1) => {
    const u = unit.trim().toLowerCase();
    if (!isKnown(u)) return unit;
    const one = quantity === null || plural.select(quantity) === 'one';
    return t(`groceries.${one ? 'units' : 'unitsPlural'}.${u}`);
  };
  /** "800 g"; '' without a quantity (the row then shows the name only). */
  const amount = (quantity: number | null, unit: string | null) =>
    quantity === null ? '' : unit ? `${number(quantity)} ${unitLabel(unit, quantity)}` : number(quantity);
  /** On a recipe, whole items read as a bare count: "2", not "2 pcs". */
  const recipeAmount = (quantity: number | null, unit: string | null) =>
    amount(quantity, unit?.trim().toLowerCase() === 'piece' ? null : unit);
  /** Several lines of one item: same units added up, others joined ("2 cloves + 1 tsp"). */
  const linesAmount = (lines: { quantity: number | null; unit: string | null }[]) => {
    const byUnit = new Map<string, number>();
    for (const l of lines) {
      if (l.quantity === null) continue;
      const u = l.unit?.trim().toLowerCase() ?? '';
      byUnit.set(u, (byUnit.get(u) ?? 0) + l.quantity);
    }
    return [...byUnit].map(([u, q]) => recipeAmount(Math.round(q * 100) / 100, u || null)).join(' + ');
  };
  return { number, unitLabel, amount, recipeAmount, linesAmount };
}
