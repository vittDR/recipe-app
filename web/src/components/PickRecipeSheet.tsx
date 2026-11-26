// "What did you eat?": a past evening with no dinner logged gets one. Dishes
// the household has had come first, then the rest of the library A to Z.
import { useMemo, useState } from 'react';
import { useI18n } from '../i18n/index.tsx';
import { useLive } from '../lib/hooks.ts';
import { allTitles, recipeTitle } from '../lib/recipeText.ts';
import { useSession } from '../lib/session.tsx';
import { must, supabase } from '../lib/supabase.ts';
import type { Recipe } from '../lib/types.ts';
import { ListRow, RecipeThumb, SearchField, Sheet, SheetHeader, Spinner } from './ui.tsx';

type PickRow = Pick<Recipe, 'id' | 'title' | 'language' | 'translations' | 'image_path' | 'tags'>;
const normalise = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Rows shown at once: enough to scroll, few enough to stay quick. */
const SHOWN = 60;

export function PickRecipeSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (recipeId: string) => void }) {
  const { t } = useI18n();
  return (
    <Sheet open={open} onClose={onClose} label={t('calendar.pickTitle')} className="sheet--fixed">
      {open && <PickList onPick={onPick} />}
    </Sheet>
  );
}

function PickList({ onPick }: { onPick: (recipeId: string) => void }) {
  const { t, locale } = useI18n();
  const { household } = useSession();
  const [query, setQuery] = useState('');
  const { data } = useLive<{ recipes: PickRow[]; had: Map<string, number> }>(`pick-recipe:${household!.id}`, async () => {
    const [recipes, meals] = await Promise.all([
      supabase.from('library_recipes').select('id, title, language, translations, image_path, tags'),
      supabase.from('meals').select('recipe_id').eq('household_id', household!.id).neq('status', 'skipped'),
    ]);
    const had = new Map<string, number>();
    for (const m of must(meals) as { recipe_id: string }[]) had.set(m.recipe_id, (had.get(m.recipe_id) ?? 0) + 1);
    return { recipes: must(recipes) as PickRow[], had };
  });

  const shown = useMemo(() => {
    if (!data) return [];
    const words = normalise(query).split(/\s+/).filter(Boolean);
    return data.recipes
      .filter((r) => words.every((w) => normalise(allTitles(r).join(' ')).includes(w)))
      .sort((a, b) => (data.had.get(b.id) ?? 0) - (data.had.get(a.id) ?? 0)
        || recipeTitle(a, locale).localeCompare(recipeTitle(b, locale), locale))
      .slice(0, SHOWN);
  }, [data, query, locale]);

  return (
    <>
      <SheetHeader title={t('calendar.pickTitle')} />
      <SearchField value={query} onChange={setQuery} placeholder={t('calendar.search')} label={t('calendar.search')} />
      {!data ? <Spinner /> : shown.length === 0 ? <p className="muted">{t('calendar.noResults')}</p> : (
        <div className="list mt-4">
          {shown.map((r) => (
            <ListRow key={r.id} onClick={() => onPick(r.id)} chevron={false}
              icon={<span className="row-thumb"><RecipeThumb recipe={r} /></span>} title={recipeTitle(r, locale)} />
          ))}
        </div>
      )}
    </>
  );
}
