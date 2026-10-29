// The catalogue admin (the household's creator): the shared base items and
// the household's own, with their aisle and usual amount. Reached from the
// bottom of Us and from the New catalog item sheet.

import { useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { DEFAULT_AISLE_ORDER } from '@logic/groceries.ts';
import { GROCERY_UNITS, productKey, productName, unitsFor, type Product } from '@logic/products.ts';
import { Icon } from '../components/Icon.tsx';
import { Button, Chip, Field, Screen, Segmented, Sheet, Spinner, toast } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
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
  const [products, setProducts] = useState<Product[] | null>(null);
  const [editing, setEditing] = useState<Product | 'new' | null>(null);

  const load = async () => {
    const rows = must(await supabase.from('products').select('*')
      .or(`household_id.is.null,household_id.eq.${household!.id}`)) as Product[];
    setProducts(rows);
  };
  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => {
    const q = productKey(query);
    return (products ?? [])
      .filter((p) => (scope === 'base' ? !p.household_id : !!p.household_id))
      .filter((p) => !q || productKey(`${p.name_fr} ${p.name_en ?? ''} ${p.aliases.join(' ')}`).includes(q))
      .sort((a, b) => productName(a, locale).localeCompare(productName(b, locale), locale));
  }, [products, scope, query, locale]);

  if (!isAdmin) return <Navigate to="/us" replace />;

  return (
    <Screen back="/us" title={t('admin.title')}>
      <Segmented<Scope> label={t('admin.title')} value={scope} onChange={setScope} options={[
        { value: 'base', label: t('admin.base') },
        { value: 'yours', label: t('admin.yours') },
      ]} />
      <div className="row" style={{ margin: 'var(--s-4) 0' }}>
        <input className="input" type="search" value={query} placeholder={t('admin.search')} aria-label={t('admin.search')}
          onChange={(e) => setQuery(e.target.value)} />
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
              <button key={p.id} type="button" className="list-row" onClick={() => setEditing(p)}>
                <span className="list-row__main">
                  <span className="list-row__title">{productName(p, locale)}</span>
                  <span className="list-row__meta">
                    {t(`groceries.aisles.${p.default_aisle}`)}
                    {p.default_unit ? ` · ${amount(p.default_qty ?? null, p.default_unit) || `– ${unitLabel(p.default_unit)}`}` : ''}
                  </span>
                </span>
                <span className="chevron"><Icon name="chevron" size={18} /></span>
              </button>
            ))}
          </div>
          {list.length > SHOWN && <p className="muted small center">{tn('admin.more', list.length - SHOWN)}</p>}
        </>
      )}

      <ProductEditor product={editing} onClose={() => setEditing(null)} onSaved={() => {
        setEditing(null);
        forgetSharedProducts();
        toast(t('admin.saved'));
        void load();
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
      <h2 className="title2" style={{ marginBottom: 'var(--s-4)' }}>{isNew ? t('admin.newItem') : t('admin.editItem')}</h2>
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

      <h3 className="section-label">{t('admin.aisle')}</h3>
      <div className="chips">
        {DEFAULT_AISLE_ORDER.map((a) => (
          <Chip key={a} pressed={a === aisle} onClick={() => setAisle(a)}>{t(`groceries.aisles.${a}`)}</Chip>
        ))}
      </div>

      <h3 className="section-label">{t('admin.defaultUnit')}</h3>
      <div className="chips">
        {choices.map((u) => (
          <Chip key={u} pressed={u === unit} onClick={() => setUnit(u === unit ? null : u)}>{unitLabel(u)}</Chip>
        ))}
      </div>

      <div style={{ marginTop: 'var(--s-4)' }}>
        <Field label={t('admin.defaultQty')} hint={t('admin.defaultQtyHint')}>
          <input className="input" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
      </div>

      <h3 className="section-label">{t('admin.units')}</h3>
      <div className="chips">
        {choices.map((u) => (
          <Chip key={u} pressed={units.includes(u) || u === unit} onClick={() => u !== unit && toggleUnit(u)}>{unitLabel(u)}</Chip>
        ))}
      </div>
      <div className="row" style={{ marginTop: 'var(--s-3)' }}>
        <input className="input" value={customUnit} placeholder={t('groceries.customUnitPlaceholder')}
          aria-label={t('groceries.customUnit')} onChange={(e) => setCustomUnit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} />
        <button type="button" className="icon-btn icon-btn--filled" aria-label={t('groceries.customUnit')}
          disabled={!customUnit.trim()} onClick={addCustom}>
          <Icon name="plus" />
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      <Button block disabled={saving} style={{ marginTop: 'var(--s-6)' }} onClick={() => void save()}>{t('app.save')}</Button>
      <Button block variant="text" onClick={onClose}>{t('app.cancel')}</Button>
    </Sheet>
  );
}
