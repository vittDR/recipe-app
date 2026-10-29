// The tag catalogue on the client: shared tags plus the household's own, kept
// on the phone and re-loaded when the household adds or translates a tag.
// Rules live in @logic/tags.ts.
import { useMemo } from 'react';
import { TagCatalog, type TagEntry } from '@logic/tags.ts';
import { readCache, writeCache } from './cache.ts';
import { useLive } from './hooks.ts';
import { supabase } from './supabase.ts';

const cacheKey = (hid: string) => `household:${hid}:tags`;

export function useTags(hid: string): { tags: TagCatalog | null; reload: () => Promise<void> } {
  const { data, reload } = useLive<TagEntry[]>(`tags:${hid}`, async () => {
    const { data, error } = await supabase.from('tag_catalog').select('*');
    if (error) throw new Error(error.message);
    writeCache(cacheKey(hid), data);
    return (data ?? []) as TagEntry[];
  }, [{ table: 'tag_catalog', filter: `household_id=eq.${hid}` }], () => readCache<TagEntry[]>(cacheKey(hid)));
  const tags = useMemo(() => (data ? new TagCatalog(data) : null), [data]);
  return { tags, reload };
}
