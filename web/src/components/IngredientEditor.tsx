import { useState } from 'react';
import { parseIngredientLine, type Catalog } from '@logic/ingredients.ts';
import { matchProduct, productName, type Product } from '@logic/products.ts';
import { useI18n } from '../i18n/index.tsx';
import type { GroceryCatalog } from '../lib/products.ts';
import { formatQuantity } from './AddToListSheet.tsx';
import { ProductPicker } from './ProductPicker.tsx';
import { Button, Chip, Field, ListRow, Section, Sheet, SheetHeader } from './ui.tsx';

/** A recipe line being reviewed or typed, with the item it is. */
export interface DraftIngredient {
  key: string;
  /** The line as written: "200 g framboises fraîches". */
  text: string;
  original_text?: string | null;
  guessed: boolean;
  /** Null with match 'new': a new household item named after the line. */
  product_id: string | null;
  /**
   * exact: matched automatically. close: matched, worth a look (kept unless
   * changed). chosen: by hand. new: a new item, maybe with a guess to confirm.
   */
  match: 'exact' | 'close' | 'chosen' | 'new';
  /** A weak guess for a new item: "C'est X ?" */
  suggestion_id?: string | null;
}

let nextKey = 0;
const newKey = () => `ing-${++nextKey}`;

/** Matches a line to the catalogue: the parser's catalogue ingredient, then any item. */
export function draftFromLine(
  text: string,
  catalog: GroceryCatalog,
  ingredients: Catalog | null,
  extra: Partial<DraftIngredient> = {},
): DraftIngredient {
  const parsed = parseIngredientLine(text);
  const ingredient = ingredients?.normalise(parsed).catalog?.name;
  const m = parsed.name ? matchProduct(catalog.index, parsed.name, ingredient) : null;
  const base = { key: newKey(), text: parsed.raw_text, guessed: false };
  if (m?.confidence === 'weak') return { ...base, product_id: null, match: 'new', suggestion_id: m.product.id, ...extra };
  return { ...base, product_id: m?.product.id ?? null, match: m?.confidence ?? 'new', ...extra };
}

/** Recipe ingredients, added the way you add to the groceries list. */
export function IngredientEditor({
  items,
  onChange,
  catalog,
}: {
  items: DraftIngredient[];
  onChange: (items: DraftIngredient[]) => void;
  catalog: GroceryCatalog | null;
}) {
  const { t, tn, locale } = useI18n();
  const [draft, setDraft] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = items.find((i) => i.key === openKey) ?? null;
  const toCheck = items.filter((i) => i.match === 'close' || i.suggestion_id).length;

  const productOf = (i: DraftIngredient) => (i.product_id ? catalog?.index.get(i.product_id) : undefined);
  const titleOf = (i: DraftIngredient) => {
    const p = productOf(i);
    return p ? productName(p, locale) : productName({ name_fr: parseIngredientLine(i.text).name || i.text, name_en: null });
  };
  const amountOf = (i: DraftIngredient) => {
    const p = parseIngredientLine(i.text);
    return formatQuantity(p.quantity, p.unit);
  };
  const suggestionName = (i: DraftIngredient) => {
    const p = i.suggestion_id ? catalog?.index.get(i.suggestion_id) : undefined;
    return p ? productName(p, locale) : null;
  };
  const metaOf = (i: DraftIngredient) =>
    i.match === 'close' ? t('ingredients.check')
      : i.match === 'new' ? (suggestionName(i) ? t('ingredients.maybe', { name: suggestionName(i)! }) : t('ingredients.newItem'))
        : i.guessed ? t('recipe.guessed') : '';
  const flagged = (i: DraftIngredient) => i.match === 'close' || !!i.suggestion_id;

  const update = (key: string, patch: Partial<DraftIngredient>) =>
    onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const add = (product: Product | null, text: string) => {
    setDraft('');
    onChange([...items, { key: newKey(), text, guessed: false, product_id: product?.id ?? null, match: product ? 'chosen' : 'new' }]);
  };

  return (
    <div className="stack">
      {toCheck > 0 && <p className="notice">{tn('ingredients.toCheck', toCheck)}</p>}
      {items.length > 0 ? (
        <div className="list">
          {items.map((i) => (
            <ListRow key={i.key} onClick={() => setOpenKey(i.key)} title={titleOf(i)}
              meta={(metaOf(i) || i.match !== 'chosen') && (
                <span className="stack-lines">
                  {metaOf(i) && <span className={flagged(i) ? 'text-warning' : undefined}>{metaOf(i)}</span>}
                  {i.match !== 'chosen' && <span>{i.text}</span>}
                </span>
              )}
              trailing={<span className="muted small">{amountOf(i)}</span>} />
          ))}
        </div>
      ) : (
        <p className="muted small m-0">{t('ingredients.empty')}</p>
      )}

      <ProductPicker catalog={catalog} value={draft} onChange={setDraft}
        onPick={(p, parsed) => add(p, parsed.raw_text)}
        placeholder={t('ingredients.addPlaceholder')} label={t('ingredients.add')} />

      <Sheet open={!!open} onClose={() => setOpenKey(null)} label={open ? titleOf(open) : ''}>
        {open && (
          <IngredientSheet key={open.key} item={open} title={titleOf(open)} catalog={catalog}
            suggestion={suggestionName(open)}
            onUpdate={(patch) => update(open.key, patch)}
            onRemove={() => { onChange(items.filter((i) => i.key !== open.key)); setOpenKey(null); }}
            onClose={() => setOpenKey(null)} />
        )}
      </Sheet>
    </div>
  );
}

