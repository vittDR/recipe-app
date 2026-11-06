import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { DIFFICULTIES, SPECIAL_EQUIPMENT, type Difficulty } from '@logic/facets.ts';
import { draftFromLine, IngredientEditor, type DraftIngredient } from '../../components/IngredientEditor.tsx';
import { StepEditor } from '../../components/StepEditor.tsx';
import { TagEditor } from '../../components/Tags.tsx';
import { Icon } from '../../components/Icon.tsx';
import {
  Button, Chip, ListRow, ModeBar, SectionHeading, Segmented, Sheet, SheetHeader, Spinner, Switch, imageStyle, recipeEmoji, toast,
} from '../../components/ui.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { useCatalog } from '../../lib/hooks.ts';
import { useGroceryCatalog } from '../../lib/products.ts';
import { useSession } from '../../lib/session.tsx';
import { callFunction } from '../../lib/supabase.ts';
import { useTags } from '../../lib/tags.ts';
import { shrinkPhoto, uploadPhoto } from '../../lib/photo.ts';

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
  /** Tag names; new words become the household's own tags on save. */
  tags: string[];
  /** Tags read from the page, matched once the tag catalogue has loaded. */
  pendingTags: string[] | null;
  source_url: string | null;
  source_type: 'web' | 'instagram' | 'typed';
  image_url: string | null;
  /** A photo picked on the phone, shrunk, uploaded on save. */
  photo: { blob: Blob; preview: string } | null;
  language: string | null;
  difficulty: Difficulty | null;
  /** 0 = not said. */
  pots: number;
  oven: boolean;
  special: string[];
}

