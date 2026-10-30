import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { formatQuantity } from '../../components/AddToListSheet.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Button, ModeBar, ProgressBar, Spinner } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { recipeTitle, recipeSteps } from '../../lib/recipeText.ts';
import { useLive, useWakeLock } from '../../lib/hooks.ts';
import { INGREDIENT_SELECT, ingredientName } from '../../lib/products.ts';
import { must, supabase } from '../../lib/supabase.ts';
import type { Recipe, RecipeIngredient } from '../../lib/types.ts';

/** Step-by-step, large type, screen kept awake. Step 0 lists ingredients. */
export function CookingScreen() {
  const { id } = useParams();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  useWakeLock(true);
  const { data } = useLive<{ recipe: Recipe; ingredients: RecipeIngredient[] }>(`cooking:${id}`, async () => {
    const [r, i] = await Promise.all([
      supabase.from('recipes').select('*').eq('id', id!).single(),
      supabase.from('recipe_ingredients').select(INGREDIENT_SELECT).eq('recipe_id', id!).order('position'),
    ]);
    return { recipe: must(r) as Recipe, ingredients: must(i) as RecipeIngredient[] };
  });

  if (!data) return <Spinner />;
  const { recipe, ingredients } = data;
  const steps = recipeSteps(recipe, locale);
  const total = steps.length;

  return (
    <main className="screen screen--plain">
      <ModeBar title={step === 0 ? t('recipe.ingredients') : t('recipe.step', { n: step, total })} onClose={() => navigate(-1)} />
      <ProgressBar value={step} max={Math.max(total, 1)} />
      <h1 className="title3 muted mt-4">{recipeTitle(recipe, locale)}</h1>
      <div className="cooking__body">
        {step === 0 ? (
          <ul className="stack cooking__ingredients">
            {ingredients.map((i) => (
              <li key={i.id} className="row row--between"><span>{ingredientName(i, locale)}</span><span className="muted">{formatQuantity(i.quantity, i.unit)}</span></li>
            ))}
          </ul>
        ) : (
          <p className="cooking__step" aria-live="polite">{steps[step - 1]}</p>
        )}
      </div>
      <div className="row">
        <Button variant="secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)} aria-label={t('app.back')}>
          <Icon name="back" />
        </Button>
        <Button block onClick={() => (step >= total ? navigate(-1) : setStep((s) => s + 1))}>
          {step >= total ? t('app.done') : t('app.next')}
        </Button>
      </div>
    </main>
  );
}
