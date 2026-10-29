import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { DIFFICULTIES, SPECIAL_EQUIPMENT, type Difficulty } from '@logic/facets.ts';
import { draftFromLine, IngredientEditor, type DraftIngredient } from '../../components/IngredientEditor.tsx';
import { StepEditor } from '../../components/StepEditor.tsx';
import { Button, Chip, Field, Screen, Segmented, Spinner, toast } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useCatalog } from '../../lib/hooks.ts';
import { useGroceryCatalog } from '../../lib/products.ts';
import { useSession } from '../../lib/session.tsx';
import { callFunction } from '../../lib/supabase.ts';

interface Draft {
  title: string;
  servings: string;
  minutes: string;
  prep: string;
  cook: string;
  ingredients: DraftIngredient[];
  /** Lines read from the page, matched once the catalogue has loaded. */
  pendingLines: string[] | null;
  steps: string[];
  tags: string;
  source_url: string | null;
  source_type: 'web' | 'instagram' | 'typed';
  image_url: string | null;
  language: string | null;
  difficulty: Difficulty | null;
  /** 0 = not said. */
  pots: number;
  oven: boolean;
  special: string[];
}

const EMPTY: Draft = {
  title: '', servings: '2', minutes: '', prep: '', cook: '', ingredients: [], pendingLines: null, steps: [], tags: '',
  source_url: null, source_type: 'typed', image_url: null, language: null,
  difficulty: null, pots: 0, oven: false, special: [],
};

interface Preview {
  title: string;
  ingredients: string[];
  steps: string[];
  servings: number | null;
  totalMin: number | null;
  prepMin: number | null;
  cookMin: number | null;
  imageUrl: string | null;
  tags: string[];
  language: string | null;
  source_url: string;
  source_type: 'web' | 'instagram';
}

