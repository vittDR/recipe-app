import { parseIngredientLine, type ParsedIngredient } from '@logic/ingredients.ts';
import { productName, type Product } from '@logic/products.ts';
import { useI18n } from '../i18n/index.tsx';
import type { GroceryCatalog } from '../lib/products.ts';
import { Icon } from './Icon.tsx';

/**
 * Type "2 citrons": suggestions from the household's items as you type, or
 * add it as a new item. Used by the groceries list and recipe ingredients.
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
  const exact = parsed.name ? catalog?.index.find(parsed.name) : undefined;
  const suggestions = parsed.name && catalog
    ? catalog.index.search(parsed.name, 5, (p) => catalog.prefs.get(p.id)?.add_count ?? 0)
    : [];
  if (exact && !suggestions.some((p) => p.id === exact.id)) suggestions.unshift(exact);
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

      {parsed.name && (
        <div className="list" role="listbox" aria-label={t('groceries.suggestions')} style={{ marginTop: 'var(--s-2)' }}>
          {suggestions.map((p) => (
            <button key={p.id} type="button" role="option" aria-selected={p.id === exact?.id} className="list-row"
              onClick={() => onPick(p, parsed)}>
              <span className="list-row__main">
                <span className="list-row__title">{productName(p, locale)}</span>
                {metaOf && <span className="list-row__meta">{metaOf(p)}</span>}
              </span>
              <Icon name="plus" size={20} />
            </button>
          ))}
          {!exact && (
            <button type="button" role="option" aria-selected={false} className="list-row" onClick={() => onPick(null, parsed)}>
              <span className="list-row__main">
                <span className="list-row__title">{t('groceries.create', { name: parsed.name })}</span>
                <span className="list-row__meta">{t('groceries.newItem')}</span>
              </span>
              <Icon name="plus" size={20} />
            </button>
          )}
        </div>
      )}
    </>
  );
}

/** "2 citrons" back from a parsed line, for editing. */
export function lineOf(p: Pick<ParsedIngredient, 'quantity' | 'unit'>, name: string): string {
  const q = p.quantity === null ? '' : String(Number.isInteger(p.quantity) ? p.quantity : Number(p.quantity.toFixed(2)));
  const u = p.unit && p.unit !== 'piece' ? ` ${p.unit}` : '';
  return [q && `${q}${u}`, name].filter(Boolean).join(' ');
}
