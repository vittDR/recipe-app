import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Icon } from '../../components/Icon.tsx';
import { Chip, Screen, Spinner, imageStyle, recipeEmoji } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useLive } from '../../lib/hooks.ts';
import { useSession } from '../../lib/session.tsx';
import { must, supabase } from '../../lib/supabase.ts';
import type { Recipe } from '../../lib/types.ts';

type Filter = 'all' | 'mine' | 'library' | 'web' | 'typed';
type Row = Recipe & { recipe_ingredients: { name: string }[] };

const normalise = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function RecipesScreen() {
  const { t, tn } = useI18n();
  const { household } = useSession();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const { data, loading } = useLive<Row[]>(`recipes:${household!.id}`, async () =>
    must(await supabase.from('library_recipes').select('*, recipe_ingredients(name)').order('created_at', { ascending: false })) as Row[],
  [{ table: 'recipes', filter: `household_id=eq.${household!.id}` }]);

  const shown = useMemo(() => {
    // Every word must match the title, a tag or an ingredient: "quick chicken" works.
    const words = normalise(query).split(/\s+/).filter(Boolean);
    return (data ?? []).filter((r) => {
      if (filter === 'mine' && !r.household_id) return false;
      if (filter === 'library' && r.household_id) return false;
      if (filter === 'web' && !['web', 'instagram'].includes(r.source_type)) return false;
      if (filter === 'typed' && r.source_type !== 'typed') return false;
      const hay = normalise([r.title, ...r.tags, ...r.recipe_ingredients.map((i) => i.name)].join(' '));
      return words.every((w) => hay.includes(w));
    });
  }, [data, query, filter]);

  const filters: Filter[] = ['all', 'mine', 'library', 'web', 'typed'];
  return (
    <Screen right={
      <button type="button" className="icon-btn icon-btn--filled" aria-label={t('recipes.add')} onClick={() => navigate('/recipes/new')}>
        <Icon name="plus" />
      </button>
    }>
      <h1 className="screen__title">{t('recipes.title')}</h1>
      <div className="stack">
        <label className="row input" style={{ minHeight: 44, padding: '0 var(--s-3)' }}>
          <Icon name="search" size={18} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('recipes.search')} type="search"
            style={{ border: 0, outline: 0, background: 'none', flex: 1, minWidth: 0 }} />
        </label>
        <div className="chips chips--scroll">
          {filters.map((f) => <Chip key={f} pressed={filter === f} onClick={() => setFilter(f)}>{t(`recipes.${f}`)}</Chip>)}
        </div>
        {loading && !data ? <Spinner /> : (
          <>
            <span className="small muted">{tn('recipes.count', shown.length)}</span>
            {shown.length === 0 ? <p className="muted center">{t('recipes.empty')}</p> : (
              <div className="grid">
                {shown.map((r) => (
                  <Link key={r.id} to={`/recipes/${r.id}`} className="tile">
                    <div className="tile__image" style={imageStyle(r.image_path)}>
                      {!imageStyle(r.image_path) && <span aria-hidden>{recipeEmoji(r.title, r.tags)}</span>}
                    </div>
                    <div className="tile__body">
                      <span className="tile__title">{r.title}</span>
                      <span className="small muted">
                        {[r.total_min && `${r.total_min} min`, r.kcal_per_serving && `${Math.round(r.kcal_per_serving)} kcal`].filter(Boolean).join(' · ')}
                      </span>
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