/** Add a recipe from a link (structured page data) or by typing it. */
export function ImportScreen() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { household } = useSession();
  const { data: catalog } = useGroceryCatalog(household!.id);
  const ingredientCatalog = useCatalog();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'link' | 'type'>('link');
  const [url, setUrl] = useState(params.get('url') ?? params.get('text') ?? '');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const read = async () => {
    setBusy(true);
    setNotice(null);
    const link = url.match(/https?:\/\/\S+/)?.[0] ?? url.trim();
    try {
      const { recipe } = await callFunction<{ recipe: Preview }>('import-recipe', { action: 'preview', url: link });
      setDraft({
        ...EMPTY,
        title: recipe.title,
        servings: String(recipe.servings ?? 2),
        minutes: recipe.totalMin ? String(recipe.totalMin) : '',
        prep: recipe.prepMin ? String(recipe.prepMin) : '',
        cook: recipe.cookMin ? String(recipe.cookMin) : '',
        pendingLines: recipe.ingredients,
        steps: recipe.steps,
        tags: recipe.tags.join(', '),
        source_url: recipe.source_url,
        source_type: recipe.source_type,
        image_url: recipe.imageUrl,
        language: recipe.language,
      });
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      if (code === 'no_recipe_data') {
        setNotice(t('import.noData'));
        setDraft({ ...EMPTY, source_url: link, source_type: /instagram\.com/.test(link) ? 'instagram' : 'web' });
        setMode('type');
      } else {
        setNotice(t('import.fetchFailed'));
      }
    } finally {
      setBusy(false);
    }
  };

  // Imported lines arrive pre-matched: exact matches, suggestions to check, new items.
  useEffect(() => {
    if (!draft?.pendingLines || !catalog || !ingredientCatalog) return;
    const lines = draft.pendingLines.map((l) => l.trim()).filter(Boolean);
    setDraft({ ...draft, pendingLines: null, ingredients: lines.map((l) => draftFromLine(l, catalog, ingredientCatalog)) });
  }, [draft, catalog, ingredientCatalog]);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setNotice(null);
    const minutes = (s: string) => (s.trim() && Number(s) >= 0 ? Math.round(Number(s)) : null);
    try {
      const res = await callFunction<{ recipe_id: string; unknown_ingredients: string[] }>('import-recipe', {
        action: 'save',
        recipe: {
          title: draft.title,
          source_type: draft.source_type,
          source_url: draft.source_url,
          image_url: draft.image_url,
          servings: Number(draft.servings) || 2,
          total_min: minutes(draft.minutes),
          prep_min: minutes(draft.prep),
          cook_min: minutes(draft.cook),
          steps: draft.steps.map((s) => s.trim()).filter(Boolean),
          tags: draft.tags.split(',').map((x) => x.trim()).filter(Boolean),
          language: draft.language ?? locale,
          difficulty: draft.difficulty,
          equipment: draft.pots || draft.oven || draft.special.length
            ? { pots: draft.pots, oven: draft.oven, special: draft.special } : null,
          // The item each line is: chosen, matched (suggestions count as accepted), or new.
          ingredients: draft.ingredients.map((i) => ({
            text: i.text, original_text: i.original_text ?? null, guessed: i.guessed,
            product_id: i.product_id, new_item: i.match === 'new',
          })),
        },
      });
      toast(res.unknown_ingredients.length
        ? t('import.unknown', { items: res.unknown_ingredients.slice(0, 3).join(', ') })
        : t('import.saved'));
      navigate(`/recipes/${res.recipe_id}`, { replace: true });
    } catch (e) {
      setNotice(e instanceof Error && e.message === 'already_imported' ? t('import.already') : t('app.error'));
      setBusy(false);
    }
  };

  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setDraft((d) => ({ ...(d ?? EMPTY), [k]: e.target.value }));
  const form = draft ?? (mode === 'type' ? EMPTY : null);
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...(d ?? EMPTY), ...patch }));
  const toggleSpecial = (item: string) => update({
    special: form!.special.includes(item) ? form!.special.filter((x) => x !== item) : [...form!.special, item],
  });

  return (
    <Screen back title={t('import.title')}>
      <div className="stack stack--lg">
        {!draft && (
          <Segmented label={t('import.title')} value={mode} onChange={(m) => { setMode(m); if (m === 'type') setDraft(EMPTY); }} options={[
            { value: 'link', label: t('import.link') },
            { value: 'type', label: t('import.type') },
          ]} />
        )}

        {mode === 'link' && !draft && (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void read(); }}>
            <input className="input" type="url" inputMode="url" value={url} placeholder={t('import.linkPlaceholder')}
              onChange={(e) => setUrl(e.target.value)} aria-label={t('import.link')} />
            <Button block type="submit" disabled={busy || !/https?:\/\//.test(url)}>{busy ? t('import.reading') : t('import.read')}</Button>
          </form>
        )}

        {notice && <p className="notice">{notice}</p>}

        {form && (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            {draft?.source_url && <p className="headline" style={{ margin: 0 }}>{t('import.review')}</p>}
            <Field label={t('import.titleField')}>
              <input className="input" required value={form.title} onChange={set('title')} />
            </Field>
            <div className="row">
              <Field label={t('import.servings')}>
                <input className="input" inputMode="numeric" value={form.servings} onChange={set('servings')} />
              </Field>
            </div>
            <div className="row">
              <Field label={t('import.prep')}>
                <input className="input" inputMode="numeric" value={form.prep} onChange={set('prep')} />
              </Field>
              <Field label={t('import.cook')}>
                <input className="input" inputMode="numeric" value={form.cook} onChange={set('cook')} />
              </Field>
              <Field label={t('import.minutes')}>
                <input className="input" inputMode="numeric" value={form.minutes} onChange={set('minutes')}
                  placeholder={form.prep || form.cook ? String((Number(form.prep) || 0) + (Number(form.cook) || 0)) : ''} />
              </Field>
            </div>
            <div className="field">
              <span className="field__label">{t('import.ingredientsField')}</span>
              {form.pendingLines ? <Spinner /> : (
                <IngredientEditor items={form.ingredients} catalog={catalog} onChange={(ingredients) => update({ ingredients })} />
              )}
            </div>
            <div className="field">
              <span className="field__label">{t('import.stepsField')}</span>
              <StepEditor steps={form.steps} onChange={(steps) => update({ steps })} />
            </div>
            <Field label={t('import.tagsField')}>
              <input className="input" value={form.tags} onChange={set('tags')} />
            </Field>
            <div className="field">
              <span className="field__label">{t('import.difficultyField')}</span>
              <Segmented label={t('import.difficultyField')} value={form.difficulty ?? ''} onChange={(v) => update({ difficulty: v as Difficulty })}
                options={DIFFICULTIES.map((d) => ({ value: d, label: t(`recipe.${d}`) }))} />
            </div>
            <div className="field">
              <span className="field__label">{t('import.potsField')}</span>
              <div className="chips">
                {[1, 2, 3, 4].map((n) => (
                  <Chip key={n} pressed={form.pots === n} onClick={() => update({ pots: form.pots === n ? 0 : n })}>{n === 4 ? '4+' : n}</Chip>
                ))}
                <Chip pressed={form.oven} onClick={() => update({ oven: !form.oven })}>{t('import.ovenField')}</Chip>
              </div>
            </div>
            <div className="field">
              <span className="field__label">{t('import.specialField')}</span>
              <div className="chips">
                {SPECIAL_EQUIPMENT.map((item) => (
                  <Chip key={item} pressed={form.special.includes(item)} onClick={() => toggleSpecial(item)}>{t(`equipment.${item}`)}</Chip>
                ))}
              </div>
            </div>
            <Button block type="submit" disabled={busy || !form.title.trim() || form.ingredients.length === 0}>{t('import.save')}</Button>
          </form>
        )}
      </div>
    </Screen>
  );
}
