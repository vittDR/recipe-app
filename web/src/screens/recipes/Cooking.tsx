import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { formatQuantity } from '../../components/AddToListSheet.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Button, Spinner } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useWakeLock } from '../../lib/hooks.ts';
import { must, supabase } from '../../lib/supabase.ts';
import type { Recipe, RecipeIngredient } from '../../lib/types.ts';

/** Step-by-step, large type, screen kept awake. Step 0 lists ingredients. */
export function CookingScreen() {
  const { id } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [step, setStep] = useState(0);
  useWakeLock(true);

  useEffect(() => {
    void Promise.all([
      supabase.from('recipes').select('*').eq('id', id!).single(),
      supabase.from('recipe_ingredients').select('*').eq('recipe_id', id!).order('position'),
    ]).then(([r, i]) => {
      setRecipe(must(r) as Recipe);
      setIngredients(must(i) as RecipeIngredient[]);
    });
  }, [id]);

  if (!recipe) return <Spinner />;
  const total = recipe.steps.length;

  return (
    <main className="screen screen--plain">
      <div className="screen__bar">
        <button type="button" className="icon-btn" aria-label={t('app.close')} onClick={() => navigate(-1)}><Icon name="x" /></button>
        <span className="headline">{step === 0 ? t('recipe.ingredients') : t('recipe.step', { n: step, total })}</span>
        <span style={{ width: 44 }} />
      </div>
      <div className="progress" aria-hidden><div style={{ width: `${(step / Math.max(total, 1)) * 100}%` }} /></div>
      <h1 className="title3 muted" style={{ marginTop: 'var(--s-4)' }}>{recipe.title}</h1>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        {step === 0 ? (
          <ul className="stack" style={{ listStyle: 'none', padding: 0, width: '100%', font: 'var(--t-title3)' }}>
            {ingredients.map((i) => (
              <li key={i.id} className="row row--between"><span>{i.name}</span><span className="muted">{formatQuantity(i.quantity, i.unit)}</span></li>
            ))}
          </ul>
        ) : (
          <p style={{ font: 'var(--t-title1)', lineHeight: 1.35 }} aria-live="polite">{recipe.steps[step - 1]}</p>
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
