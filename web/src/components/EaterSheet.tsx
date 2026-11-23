// Add or edit a person who eats but doesn't choose (handoff v2, 04f): name,
// age band (which sets the default portion), portion in quarter steps, and
// what they don't eat (the same allergens and catalogue search as a member's
// "Je ne mange pas"). Used in onboarding (04e) and household settings (24).
import { useEffect, useState } from 'react';
import { productName } from '@logic/products.ts';
import { useI18n } from '../i18n/index.tsx';
import {
  AGE_BANDS, DEFAULT_PORTION, type AgeBand, type Eater, PORTION_MAX, PORTION_MIN, PORTION_STEP, portionText,
} from '../lib/eaters.ts';
import { searchProducts, useGroceryCatalog } from '../lib/products.ts';
import { useSession } from '../lib/session.tsx';
import { supabase } from '../lib/supabase.ts';
import { ALLERGENS } from '../screens/onboarding/NoEat.tsx';
import { useAllergies } from './Allergies.tsx';
import { Icon } from './Icon.tsx';
import { Button, Chip, confirmSheet, ListRow, SearchField, Sheet, toast } from './ui.tsx';

type Draft = { name: string; age_band: AgeBand; portion: number; allergens: string[]; never_products: string[] };

const blank: Draft = { name: '', age_band: '4-8', portion: DEFAULT_PORTION['4-8'], allergens: [], never_products: [] };

