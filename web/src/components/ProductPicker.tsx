import { parseIngredientLine, type ParsedIngredient } from '@logic/ingredients.ts';
import { productName, type Product } from '@logic/products.ts';
import { useI18n } from '../i18n/index.tsx';
import { searchProducts, type GroceryCatalog } from '../lib/products.ts';
import { Icon } from './Icon.tsx';
import { CreateRow, ListRow } from './ui.tsx';

/**
 * Type "2 citrons": suggestions from the household's items as you type, or
 * add it as a new item. Used by the recipe ingredient editor.
 * `onPick(null, …)` means a new item named `parsed.name`.
 */
export function ProductPicker({
  catalog,
  value,
  onChange,
  onPick,
  placeholder,
  label,
  metaOf,
  autoFocus,
}: {
  catalog: GroceryCatalog | null;
  value: string;
  onChange: (v: string) => void;
  onPick: (product: Product | null, parsed: ParsedIngredient) => void;
  placeholder: string;
  label: string;
  /** Second line under a suggestion (its aisle, "on the list"…). */
  metaOf?: (p: Product) => string;
  autoFocus?: boolean;
}) {
  const { t, locale } = useI18n();
  const parsed = parseIngredientLine(value);
  const { results, exact } = searchProducts(catalog, parsed.name, { limit: 5 });
  const submit = () => {
    if (parsed.name) onPick(exact ?? null, parsed);
  };

  return (
    <>
      {/* Not a <form>: it also sits inside the recipe form. */}
      <div className="row">
        <input className="input" value={value} placeholder={placeholder} aria-label={label} autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)} enterKeyHint="done" autoComplete="off"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} />
        <button type="button" className="icon-btn icon-btn--filled" aria-label={label} disabled={!parsed.name} onClick={submit}>
          <Icon name="plus" />
        </button>
      </div>

      {parsed.name && (results.length > 0 || !exact) && (
        <div className="list mt-2" role="listbox" aria-label={t('groceries.suggestions')}>
          {results.map((p) => (
            <ListRow key={p.id} role="option" selected={p.id === exact?.id} title={productName(p, locale)}
              meta={metaOf?.(p)} trailing={<Icon name="plus" size={20} />} onClick={() => onPick(p, parsed)} />
          ))}
          {!exact && (
            <CreateRow role="option" title={t('groceries.create', { name: parsed.name })} meta={t('groceries.newItem')} onClick={() => onPick(null, parsed)} />
          )}
        </div>
      )}
    </>
  );
}