const EMPTY: Draft = {
  title: '', servings: '2', minutes: '', prep: '', cook: '', ingredients: [], pendingLines: null, steps: [], tags: [], pendingTags: null,
  source_url: null, source_type: 'typed', image_url: null, photo: null, language: null,
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
  const { t, tn, locale } = useI18n();
  const navigate = useNavigate();
  const { household } = useSession();
  const { data: catalog } = useGroceryCatalog(household!.id);
  const ingredientCatalog = useCatalog();
  const { tags: tagCatalog, reload: reloadTags } = useTags(household!.id);
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'link' | 'type'>(params.get('mode') === 'type' ? 'type' : 'link');
  const [sheet, setSheet] = useState<'time' | 'servings' | 'difficulty' | 'details' | null>(null);
  // A link's recipe shows as a summary first; the full form on request.
  const [reviewing, setReviewing] = useState(false);
  const [saved, setSaved] = useState<{ id: string; title: string; image: string | null; facts: string } | null>(null);
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
        pendingTags: recipe.tags,
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
        setReviewing(true);
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

  // Page tags in any language land on catalogue tags; ingredients and filler words go.
  useEffect(() => {
    if (!draft?.pendingTags || !tagCatalog) return;
    setDraft({ ...draft, pendingTags: null, tags: tagCatalog.normalise(draft.pendingTags).tags });
  }, [draft, tagCatalog]);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setNotice(null);
    const minutes = (s: string) => (s.trim() && Number(s) >= 0 ? Math.round(Number(s)) : null);
    try {
      const imageUrl = draft.photo ? await uploadPhoto(household!.id, draft.photo.blob) : draft.image_url;
      const res = await callFunction<{ recipe_id: string; unknown_ingredients: string[] }>('import-recipe', {
        action: 'save',
        recipe: {
          title: draft.title,
          source_type: draft.source_type,
          source_url: draft.source_url,
          image_url: imageUrl,
          servings: Number(draft.servings) || 2,
          total_min: minutes(draft.minutes),
          prep_min: minutes(draft.prep),
          cook_min: minutes(draft.cook),
          steps: draft.steps.map((s) => s.trim()).filter(Boolean),
          tags: draft.tags,
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
      void reloadTags();
      if (res.unknown_ingredients.length) toast(t('import.unknown', { items: res.unknown_ingredients.slice(0, 3).join(', ') }));
      setSaved({
        id: res.recipe_id, title: draft.title, image: imageUrl,
        facts: [minutes(draft.minutes) != null && t('swipe.minutes', { n: minutes(draft.minutes)! }),
          draft.difficulty && t(`recipe.${draft.difficulty}`), tn('import.people', Number(draft.servings) || 2)].filter(Boolean).join(' · '),
      });
      setBusy(false);
    } catch (e) {
      setNotice(e instanceof Error && e.message === 'already_imported' ? t('import.already') : t('app.error'));
      setBusy(false);
    }
  };

  const form = draft ?? (mode === 'type' ? EMPTY : null);
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...(d ?? EMPTY), ...patch }));
  const toggleSpecial = (item: string) => update({
    special: form!.special.includes(item) ? form!.special.filter((x) => x !== item) : [...form!.special, item],
  });
  const close = () => navigate('/recipes');

  if (saved) {
    return (
      <main className="screen moment">
        <div className="saved-card card card--flush">
          <div className="match-card__photo" style={imageStyle(saved.image)}>
            {!imageStyle(saved.image) && <span aria-hidden>{recipeEmoji(saved.title)}</span>}
          </div>
          <div className="match-card__body">
            <span className="headline">{saved.title}</span>
            <span className="t-caption muted">{saved.facts}</span>
          </div>
        </div>
        <div className="moment__head moment__head--saved">
          <h1 className="t-title-m m-0">{t('import.savedTitle')}</h1>
          <p className="t-callout muted m-0">{t('import.savedSub')}</p>
        </div>
        <div className="moment__actions">
          <Button block onClick={() => navigate(`/recipes/${saved.id}`, { replace: true })}>{t('match.viewRecipe')}</Button>
          <Button variant="text" onClick={() => { setSaved(null); setDraft(null); setReviewing(false); setUrl(''); setMode('link'); }}>{t('import.another')}</Button>
        </div>
      </main>
    );
  }

  const minutesOf = (s: string) => Number(s) || 0;
  const total = form ? minutesOf(form.minutes) || minutesOf(form.prep) + minutesOf(form.cook) : 0;
  const canSave = !!form && !busy && !!form.title.trim() && form.ingredients.length > 0;
  const toCheck = form ? form.ingredients.filter((i) => i.match === 'close' || (i.match === 'new' && i.suggestion_id)).length : 0;
  const summary = !!draft?.source_url && !reviewing && mode === 'link';

  return (
    <main className="screen create">
      <ModeBar title={t('import.newTitle')} onClose={close} />

      {mode === 'link' && !draft && (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); void read(); }}>
          <input className="input" type="url" inputMode="url" value={url} placeholder={t('import.linkPlaceholder')} autoFocus
            onChange={(e) => setUrl(e.target.value)} aria-label={t('import.link')} />
          <Button block type="submit" disabled={busy || !/https?:\/\//.test(url)}>{busy ? t('import.reading') : t('import.importBtn')}</Button>
        </form>
      )}

      {notice && <p className="notice">{notice}</p>}

      {form && summary && (
        <>
          <article className="card card--flush">
            <div className="match-card__photo import-photo" style={imageStyle(form.image_url)}>
              {!imageStyle(form.image_url) && <span aria-hidden>{recipeEmoji(form.title)}</span>}
              {form.source_url && <span className="glass-badge import-photo__link"><Icon name="link" size={14} /> {new URL(form.source_url).hostname.replace(/^www\./, '')}</span>}
            </div>
            <div className="match-card__body">
              <h2 className="t-title-s m-0">{form.title}</h2>
              <div className="facts">
                {total > 0 && <Chip variant="fact"><Icon name="clock" size={15} /> {t('swipe.minutes', { n: total })}</Chip>}
                <Chip variant="fact">{tn('import.ingredientsCount', form.pendingLines?.length ?? form.ingredients.length)}</Chip>
                <Chip variant="fact">{tn('import.stepsCount', form.steps.length)}</Chip>
              </div>
              {form.tags.length > 0 && (
                <div className="chips">
                  {form.tags.map((name) => (
                    <Chip key={name} variant="suggested" onRemove={() => update({ tags: form.tags.filter((x) => x !== name) })}
                      removeLabel={t('tags.remove', { tag: tagCatalog?.label(name, locale) ?? name })}>
                      <Icon name="sparkle" filled size={12} /> {tagCatalog?.label(name, locale) ?? name}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          </article>
          {toCheck > 0 && (
            <button type="button" className="card card--sage check-card" onClick={() => setReviewing(true)}>
              <span className="card__title">{tn('ingredients.checkShort', toCheck)}</span>
            </button>
          )}
          <Button variant="text" className="self-start" onClick={() => setReviewing(true)}>{t('import.reviewAll')} ›</Button>
        </>
      )}

      {form && !summary && (
        <div className="create__form">
          <PhotoPicker image={form.photo?.preview ?? form.image_url} onPick={(photo) => update({ photo })} />
          <input className="title-input" value={form.title} placeholder={t('import.namePlaceholder')} aria-label={t('import.titleField')}
            onChange={(e) => update({ title: e.target.value })} />
          <div className="chips">
            <Chip variant={total ? undefined : 'dashed'} onClick={() => setSheet('time')}>
              <Icon name="clock" size={16} /> {total ? t('swipe.minutes', { n: total }) : t('import.time')}
            </Chip>
            <Chip onClick={() => setSheet('servings')}><Icon name="people" size={16} /> {tn('import.people', Number(form.servings) || 2)}</Chip>
            <Chip variant={form.difficulty ? undefined : 'dashed'} onClick={() => setSheet('difficulty')}>
              <Icon name="chart" size={16} /> {form.difficulty ? t(`recipe.${form.difficulty}`) : t('import.difficultyField')}
            </Chip>
          </div>

          <SectionHeading count={form.ingredients.length || undefined}>{t('import.ingredientsField')}</SectionHeading>
          {form.pendingLines ? <Spinner /> : (
            <IngredientEditor items={form.ingredients} catalog={catalog} onChange={(ingredients) => update({ ingredients })} />
          )}
          <SectionHeading count={form.steps.length || undefined}>{t('import.stepsField')}</SectionHeading>
          <StepEditor steps={form.steps} onChange={(steps) => update({ steps })} />

          <div className="list mt-6">
            <ListRow tile="accent" icon={<Icon name="gear" size={18} />} title={t('import.details')} meta={t('import.detailsHint')}
              onClick={() => setSheet('details')} chevron />
          </div>
        </div>
      )}

      {form && (
        <div className="bottom-action">
          {!canSave && !summary && <p className="t-callout muted center m-0 mb-3">{t('import.needs')}</p>}
          <Button block disabled={!canSave} onClick={() => void save()}>{busy ? t('import.reading') : summary ? t('import.saveOurs') : t('import.save')}</Button>
        </div>
      )}

      {form && (
        <>
          <Sheet open={sheet === 'time'} onClose={() => setSheet(null)} label={t('import.timeTitle')}>
            <TimeSheet form={form} update={update} onDone={() => setSheet(null)} />
          </Sheet>
          <Sheet open={sheet === 'servings'} onClose={() => setSheet(null)} label={t('import.servingsTitle')}>
            <SheetHeader title={t('import.servingsTitle')} />
            <BigStepper value={Number(form.servings) || 2} min={1} max={20} step={1} unit=""
              onChange={(n) => update({ servings: String(n) })} />
            <Button className="sheet__actions" block onClick={() => setSheet(null)}>{t('import.validate')}</Button>
          </Sheet>
          <Sheet open={sheet === 'difficulty'} onClose={() => setSheet(null)} label={t('import.difficultyField')}>
            <SheetHeader title={t('import.difficultyField')} />
            <div className="chips">
              {DIFFICULTIES.map((d) => (
                <Chip key={d} pressed={form.difficulty === d} onClick={() => { update({ difficulty: d }); setSheet(null); }}>{t(`recipe.${d}`)}</Chip>
              ))}
            </div>
          </Sheet>
          <Sheet open={sheet === 'details'} onClose={() => setSheet(null)} label={t('import.details')}>
            <SheetHeader title={t('import.details')} subtitle={t('import.detailsSub')} />
            <div className="stack stack--lg">
              <div className="field">
                <span className="field__label">{t('import.tagsField')}</span>
                {form.pendingTags ? <Spinner /> : (
                  <TagEditor value={form.tags} tags={tagCatalog} onChange={(tags) => update({ tags })} />
                )}
              </div>
              <div className="field">
                <span className="field__label">{t('import.potsField')}</span>
                <Segmented label={t('import.potsField')} value={String(form.pots)} onChange={(v) => update({ pots: Number(v) })}
                  options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: n === 4 ? '4+' : String(n) }))} />
              </div>
              <div className="list">
                <ListRow icon={<Icon name="flame" size={20} />} title={t('import.ovenField')}
                  trailing={<Switch checked={form.oven} label={t('import.ovenField')} onChange={(oven) => update({ oven })} />} />
              </div>
              <div className="field">
                <span className="field__label">{t('import.specialField')}</span>
                <div className="chips">
                  {SPECIAL_EQUIPMENT.map((item) => (
                    <Chip key={item} pressed={form.special.includes(item)} onClick={() => toggleSpecial(item)}>{t(`equipment.${item}`)}</Chip>
                  ))}
                </div>
              </div>
            </div>
            <Button className="sheet__actions" block onClick={() => setSheet(null)}>{t('import.done')}</Button>
          </Sheet>
        </>
      )}
      {!form && mode === 'link' && (
        <Link to="/recipes/new?mode=type" className="btn btn--text self-start" onClick={() => { setMode('type'); setDraft(EMPTY); }}>
          {t('import.write')}
        </Link>
      )}
    </main>
  );
}