export function EaterSheet({ open, eater, onClose }: {
  open: boolean;
  /** Editing this one; null or absent: adding someone. */
  eater?: Eater | null;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { household } = useSession();
  const { data: catalog } = useGroceryCatalog(household!.id);
  const { data: allergies } = useAllergies();
  const [draft, setDraft] = useState<Draft>(blank);
  const [view, setView] = useState<'main' | 'exclusions'>('main');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  // Each opening starts from the person being edited, or blank.
  useEffect(() => {
    if (!open) return;
    setDraft(eater ? {
      name: eater.name, age_band: eater.age_band, portion: eater.portion, allergens: eater.allergens, never_products: eater.never_products,
    } : blank);
    setView('main');
    setQuery('');
  }, [open, eater]);

  const pickBand = (b: AgeBand) => setDraft((d) => ({ ...d, age_band: b, portion: DEFAULT_PORTION[b] }));
  const stepPortion = (dir: 1 | -1) => setDraft((d) => ({
    ...d, portion: Math.min(PORTION_MAX, Math.max(PORTION_MIN, d.portion + dir * PORTION_STEP)),
  }));
  const toggle = <K extends 'allergens' | 'never_products'>(key: K, v: string) =>
    setDraft((d) => ({ ...d, [key]: d[key].includes(v) ? d[key].filter((x) => x !== v) : [...d[key], v] }));

  const allergenName = (key: string) => {
    const a = allergies?.allergens.find((x) => x.key === key);
    return a ? (locale === 'fr' ? a.name_fr : a.name_en) : key;
  };
  const productLabel = (id: string) => {
    const p = catalog?.index.get(id);
    return p ? productName(p, locale) : '';
  };
  const excluded = [...draft.allergens.map(allergenName), ...draft.never_products.map(productLabel).filter(Boolean)];

  const save = async () => {
    setBusy(true);
    const row = { ...draft, name: draft.name.trim() };
    const { error } = eater
      ? await supabase.from('household_eaters').update(row).eq('id', eater.id)
      : await supabase.from('household_eaters').insert(row);
    setBusy(false);
    if (error) {
      toast(t('app.error'));
      return;
    }
    onClose();
  };
  const remove = async () => {
    if (!eater || !(await confirmSheet(t('eaters.removeQuestion', { name: eater.name }), { confirmLabel: t('app.delete') }))) return;
    const { error } = await supabase.from('household_eaters').delete().eq('id', eater.id);
    if (error) toast(t('app.error'));
    else onClose();
  };

  if (view === 'exclusions') {
    const results = searchProducts(catalog, query, { limit: 6 }).results.filter((p) => !draft.never_products.includes(p.id));
    return (
      <Sheet open={open} onClose={onClose} label={t('eaters.noEat')} className="sheet--fixed eater-sheet">
        <div className="eater-sheet__head">
          <button type="button" className="link-btn" onClick={() => setView('main')}>{t('app.back')}</button>
          <h2 className="eater-sheet__title">{t('eaters.noEatOf', { name: draft.name.trim() || t('eaters.thisPerson') })}</h2>
        </div>
        <div className="stack">
          <SearchField value={query} onChange={setQuery} placeholder={t('ob.noEat.search')} label={t('ob.noEat.search')} />
          {query.trim() && results.length > 0 && (
            <div className="list" role="listbox" aria-label={t('ob.noEat.search')}>
              {results.map((p) => (
                <ListRow key={p.id} role="option" title={productName(p, locale)} trailing={<Icon name="plus" size={20} />}
                  onClick={() => { toggle('never_products', p.id); setQuery(''); }} />
              ))}
            </div>
          )}
          <section className="ob-group">
            <h3 className="ob-group__label">{t('ob.noEat.allergies')}</h3>
            <div className="chips">
              {ALLERGENS.map((key) => (
                <Chip key={key} pressed={draft.allergens.includes(key)} onClick={() => toggle('allergens', key)}>{allergenName(key)}</Chip>
              ))}
            </div>
          </section>
          {draft.never_products.length > 0 && (
            <section className="ob-group">
              <h3 className="ob-group__label">{t('ob.noEat.also')}</h3>
              <div className="chips">
                {draft.never_products.map((id) => (
                  <Chip key={id} pressed onRemove={() => toggle('never_products', id)} removeLabel={`${t('app.delete')} ${productLabel(id)}`}>
                    {productLabel(id)}
                  </Chip>
                ))}
              </div>
            </section>
          )}
        </div>
        <Button className="sheet__actions" block onClick={() => setView('main')}>{t('app.done')}</Button>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} label={eater ? t('eaters.edit') : t('eaters.add')} className="eater-sheet">
      <div className="eater-sheet__head">
        <button type="button" className="link-btn" onClick={onClose}>{t('app.cancel')}</button>
        <h2 className="eater-sheet__title">{eater ? t('eaters.edit') : t('eaters.add')}</h2>
      </div>
      <div className="stack">
        <input className="input input--large" value={draft.name} maxLength={40} autoComplete="off" aria-label={t('eaters.name')}
          placeholder={t('eaters.namePlaceholder')} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <section className="ob-group">
          <h3 className="ob-group__label">{t('eaters.age')}</h3>
          <div className="age-bands" role="radiogroup" aria-label={t('eaters.age')}>
            {AGE_BANDS.map((b) => (
              <button key={b} type="button" role="radio" aria-checked={draft.age_band === b} className="age-band" onClick={() => pickBand(b)}>
                <span className="age-band__name">{t(`eaters.bands.${b === '14+' ? 'adult' : b === '4-8' ? 'young' : 'older'}`)}</span>
                <span className="age-band__portion">{t('eaters.portionOf', { n: portionText(DEFAULT_PORTION[b]) })}</span>
              </button>
            ))}
          </div>
        </section>
        <div className="list">
          <div className="list-row eater-portion">
            <span className="list-row__main">
              <span className="list-row__title">{t('eaters.portion')}</span>
            </span>
            <span className="eater-portion__stepper">
              <button type="button" className="icon-btn icon-btn--filled" aria-label={`${t('eaters.portion')} −`}
                disabled={draft.portion <= PORTION_MIN} onClick={() => stepPortion(-1)}><Icon name="minus" size={18} /></button>
              <b className="eater-portion__value" aria-live="polite">{portionText(draft.portion)}</b>
              <button type="button" className="icon-btn icon-btn--filled" aria-label={`${t('eaters.portion')} +`}
                disabled={draft.portion >= PORTION_MAX} onClick={() => stepPortion(1)}><Icon name="plus" size={18} /></button>
            </span>
          </div>
          <ListRow title={t('eaters.noEat')} meta={excluded.length ? excluded.join(', ') : undefined} chevron
            onClick={() => setView('exclusions')} />
        </div>
      </div>
      <Button className="sheet__actions" block disabled={busy || !draft.name.trim()} onClick={() => void save()}>
        {eater ? t('app.save') : t('eaters.addButton')}
      </Button>
      {eater && <Button block variant="danger" onClick={() => void remove()}>{t('eaters.remove')}</Button>}
    </Sheet>
  );
}
