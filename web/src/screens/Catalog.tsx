// The catalogue admin (people in public.app_admins): the shared base items and
// the household's own, with their aisle and usual amount. Reached from Us and
// from the New catalog item sheet; nobody else sees it.

import { useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { DEFAULT_AISLE_ORDER } from '@logic/groceries.ts';
import { GROCERY_UNITS, ProductIndex, productName, unitsFor, type Product } from '@logic/products.ts';
import { Icon } from '../components/Icon.tsx';
import { Button, Chip, Field, ListRow, Screen, SearchField, Section, Segmented, Sheet, SheetHeader, Spinner, toast } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import { useLive } from '../lib/hooks.ts';
import { forgetSharedProducts } from '../lib/products.ts';
import { useSession } from '../lib/session.tsx';
import { must, supabase } from '../lib/supabase.ts';
import type { Aisle } from '../lib/types.ts';
import { useAmount } from '../lib/units.ts';

type Scope = 'base' | 'yours';
const SHOWN = 80;

export function CatalogScreen() {
  const { t, tn, locale } = useI18n();
  const { household, isCatalogAdmin: isAdmin } = useSession();
  const { amount, unitLabel } = useAmount();
  const [params] = useSearchParams();
  const [scope, setScope] = useState<Scope>('base');
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const { data: products, reload } = useLive<Product[]>(isAdmin ? `catalog-admin:${household!.id}` : null, async () =>
    must(await supabase.from('products').select('*')
      .or(`household_id.is.null,household_id.eq.${household!.id}`)) as Product[]);

  // All of them A to Z; searching ranks matches the way every item search does.
  const scoped = useMemo(() => (products ?? [])
    .filter((p) => (scope === 'base' ? !p.household_id : !!p.household_id))
    .sort((a, b) => productName(a, locale).localeCompare(productName(b, locale), locale)), [products, scope, locale]);
  const index = useMemo(() => new ProductIndex(scoped), [scoped]);
  const list = query.trim() ? index.search(query, SHOWN) : scoped;

  if (!isAdmin) return <Navigate to="/us" replace />;

  return (
    <Screen back="/us" title={t('admin.title')}>
      <Segmented<Scope> label={t('admin.title')} value={scope} onChange={setScope} options={[
        { value: 'base', label: t('admin.base') },
        { value: 'yours', label: t('admin.yours') },
      ]} />
      <div className="row catalog-search">
        <SearchField value={query} onChange={setQuery} placeholder={t('admin.search')} label={t('admin.search')} />
        {scope === 'base' && (
          <button type="button" className="icon-btn icon-btn--filled" aria-label={t('admin.newItem')} onClick={() => setEditing('new')}>
            <Icon name="plus" />
          </button>
        )}
      </div>

      {!products ? <Spinner /> : list.length === 0 ? <p className="muted center">{t('admin.noResults')}</p> : (
        <>
          <div className="list">
            {list.slice(0, SHOWN).map((p) => (
              <ListRow key={p.id} title={productName(p, locale)} chevron onClick={() => setEditing(p)}
                meta={`${t(`groceries.aisles.${p.default_aisle}`)}${p.default_unit
                  ? ` · ${amount(p.default_qty ?? null, p.default_unit) || `– ${unitLabel(p.default_unit)}`}` : ''}`} />
            ))}
          </div>
          {list.length > SHOWN && <p className="muted small center">{tn('admin.more', list.length - SHOWN)}</p>}
        </>
      )}

      <ProductEditor product={editing} onClose={() => setEditing(null)} onSaved={() => {
        setEditing(null);
        forgetSharedProducts();
        toast(t('admin.saved'));
        void reload();
      }} />
    </Screen>
  );
}

const parseQty = (s: string): number | null => {
  const n = Number(s.replace(',', '.'));
  return s.trim() && Number.isFinite(n) && n > 0 ? n : null;
};

function ProductEditor({ product, onClose, onSaved }: {
  product: Product | 'new' | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const { unitLabel } = useAmount();
  const isNew = product === 'new';
  const p = product && product !== 'new' ? product : null;
  const [nameFr, setNameFr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [aliases, setAliases] = useState('');
  const [aisle, setAisle] = useState<Aisle>('other');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState<string | null>(null);
  const [units, setUnits] = useState<string[]>([]);
  const [customUnit, setCustomUnit] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNameFr(p?.name_fr ?? '');
    setNameEn(p?.name_en ?? '');
    setAliases(p?.aliases.join(', ') ?? '');
    setAisle(p?.default_aisle ?? 'other');
    setQty(p?.default_qty != null ? String(p.default_qty) : '');
    setUnit(p?.default_unit ?? null);
    setUnits(p ? unitsFor(p) : []);
    setCustomUnit('');
    setError(null);
  }, [product]); // eslint-disable-line react-hooks/exhaustive-deps

  const choices = [...new Set([...GROCERY_UNITS, ...units, ...(unit ? [unit] : [])])];
  const toggleUnit = (u: string) => setUnits((us) => (us.includes(u) ? us.filter((x) => x !== u) : [...us, u]));
  const addCustom = () => {
    const u = customUnit.trim().toLowerCase();
    if (!u) return;
    setUnits((us) => (us.includes(u) ? us : [...us, u]));
    setUnit((cur) => cur ?? u);
    setCustomUnit('');
  };

  const save = async () => {
    if (!nameFr.trim()) {
      setError(t('admin.nameRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    const suggested = unit ? [unit, ...units.filter((u) => u !== unit)] : units;
    const row = {
      name_fr: nameFr.trim(),
      name_en: nameEn.trim() || null,
      aliases: aliases.split(',').map((a) => a.trim()).filter(Boolean),
      default_aisle: aisle,
      default_qty: parseQty(qty),
      default_unit: unit,
      suggested_units: suggested,
    };
    const { error: e } = isNew
      ? await supabase.from('products').insert(row)
      : await supabase.from('products').update(row).eq('id', p!.id);
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    onSaved();
  };

  return (
    <Sheet open={!!product} onClose={onClose} label={isNew ? t('admin.newItem') : t('admin.editItem')}>
      <SheetHeader title={isNew ? t('admin.newItem') : t('admin.editItem')} />
      <div className="stack">
        <Field label={t('admin.nameFr')}>
          <input className="input" value={nameFr} onChange={(e) => setNameFr(e.target.value)} />
        </Field>
        <Field label={t('admin.nameEn')}>
          <input className="input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        </Field>
        <Field label={t('admin.aliases')} hint={t('admin.aliasesHint')}>
          <input className="input" value={aliases} onChange={(e) => setAliases(e.target.value)} />
        </Field>
      </div>

      <Section label={t('admin.aisle')}>
        <div className="chips">
          {DEFAULT_AISLE_ORDER.map((a) => (
            <Chip key={a} pressed={a === aisle} onClick={() => setAisle(a)}>{t(`groceries.aisles.${a}`)}</Chip>
          ))}
        </div>
      </Section>

      <Section label={t('admin.defaultUnit')}>
        <div className="chips">
          {choices.map((u) => (
            <Chip key={u} pressed={u === unit} onClick={() => setUnit(u === unit ? null : u)}>{unitLabel(u)}</Chip>
          ))}
        </div>
        <div className="mt-4">
          <Field label={t('admin.defaultQty')} hint={t('admin.defaultQtyHint')}>
            <input className="input" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section label={t('admin.units')}>
        <div className="chips">
          {choices.map((u) => (
            <Chip key={u} pressed={units.includes(u) || u === unit} onClick={() => u !== unit && toggleUnit(u)}>{unitLabel(u)}</Chip>
          ))}
        </div>
      </Section>
      <div className="row mt-3">
        <input className="input" value={customUnit} placeholder={t('groceries.customUnitPlaceholder')}
          aria-label={t('groceries.customUnit')} onChange={(e) => setCustomUnit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} />
        <button type="button" className="icon-btn icon-btn--filled" aria-label={t('groceries.customUnit')}
          disabled={!customUnit.trim()} onClick={addCustom}>
          <Icon name="plus" />
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      <Button block disabled={saving} className="mt-6" onClick={() => void save()}>{t('app.save')}</Button>
      <Button block variant="text" onClick={onClose}>{t('app.cancel')}</Button>
    </Sheet>
  );
}
