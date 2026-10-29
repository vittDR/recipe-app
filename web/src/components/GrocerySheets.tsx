import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { DEFAULT_AISLE_ORDER, storeKey } from '@logic/groceries.ts';
import { productKey, productName, sectionOf, suggestAisle, unitsFor, type Product } from '@logic/products.ts';
import { dueAgain, usuals, type Purchase, type Usual } from '@logic/usuals.ts';
import { useI18n } from '../i18n/index.tsx';
import type { GroceryCatalog } from '../lib/products.ts';
import { must, supabase } from '../lib/supabase.ts';
import type { Aisle, GroceryRow } from '../lib/types.ts';
import { AmountControl, type Amount } from './GroceryControls.tsx';
import { Icon } from './Icon.tsx';
import { Button, Chip, Field, Sheet } from './ui.tsx';

/** Section title: a store's name or the translated aisle. */
export function useSectionTitle(catalog: GroceryCatalog | null) {
  const { t } = useI18n();
  return (key: string) =>
    key.startsWith('store:')
      ? catalog?.stores.find((s) => storeKey(s.id) === key)?.name ?? ''
      : t(`groceries.aisles.${key as Aisle}`);
}

/** Where a product sits for this household: its store's section, else its aisle. */
export function sectionKeyOf(catalog: GroceryCatalog | null, p: Product): string {
  const s = sectionOf(p, catalog?.prefs.get(p.id));
  return s.store_id && catalog?.sectionOrder.includes(storeKey(s.store_id)) ? storeKey(s.store_id) : s.aisle;
}

/** A list row with its display name. */
export type ListItem = GroceryRow & { display: string };

