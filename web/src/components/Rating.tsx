// The household's rating of a dish and its favourite heart (household_recipes,
// design/calendar/HANDOFF.md §4). One rating per household and dish: the first
// person to rate it rates it for both, either can change it later (the last
// edit wins). The heart here and on the recipe screen are the same value.
import { useState } from 'react';
import { useI18n } from '../i18n/index.tsx';
import { useSave } from '../lib/hooks.ts';
import { recipeTitle } from '../lib/recipeText.ts';
import { useSession } from '../lib/session.tsx';
import { supabase } from '../lib/supabase.ts';
import type { HouseholdRecipe, Recipe } from '../lib/types.ts';
import { Icon } from './Icon.tsx';
import { Avatar, Button, RecipeThumb, Sheet } from './ui.tsx';

export const HOUSEHOLD_RECIPE = 'recipe_id, stars, rated_by, rated_at, favorite';

/** Saves the heart; the rating, if any, stays as it is. */
export async function saveFavorite(householdId: string, recipeId: string, favorite: boolean) {
  return supabase.from('household_recipes').upsert(
    { household_id: householdId, recipe_id: recipeId, favorite },
    { onConflict: 'household_id,recipe_id' },
  );
}

/** Five stars, read-only: star yellow when on, an outline when off. */
export function Stars({ value, size = 18 }: { value: number | null; size?: number }) {
  const { tn } = useI18n();
  return (
    <span className="stars" role="img" aria-label={value ? tn('rating.star', value) : undefined}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`stars__star${value && n <= value ? ' stars__star--on' : ''}`} aria-hidden>
          <Icon name="star" filled={!!value && n <= value} size={size} strokeWidth={1.6} />
        </span>
      ))}
    </span>
  );
}

/** The round heart button: an outline when off, filled terracotta with a ring when on. */
export function HeartButton({ on, onChange, glass }: { on: boolean; onChange: (on: boolean) => void; glass?: boolean }) {
  const { t } = useI18n();
  return (
    <button type="button" className={`heart-btn${on ? ' heart-btn--on' : ''}${glass ? ' heart-btn--glass' : ''}`}
      aria-pressed={on} aria-label={on ? t('rating.removeFavorite') : t('rating.addFavorite')} onClick={() => onChange(!on)}>
      <Icon name="heart" filled={on} size={glass ? 20 : 24} />
    </button>
  );
}

type RateRecipe = Pick<Recipe, 'id' | 'title' | 'language' | 'translations' | 'image_path' | 'tags'>;

/** How was it? Five stars with their label, the heart, and Save. */
export function RateSheet({ open, onClose, recipe, dateLabel, rating, initialStars }: {
  open: boolean;
  onClose: () => void;
  recipe: RateRecipe;
  /** "Tuesday, November 17": the evening it was eaten. */
  dateLabel?: string;
  rating: HouseholdRecipe | null;
  /** A star already tapped on the card that opened the sheet. */
  initialStars?: number | null;
}) {
  const { t } = useI18n();
  return (
    <Sheet open={open} onClose={onClose} label={t('rating.rate')}>
      {/* Mounted afresh each time it opens, so it starts from the household's rating. */}
      {open && <RateForm onClose={onClose} recipe={recipe} dateLabel={dateLabel} rating={rating} initialStars={initialStars} />}
    </Sheet>
  );
}

function RateForm({ onClose, recipe, dateLabel, rating, initialStars }: {
  onClose: () => void; recipe: RateRecipe; dateLabel?: string; rating: HouseholdRecipe | null; initialStars?: number | null;
}) {
  const { t, tn, list, locale } = useI18n();
  const { household, memberName, memberColor } = useSession();
  const save = useSave();
  const [stars, setStars] = useState<number | null>(initialStars ?? rating?.stars ?? null);
  const [favorite, setFavorite] = useState(rating?.favorite ?? false);
  const [saving, setSaving] = useState(false);
  const labels = list('rating.labels');
  const title = recipeTitle(recipe, locale);

  const submit = async () => {
    if (!stars) return;
    setSaving(true);
    const ok = await save(supabase.from('household_recipes').upsert(
      { household_id: household!.id, recipe_id: recipe.id, stars, favorite },
      { onConflict: 'household_id,recipe_id' },
    ));
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div className="rate">
      <header className="rate__head">
        <span className="rate__thumb"><RecipeThumb recipe={recipe} /></span>
        <span className="grow">
          {dateLabel && <span className="t-label muted d-block">{dateLabel}</span>}
          <h2 className="title2 m-0">{t('rating.question', { title })}</h2>
        </span>
      </header>
      <section className="card rate__stars">
        <div className="rate__picker" role="radiogroup" aria-label={t('rating.question', { title })}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${tn('rating.star', n)} · ${labels[n - 1]}`}
              className={`rate__star${stars && n <= stars ? ' rate__star--on' : ''}`} onClick={() => setStars(n)}>
              <Icon name="star" filled={!!stars && n <= stars} size={40} strokeWidth={1.4} />
            </button>
          ))}
        </div>
        <span className="rate__label" aria-live="polite">{stars ? labels[stars - 1] : ' '}</span>
        {rating?.stars && rating.rated_by && (
          <span className="rate__by muted">
            <Avatar name={memberName(rating.rated_by)} color={memberColor(rating.rated_by)} size="sm" />
            {t('rating.ratedBy', { name: memberName(rating.rated_by) })}
          </span>
        )}
      </section>
      <section className="card rate__fav">
        <span className="grow">
          <span className="card__title d-block">{t('rating.addFavorite')}</span>
          <span className="muted d-block">{t('rating.favoriteHint')}</span>
        </span>
        <HeartButton on={favorite} onChange={setFavorite} />
      </section>
      <Button block disabled={!stars || saving} onClick={() => void submit()}>{t('rating.save')}</Button>
    </div>
  );
}
