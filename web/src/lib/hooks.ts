// Data hooks. Each loads with supabase-js and, where both phones must agree
// live, re-loads on realtime changes.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Catalog, type CatalogEntry } from '@logic/ingredients.ts';
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
}

/**
 * Runs `fetcher` now and whenever one of `tables` changes for this filter.
 * `key` identifies the query; changing it re-subscribes.
 */
export function useLive<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  tables: { table: string; filter?: string }[] = [],
): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    void reload();
    if (tables.length === 0) return;
    let channel = supabase.channel(`live:${key}:${Math.random().toString(36).slice(2)}`);
    for (const t of tables) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: t.table, filter: t.filter }, () => {
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

  return { data, loading, error, reload };
}

let catalogPromise: Promise<Catalog> | null = null;

/** The ingredient catalogue, loaded once per session. */
export function loadCatalog(): Promise<Catalog> {
  catalogPromise ??= (async () => {
    const { data, error } = await supabase.from('ingredient_catalog').select('*');
    if (error) {
      catalogPromise = null;
      throw new Error(error.message);
    }
    return new Catalog((data ?? []) as CatalogEntry[]);
  })();
  return catalogPromise;
}

export function useCatalog(): Catalog | null {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
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
