import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { classifyRow } from '@logic/classify.ts';
import { AddToListSheet, loadProposals } from '../../components/AddToListSheet.tsx';
import { Icon } from '../../components/Icon.tsx';
import { RecipeBody } from '../../components/RecipeBody.tsx';
import { RecipeTags } from '../../components/Tags.tsx';
import { Button, confirmSheet, Screen, Spinner, Tag, imageStyle, recipeEmoji } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { classificationChips } from '../../lib/classes.ts';
import { useCatalog, useLive, useSave } from '../../lib/hooks.ts';
import { INGREDIENT_SELECT } from '../../lib/products.ts';
import { useSession } from '../../lib/session.tsx';
import { must, supabase } from '../../lib/supabase.ts';
import { useTags } from '../../lib/tags.ts';
import type { Recipe, RecipeIngredient } from '../../lib/types.ts';

interface Portion {
  kcal: number;
  protein_g: number;
  servings: number;
  fits: boolean;
}

interface RecipeData {
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  portion: Portion | null;
  /** Ingredient ids probably at home. */
  atHome: Set<string>;
  cooked: number;
}

/** One vertical scroll: photo, facts, cookware, ingredients, steps; cooking at the bottom. */
export function RecipeScreen() {
  const { id } = useParams();
  const { t, tn } = useI18n();
  const catalog = useCatalog();
  const { household } = useSession();
  const { tags, reload: reloadTags } = useTags(household!.id);
  const navigate = useNavigate();
  const save = useSave();
  const [sheet, setSheet] = useState(false);
  const { data, reload } = useLive<RecipeData>(`recipe:${id}`, async () => {
    const [r, ings, p, cooked] = await Promise.all([
      supabase.from('recipes').select('*').eq('id', id!).single(),
      supabase.from('recipe_ingredients').select(INGREDIENT_SELECT).eq('recipe_id', id!).order('position'),
      supabase.rpc('my_portion', { p_recipe: id }),
      supabase.from('meals').select('id', { count: 'exact', head: true })
        .eq('household_id', household!.id).eq('recipe_id', id!).eq('status', 'cooked'),
    ]);
    const ingredients = must(ings) as RecipeIngredient[];
    const proposals = await loadProposals(household!.id, ingredients);
    return {
      recipe: must(r) as Recipe,
      ingredients,
      portion: ((p.data ?? []) as Portion[])[0] ?? null,
      atHome: new Set(proposals.filter((x) => !x.add).map((x) => x.ingredient.id)),
      cooked: cooked.count ?? 0,
    };
  });
  const listMeals = useMemo(() => (data ? [{ recipe: data.recipe, ingredients: data.ingredients }] : []), [data]);

  if (!data) return <Screen back><Spinner /></Screen>;
  const { recipe, ingredients, portion } = data;

  const own = recipe.household_id === household!.id;
  // Worked out from the ingredients, steps and tags, like for every recipe (logic/classify.ts).
  const about = catalog ? classificationChips(classifyRow({ ...recipe, recipe_ingredients: ingredients }, catalog), t) : [];
  const remove = async () => {
    if (!(await confirmSheet(t('recipe.removeConfirm'), { confirmLabel: t('app.delete') }))) return;
    if (await save(supabase.from('recipes').delete().eq('id', recipe.id))) navigate('/recipes', { replace: true });
  };

  return (
    <main className="recipe-page">
      <div className="recipe-photo" style={imageStyle(recipe.image_path)}>
        {!imageStyle(recipe.image_path) && <span aria-hidden>{recipeEmoji(recipe.title, recipe.tags)}</span>}
        <button type="button" className="icon-btn icon-btn--glass recipe-photo__left" aria-label={t('app.back')} onClick={() => navigate(-1)}>
          <Icon name="back" />
        </button>
      </div>
      <div className="recipe-sheet">
        <RecipeBody recipe={recipe} ingredients={ingredients} atHome={data.atHome}
          plate={portion && { kcal: portion.kcal, protein_g: portion.protein_g }}
          overline={data.cooked > 0 ? tn('recipe.cookedTimes', data.cooked) : undefined}
          ingredientsAction={(
            <Button small variant="text" onClick={() => setSheet(true)}><Icon name="basket" size={18} /> {t('tonight.groceries')}</Button>
          )}>
          <div className="recipe-page__more">
            {(about.length > 0 || recipe.tags.length > 0) && (
              <div className="chips">
                <RecipeTags names={recipe.tags} tags={tags} householdId={household!.id} onTranslated={() => void reloadTags()} />
                {about.map((label) => <Tag key={label}>{label}</Tag>)}
                {(recipe.collection === 'original' || recipe.collection === 'web') && <Tag>{t(`collection.${recipe.collection}One`)}</Tag>}
              </div>
            )}
            <span className="t-callout muted">
              {tn('recipe.servings', recipe.servings)}
              {portion && portion.servings !== 1 && ` · ${t('recipe.yourMacros')} ${tn('recipe.servings', portion.servings)}`}
              {recipe.macros_estimated && ` · ${t('recipe.estimated')}`}
            </span>
            {recipe.source_url && (
              <span className="t-callout muted">
                {t('recipe.source')} : <a href={recipe.source_url} target="_blank" rel="noreferrer">{recipe.source_name ?? new URL(recipe.source_url).hostname}</a>
              </span>
            )}
            {own && <Button variant="danger" onClick={() => void remove()}>{t('recipe.remove')}</Button>}
          </div>
        </RecipeBody>
      </div>

      <div className="bottom-action">
        <Button block onClick={() => navigate(`/recipes/${recipe.id}/cook`)}><Icon name="pot" /> {t('tonight.startCooking')}</Button>
      </div>

      <AddToListSheet open={sheet} onClose={() => { setSheet(false); void reload(); }} meals={listMeals} />
    </main>
  );
}
