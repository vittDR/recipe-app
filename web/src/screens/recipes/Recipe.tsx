import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { ListProposal } from '@logic/groceries.ts';
import { AddToListSheet, formatQuantity, loadProposals } from '../../components/AddToListSheet.tsx';
import { Icon } from '../../components/Icon.tsx';
import { RecipeTags } from '../../components/Tags.tsx';
import { Button, Screen, Spinner, Tag, imageStyle, recipeEmoji } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { recipeTitle, recipeSteps } from '../../lib/recipeText.ts';
import { MANY_POTS } from '@logic/facets.ts';
import { equipmentLabels, exoticIngredients } from '../../lib/facets.ts';
import { useCatalog } from '../../lib/hooks.ts';
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

export function RecipeScreen() {
  const { id } = useParams();
  const i18n = useI18n();
  const { t, tn, locale } = i18n;
  const catalog = useCatalog();
  const { household } = useSession();
  const { tags, reload: reloadTags } = useTags(household!.id);
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [portion, setPortion] = useState<Portion | null>(null);
  const [proposals, setProposals] = useState<Map<string, ListProposal<RecipeIngredient>>>(new Map());
  const [sheet, setSheet] = useState(false);

  const load = async () => {
    const [r, ings, p] = await Promise.all([
      supabase.from('recipes').select('*').eq('id', id!).single(),
      supabase.from('recipe_ingredients').select(INGREDIENT_SELECT).eq('recipe_id', id!).order('position'),
      supabase.rpc('my_portion', { p_recipe: id }),
    ]);
    setRecipe(must(r) as Recipe);
    const list = must(ings) as RecipeIngredient[];
    setIngredients(list);
    setPortion(((p.data ?? []) as Portion[])[0] ?? null);
    const props = await loadProposals(household!.id, list);
    setProposals(new Map(props.map((x) => [x.ingredient.id, x])));
  };

  useEffect(() => {
    void load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!recipe) return <Screen back><Spinner /></Screen>;

  const own = recipe.household_id === household!.id;
  const exotic = new Set(catalog ? exoticIngredients(ingredients.map((i) => i.name), catalog) : []);
  const equipment = equipmentLabels(recipe.equipment, i18n);
  const manyPots = (recipe.equipment?.pots ?? 0) >= MANY_POTS;
  const remove = async () => {
    if (!confirm(t('recipe.removeConfirm'))) return;
    await supabase.from('recipes').delete().eq('id', recipe.id);
    navigate('/recipes', { replace: true });
  };

  return (
    <main className="screen">
      <div className="hero" style={imageStyle(recipe.image_path)}>
        {!imageStyle(recipe.image_path) && <span aria-hidden>{recipeEmoji(recipe.title, recipe.tags)}</span>}
        <button type="button" className="icon-btn icon-btn--filled hero__back" aria-label={t('app.back')} onClick={() => navigate(-1)}>
          <Icon name="back" />
        </button>
      </div>
      <h1 className="screen__title" style={{ marginTop: 0 }}>{recipeTitle(recipe, i18n.locale)}</h1>
      <div className="row row--wrap" style={{ marginBottom: 'var(--s-4)' }}>
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
        {recipe.macros_estimated && <span className="small" style={{ color: 'var(--c-warning)' }}>⚠︎ {t('recipe.estimated')}</span>}
      </div>

      {equipment.length > 0 && (
        <>
          <h2 className="section-label">{t('recipe.equipment')}</h2>
          <div className="row row--wrap">
            {equipment.map((e) => <Tag key={e.label} tone={e.tedious ? 'warning' : undefined}>{e.label}</Tag>)}
          </div>
          {manyPots && <span className="small muted">{t('equipment.manyPots')}</span>}
        </>
      )}

      <div className="row row--between">
        <h2 className="section-label">{t('recipe.ingredients')}</h2>
        <Button small variant="text" onClick={() => setSheet(true)}><Icon name="cart" size={18} /> {t('match.addToList')}</Button>
      </div>
      <div className="list">
        {ingredients.map((i) => {
          const p = proposals.get(i.id);
          return (
            <div key={i.id} className="list-row">
              <div className="list-row__main">
                <div className="list-row__title">{ingredientName(i, locale)}</div>
                {i.optional && <div className="list-row__meta">{t('recipe.optional')}</div>}
                {i.guessed && <div className="list-row__meta" style={{ color: 'var(--c-warning)' }}>{t('recipe.guessed')}</div>}
                {exotic.has(i.name) && <div className="list-row__meta">{t('recipe.exoticHint')}</div>}
              </div>
              {exotic.has(i.name) && <Tag tone="warning">{t('recipe.exotic')}</Tag>}
              {p?.why === 'on_list' && <Tag>{t('recipe.onList')}</Tag>}
              {(p?.why === 'bought_recently' || p?.why === 'staple') && <Tag tone="success">{t('recipe.atHome')}</Tag>}
              <span className="muted small">{formatQuantity(i.quantity, i.unit)}</span>
            </div>
          );
        })}
      </div>

      {recipeSteps(recipe, i18n.locale).length > 0 && (
        <>
          <h2 className="section-label">{t('recipe.steps')}</h2>
          <ol className="card stack" style={{ paddingLeft: 'var(--s-8)', margin: 0 }}>
            {recipeSteps(recipe, i18n.locale).map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </>
      )}

      {recipe.source_url && (
        <p className="small muted" style={{ marginTop: 'var(--s-4)' }}>
          {t('recipe.source')}: <a href={recipe.source_url} target="_blank" rel="noreferrer">{recipe.source_name ?? new URL(recipe.source_url).hostname}</a>
        </p>
      )}

      <div className="stack" style={{ marginTop: 'var(--s-5)' }}>
        <Button block onClick={() => navigate(`/recipes/${recipe.id}/cook`)}><Icon name="pot" /> {t('recipe.cookingMode')}</Button>
        {own && <Button block variant="text" onClick={() => void remove()} style={{ color: 'var(--c-danger)' }}>{t('recipe.remove')}</Button>}
      </div>

      <AddToListSheet open={sheet} onClose={() => { setSheet(false); void load(); }} recipe={recipe} ingredients={ingredients} />
    </main>
  );
}