/** A big number with − and +, for minutes and servings. */
function BigStepper({ value, onChange, min, max, step, unit }: {
  value: number; onChange: (n: number) => void; min: number; max: number; step: number; unit: string;
}) {
  return (
    <div className="big-stepper">
      <button type="button" className="swipe-btn swipe-btn--small" aria-label="−" onClick={() => onChange(Math.max(min, value - step))}>
        <Icon name="minus" size={20} />
      </button>
      <label className="big-stepper__value">
        {/* Tapping the number opens the number pad. */}
        <input className="big-stepper__input" type="text" inputMode="numeric" pattern="[0-9]*" value={value === 0 ? '' : String(value)}
          placeholder="0" style={{ width: `${Math.max(1, String(value).length)}ch` }}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/\D/g, '').slice(0, 3));
            onChange(Math.min(max, n));
          }}
          onBlur={() => value < min && onChange(min)} />
        {unit && <span className="big-stepper__unit"> {unit}</span>}
      </label>
      <button type="button" className="swipe-btn swipe-btn--small" aria-label="+" onClick={() => onChange(Math.min(max, value + step))}>
        <Icon name="plus" size={20} />
      </button>
    </div>
  );
}

const PRESETS = [10, 15, 20, 30, 45, 60, 90, 120];

/** The photo block at the top of the form: add one, or change it. */
function PhotoPicker({ image, onPick }: { image: string | null; onPick: (photo: Draft['photo']) => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const input = (
    <input type="file" accept="image/*" hidden onChange={async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setBusy(true);
      try {
        const blob = await shrinkPhoto(file);
        onPick({ blob, preview: URL.createObjectURL(blob) });
      } catch {
        toast(t('app.error'));
      } finally {
        setBusy(false);
      }
    }} />
  );
  if (image) {
    return (
      <div className="photo-pick photo-pick--set" style={imageStyle(image)}>
        <label className="glass-badge photo-pick__change">
          <Icon name="camera" size={16} /> {t('import.changePhoto')}
          {input}
        </label>
      </div>
    );
  }
  return (
    <label className="photo-pick">
      <span className="icon-tile photo-pick__tile"><Icon name="camera" size={22} /></span>
      <span className="headline">{busy ? t('app.loading') : t('import.addPhoto')}</span>
      <span className="t-callout muted">{t('import.addPhotoHint')}</span>
      {input}
    </label>
  );
}

