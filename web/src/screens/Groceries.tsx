import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { groupGroceries, splitCart, type GroupMode } from '@logic/groceries.ts';
import { parseIngredientLine } from '@logic/ingredients.ts';
import { applyQueue, type ListOp } from '@logic/listsync.ts';
import { defaultAmount, ProductIndex, productName, sectionOf, unitsFor, type Product } from '@logic/products.ts';
import { AmountControl, AmountSheet, Highlight, SwipeRow, SyncIcon, type Amount } from '../components/GroceryControls.tsx';
import { CreateItemSheet, ItemSheet, sectionKeyOf, UsualsSheet, useSectionTitle, type ListItem } from '../components/GrocerySheets.tsx';
import { Icon } from '../components/Icon.tsx';
import { Avatar, Button, Checkbox, dismissToast, Screen, Segmented, Spinner, toast } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import { useLive } from '../lib/hooks.ts';
import { listQueue, useListQueue } from '../lib/listQueue.ts';
import { useGroceryCatalog } from '../lib/products.ts';
import { useSession } from '../lib/session.tsx';
import { must, supabase } from '../lib/supabase.ts';
import type { Aisle, GroceryRow } from '../lib/types.ts';
import { useAmount } from '../lib/units.ts';

const MODE_KEY = 'dineamite.groceryMode';
const SEEN_KEY = 'dineamite.groceriesSeen:';
const PRESENCE_MS = 60_000;
const RESULTS = 8;

interface ListData {
  items: GroceryRow[];
  recipes: Map<string, string>;
  /** When this load started: changes saved after it are still shown from the queue. */
  startedAt: number;
}

const readSeen = (hid: string): number | null => {
  try {
    const v = localStorage.getItem(SEEN_KEY + hid);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
};
const writeSeen = (hid: string) => {
  try {
    localStorage.setItem(SEEN_KEY + hid, String(Date.now()));
  } catch {
    // storage unavailable: no dots next time
  }
};

/**
 * While the tab is on screen, tell the server, so "added to the list"
 * pushes skip this person; remember when they last saw the list, for the
 * dots on items others added since.
 */
function usePresence(hid: string, userId: string) {
  const [seenBefore] = useState(() => readSeen(hid) ?? Date.now());
  useEffect(() => {
    let timer: number | undefined;
    const here = () => {
      void supabase.from('grocery_presence').upsert({ user_id: userId, seen_at: new Date().toISOString() });
      timer = window.setTimeout(here, PRESENCE_MS);
    };
    const away = () => {
      window.clearTimeout(timer);
      writeSeen(hid);
      void supabase.from('grocery_presence').delete().eq('user_id', userId);
    };
    const onVisibility = () => (document.visibilityState === 'visible' ? here() : away());
    here();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      away();
    };
  }, [hid, userId]);
  return seenBefore;
}

