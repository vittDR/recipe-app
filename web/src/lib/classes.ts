// Recipe classification (logic/classify.ts) in the app's language: chips on
// the recipe page and labels for learned patterns ("sauce:coconut").
import { type RecipeClassification, SAUCE_LEVELS } from '@logic/classify.ts';
import type { MessageKey, useI18n } from '../i18n/index.tsx';

type T = ReturnType<typeof useI18n>['t'];

/** A namespaced learning feature as words, or null for tags and ingredients. */
export function classLabel(feature: string, t: T): string | null {
  const m = feature.match(/^(protein|starch|dish|sauce|method|goal|intent|heat|texture):(.+)$/);
  if (!m) return null;
  const [, ns, value] = m;
  if (ns === 'heat') {
    if (value === '0') return t('classes.heat.0');
    const n = value.replace('+', '');
    const level = t(`classes.heat.${n}` as MessageKey);
    return n === '4' ? level : t('classes.heatAtLeast', { level });
  }
  return t(`classes.${ns}.${value}` as MessageKey);
}

/** What the dish is, most telling first: family, sauce, heat, how saucy, goals and moods. */
export function classificationChips(c: RecipeClassification, t: T): string[] {
  const chips = [
    ...c.dish_families.filter((d) => d !== 'other' && d !== 'plated').map((d) => t(`classes.dish.${d}` as MessageKey)),
    ...(c.sauce_families ?? []).map((s) => t(`classes.sauce.${s}` as MessageKey)),
  ];
  if (c.heat_level !== null && c.heat_level > 0) chips.push(t(`classes.heat.${c.heat_level}` as MessageKey));
  if (c.heat_adjustable) chips.push(t('classes.adjustable'));
  if (c.sauce_level !== null) chips.push(t(`classes.texture.${SAUCE_LEVELS[c.sauce_level]}` as MessageKey));
  chips.push(...c.nutrition_goals.map((g) => t(`classes.goal.${g}` as MessageKey)));
  chips.push(...c.meal_intents.map((i) => t(`classes.intent.${i}` as MessageKey)));
  return [...new Set(chips)];
}

/**
 * The few things shown as tags on a recipe: diet, then health and mood.
 * Everything else the classification knows (protein, dish, sauce, heat…)
 * feeds the deck, and time, difficulty and protein have their own facts.
 */
export function visibleTags(c: RecipeClassification, dietClass: 'veg' | 'fish' | 'meat', t: T): string[] {
  return [...new Set([
    ...(dietClass === 'veg' ? [t('tastes.vegetarian')] : dietClass === 'fish' ? [t('recipes.fish')] : []),
    ...c.nutrition_goals.map((g) => t(`classes.goal.${g}` as MessageKey)),
    ...c.meal_intents.filter((i) => i !== 'everyday').map((i) => t(`classes.intent.${i}` as MessageKey)),
  ])];
}
