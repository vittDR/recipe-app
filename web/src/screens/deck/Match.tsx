import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AddToListSheet, loadProposals } from '../../components/AddToListSheet.tsx';
import { Icon } from '../../components/Icon.tsx';
import { RecipeFacts } from '../../components/RecipeBody.tsx';
import { AvatarPair, Button, imageStyle, recipeEmoji } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useLive, useSave } from '../../lib/hooks.ts';
import { recipeTitle } from '../../lib/recipeText.ts';
import { useSession } from '../../lib/session.tsx';
import { INGREDIENT_SELECT } from '../../lib/products.ts';
import { must, supabase } from '../../lib/supabase.ts';
import type { Recipe, RecipeIngredient } from '../../lib/types.ts';
import type { DeckData } from './data.ts';

interface Portion {
  kcal: number;
  protein_g: number;
  servings: number;
  pot_servings: number;
  fits: boolean;
}

/** Confetti around the title: positions and colours are decoration only. */
const CONFETTI = [
  { l: 22, t: 70, w: 10, h: 18, c: 'var(--accent)', r: -24 },
  { l: 60, t: 40, w: 8, h: 8, c: 'var(--star)', round: true },
  { l: 350, t: 52, w: 9, h: 16, c: 'var(--sage-strong)', r: 32 },
  { l: 318, t: 30, w: 10, h: 10, c: 'var(--accent-dash)', round: true },
  { l: 12, t: 150, w: 8, h: 14, c: 'var(--star)', r: 18 },
  { l: 368, t: 140, w: 8, h: 14, c: 'var(--accent)', r: -40 },
  { l: 196, t: 26, w: 7, h: 7, c: 'var(--iris)', round: true },
  { l: 120, t: 20, w: 9, h: 9, c: 'var(--sage-strong)', round: true },
];

/**
 * The match moment. × goes to the decided home: nothing forces cooking now.
 * The main action sends what isn't at home to the list.
 */
export function MatchView({ data }: { data: DeckData }) {
  const { t, locale } = useI18n();
  const { userId, household, memberName, memberColor } = useSession();
  const navigate = useNavigate();
  const recipeId = data.deck.matched_recipe_id!;
  const card = data.cards.find((c) => c.recipe_id === recipeId);
  const save = useSave();
  const [sheet, setSheet] = useState(false);
  const { data: match } = useLive<{
    recipe: Recipe; ingredients: RecipeIngredient[]; portion: Portion | null; matches: string[]; missing: number; mutual: boolean;
  }>(`match:${data.deck.id}:${recipeId}`, async () => {
    const [r, ings, p, m] = await Promise.all([
      card ? Promise.resolve({ data: card.recipe, error: null }) : supabase.from('recipes').select('*').eq('id', recipeId).single(),
      supabase.from('recipe_ingredients').select(INGREDIENT_SELECT).eq('recipe_id', recipeId).order('position'),
      supabase.rpc('my_portion', { p_recipe: recipeId, p_eaters: data.deck.who_eating }),
      supabase.rpc('deck_matches', { p_deck: data.deck.id }),
    ]);
    const ingredients = must(ings) as RecipeIngredient[];
    const proposals = await loadProposals(household!.id, ingredients);
    const matches = ((m.data ?? []) as { recipe_id: string }[]).map((x) => x.recipe_id);
    return {
      recipe: must(r) as Recipe,
      ingredients,
      portion: ((p.data ?? []) as Portion[])[0] ?? null,
      matches,
      missing: proposals.filter((x) => x.add).length,
      // A recipe everyone said yes to; otherwise it came out of the tie-break.
      mutual: data.deck.who_eating.length === 1 || matches.includes(recipeId),
    };
  });
  const recipe = match?.recipe ?? card?.recipe ?? null;
  const portion = match?.portion ?? null;
  const listMeals = useMemo(() => (match ? [{ recipe: match.recipe, ingredients: match.ingredients, potServings: match.portion?.pot_servings }] : []), [match]);

  const eaters = [userId!, ...data.deck.who_eating.filter((u) => u !== userId)];
  const otherMatch = match?.matches.find((id) => id !== recipeId);
  const said = !match || match.mutual
    ? eaters.length === 1 ? t('match.youYes') : eaters.length === 2 ? t('match.bothYes') : t('match.allYes')
    : t('match.pickedTogether');

  if (!recipe) return null;
  return (
    <main className="screen moment">
      {CONFETTI.map((c, k) => (
        <span key={k} className="confetti" aria-hidden style={{
          left: `${(c.l / 390) * 100}%`, top: c.t, width: c.w, height: c.h, background: c.c,
          transform: c.r ? `rotate(${c.r}deg)` : undefined, borderRadius: c.round ? '50%' : 2,
        }} />
      ))}
      <button type="button" className="icon-btn icon-btn--filled moment__close" aria-label={t('app.close')} onClick={() => navigate('/')}>
        <Icon name="x" />
      </button>

      <div className="moment__head">
        <span className="row t-callout muted">
          <AvatarPair people={eaters.map((id) => ({ id, name: memberName(id), color: memberColor(id) }))} /> {said}
        </span>
        <h1 className="t-title-l m-0">{t('match.decided')}</h1>
      </div>

      <article className="card card--flush match-card">
        <div className="match-card__photo" style={imageStyle(recipe.image_path)}>
          {!imageStyle(recipe.image_path) && <span aria-hidden>{recipeEmoji(recipe.title, recipe.tags)}</span>}
        </div>
        <div className="match-card__body">
          <h2 className="t-title-s m-0">{recipeTitle(recipe, locale)}</h2>
          <RecipeFacts recipe={recipe} plate={portion} max={3} />
        </div>
      </article>

      <div className="moment__actions">
        {match && match.missing === 0 && <p className="t-callout text-sage m-0 center">{t('match.nothingMissing')}</p>}
        {match && match.missing > 0 && (
          <Button block onClick={() => setSheet(true)}><Icon name="basket" /> {t('match.addIngredients')}</Button>
        )}
        <Button block variant="secondary" onClick={() => navigate(`/recipes/${recipe.id}`)}>{t('match.viewRecipe')}</Button>
        {otherMatch && (
          <Button variant="text" onClick={() => void save(supabase.rpc('choose_match', { p_deck: data.deck.id, p_recipe: otherMatch }))}>
            {t('match.other')}
          </Button>
        )}
      </div>

      {/* Once the groceries are sorted, the evening is decided: back to Ce soir. */}
      <AddToListSheet open={sheet} onClose={() => setSheet(false)} onAdded={() => navigate('/')} meals={listMeals} />
    </main>
  );
}