function IngredientSheet({
  item,
  title,
  catalog,
  suggestion,
  onUpdate,
  onRemove,
  onClose,
}: {
  item: DraftIngredient;
  title: string;
  suggestion: string | null;
  catalog: GroceryCatalog | null;
  onUpdate: (patch: Partial<DraftIngredient>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [changing, setChanging] = useState(false);

  return (
    <>
      <SheetHeader title={title} subtitle={(
        <>
          {item.match === 'new' ? t('ingredients.newItem') : item.match === 'close' ? t('ingredients.check') : ''}
          {item.match === 'new' && suggestion ? ` · ${t('ingredients.maybe', { name: suggestion })}` : ''}
        </>
      )} />

      {item.match === 'close' && (
        <Button block variant="secondary" onClick={() => { onUpdate({ match: 'chosen' }); onClose(); }}>
          {t('ingredients.confirm', { name: title })}
        </Button>
      )}
      {item.match === 'new' && suggestion && (
        <Button block variant="secondary" onClick={() => {
          onUpdate({ product_id: item.suggestion_id!, match: 'chosen', suggestion_id: null }); onClose();
        }}>
          {t('ingredients.confirm', { name: suggestion })}
        </Button>
      )}

      <Section label={t('ingredients.item')}>
        {changing ? (
          <ProductPicker catalog={catalog} value={search} onChange={setSearch} autoFocus
            placeholder={t('ingredients.searchItem')} label={t('ingredients.searchItem')}
            onPick={(p) => { onUpdate({ product_id: p?.id ?? null, match: p ? 'chosen' : 'new', suggestion_id: null }); onClose(); }} />
        ) : (
          <div className="chips">
            <Chip onClick={() => { setSearch(parseIngredientLine(item.text).name); setChanging(true); }}>{t('ingredients.change')}</Chip>
            {item.match !== 'new' && (
              <Chip onClick={() => { onUpdate({ product_id: null, match: 'new', suggestion_id: null }); onClose(); }}>{t('ingredients.makeNew')}</Chip>
            )}
          </div>
        )}
      </Section>

      <div className="mt-4">
        <Field label={t('ingredients.line')}>
          <input className="input" defaultValue={item.text} enterKeyHint="done"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
            onBlur={(e) => e.target.value.trim() && onUpdate({ text: e.target.value.trim() })} />
        </Field>
      </div>
      <div className="chips mt-3">
        <Chip pressed={item.guessed} onClick={() => onUpdate({ guessed: !item.guessed })}>{t('ingredients.guessed')}</Chip>
      </div>

      <Button block variant="danger" className="mt-6" onClick={onRemove}>
        {t('ingredients.remove')}
      </Button>
    </>
  );
}