/** One total time by default; prep and cooking apart only when asked. */
function TimeSheet({ form, update, onDone }: { form: Draft; update: (p: Partial<Draft>) => void; onDone: () => void }) {
  const { t } = useI18n();
  const [split, setSplit] = useState(!!(form.prep || form.cook));
  const n = (s: string) => Number(s) || 0;
  const total = n(form.minutes) || n(form.prep) + n(form.cook);
  const label = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m / 60} h`);
  return (
    <>
      <SheetHeader title={t('import.timeTitle')} subtitle={t('import.timeHint')} />
      {split ? (
        <div className="stack">
          <span className="field__label">{t('import.prepShort')}</span>
          <BigStepper value={n(form.prep)} min={0} max={600} step={5} unit="min" onChange={(v) => update({ prep: String(v), minutes: '' })} />
          <span className="field__label">{t('import.cookShort')}</span>
          <BigStepper value={n(form.cook)} min={0} max={600} step={5} unit="min" onChange={(v) => update({ cook: String(v), minutes: '' })} />
        </div>
      ) : (
        <>
          <BigStepper value={total || 30} min={5} max={600} step={5} unit="min" onChange={(v) => update({ minutes: String(v) })} />
          <div className="chips chips--center">
            {PRESETS.map((m) => (
              <Chip key={m} pressed={total === m} onClick={() => update({ minutes: String(m) })}>{m >= 120 ? '2 h +' : label(m)}</Chip>
            ))}
          </div>
        </>
      )}
      <div className="list mt-6">
        <ListRow title={t('import.split')} meta={t('import.splitHint')}
          trailing={<Switch checked={split} label={t('import.split')} onChange={(v) => {
            setSplit(v);
            if (!v) update({ minutes: String(total || 30), prep: '', cook: '' });
          }} />} />
      </div>
      <Button className="sheet__actions" block onClick={() => { if (!total && !split) update({ minutes: '30' }); onDone(); }}>{t('import.validate')}</Button>
    </>
  );
}
