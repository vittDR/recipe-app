import { useMemo, useState } from 'react';
import { storeKey } from '@logic/groceries.ts';
import { isFrequent, productKey, productName, sectionOf, type Product } from '@logic/products.ts';
import { useI18n } from '../i18n/index.tsx';
import type { GroceryCatalog } from '../lib/products.ts';
import { supabase } from '../lib/supabase.ts';
import type { Aisle, GroceryRow } from '../lib/types.ts';
import { Icon } from './Icon.tsx';
import { Button, Chip, Sheet, toast } from './ui.tsx';

/** Section title: a store's name or the translated aisle. */
export function useSectionTitle(catalog: GroceryCatalog | null) {
  const { t } = useI18n();
  return (key: string) =>
    key.startsWith('store:')
      ? catalog?.stores.find((s) => storeKey(s.id) === key)?.name ?? ''
      : t(`groceries.aisles.${key as Aisle}`);
}

/** Tap on a list item: where it goes, whether it's a frequent, remove it. */
export function ItemSheet({
  item,
  catalog,
  onClose,
  onChanged,
}: {
  item: GroceryRow | null;
  catalog: GroceryCatalog | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t, locale } = useI18n();
  const title = useSectionTitle(catalog);
  const product = item?.product_id ? catalog?.index.get(item.product_id) : undefined;
  const pref = product ? catalog?.prefs.get(product.id) : undefined;
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
    onChanged();
    onClose();
  };

  const toggleFrequent = async () => {
    if (!product) return;
    await supabase.rpc('set_frequent', { p_product: product.id, p_on: !(pref && isFrequent(pref)) });
    onChanged();
  };

  const remove = async () => {
    if (!item) return;
    await supabase.from('grocery_items').delete().eq('id', item.id);
    onChanged();
    onClose();
  };

  return (
    <Sheet open={!!item} onClose={onClose} label={item?.name ?? ''}>
      {item && (
        <>
          <h2 className="title2" style={{ marginBottom: 'var(--s-1)' }}>
            {product ? productName(product, locale) : productName({ name_fr: item.name, name_en: null })}
          </h2>
          {product?.household_id && <p className="muted small" style={{ marginTop: 0 }}>{t('groceries.yourItem')}</p>}

          <h3 className="section-label">{t('groceries.section')}</h3>
          <div className="chips">
            {sections.map((key) => (
              <Chip key={key} pressed={key === current} onClick={() => void move(key)}>{title(key)}</Chip>
            ))}
          </div>

          {product && (
            <>
              <div style={{ height: 'var(--s-5)' }} />
              <div className="chips">
                <Chip pressed={!!pref && isFrequent(pref)} onClick={() => void toggleFrequent()}>
                  <Icon name="star" size={16} /> {t('groceries.inFrequent')}
                </Chip>
              </div>
            </>
          )}

          <Button block variant="text" style={{ color: 'var(--c-danger)', marginTop: 'var(--s-6)' }} onClick={() => void remove()}>
            {t('groceries.removeItem')}
          </Button>
        </>
      )}
    </Sheet>
  );
}

/** "Frequently bought": browse by section and add with one tap. */
export function FrequentSheet({
  open,
  onClose,
  catalog,
  onList,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  catalog: GroceryCatalog | null;
  /** Product ids with an unchecked item on the list. */
  onList: Set<string>;
  onAdd: (product: Product) => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const title = useSectionTitle(catalog);
  const [query, setQuery] = useState('');

  const sections = useMemo(() => {
    if (!catalog) return [];
    const q = productKey(query);
    const groups = new Map<string, Product[]>();
    for (const p of catalog.products) {
      const pref = catalog.prefs.get(p.id);
      if (!pref || !isFrequent(pref)) continue;
      if (q && !productKey(`${p.name_fr} ${p.name_en ?? ''} ${p.aliases.join(' ')}`).includes(q)) continue;
      const s = sectionOf(p, pref);
      const key = s.store_id && catalog.sectionOrder.includes(storeKey(s.store_id)) ? storeKey(s.store_id) : s.aisle;
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }
    const rank = (k: string) => {
      const i = catalog.sectionOrder.indexOf(k);
      return i === -1 ? catalog.sectionOrder.length : i;
    };
    return [...groups.entries()]
      .sort(([a], [b]) => rank(a) - rank(b))
      .map(([key, items]) => ({
        key,
        items: items.sort((a, b) => productName(a, locale).localeCompare(productName(b, locale), locale)),
      }));
  }, [catalog, query, locale]);

  return (
    <Sheet open={open} onClose={onClose} label={t('groceries.frequent')}>
      <h2 className="title2" style={{ marginBottom: 'var(--s-3)' }}>{t('groceries.frequent')}</h2>
      <input className="input" type="search" value={query} placeholder={t('groceries.frequentSearch')}
        aria-label={t('groceries.frequentSearch')} onChange={(e) => setQuery(e.target.value)} />
      {sections.length === 0 && !query && (
        <p className="muted small" style={{ marginTop: 'var(--s-4)' }}>{t('groceries.frequentEmpty')}</p>
      )}
      {sections.map((section) => (
        <section key={section.key}>
          <h3 className="section-label">{title(section.key)}</h3>
          <div className="list">
            {section.items.map((p) => {
              const listed = onList.has(p.id);
              const name = productName(p, locale);
              return (
                <button key={p.id} type="button" className="list-row" disabled={listed}
                  aria-label={listed ? `${name}, ${t('groceries.onList')}` : `${t('groceries.add')} ${name}`}
                  onClick={() => void onAdd(p).then(() => toast(t('groceries.added', { name })))}>
                  <span className="list-row__main">
                    <span className={`list-row__title${listed ? ' muted' : ''}`}>{name}</span>
                  </span>
                  {listed ? <span className="muted small">{t('groceries.onList')}</span> : <Icon name="plus" size={20} />}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </Sheet>
  );
}
