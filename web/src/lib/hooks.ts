// Data hooks. Each loads with supabase-js and, where both phones must agree
// live, re-loads on realtime changes.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Catalog, type CatalogEntry } from '@logic/ingredients.ts';
import { toast } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import { cachedCatalogue, peekCatalogue } from './cache.ts';
import { supabase } from './supabase.ts';

/** Today's date (YYYY-MM-DD) in the household's time zone. */
export function todayIn(timeZone: string, offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(d);
}

/** ISO weekday (1 = Monday) of a YYYY-MM-DD date. */
export function isoWeekday(date: string): number {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

interface Loaded<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** Shows a change right away, before the write and the reload land. */
  set: (update: (data: T | null) => T | null) => void;
}

/**
 * Runs `fetcher` now and whenever one of `tables` changes for this filter.
 * `key` identifies the query; changing it re-subscribes. `initial` can give
 * stored data to show until the first load lands.
 */
export function useLive<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  tables: { table: string; filter?: string; event?: 'INSERT' | 'UPDATE' | 'DELETE' }[] = [],
  initial?: () => T | null,
): Loaded<T> {
  const [data, setData] = useState<T | null>(() => initial?.() ?? null);
  const [loading, setLoading] = useState(data === null);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(async () => {
    try {
      setData(await fetcherRef.current());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const tablesKey = JSON.stringify(tables);
  useEffect(() => {
    if (!key) return;
    if (!initial) setLoading(true);
    void reload();
    if (tables.length === 0) return;
    let channel = supabase.channel(`live:${key}:${Math.random().toString(36).slice(2)}`);
    for (const t of tables) {
      channel = channel.on('postgres_changes', { event: t.event ?? '*', schema: 'public', table: t.table, filter: t.filter }, () => {
        void reload();
      });
    }
    channel.subscribe();
    // Catch up after the phone wakes or the app comes back to the foreground.
    const onVisible = () => document.visibilityState === 'visible' && void reload();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tablesKey, reload]);

  return { data, loading, error, reload, set: setData };
}

type Write = PromiseLike<{ error: { message: string } | null }>;

/**
 * Runs a write (a supabase-js query or RPC) and tells the person when it
 * failed. Resolves true when it saved; `done` is shown as a toast then.
 */
export function useSave(): (write: Write, done?: string) => Promise<boolean> {
  const { t } = useI18n();
  return useCallback(async (write: Write, done?: string) => {
    const { error } = await write;
    if (error) {
      toast(t('app.error'));
      return false;
    }
    if (done) toast(done);
    return true;
  }, [t]);
}

let catalogPromise: Promise<Catalog> | null = null;
let storedCatalog: Catalog | null = null;

/** The ingredient catalogue: kept on the phone, downloaded again only when it changed. */
export function loadCatalog(): Promise<Catalog> {
  catalogPromise ??= cachedCatalogue<CatalogEntry[]>(
    'ingredients',
    async () => {
      const { data, error } = await supabase.from('ingredient_catalog').select('*');
      if (error) throw new Error(error.message);
      return (data ?? []) as CatalogEntry[];
    },
    (fresh) => { catalogPromise = Promise.resolve((storedCatalog = new Catalog(fresh))); },
  ).then((entries) => (storedCatalog = new Catalog(entries))).catch((e) => {
    catalogPromise = null;
    throw e;
  });
  return catalogPromise;
}

export function useCatalog(): Catalog | null {
  const [catalog, setCatalog] = useState<Catalog | null>(() => {
    if (!storedCatalog) {
      const entries = peekCatalogue<CatalogEntry[]>('ingredients');
      if (entries) storedCatalog = new Catalog(entries);
    }
    return storedCatalog;
  });
  useEffect(() => {
    void loadCatalog().then(setCatalog).catch(() => undefined);
  }, []);
  return catalog;
}

/** Keeps the screen awake while mounted (cooking mode). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        // denied or unsupported
      }
    };
    void request();
    const onVisible = () => document.visibilityState === 'visible' && void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [active]);
}
