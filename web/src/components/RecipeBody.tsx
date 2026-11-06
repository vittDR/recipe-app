// A recipe as one vertical scroll: title, facts, cookware, ingredients, steps.
// Shared by the recipe page and the expanded swipe card. No tabs, nothing
// folded away: every ingredient and every step is on the page.
import type { ReactNode } from 'react';
import { useI18n } from '../i18n/index.tsx';
import { equipmentLabels, exoticIngredients } from '../lib/facets.ts';
import { useCatalog } from '../lib/hooks.ts';
import { groupIngredients, ingredientName } from '../lib/products.ts';
import { recipeSteps, recipeTitle } from '../lib/recipeText.ts';
import type { Recipe, RecipeIngredient } from '../lib/types.ts';
import { useAmount } from '../lib/units.ts';
import { Icon } from './Icon.tsx';
import { Chip, SectionHeading } from './ui.tsx';

export interface Plate {
  kcal: number;
  protein_g: number;
}

/** Time, difficulty, kcal, protein: at most four, the plate's numbers when known. */
export function RecipeFacts({ recipe, plate, max = 4 }: { recipe: Recipe; plate?: Plate | null; max?: number }) {
  const { t } = useI18n();
  const kcal = plate?.kcal ?? recipe.kcal_per_serving;
  const protein = plate?.protein_g ?? recipe.protein_g_per_serving;
  const facts = [
    recipe.total_min != null && <Chip key="t" variant="fact"><Icon name="clock" size={15} /> {t('swipe.minutes', { n: recipe.total_min })}</Chip>,
    recipe.difficulty && <Chip key="d" variant="fact">{t(`recipe.${recipe.difficulty}`)}</Chip>,
    kcal != null && max > 3 && <Chip key="k" variant="fact"><Icon name="flame" size={15} /> {t('recipe.kcal', { n: Math.round(kcal) })}</Chip>,
    protein != null && <Chip key="p" variant="fact"><Icon name="bolt" size={15} /> {t('recipe.protein', { n: Math.round(protein) })}</Chip>,
  ].filter(Boolean);
  return facts.length ? <div className="facts">{facts}</div> : null;
}

export function RecipeBody({ recipe, ingredients, atHome, plate, overline, ingredientsAction, children }: {
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  /** Ingredient ids probably at home: a small sage house on the row. */
  atHome?: Set<string>;
  plate?: Plate | null;
  overline?: ReactNode;
  /** On the Ingredients heading, e.g. add to the list. */
  ingredientsAction?: ReactNode;
  /** After the steps: tags, source, secondary actions. */
  children?: ReactNode;
}) {
  const i18n = useI18n();
  const { t, locale } = i18n;
  const { linesAmount } = useAmount();
  const catalog = useCatalog();
  const exotic = new Set(catalog ? exoticIngredients(ingredients.map((i) => i.name), catalog) : []);
  const cookware = [
    ...equipmentLabels(recipe.equipment, i18n).map((e) => e.label),
    ...(recipe.equipment && !recipe.equipment.oven ? [t('equipment.noOven')] : []),
  ];
  const lines = groupIngredients(ingredients);
  const steps = recipeSteps(recipe, locale);
  const anyHome = lines.some((g) => g.some((l) => atHome?.has(l.id)));
  const split = recipe.prep_min != null && recipe.cook_min ? t('recipe.split', { prep: recipe.prep_min, cook: recipe.cook_min }) : null;

  return (
    <div className="recipe-body">
      {overline && <span className="t-label muted">{overline}</span>}
      <h1 className="t-title-m m-0">{recipeTitle(recipe, locale)}</h1>
      <RecipeFacts recipe={recipe} plate={plate} />
      {(cookware.length > 0 || split) && (
        <div className="recipe-body__meta">
          {cookware.length > 0 && <span className="row"><Icon name="pot" size={18} /> {cookware.join(' · ')}</span>}
          {split && <span className="row"><Icon name="clock" size={18} /> {split}</span>}
        </div>
      )}

      {lines.length > 0 && (
        <>
          <SectionHeading count={lines.length} action={ingredientsAction}>{t('recipe.ingredients')}</SectionHeading>
          <div className="list ingredient-list">
            {lines.map((group) => {
              const i = group[0];
              const notes = [
                i.optional && t('recipe.optional'),
                group.some((l) => l.guessed) && t('recipe.guessed'),
                exotic.has(i.name) && t('recipe.exotic'),
              ].filter(Boolean);
              return (
                <div key={i.id} className="ingredient-row">
                  <span className="ingredient-row__qty">{linesAmount(group, catalog?.find(i.name))}</span>
                  <span className="ingredient-row__name">
                    {ingredientName(i, locale)}
                    {notes.length > 0 && <span className="list-row__meta">{notes.join(' · ')}</span>}
                  </span>
                  {group.some((l) => atHome?.has(l.id)) && <span className="text-sage"><Icon name="home" size={16} label={t('recipe.probablyHome')} /></span>}
                </div>
              );
            })}
          </div>
          {anyHome && <p className="legend text-sage"><Icon name="home" size={14} /> {t('recipe.probablyHome')}</p>}
        </>
      )}

      {steps.length > 0 && (
        <>
          <SectionHeading count={steps.length}>{t('recipe.steps')}</SectionHeading>
          <ol className="list step-list-read">
            {steps.map((s, k) => (
              <li key={k}><span className="step-badge">{k + 1}</span><span>{s}</span></li>
            ))}
          </ol>
        </>
      )}
      {children}
    </div>
  );
}
