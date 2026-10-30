// Copies of the shared catalogues (and the household's grocery setup) on the
// phone, so screens open instantly and offline. Shared catalogues are checked
// against public.catalog_version() once per session and downloaded again only
// when they changed. Everything here is a convenience: storage can be empty
// or unavailable and the app still works.

import { supabase } from './supabase.ts';

const PREFIX = 'dineamite.cache.v1:';

export function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // full or unavailable: the next load downloads again
  }
}

/** Drops the household's copies, e.g. on sign-out; shared catalogues stay. */
export function clearHouseholdCache(): void {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(`${PREFIX}household:`)) localStorage.removeItem(k);
    }
  } catch {
    // unavailable
  }
}

type Catalogue = 'products' | 'ingredients' | 'tags';
let versions: Promise<Record<Catalogue, string>> | null = null;

function serverVersions(): Promise<Record<Catalogue, string>> {
  versions ??= (async () => {
    const { data, error } = await supabase.rpc('catalog_version');
    if (error) {
      versions = null;
      throw new Error(error.message);
    }
    return data as Record<Catalogue, string>;
  })();
  return versions;
}

/** Checks the server's versions again on next use, e.g. after editing a catalogue. */
export function forgetCatalogueVersions(): void {
  versions = null;
}

interface Versioned<T> {
  version: string;
  data: T;
}

/** The stored copy of a shared catalogue, if any, without waiting. */
export function peekCatalogue<T>(name: Catalogue): T | null {
  return readCache<Versioned<T>>(name)?.data ?? null;
}

/**
 * A shared catalogue: the stored copy right away when there is one (checked
 * in the background; `onFresh` gets a newer one), else downloaded and stored.
 */
export function cachedCatalogue<T>(name: Catalogue, download: () => Promise<T>, onFresh: (data: T) => void): Promise<T> {
  const stored = readCache<Versioned<T>>(name);
  const refresh = async (): Promise<T> => {
    // Offline or an older server: keep the copy, or download without a version.
    const version = await serverVersions().then((v) => v[name] ?? '').catch(() => null);
    if (stored && (version === null || stored.version === version)) return stored.data;
    const data = await download();
    writeCache(name, { version: version ?? '', data } satisfies Versioned<T>);
    return data;
  };
  if (!stored) return refresh();
  void refresh().then((data) => data !== stored.data && onFresh(data)).catch(() => undefined);
  return Promise.resolve(stored.data);
}
