import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { ListProposal } from '@logic/groceries.ts';
import { AddToListSheet, formatQuantity, loadProposals } from '../../components/AddToListSheet.tsx';
import { Icon } from '../../components/Icon.tsx';
import { RecipeTags } from '../../components/Tags.tsx';
import { Button, confirmSheet, ListRow, Screen, Section, Spinner, Tag, imageStyle, recipeEmoji } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { recipeTitle, recipeSteps } from '../../lib/recipeText.ts';
import { MANY_POTS } from '@logic/facets.ts';
import { equipmentLabels, exoticIngredients } from '../../lib/facets.ts';
import { useCatalog, useLive, useSave } from '../../lib/hooks.ts';
import { INGREDIENT_SELECT, ingredientName } from '../../lib/products.ts';
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
  proposals: Map<string, ListProposal<RecipeIngredient>>;
}

export function RecipeScreen() {
  const { id } = useParams();
  const i18n = useI18n();
  const { t, tn, locale } = i18n;
  const catalog = useCatalog();
  const { household } = useSession();
  const { tags, reload: reloadTags } = useTags(household!.id);
  const navigate = useNavigate();
  const save = useSave();
  const [sheet, setSheet] = useState(false);
  const { data, reload } = useLive<RecipeData>(`recipe:${id}`, async () => {
    const [r, ings, p] = await Promise.all([
      supabase.from('recipes').select('*').eq('id', id!).single(),
      supabase.from('recipe_ingredients').select(INGREDIENT_SELECT).eq('recipe_id', id!).order('position'),
      supabase.rpc('my_portion', { p_recipe: id }),
    ]);
    const ingredients = must(ings) as RecipeIngredient[];
    const proposals = await loadProposals(household!.id, ingredients);
    return {
      recipe: must(r) as Recipe,
      ingredients,
      portion: ((p.data ?? []) as Portion[])[0] ?? null,
      proposals: new Map(proposals.map((x) => [x.ingredient.id, x])),
    };
  });

  if (!data) return <Screen back><Spinner /></Screen>;
  const { recipe, ingredients, portion, proposals } = data;

  const own = recipe.household_id === household!.id;
  const exotic = new Set(catalog ? exoticIngredients(ingredients.map((i) => i.name), catalog) : []);
  const equipment = equipmentLabels(recipe.equipment, i18n);
  const manyPots = (recipe.equipment?.pots ?? 0) >= MANY_POTS;
  const remove = async () => {
    if (!(await confirmSheet(t('recipe.removeConfirm'), { confirmLabel: t('app.delete') }))) return;
    if (await save(supabase.from('recipes').delete().eq('id', recipe.id))) navigate('/recipes', { replace: true });
  };

  return (
    <main className="screen">
      <div className="hero" style={imageStyle(recipe.image_path)}>
        {!imageStyle(recipe.image_path) && <span aria-hidden>{recipeEmoji(recipe.title, recipe.tags)}</span>}
        <button type="button" className="icon-btn icon-btn--filled hero__back" aria-label={t('app.back')} onClick={() => navigate(-1)}>
          <Icon name="back" />
        </button>
      </div>
      <h1 className="screen__title recipe__title">{recipeTitle(recipe, i18n.locale)}</h1>
      <div className="row row--wrap recipe__tags">
        {recipe.total_min && <Tag><Icon name="clock" size={14} /> {recipe.total_min} min</Tag>}
        {recipe.prep_min != null && <Tag>{t('recipe.prep', { n: recipe.prep_min })}</Tag>}
        {recipe.cook_min != null && <Tag>{recipe.cook_min ? t('recipe.cook', { n: recipe.cook_min }) : t('recipe.noCook')}</Tag>}
        <Tag>{tn('recipe.servings', recipe.servings)}</Tag>
        {recipe.difficulty && <Tag tone={recipe.difficulty === 'hard' ? 'warning' : undefined}>{t(`recipe.${recipe.difficulty}`)}</Tag>}
        <RecipeTags names={recipe.tags} tags={tags} householdId={household!.id} onTranslated={() => void reloadTags()} />
        {(recipe.collection === 'original' || recipe.collection === 'web') && <Tag>{t(`collection.${recipe.collection}One`)}</Tag>}
      </div>

      <div className="card stack">
        <span className="small muted">{t('recipe.yourMacros')} · {tn('recipe.servings', portion?.servings ?? 1)}</span>
        {portion ? (
          <>
            <div className="macros">
              <span><strong>{Math.round(portion.kcal)}</strong> kcal</span>
              <span><strong>{Math.round(portion.protein_g)}</strong> g {t('swipe.protein')}</span>
              {portion.fits && <Tag tone="success">{t('swipe.fitsYou')}</Tag>}
            </div>
            {portion.servings !== 1 && recipe.kcal_per_serving != null && (
              <span className="small muted">
                {Math.round(recipe.kcal_per_serving)} kcal · {Math.round(recipe.protein_g_per_serving ?? 0)} g {t('swipe.protein')} {t('recipe.perServing')}
              </span>
            )}
          </>
        ) : <span className="muted">{t('recipe.noMacros')}</span>}
        {recipe.macros_estimated && <span className="small text-warning">⚠︎ {t('recipe.estimated')}</span>}
      </div>

      {equipment.length > 0 && (
        <Section label={t('recipe.equipment')}>
          <div className="row row--wrap">
            {equipment.map((e) => <Tag key={e.label} tone={e.tedious ? 'warning' : undefined}>{e.label}</Tag>)}
          </div>
          {manyPots && <span className="small muted">{t('equipment.manyPots')}</span>}
        </Section>
      )}

      <Section label={t('recipe.ingredients')}
        action={<Button small variant="text" onClick={() => setSheet(true)}><Icon name="cart" size={18} /> {t('match.addToList')}</Button>}>
        <div className="list">
          {ingredients.map((i) => {
            const p = proposals.get(i.id);
            const notes = [
              i.optional && <span key="o">{t('recipe.optional')}</span>,
              i.guessed && <span key="g" className="text-warning">{t('recipe.guessed')}</span>,
              exotic.has(i.name) && <span key="e">{t('recipe.exoticHint')}</span>,
            ].filter(Boolean);
            return (
              <ListRow key={i.id} title={ingredientName(i, locale)}
                meta={notes.length > 0 && <span className="stack-lines">{notes}</span>}
                trailing={(
                  <>
                    {exotic.has(i.name) && <Tag tone="warning">{t('recipe.exotic')}</Tag>}
                    {p?.why === 'on_list' && <Tag>{t('recipe.onList')}</Tag>}
                    {(p?.why === 'bought_recently' || p?.why === 'staple') && <Tag tone="success">{t('recipe.atHome')}</Tag>}
                    <span className="muted small">{formatQuantity(i.quantity, i.unit)}</span>
                  </>
                )} />
            );
          })}
        </div>
      </Section>

      {recipeSteps(recipe, i18n.locale).length > 0 && (
        <Section label={t('recipe.steps')}>
          <ol className="card stack recipe__steps">
            {recipeSteps(recipe, i18n.locale).map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </Section>
      )}

      {recipe.source_url && (
        <p className="small muted mt-4">
          {t('recipe.source')}: <a href={recipe.source_url} target="_blank" rel="noreferrer">{recipe.source_name ?? new URL(recipe.source_url).hostname}</a>
        </p>
      )}

      <div className="stack mt-6">
        <Button block onClick={() => navigate(`/recipes/${recipe.id}/cook`)}><Icon name="pot" /> {t('recipe.cookingMode')}</Button>
        {own && <Button block variant="danger" onClick={() => void remove()}>{t('recipe.remove')}</Button>}
      </div>

      <AddToListSheet open={sheet} onClose={() => { setSheet(false); void reload(); }} recipe={recipe} ingredients={ingredients} />
    </main>
  );
}
