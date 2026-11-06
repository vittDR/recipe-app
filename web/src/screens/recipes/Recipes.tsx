import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Icon } from '../../components/Icon.tsx';
import { Button, Chip, ListRow, RecipeThumb, Screen, SearchField, Sheet, SheetHeader, Spinner, TabHeader, Tag } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { recipeTitle, allTitles } from '../../lib/recipeText.ts';
import type { ClassifiableRow } from '@logic/classify.ts';
import { RECIPE_FILTERS, type RecipeFilter, matchesFilters } from '@logic/facets.ts';
import { effortLabels, facetsOf } from '../../lib/facets.ts';
import { useCatalog, useLive } from '../../lib/hooks.ts';
import { useSession } from '../../lib/session.tsx';
import { must, supabase } from '../../lib/supabase.ts';
import { useTags } from '../../lib/tags.ts';
import { RECIPE_COLLECTIONS, type Recipe, type RecipeCollection } from '../../lib/types.ts';

type Filter = 'all' | RecipeCollection;
type Row = Recipe & { recipe_ingredients: ClassifiableRow['recipe_ingredients'] };

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
  const [adding, setAdding] = useState(false);

  const { data, loading } = useLive<Row[]>(`recipes:${household!.id}`, async () =>
    must(await supabase.from('library_recipes').select('*, recipe_ingredients(name, quantity, unit, optional, is_staple, guessed)').order('created_at', { ascending: false })) as Row[],
  [{ table: 'recipes', filter: `household_id=eq.${household!.id}` }]);

  const shown = useMemo(() => {
    // Every word must match the title, a tag or an ingredient, in either language: "quick chicken" and "poulet rapide" work.
    const words = normalise(query).split(/\s+/).filter(Boolean);
    if (!catalog) return [];
    return (data ?? []).filter((r) => {
      if (filter !== 'all' && r.collection !== filter) return false;
      if (facets.size && !matchesFilters(facetsOf(r, r.recipe_ingredients, catalog), facets)) return false;
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
    <Screen>
      <TabHeader overline={data ? tn('recipes.count', data.length) : undefined} title={t('recipes.title')} right={
        <button type="button" className="fab" aria-label={t('recipes.add')} onClick={() => setAdding(true)}>
          <Icon name="plus" size={26} strokeWidth={2.4} />
        </button>
      } />
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
            {(facets.size > 0 || filter !== 'all' || query.trim()) && (
              <div className="row row--between">
                <span className="t-label muted">{tn('recipes.count', shown.length)}</span>
                {facets.size > 0 && <Button small variant="text" onClick={() => setFacets(new Set())}>{t('recipes.clear')}</Button>}
              </div>
            )}
            {shown.length === 0 ? <p className="muted center">{t('recipes.empty')}</p> : (
              <div className="grid">
                {shown.map((r) => (
                  <Link key={r.id} to={`/recipes/${r.id}`} className="tile">
                    <div className="tile__image">
                      <RecipeThumb recipe={r} />
                      {(r.collection === 'our_import' || r.collection === 'our_recipe') && (
                        <span className="tile__badge">{t(r.collection === 'our_recipe' ? 'recipes.ours' : 'recipes.imported')}</span>
                      )}
                    </div>
                    <div className="tile__body">
                      <span className="tile__title">{recipeTitle(r, i18n.locale)}</span>
                      <span className="t-callout muted">
                        {[r.total_min && `${r.total_min} min`,
                          r.protein_g_per_serving && t('recipe.protein', { n: Math.round(r.protein_g_per_serving) })].filter(Boolean).join(' · ')}
                      </span>
                      {effortLabels(r.equipment, i18n).length > 0 && (
                        <span className="t-caption muted">{effortLabels(r.equipment, i18n).join(' · ')}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <Sheet open={adding} onClose={() => setAdding(false)} label={t('import.newTitle')}>
        <SheetHeader title={t('import.newTitle')} subtitle={t('import.how')} />
        <div className="stack">
          <ListRow className="card" tile="accent" icon={<Icon name="link" size={20} />} onClick={() => navigate('/recipes/new?mode=link')}
            title={<span className="row">{t('import.fromLink')} <Tag tone="success">{t('import.fastest')}</Tag></span>}
            meta={t('import.fromLinkHint')} chevron={false} />
          <ListRow className="card" tile="plain" icon={<Icon name="pencil" size={20} />} onClick={() => navigate('/recipes/new?mode=type')}
            title={t('import.write')} meta={t('import.writeHint')} chevron={false} />
        </div>
      </Sheet>
    </Screen>
  );
}
