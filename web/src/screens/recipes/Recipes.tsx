import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Icon } from '../../components/Icon.tsx';
import { Button, Chip, RecipeThumb, Screen, SearchField, Spinner } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { recipeTitle, allTitles } from '../../lib/recipeText.ts';
import { RECIPE_FILTERS, type RecipeFilter, matchesFilters } from '@logic/facets.ts';
import { effortLabels, facetsOf } from '../../lib/facets.ts';
import { useCatalog, useLive } from '../../lib/hooks.ts';
import { useSession } from '../../lib/session.tsx';
import { must, supabase } from '../../lib/supabase.ts';
import { useTags } from '../../lib/tags.ts';
import { RECIPE_COLLECTIONS, type Recipe, type RecipeCollection } from '../../lib/types.ts';

type Filter = 'all' | RecipeCollection;
type Row = Recipe & { recipe_ingredients: { name: string }[] };

const normalise = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function RecipesScreen() {
  const i18n = useI18n();
  const { t, tn } = i18n;
  const { household } = useSession();
  const { tags } = useTags(household!.id);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [facets, setFacets] = useState<Set<RecipeFilter>>(new Set());
  const catalog = useCatalog();

  const { data, loading } = useLive<Row[]>(`recipes:${household!.id}`, async () =>
    must(await supabase.from('library_recipes').select('*, recipe_ingredients(name)').order('created_at', { ascending: false })) as Row[],
  [{ table: 'recipes', filter: `household_id=eq.${household!.id}` }]);

  const shown = useMemo(() => {
    // Every word must match the title, a tag or an ingredient, in either language: "quick chicken" and "poulet rapide" work.
    const words = normalise(query).split(/\s+/).filter(Boolean);
    if (!catalog) return [];
    return (data ?? []).filter((r) => {
      if (filter !== 'all' && r.collection !== filter) return false;
      if (facets.size && !matchesFilters(facetsOf(r, r.recipe_ingredients.map((i) => i.name), catalog), facets)) return false;
      const hay = normalise([
        ...allTitles(r),
        ...r.tags.flatMap((tag) => [tag, tags?.label(tag, 'en') ?? '', tags?.label(tag, 'fr') ?? '']),
        ...r.recipe_ingredients.flatMap((i) => [i.name, catalog.find(i.name)?.name_fr ?? '']),
      ].join(' '));
      return words.every((w) => hay.includes(w));
    });
  }, [data, query, filter, facets, catalog, tags]);

  const toggle = (f: RecipeFilter) => setFacets((cur) => {
    const next = new Set(cur);
    if (!next.delete(f)) next.add(f);
    return next;
  });

  const filters: Filter[] = ['all', ...RECIPE_COLLECTIONS];
  return (
    <Screen right={
      <button type="button" className="icon-btn icon-btn--filled" aria-label={t('recipes.add')} onClick={() => navigate('/recipes/new')}>
        <Icon name="plus" />
      </button>
    }>
      <h1 className="screen__title">{t('recipes.title')}</h1>
      <div className="stack">
        <SearchField value={query} onChange={setQuery} placeholder={t('recipes.search')} label={t('recipes.search')} />
        <div className="chips chips--scroll">
          {filters.map((f) => <Chip key={f} pressed={filter === f} onClick={() => setFilter(f)}>{t(f === 'all' ? 'recipes.all' : `collection.${f}`)}</Chip>)}
        </div>
        <div className="chips chips--scroll" role="group" aria-label={t('recipes.filters')}>
          {RECIPE_FILTERS.map((f) => <Chip key={f} pressed={facets.has(f)} onClick={() => toggle(f)}>{t(`recipes.${f}`)}</Chip>)}
        </div>
        {(loading && !data) || !catalog ? <Spinner /> : (
          <>
            <div className="row row--between">
              <span className="small muted">{tn('recipes.count', shown.length)}</span>
              {facets.size > 0 && <Button small variant="text" onClick={() => setFacets(new Set())}>{t('recipes.clear')}</Button>}
            </div>
            {shown.length === 0 ? <p className="muted center">{t('recipes.empty')}</p> : (
              <div className="grid">
                {shown.map((r) => (
                  <Link key={r.id} to={`/recipes/${r.id}`} className="tile">
                    <div className="tile__image"><RecipeThumb recipe={r} /></div>
                    <div className="tile__body">
                      <span className="tile__title">{recipeTitle(r, i18n.locale)}</span>
                      <span className="small muted">
                        {[r.total_min && `${r.total_min} min`, r.kcal_per_serving && `${Math.round(r.kcal_per_serving)} kcal`,
                          r.difficulty && t(`recipe.${r.difficulty}`)].filter(Boolean).join(' · ')}
                      </span>
                      {effortLabels(r.equipment, i18n).length > 0 && (
                        <span className="small text-warning">{effortLabels(r.equipment, i18n).join(' · ')}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Screen>
  );
}
