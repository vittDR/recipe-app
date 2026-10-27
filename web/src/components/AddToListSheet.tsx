import { useEffect, useMemo, useState } from 'react';
import { proposeListItems, scaleQuantity, type ListProposal } from '@logic/groceries.ts';
import { useI18n } from '../i18n/index.tsx';
import { useSession } from '../lib/session.tsx';
import { must, supabase } from '../lib/supabase.ts';
import type { GroceryRow, Recipe, RecipeIngredient } from '../lib/types.ts';
import { Button, Checkbox, Sheet, toast } from './ui.tsx';

/** Missing ingredients for a recipe given the live list and staples. */
export async function loadProposals(
  householdId: string,
  ingredients: RecipeIngredient[],
): Promise<ListProposal<RecipeIngredient>[]> {
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const [items, staples] = await Promise.all([
    supabase.from('grocery_items').select('*').eq('household_id', householdId)
      .or(`cleared_at.is.null,checked_at.gte.${since}`),
    supabase.from('household_staples').select('name').eq('household_id', householdId),
  ]);
  return proposeListItems(
    ingredients,
    must(items) as GroceryRow[],
    (must(staples) as { name: string }[]).map((s) => s.name),
  );
}

export function formatQuantity(q: number | null, unit: string | null): string {
  if (q === null) return '';
  const n = Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, '');
  return unit && unit !== 'piece' ? `${n} ${unit}` : n;
}

export function AddToListSheet({
  open,
  onClose,
  recipe,
  ingredients,
  potServings,
}: {
  open: boolean;
  onClose: () => void;
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  potServings?: number | null;
}) {
  const { t, tn } = useI18n();
  const { household } = useSession();
  const [proposals, setProposals] = useState<ListProposal<RecipeIngredient>[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void loadProposals(household!.id, ingredients).then((p) => {
      setProposals(p);
      setSelected(new Set(p.filter((x) => x.add).map((x) => x.ingredient.id)));
    });
  }, [open, household, ingredients]);

  const servings = potServings ?? recipe.servings;
  const scaled = (i: RecipeIngredient) => scaleQuantity(i.quantity, recipe.servings, servings);
  const toBuy = useMemo(() => proposals?.filter((p) => p.add) ?? [], [proposals]);
  const atHome = useMemo(() => proposals?.filter((p) => !p.add) ?? [], [proposals]);

  const add = async () => {
    setBusy(true);
    const items = (proposals ?? [])
      .filter((p) => selected.has(p.ingredient.id))
      .map((p) => ({
        name: p.ingredient.name, quantity: scaled(p.ingredient), unit: p.ingredient.unit,
        aisle: p.ingredient.aisle, recipe_id: recipe.id,
      }));
    const { error } = await supabase.rpc('add_grocery_items', { p_items: items });
    setBusy(false);
    if (error) {
      toast(t('app.error'));
      return;
    }
    toast(t('addToList.added'));
    onClose();
  };

  const row = (p: ListProposal<RecipeIngredient>) => {
    const why = p.why === 'staple' ? t('addToList.staple')
      : p.why === 'bought_recently' ? t('addToList.boughtRecently')
        : p.why === 'on_list' ? t('addToList.onList') : null;
    const checked = selected.has(p.ingredient.id);
    return (
      <div key={p.ingredient.id} className="list-row">
        <Checkbox checked={checked} label={p.ingredient.name} onChange={(v) => {
          const next = new Set(selected);
          if (v) next.add(p.ingredient.id);
          else next.delete(p.ingredient.id);
          setSelected(next);
        }} />
        <div className="list-row__main">
          <div className="list-row__title">{p.ingredient.name}</div>
          {why && <div className="list-row__meta">{why}</div>}
        </div>
        <span className="muted small">{formatQuantity(scaled(p.ingredient), p.ingredient.unit)}</span>
      </div>
    );
  };

  return (
    <Sheet open={open} onClose={onClose} label={t('addToList.title')}>
      <h2 className="title2" style={{ marginBottom: 'var(--s-2)' }}>{t('addToList.title')}</h2>
      <p className="muted small" style={{ marginTop: 0 }}>{recipe.title}</p>
      {toBuy.length > 0 && (
        <>
          <h3 className="section-label">{t('addToList.toBuy')}</h3>
          <div className="list">{toBuy.map(row)}</div>
        </>
      )}
      {atHome.length > 0 && (
        <>
          <h3 className="section-label">{t('addToList.atHome')}</h3>
          <div className="list">{atHome.map(row)}</div>
        </>
      )}
      <div style={{ height: 'var(--s-5)' }} />
      <Button block disabled={busy || selected.size === 0} onClick={() => void add()}>
        {tn('addToList.add', selected.size)}
      </Button>
    </Sheet>
  );
}
