import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AddToListSheet, loadProposals } from '../../components/AddToListSheet.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Avatar, Button, imageStyle, recipeEmoji } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { recipeTitle } from '../../lib/recipeText.ts';
import { useSession } from '../../lib/session.tsx';
import { INGREDIENT_SELECT } from '../../lib/products.ts';
import { must, supabase } from '../../lib/supabase.ts';
import type { RecipeIngredient } from '../../lib/types.ts';
import type { DeckData } from './data.ts';

interface Portion {
  kcal: number;
  protein_g: number;
  servings: number;
  pot_servings: number;
  fits: boolean;
}

export function MatchView({ data }: { data: DeckData }) {
  const { t, tn, locale } = useI18n();
  const { userId, household, memberName, memberColor } = useSession();
  const navigate = useNavigate();
  const recipeId = data.deck.matched_recipe_id!;
  const card = data.cards.find((c) => c.recipe_id === recipeId);
  const [recipe, setRecipe] = useState(card?.recipe ?? null);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [portion, setPortion] = useState<Portion | null>(null);
  const [missing, setMissing] = useState<number | null>(null);
  const [matches, setMatches] = useState<string[]>([]);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    void (async () => {
      const [r, ings, p, m] = await Promise.all([
        card ? Promise.resolve({ data: card.recipe, error: null }) : supabase.from('recipes').select('*').eq('id', recipeId).single(),
        supabase.from('recipe_ingredients').select(INGREDIENT_SELECT).eq('recipe_id', recipeId).order('position'),
        supabase.rpc('my_portion', { p_recipe: recipeId, p_eaters: data.deck.who_eating }),
        supabase.rpc('deck_matches', { p_deck: data.deck.id }),
      ]);
      setRecipe(must(r));
      const list = must(ings) as RecipeIngredient[];
      setIngredients(list);
      setPortion(((p.data ?? []) as Portion[])[0] ?? null);
      setMatches(((m.data ?? []) as { recipe_id: string }[]).map((x) => x.recipe_id));
      const proposals = await loadProposals(household!.id, list);
      setMissing(proposals.filter((x) => x.add).length);
    })();
  }, [recipeId, card, data.deck.id, data.deck.who_eating, household]);

  const others = data.deck.who_eating.filter((u) => u !== userId);
  const fits = data.fits.get(recipeId);
  const otherMatch = matches.find((id) => id !== recipeId);

  const cook = async () => {
    await supabase.from('meals').update({ status: 'cooked' })
      .eq('household_id', household!.id).eq('for_date', data.deck.for_date);
    navigate(`/recipes/${recipeId}/cook`);
  };

  if (!recipe) return null;
  return (
    <main className="screen">
      <div className="hero" style={imageStyle(recipe.image_path)}>
        {!imageStyle(recipe.image_path) && <span aria-hidden>{recipeEmoji(recipe.title, recipe.tags)}</span>}
        <button type="button" className="icon-btn icon-btn--filled hero__back" aria-label={t('app.close')} onClick={() => navigate('/')}>
          <Icon name="x" />
        </button>
      </div>
      <p className="headline" style={{ color: 'var(--c-accent)', margin: 0 }}>🎉 {t('match.title')}</p>
      <h1 className="screen__title" style={{ marginTop: 'var(--s-1)' }}>{recipeTitle(recipe, locale)}</h1>

      <div className="plates">
        <div className="card stack">
          <span className="small muted">{t('match.yourPlate')}{portion && portion.servings !== 1 && ` · ${tn('recipe.servings', portion.servings)}`}</span>
          {portion ? (
            <>
              <span className="title3">{Math.round(portion.kcal)} kcal</span>
              <span className="muted">{Math.round(portion.protein_g)} g {t('swipe.protein')}</span>
            </>
          ) : <span className="muted small">{t('recipe.noMacros')}</span>}
        </div>
        {others.map((u) => (
          <div key={u} className="card stack">
            <span className="row small muted"><Avatar name={memberName(u)} color={memberColor(u)} size="sm" /> {t('match.partnerPlate', { name: memberName(u) })}</span>
            <span className="headline" style={{ color: fits?.get(u) ? 'var(--c-success)' : 'var(--c-muted)' }}>
              {fits?.get(u) ? `✓ ${t('match.fits')}` : t('match.notFits')}
            </span>
          </div>
        ))}
      </div>

      <div className="stack" style={{ marginTop: 'var(--s-5)' }}>
        {portion && <p className="muted small" style={{ margin: 0 }}>{t('match.servingsPot', { n: Math.round(portion.pot_servings * 4) / 4 })}</p>}
        <div className="notice notice--info row row--between">
          <span>{missing === null ? '…' : missing === 0 ? t('match.nothingMissing') : tn('match.missing', missing)}</span>
          {missing !== 0 && <Button small variant="secondary" onClick={() => setSheet(true)}>{t('match.addToList')}</Button>}
        </div>
        <Button block onClick={() => void cook()}><Icon name="pot" /> {t('match.cook')}</Button>
        <Button block variant="secondary" onClick={() => navigate(`/recipes/${recipeId}`)}>{t('match.viewRecipe')}</Button>
        {otherMatch && (
          <Button block variant="text" onClick={() => void supabase.rpc('choose_match', { p_deck: data.deck.id, p_recipe: otherMatch })}>
            {t('match.other')}
          </Button>
        )}
      </div>

      <AddToListSheet open={sheet} onClose={() => { setSheet(false); setMissing(null); void loadProposals(household!.id, ingredients).then((p) => setMissing(p.filter((x) => x.add).length)); }}
        recipe={recipe} ingredients={ingredients} potServings={portion?.pot_servings} />
    </main>
  );
}
