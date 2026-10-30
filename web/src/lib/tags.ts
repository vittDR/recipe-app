// The tag catalogue on the client: shared tags (kept on the phone and
// downloaded again only when catalog_version() changes, like products and
// ingredients) plus the household's own, re-loaded when it adds or translates
// one. Rules live in @logic/tags.ts.
import { useMemo } from 'react';
import { TagCatalog, type TagEntry } from '@logic/tags.ts';
import { cachedCatalogue, peekCatalogue, readCache, writeCache } from './cache.ts';
import { useLive } from './hooks.ts';
import { must, supabase } from './supabase.ts';

const ownKey = (hid: string) => `household:${hid}:tags`;

let sharedTags: Promise<TagEntry[]> | null = null;

function loadSharedTags(): Promise<TagEntry[]> {
  sharedTags ??= cachedCatalogue<TagEntry[]>(
    'tags',
    async () => must(await supabase.from('tag_catalog').select('*').is('household_id', null)) as TagEntry[],
    (fresh) => { sharedTags = Promise.resolve(fresh); },
  ).catch((e) => {
    sharedTags = null;
    throw e;
  });
  return sharedTags;
}

export function useTags(hid: string): { tags: TagCatalog | null; reload: () => Promise<void> } {
  const { data, reload } = useLive<TagEntry[]>(`tags:${hid}`, async () => {
    const [shared, own] = await Promise.all([
      loadSharedTags(),
      supabase.from('tag_catalog').select('*').eq('household_id', hid),
    ]);
    const mine = must(own) as TagEntry[];
    writeCache(ownKey(hid), mine);
    return [...shared, ...mine];
  }, [{ table: 'tag_catalog', filter: `household_id=eq.${hid}` }], () => {
    const shared = peekCatalogue<TagEntry[]>('tags');
    const mine = readCache<TagEntry[]>(ownKey(hid));
    return shared && mine ? [...shared, ...mine] : null;
  });
  const tags = useMemo(() => (data ? new TagCatalog(data) : null), [data]);
  return { tags, reload };
}
