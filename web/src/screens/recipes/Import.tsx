import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button, Field, Screen, Segmented, toast } from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { callFunction } from '../../lib/supabase.ts';

interface Draft {
  title: string;
  servings: string;
  minutes: string;
  ingredients: string;
  steps: string;
  tags: string;
  source_url: string | null;
  source_type: 'web' | 'instagram' | 'typed';
  image_url: string | null;
  language: string | null;
}

const EMPTY: Draft = {
  title: '', servings: '2', minutes: '', ingredients: '', steps: '', tags: '',
  source_url: null, source_type: 'typed', image_url: null, language: null,
};

interface Preview {
  title: string;
  ingredients: string[];
  steps: string[];
  servings: number | null;
  totalMin: number | null;
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
        title: recipe.title,
        servings: String(recipe.servings ?? 2),
        minutes: recipe.totalMin ? String(recipe.totalMin) : '',
        ingredients: recipe.ingredients.join('\n'),
        steps: recipe.steps.join('\n'),
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

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setNotice(null);
    const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);
    try {
      const res = await callFunction<{ recipe_id: string; unknown_ingredients: string[] }>('import-recipe', {
        action: 'save',
        recipe: {
          title: draft.title,
          source_type: draft.source_type,
          source_url: draft.source_url,
          image_url: draft.image_url,
          servings: Number(draft.servings) || 2,
          total_min: Number(draft.minutes) || null,
          steps: lines(draft.steps),
          tags: draft.tags.split(',').map((x) => x.trim()).filter(Boolean),
          language: draft.language ?? locale,
          // A trailing "?" marks an amount the person wasn't sure about.
          ingredients: lines(draft.ingredients).map((l) => ({ text: l.replace(/\s*\?$/, ''), guessed: l.endsWith('?') })),
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
              <Field label={t('import.minutes')}>
                <input className="input" inputMode="numeric" value={form.minutes} onChange={set('minutes')} />
              </Field>
            </div>
            <Field label={t('import.ingredientsField')} hint={t('import.unsure')}>
              <textarea className="input" required value={form.ingredients} placeholder={t('import.ingredientsHint')} onChange={set('ingredients')} />
            </Field>
            <Field label={t('import.stepsField')}>
              <textarea className="input" value={form.steps} onChange={set('steps')} />
            </Field>
            <Field label={t('import.tagsField')}>
              <input className="input" value={form.tags} onChange={set('tags')} />
            </Field>
            <Button block type="submit" disabled={busy || !form.title.trim() || !form.ingredients.trim()}>{t('import.save')}</Button>
          </form>
        )}
      </div>
    </Screen>
  );
}