export function GroceriesScreen() {
  const { t, tn, locale } = useI18n();
  const { userId, household, memberName, memberColor, members } = useSession();
  const { amount } = useAmount();
  const hid = household!.id;
  const isAdmin = household!.owner_id === userId;
  const queue = listQueue(hid);
  const sync = useListQueue(hid);
  const seenBefore = usePresence(hid, userId!);

  const [mode, setModeState] = useState<GroupMode>(() => {
    try {
      return (localStorage.getItem(MODE_KEY) as GroupMode) || 'aisle';
    } catch {
      return 'aisle';
    }
  });
  const setMode = (m: GroupMode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      // storage unavailable
    }
  };
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [usualsOpen, setUsualsOpen] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [amountId, setAmountId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: catalog, reload: reloadCatalog } = useGroceryCatalog(hid);
  const sectionTitleOf = useSectionTitle(catalog);
  const { data, loading, reload } = useLive<ListData>(
    `groceries:${hid}`,
    async () => {
      const startedAt = Date.now();
      const rows = must(await supabase.from('grocery_items').select('*').eq('household_id', hid).is('cleared_at', null)) as GroceryRow[];
      const recipeIds = [...new Set(rows.map((r) => r.recipe_id).filter(Boolean))] as string[];
      const recipes = recipeIds.length
        ? (must(await supabase.from('recipes').select('id, title').in('id', recipeIds)) as { id: string; title: string }[])
        : [];
      return { items: rows, recipes: new Map(recipes.map((r) => [r.id, r.title])), startedAt };
    },
    // Deletes can't be filtered by household: any delete reloads.
    [{ table: 'grocery_items', filter: `household_id=eq.${hid}` }, { table: 'grocery_items', event: 'DELETE' }],
  );

  // Each save reloads the list (realtime does too, a little later).
  const saved = sync.recent.length ? sync.recent[sync.recent.length - 1].at : 0;
  useEffect(() => {
    if (!saved) return;
    void reload();
    if (sync.recent.some((r) => r.op.kind === 'product' && r.at === saved)) void reloadCatalog();
  }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  // Not saved after the retries: say so once, with a way to try again.
  const status = sync.status;
  useEffect(() => {
    if (status === 'error') {
      toast(t('groceries.saveFailed'), { action: { label: t('app.retry'), onClick: () => queue.retry() }, duration: 8000 });
    } else {
      dismissToast(t('groceries.saveFailed'));
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Items created here but not in the catalogue yet, so they show up in search.
  const ops: ListOp[] = useMemo(() => [
    ...sync.recent.filter((r) => !data || r.at > data.startedAt).map((r) => r.op),
    ...sync.ops,
  ], [sync, data]);
  const index = useMemo(() => {
    if (!catalog) return null;
    const extra: Product[] = ops.flatMap((op) => op.kind === 'product' && !catalog.index.get(op.id)
      ? [{ id: op.id, household_id: hid, name_fr: op.name, name_en: null, aliases: [], ingredient: null, default_aisle: op.aisle, default_unit: op.unit }]
      : []);
    return extra.length ? new ProductIndex([...extra, ...catalog.products]) : catalog.index;
  }, [catalog, ops, hid]);
  const productOf = useCallback((id: string | null) => (id ? index?.get(id) : undefined), [index]);

  const { rows, pending } = useMemo(() => applyQueue(data?.items ?? [], ops, (op) => ({
    id: op.id,
    household_id: hid,
    product_id: op.product_id,
    name: op.name,
    quantity: op.quantity,
    unit: op.unit,
    aisle: op.aisle,
    store_id: op.store_id,
    recipe_id: null,
    added_by: op.added_by,
    checked_by: null,
    checked_at: null,
    cleared_at: null,
    sort_key: Date.parse(op.at) / 1000,
    created_at: op.at,
  })), [data, ops, hid]);

  const items: ListItem[] = rows.map((r) => {
    const p = productOf(r.product_id);
    return { ...r, display: p ? productName(p, locale) : productName({ name_fr: r.name, name_en: null }) };
  });
  const groupable = items.map((i) => ({ ...i, name: i.display }));
  const { toBuy, cart } = splitCart(groupable);
  const onListByProduct = new Map<string, ListItem>();
  for (const i of [...toBuy].sort((a, b) => a.sort_key - b.sort_key)) if (i.product_id) onListByProduct.set(i.product_id, i);
  const sections = groupGroceries(toBuy, mode, catalog?.sectionOrder.length ? catalog.sectionOrder : undefined);
  const total = toBuy.length + cart.length;

  // --- changes -------------------------------------------------------------

  const add = (p: Product, amt: Amount | null) => {
    const a = amt ?? defaultAmount(p);
    const s = sectionOf(p, catalog?.prefs.get(p.id));
    navigator.vibrate?.(8);
    queue.push({
      kind: 'add', id: crypto.randomUUID(), product_id: p.id, name: p.name_fr, quantity: a.quantity, unit: a.unit,
      aisle: s.aisle, store_id: s.store_id, added_by: userId!, at: new Date().toISOString(),
    });
  };
  const change = (item: ListItem, a: Amount) => queue.push({ kind: 'patch', id: item.id, fields: { quantity: a.quantity, unit: a.unit } });
  const toggle = (item: ListItem, checked: boolean) => {
    navigator.vibrate?.(8);
    queue.push({
      kind: 'patch', id: item.id,
      fields: { checked_at: checked ? new Date().toISOString() : null, checked_by: checked ? userId : null },
    });
  };
  const remove = (item: ListItem) => {
    queue.push({ kind: 'remove', id: item.id });
    toast(t('groceries.removed', { name: item.display }), {
      action: {
        label: t('groceries.undo'),
        onClick: () => {
          if (queue.cancel((op) => op.kind === 'remove' && op.id === item.id)) return;
          queue.push({
            kind: 'add', id: item.id, product_id: item.product_id, name: item.name, quantity: item.quantity, unit: item.unit,
            aisle: item.aisle, store_id: item.store_id, added_by: item.added_by ?? userId!, at: item.created_at,
          });
        },
      },
    });
  };
  const clearCart = () => {
    const ids = cart.map((i) => i.id);
    const now = new Date().toISOString();
    for (const id of ids) queue.push({ kind: 'patch', id, fields: { cleared_at: now } });
    toast(tn('groceries.cleared', ids.length), {
      action: { label: t('groceries.undo'), onClick: () => ids.forEach((id) => queue.push({ kind: 'patch', id, fields: { cleared_at: null } })) },
    });
  };
  const create = ({ name, section, unit }: { name: string; section: string; unit: string | null }) => {
    const store = section.startsWith('store:') ? section.slice('store:'.length) : null;
    const aisle: Aisle = store ? 'other' : (section as Aisle);
    const id = crypto.randomUUID();
    queue.push({ kind: 'product', id, name, aisle, unit, store_id: store });
    queue.push({
      kind: 'add', id: crypto.randomUUID(), product_id: id, name, quantity: null, unit,
      aisle, store_id: store, added_by: userId!, at: new Date().toISOString(),
    });
    setCreating(null);
    setQuery(name);
  };

  // --- search --------------------------------------------------------------

  const parsed = parseIngredientLine(query);
  // The parser lowercases; without a quantity the name is just what was typed.
  const typedName = parsed.quantity === null ? query.trim() : parsed.name;
  // "3 citronnelle": 3 in the item's own unit (a bare number reads as pieces).
  const typedFor = (p: Product): Amount | null => parsed.quantity === null ? null
    : { quantity: parsed.quantity, unit: parsed.unit === 'piece' ? defaultAmount(p).unit : parsed.unit };
  const results = parsed.name && index
    ? index.search(parsed.name, RESULTS, (p) => catalog?.prefs.get(p.id)?.add_count ?? 0)
    : [];
  const exact = parsed.name ? index?.find(parsed.name) : undefined;
  if (exact && !results.some((p) => p.id === exact.id)) results.unshift(exact);
  const submit = () => {
    const first = exact ?? results[0];
    if (first && !onListByProduct.has(first.id)) add(first, typedFor(first));
    else if (!first && parsed.name) setCreating(typedName);
  };
  const closeSearch = () => {
    setSearching(false);
    setQuery('');
    searchRef.current?.blur();
  };

  const openItem = items.find((i) => i.id === openId) ?? null;
  const amountItem = items.find((i) => i.id === amountId) ?? null;
  const amountProduct = productOf(amountItem?.product_id ?? null);
  const notSaved = (id: string) => status === 'error' && pending.has(id);
  const isNew = (i: GroceryRow) => !!i.added_by && i.added_by !== userId && Date.parse(i.created_at) > seenBefore;
  const showList = !(searching && parsed.name);

  return (
    <Screen>
      <div className="row row--between">
        <h1 className="screen__title">{t('groceries.title')}</h1>
        <SyncIcon status={status} onRetry={() => queue.retry()} />
      </div>

      <div className="row grocery-search">
        <input ref={searchRef} className="input" type="search" value={query} placeholder={t('groceries.addPlaceholder')}
          aria-label={t('groceries.add')} enterKeyHint="done" autoComplete="off"
          onFocus={() => setSearching(true)} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} />
        {searching ? (
          <Button small variant="text" onClick={closeSearch}>{t('groceries.closeSearch')}</Button>
        ) : (
          <button type="button" className="usuals-btn" aria-label={t('groceries.usualsOpen')} onClick={() => setUsualsOpen(true)}>
            <Icon name="history" />
          </button>
        )}
      </div>

      {searching && !parsed.name && <p className="muted small">{t('groceries.searchHint')}</p>}

      {searching && parsed.name && (
        <div className="grocery-results">
          {results.length === 0 ? (
            <p className="muted">{t('groceries.noMatch', { query: typedName })}</p>
          ) : (
            <div className="list" role="list" aria-label={t('groceries.suggestions')}>
              {results.map((p) => {
                const name = productName(p, locale);
                const row = onListByProduct.get(p.id);
                return (
                  <div key={p.id} role="listitem" className="list-row grocery-pick">
                    <span className="list-row__main">
                      <span className="list-row__title grocery-pick__name"><Highlight text={name} query={parsed.name} /></span>
                      <span className="list-row__meta">{sectionTitleOf(sectionKeyOf(catalog, p))}</span>
                    </span>
                    <AmountControl name={name} amount={row ? { quantity: row.quantity, unit: row.unit } : null} units={unitsFor(p)}
                      onAdd={() => add(p, typedFor(p))} onChange={(a) => row && change(row, a)} onRemove={() => row && remove(row)} />
                  </div>
                );
              })}
            </div>
          )}
          {!exact && (
            <button type="button" className="create-row" onClick={() => setCreating(typedName)}>
              <Icon name="squarePlus" />
              <span className="list-row__main">
                <span className="list-row__title">{t('groceries.createRow', { name: typedName })}</span>
                <span className="list-row__meta">{t('groceries.createRowHint')}</span>
              </span>
              <span className="chevron"><Icon name="chevron" size={18} /></span>
            </button>
          )}
        </div>
      )}

      {showList && (
        <>
          {total > 0 && (
            <div className="grocery-progress">
              <span className="small muted">
                {cart.length > 0 ? t('groceries.progress', { n: cart.length, total }) : tn('groceries.onList', total)}
              </span>
              {/* Takes its place before the first tick, so nothing moves when it appears. */}
              <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={cart.length}
                style={cart.length ? undefined : { visibility: 'hidden' }}>
                <div style={{ width: `${(cart.length / total) * 100}%` }} />
              </div>
            </div>
          )}

          <div style={{ margin: 'var(--s-4) 0' }}>
            <Segmented<GroupMode> label={t('groceries.by')} value={mode} onChange={setMode} options={[
              { value: 'aisle', label: t('groceries.aisle') },
              { value: 'recipe', label: t('groceries.recipe') },
              { value: 'az', label: t('groceries.az') },
            ]} />
          </div>

          {loading && !data ? <Spinner /> : total === 0 ? (
            <div className="center" style={{ marginTop: 'var(--s-8)' }}>
              <p>🧺 {t('groceries.empty')}</p>
              <p className="muted small">{t('groceries.emptyHint')}</p>
            </div>
          ) : (
            <>
              {sections.map((section) => (
                <section key={section.key || 'none'}>
                  <h2 className="section-label">
                    {mode === 'aisle' ? sectionTitleOf(section.key)
                      : mode === 'recipe' ? (section.key ? data?.recipes.get(section.key) ?? '' : t('groceries.noRecipe'))
                        : section.key}
                  </h2>
                  <div className="list">
                    {section.items.map((item) => (
                      <SwipeRow key={item.id} label={item.display} onRemove={() => remove(item)}>
                        <Checkbox checked={false} label={item.display} onChange={(v) => toggle(item, v)} />
                        <button type="button" className="list-row__main list-row__tap" onClick={() => setOpenId(item.id)}>
                          <span className="list-row__title grocery-row__name">
                            {isNew(item) && (
                              <span className="new-dot" style={{ background: memberColor(item.added_by) }}
                                role="img" aria-label={t('groceries.newFromOthers', { name: memberName(item.added_by) })} />
                            )}
                            {item.display}
                          </span>
                          {notSaved(item.id) && <span className="list-row__meta not-saved">{t('groceries.notSaved')}</span>}
                        </button>
                        {item.quantity !== null && (
                          <button type="button" className="grocery-row__amount" aria-label={t('groceries.amountOf', { name: item.display })}
                            onClick={() => setAmountId(item.id)}>
                            {amount(item.quantity, item.unit)}
                          </button>
                        )}
                      </SwipeRow>
                    ))}
                  </div>
                </section>
              ))}

              {cart.length > 0 && (
                <section>
                  <div className="row row--between cart-head">
                    <h2 className="section-label">{t('groceries.inCart')}</h2>
                    <Button small variant="text" onClick={clearCart}>{t('groceries.clear')}</Button>
                  </div>
                  <div className="list">
                    {cart.map((item) => {
                      const by = members.find((m) => m.user_id === item.checked_by);
                      return (
                        <div key={item.id} className="list-row list-row--checked">
                          <Checkbox checked label={item.display} color={memberColor(item.checked_by)} onChange={(v) => toggle(item, v)} />
                          <button type="button" className="list-row__main list-row__tap" onClick={() => toggle(item, false)}>
                            <span className="list-row__title grocery-row__name">{item.display}</span>
                            {notSaved(item.id) && <span className="list-row__meta not-saved">{t('groceries.notSaved')}</span>}
                          </button>
                          <span className="grocery-row__amount muted">{amount(item.quantity, item.unit)}</span>
                          {by && (
                            <span title={t('groceries.checkedBy', { name: by.profile.first_name })}>
                              <Avatar name={by.profile.first_name} color={by.profile.color} size="sm" />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      <UsualsSheet open={usualsOpen} onClose={() => setUsualsOpen(false)} householdId={hid} catalog={catalog}
        onListByProduct={onListByProduct} onAdd={add} onChange={change} onRemove={remove} />
      <CreateItemSheet name={creating} catalog={catalog} isAdmin={isAdmin} onClose={() => setCreating(null)} onCreate={create}
        onUseExisting={(p) => { setCreating(null); setQuery(productName(p, locale)); if (!onListByProduct.has(p.id)) add(p, typedFor(p)); }} />
      <ItemSheet item={openItem} catalog={catalog} onClose={() => setOpenId(null)} onChange={change} onRemove={remove}
        onMoved={() => void Promise.all([reload(), reloadCatalog()])} />
      <AmountSheet open={!!amountItem} title={t('groceries.amountOf', { name: amountItem?.display ?? '' })}
        value={{ quantity: amountItem?.quantity ?? null, unit: amountItem?.unit ?? null }}
        units={amountProduct ? unitsFor(amountProduct) : unitsFor({ default_aisle: amountItem?.aisle ?? 'other' })}
        onClose={() => setAmountId(null)} onDone={(a) => { if (amountItem) change(amountItem, a); setAmountId(null); }} />
    </Screen>
  );
}