/** Tap on a list item: its amount, where it goes, remove it. */
export function ItemSheet({
  item,
  catalog,
  onClose,
  onChange,
  onRemove,
  onMoved,
}: {
  item: ListItem | null;
  catalog: GroceryCatalog | null;
  onClose: () => void;
  onChange: (item: ListItem, a: Amount) => void;
  onRemove: (item: ListItem) => void;
  onMoved: () => void;
}) {
  const { t } = useI18n();
  const title = useSectionTitle(catalog);
  const product = item?.product_id ? catalog?.index.get(item.product_id) : undefined;
  const current = item?.store_id ? storeKey(item.store_id) : item?.aisle;
  const sections = catalog?.sectionOrder ?? [];

  const move = async (key: string) => {
    if (!item || key === current) return;
    const store = key.startsWith('store:') ? key.slice('store:'.length) : null;
    const aisle = store ? null : (key as Aisle);
    if (product) {
      await supabase.rpc('set_product_section', { p_product: product.id, p_aisle: aisle, p_store: store });
    } else {
      await supabase.from('grocery_items').update({ store_id: store, ...(aisle ? { aisle } : {}) }).eq('id', item.id);
    }
    onMoved();
    onClose();
  };

  return (
    <Sheet open={!!item} onClose={onClose} label={item?.display ?? ''}>
      {item && (
        <>
          <div className="row row--between" style={{ alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <h2 className="title2" style={{ marginBottom: 'var(--s-1)' }}>{item.display}</h2>
              {product?.household_id && <p className="muted small" style={{ marginTop: 0 }}>{t('groceries.yourItem')}</p>}
            </div>
            <AmountControl name={item.display} amount={{ quantity: item.quantity, unit: item.unit }}
              units={product ? unitsFor(product) : unitsFor({ default_aisle: item.aisle })}
              onAdd={() => undefined} onChange={(a) => onChange(item, a)}
              onRemove={() => { onRemove(item); onClose(); }} />
          </div>

          <h3 className="section-label">{t('groceries.section')}</h3>
          <div className="chips">
            {sections.map((key) => (
              <Chip key={key} pressed={key === current} onClick={() => void move(key)}>{title(key)}</Chip>
            ))}
          </div>

          <Button block variant="text" style={{ color: 'var(--c-danger)', marginTop: 'var(--s-6)' }}
            onClick={() => { onRemove(item); onClose(); }}>
            {t('groceries.removeItem')}
          </Button>
        </>
      )}
    </Sheet>
  );
}

const CREATE_UNITS = ['piece', 'g', 'kg', 'ml', 'l', 'pack', 'jar', 'bottle'];

/** "New catalog item": name, aisle (guessed from the name), usual unit. */
export function CreateItemSheet({
  name: initialName,
  catalog,
  isAdmin,
  onClose,
  onCreate,
  onUseExisting,
}: {
  /** Null: closed. */
  name: string | null;
  catalog: GroceryCatalog | null;
  isAdmin: boolean;
  onClose: () => void;
  onCreate: (item: { name: string; section: string; unit: string | null }) => void;
  onUseExisting: (p: Product) => void;
}) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const title = useSectionTitle(catalog);
  const [name, setName] = useState('');
  const [section, setSection] = useState<string>('other');
  const [touched, setTouched] = useState(false);
  const [unit, setUnit] = useState<string | null>('piece');

  const guess = catalog && name.trim() ? suggestAisle(catalog.index, name) : null;
  useEffect(() => {
    if (initialName === null) return;
    setName(initialName);
    setTouched(false);
    setUnit('piece');
  }, [initialName]);
  useEffect(() => {
    if (!touched) setSection(guess ?? 'other');
  }, [guess, touched]);

  const existing = catalog && name.trim() ? catalog.index.find(name) : undefined;
  const sections = [...DEFAULT_AISLE_ORDER.filter((a) => a !== 'other'),
    ...(catalog?.stores.map((s) => storeKey(s.id)) ?? []), 'other'];

  return (
    <Sheet open={initialName !== null} onClose={onClose} label={t('groceries.newItemTitle')}>
      <h2 className="title2" style={{ marginBottom: 'var(--s-4)' }}>{t('groceries.newItemTitle')}</h2>
      <Field label={t('groceries.name')}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      {existing && (
        <div className="notice notice--info stack" style={{ marginTop: 'var(--s-3)' }}>
          <span>{t('groceries.alreadyInCatalog', { name: productName(existing, locale) })}</span>
          <Button small variant="secondary" onClick={() => onUseExisting(existing)}>
            {t('groceries.useExisting', { name: productName(existing, locale) })}
          </Button>
        </div>
      )}

      <h3 className="section-label">{t('groceries.section')}</h3>
      <div className="chips">
        {sections.map((key) => (
          <Chip key={key} pressed={key === section} onClick={() => { setTouched(true); setSection(key); }}>{title(key)}</Chip>
        ))}
      </div>
      {guess && section === guess && <p className="muted small">{title(guess)} · {t('groceries.suggestedAisle')}</p>}

      <h3 className="section-label">{t('groceries.usualUnit')}</h3>
      <div className="chips">
        {CREATE_UNITS.map((u) => (
          <Chip key={u} pressed={u === unit} onClick={() => setUnit(u === unit ? null : u)}>{t(`groceries.units.${u as 'piece'}`)}</Chip>
        ))}
      </div>

      <p className="muted small" style={{ marginTop: 'var(--s-4)' }}>{t('groceries.createHelp')}</p>
      <Button block disabled={!name.trim() || !!existing} style={{ marginTop: 'var(--s-3)' }}
        onClick={() => onCreate({ name: name.trim(), section, unit })}>
        {t('groceries.createAndAdd')}
      </Button>
      <Button block variant="text" onClick={onClose}>{t('app.cancel')}</Button>
      {isAdmin && (
        <Button block variant="text" small onClick={() => navigate(`/us/catalog?q=${encodeURIComponent(name.trim())}`)}>
          <Icon name="pencil" size={16} /> {t('groceries.editCatalog')}
        </Button>
      )}
    </Sheet>
  );
}

type UsualsFilter = 'due' | 'all' | string;

/** "Your usuals": what the household buys, with + / module to add it. */
export function UsualsSheet({
  open,
  onClose,
  householdId,
  catalog,
  onListByProduct,
  onAdd,
  onChange,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  householdId: string;
  catalog: GroceryCatalog | null;
  /** Unchecked list rows by product. */
  onListByProduct: Map<string, ListItem>;
  onAdd: (p: Product, amount: Amount | null) => void;
  onChange: (item: ListItem, a: Amount) => void;
  onRemove: (item: ListItem) => void;
}) {
  const { t, tn, locale } = useI18n();
  const title = useSectionTitle(catalog);
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<UsualsFilter | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setFilter(null);
    const since = new Date(Date.now() - 365 * 86_400_000).toISOString();
    void (async () => {
      const rows = must(await supabase.from('grocery_items').select('product_id, quantity, unit, cleared_at')
        .eq('household_id', householdId).not('checked_at', 'is', null).not('product_id', 'is', null)
        .gte('cleared_at', since)) as { product_id: string; quantity: number | null; unit: string | null; cleared_at: string }[];
      setPurchases(rows.map((r) => ({ product_id: r.product_id, quantity: r.quantity, unit: r.unit, bought_at: r.cleared_at })));
    })().catch(() => setPurchases([]));
  }, [open, householdId]);

  const all = useMemo(() => {
    if (!purchases || !catalog) return [];
    return usuals(purchases)
      .map((u) => ({ usual: u, product: catalog.index.get(u.product_id) }))
      .filter((x): x is { usual: Usual; product: Product } => !!x.product);
  }, [purchases, catalog]);
  const due = useMemo(() => {
    const ids = new Set(dueAgain(all.map((x) => x.usual), new Set(onListByProduct.keys())).map((u) => u.product_id));
    return all.filter((x) => ids.has(x.product.id))
      .sort((a, b) => (b.usual.days_since - (b.usual.gap_days ?? 0)) - (a.usual.days_since - (a.usual.gap_days ?? 0)));
    // Due is worked out when the sheet opens: adding one doesn't make it jump away.
  }, [all]); // eslint-disable-line react-hooks/exhaustive-deps
  const sectionKeys = useMemo(() => {
    const keys = new Set(all.map((x) => sectionKeyOf(catalog, x.product)));
    return (catalog?.sectionOrder ?? DEFAULT_AISLE_ORDER).filter((k) => keys.has(k));
  }, [all, catalog]);

  const current: UsualsFilter = filter ?? (due.length ? 'due' : 'all');
  const q = productKey(query);
  const shown = (current === 'due' ? due : current === 'all' ? all : all.filter((x) => sectionKeyOf(catalog, x.product) === current))
    .filter((x) => !q || productKey(`${x.product.name_fr} ${x.product.name_en ?? ''} ${x.product.aliases.join(' ')}`).includes(q));

  return (
    <Sheet open={open} onClose={onClose} label={t('groceries.usuals')} className="sheet--fixed">
      <div className="row row--between" style={{ marginBottom: 'var(--s-3)' }}>
        <h2 className="title2">{t('groceries.usuals')}</h2>
        <Button small variant="text" onClick={onClose}>{t('app.done')}</Button>
      </div>
      {purchases && all.length === 0 ? (
        <p className="muted center" style={{ margin: 'var(--s-8) 0' }}>{t('groceries.usualsEmpty')}</p>
      ) : (
        <>
          <input className="input" type="search" value={query} placeholder={t('groceries.usualsSearch')}
            aria-label={t('groceries.usualsSearch')} onChange={(e) => setQuery(e.target.value)} />
          <div className="chips chips--scroll" style={{ margin: 'var(--s-3) 0' }}>
            {due.length > 0 && (
              <Chip pressed={current === 'due'} onClick={() => setFilter('due')}>{t('groceries.dueAgain', { n: due.length })}</Chip>
            )}
            <Chip pressed={current === 'all'} onClick={() => setFilter('all')}>{t('groceries.all')}</Chip>
            {sectionKeys.map((k) => <Chip key={k} pressed={current === k} onClick={() => setFilter(k)}>{title(k)}</Chip>)}
          </div>
          {shown.length === 0 ? <p className="muted small center">{t('groceries.usualsNoMatch')}</p> : (
            <div className="list">
              {shown.map(({ usual, product }) => {
                const name = productName(product, locale);
                const row = onListByProduct.get(product.id);
                return (
                  <div key={product.id} className="list-row grocery-pick">
                    <span className="list-row__main">
                      <span className="list-row__title grocery-pick__name">{name}</span>
                      <span className="list-row__meta">
                        {current === 'due' ? (
                          <>
                            {usual.frequency && <span className="chip chip--tag">{t(`groceries.frequency.${usual.frequency}`)}</span>}{' '}
                            {usual.days_since === 0 ? t('groceries.lastBoughtToday') : tn('groceries.lastBought', usual.days_since)}
                          </>
                        ) : title(sectionKeyOf(catalog, product))}
                      </span>
                    </span>
                    <AmountControl name={name} amount={row ? { quantity: row.quantity, unit: row.unit } : null}
                      units={unitsFor(product)}
                      onAdd={() => onAdd(product, usual.quantity !== null || usual.unit ? { quantity: usual.quantity, unit: usual.unit } : null)}
                      onChange={(a) => row && onChange(row, a)} onRemove={() => row && onRemove(row)} />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
