// A recipe's title and steps in the reader's language: its own text when it's
// written in that language, else the translation, else the original.
import type { Recipe } from './types.ts';

type Texts = Pick<Recipe, 'title'> & Partial<Pick<Recipe, 'steps' | 'language' | 'translations'>>;

const translation = (r: Texts, locale: string) => (r.language === locale ? undefined : r.translations?.[locale]);

export function recipeTitle(r: Texts, locale: string): string {
  return translation(r, locale)?.title || r.title;
}

export function recipeSteps(r: Texts, locale: string): string[] {
  const steps = translation(r, locale)?.steps;
  return steps?.length ? steps : r.steps ?? [];
}

/** Every title the recipe has, for search in any language. */
export function allTitles(r: Texts): string[] {
  return [r.title, ...Object.values(r.translations ?? {}).flatMap((t) => (t ? [t.title] : []))];
}
