import { useState } from 'react';
import { parseIngredientLine, type Catalog } from '@logic/ingredients.ts';
import { matchProduct, productName, unitsFor, type Product } from '@logic/products.ts';
import { useI18n } from '../i18n/index.tsx';
import { searchProducts, type GroceryCatalog } from '../lib/products.ts';
import { AmountControl, Highlight, type Amount } from './GroceryControls.tsx';
import { ProductPicker } from './ProductPicker.tsx';
import { Button, Chip, CreateRow, Field, ListRow, SearchField, Section, Sheet, SheetHeader } from './ui.tsx';

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

/** Units a recipe line can be written in and read back from (parseIngredientLine). */
export const RECIPE_LINE_UNITS = ['piece', 'g', 'kg', 'ml', 'cl', 'l', 'tbsp', 'tsp', 'clove', 'pinch', 'bunch', 'slice', 'can'] as const;

/** The line again from an amount and a name: "200 g framboises"; whole items as a bare count. */
export function lineText(quantity: number | null, unit: string | null, name: string): string {
  if (quantity === null) return name;
  return `${quantity}${unit && unit !== 'piece' ? ` ${unit}` : ''} ${name}`;
}

/**
 * Recipe ingredients, added exactly like on the groceries list: search the
 * catalogue, + adds the item and becomes its amount (quantity, unit, remove),
 * and "Create" adds something the catalogue doesn't have.
 */
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
  const amountOf = (i: DraftIngredient): Amount => {
    const p = parseIngredientLine(i.text);
    return { quantity: p.quantity, unit: p.quantity === null ? null : p.unit };
  };
  const suggestionName = (i: DraftIngredient) => {
    const p = i.suggestion_id ? catalog?.index.get(i.suggestion_id) : undefined;
    return p ? productName(p, locale) : null;
  };
  const metaOf = (i: DraftIngredient) =>
    i.match === 'close' ? t('ingredients.check')
      : i.match === 'new' ? (suggestionName(i) ? t('ingredients.maybe', { name: suggestionName(i)! }) : t('ingredients.newItem'))
        : i.guessed ? t('recipe.guessed') : '';

  const update = (key: string, patch: Partial<DraftIngredient>) =>
    onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const setAmount = (i: DraftIngredient, a: Amount) =>
    update(i.key, { text: lineText(a.quantity, a.unit, parseIngredientLine(i.text).name || titleOf(i)), guessed: false });
  const remove = (key: string) => onChange(items.filter((i) => i.key !== key));

  const parsed = parseIngredientLine(draft);
  const { results, exact } = searchProducts(catalog, parsed.name, { limit: 6 });
  const add = (product: Product | null) => {
    const name = product ? productName(product, locale).toLowerCase() : parsed.name;
    setDraft('');
    onChange([...items, {
      key: newKey(), text: lineText(parsed.quantity, parsed.unit, name), guessed: false,
      product_id: product?.id ?? null, match: product ? 'chosen' : 'new',
    }]);
  };
  const lineOf = (p: Product) => items.find((i) => i.product_id === p.id);

  return (
    <div className="stack">
      {toCheck > 0 && <p className="t-callout text-sage m-0">{tn('ingredients.checkShort', toCheck)}</p>}
      {items.length > 0 && (
        <div className="list">
          {items.map((i) => (
            <ListRow key={i.key} className="grocery-pick"
              title={<button type="button" className="list-row__tap" onClick={() => setOpenKey(i.key)}>{titleOf(i)}</button>}
              meta={metaOf(i) && <span className={i.match === 'close' || i.suggestion_id ? 'text-sage' : undefined}>{metaOf(i)}</span>}
              trailing={(
                <AmountControl name={titleOf(i)} amount={amountOf(i)} units={productOf(i) ? unitsFor(productOf(i)!) : []}
                  allUnits={RECIPE_LINE_UNITS} onAdd={() => undefined} onChange={(a) => setAmount(i, a)} onRemove={() => remove(i.key)} />
              )} />
          ))}
        </div>
      )}

      <SearchField value={draft} onChange={setDraft} placeholder={t('ingredients.add')} label={t('ingredients.add')}
        onEnter={() => parsed.name && add(exact ?? results[0] ?? null)} />
      {parsed.name && (
        <div className="list" role="list" aria-label={t('groceries.suggestions')}>
          {results.map((p) => {
            const name = productName(p, locale);
            const line = lineOf(p);
            return (
              <ListRow key={p.id} role="listitem" className="grocery-pick"
                title={<span className="grocery-pick__name"><Highlight text={name} query={parsed.name} /></span>}
                trailing={(
                  <AmountControl name={name} amount={line ? amountOf(line) : null} units={unitsFor(p)} allUnits={RECIPE_LINE_UNITS}
                    onAdd={() => add(p)} onChange={(a) => line && setAmount(line, a)} onRemove={() => line && remove(line.key)} />
                )} />
            );
          })}
          {!exact && (
            <CreateRow role="listitem" title={t('groceries.createRow', { name: parsed.name })} onClick={() => add(null)} />
          )}
        </div>
      )}

      <Sheet open={!!open} onClose={() => setOpenKey(null)} label={open ? titleOf(open) : ''}>
        {open && (
          <IngredientSheet key={open.key} item={open} title={titleOf(open)} catalog={catalog}
            suggestion={suggestionName(open)}
            onUpdate={(patch) => update(open.key, patch)}
            onRemove={() => { remove(open.key); setOpenKey(null); }}
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
