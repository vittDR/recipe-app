// Recipe tags. A recipe stores tag names ("comfort", "one-pot"): the shared
// catalogue's canonical lowercase English names, or a household's own tags.
// Labels in each language and the aliases recipe sites use ("réconfortant",
// "plat mijoté") live in public.tag_catalog, so a tag reads in the app's
// language and the same dish gets the same tag whatever site it came from.
// Catalogue rows of kind 'ingredient' (chicken, rice…: the ingredient list
// already says it) and 'noise' (dinner, plat principal…) are words to drop.

export interface TagEntry {
  name: string;
  /** null = shared catalogue. */
  household_id: string | null;
  kind: 'tag' | 'ingredient' | 'noise';
  name_en: string | null;
  name_fr: string | null;
  aliases: string[];
}

export const MAX_TAGS = 12;

/** Lowercase, no accents, punctuation as spaces: "Plat mijoté" = "plat mijote".
 *  Mirrors public.product_key() (no plurals: aliases list them). */
export function tagKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** How a typed or imported tag is stored when it's new: lowercase, single spaces. */
export function newTagName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 40);
}

export class TagCatalog {
  private byKey = new Map<string, TagEntry>();
  private byName = new Map<string, TagEntry>();
  readonly entries: TagEntry[];

  constructor(entries: TagEntry[]) {
    // Shared tags win over a household's own on the same words.
    this.entries = [...entries].sort((a, b) => Number(a.household_id !== null) - Number(b.household_id !== null));
    for (const e of this.entries) {
      if (!this.byName.has(e.name)) this.byName.set(e.name, e);
      for (const n of [e.name, e.name_en, e.name_fr, ...(e.aliases ?? [])]) {
        if (!n) continue;
        const k = tagKey(n);
        if (k && !this.byKey.has(k)) this.byKey.set(k, e);
      }
    }
  }

  /** The catalogue row these words name, in any language. */
  find(text: string): TagEntry | undefined {
    return this.byName.get(text) ?? this.byKey.get(tagKey(text));
  }

  /** The tags people can pick: shared ones and the household's own, by label. */
  choices(locale: string): { name: string; label: string }[] {
    return this.entries.filter((e) => e.kind === 'tag' && this.byName.get(e.name) === e)
      .map((e) => ({ name: e.name, label: this.label(e.name, locale) }))
      .sort((a, b) => a.label.localeCompare(b.label, locale));
  }

  /** The tag in `locale`, else in the other language, else its name as written. */
  label(name: string, locale: string): string {
    const e = this.byName.get(name);
    const label = locale === 'fr' ? e?.name_fr ?? e?.name_en : e?.name_en ?? e?.name_fr;
    return label ?? name.charAt(0).toUpperCase() + name.slice(1);
  }

  /** Whether `name` has no label in `locale` yet (a household tag nobody translated). */
  untranslated(name: string, locale: string): boolean {
    const e = this.byName.get(name);
    return !!e && (locale === 'fr' ? !e.name_fr : !e.name_en);
  }

  /** Tags as a recipe stores them: known ones by name, ingredients and noise
   *  dropped, new ones as typed (lowercase), no duplicates, at most MAX_TAGS. */
  normalise(raw: string[]): { tags: string[]; unknown: string[] } {
    const tags: string[] = [];
    const unknown: string[] = [];
    for (const r of raw) {
      if (!tagKey(String(r))) continue;
      const entry = this.find(String(r));
      if (entry && entry.kind !== 'tag') continue;
      const name = entry?.name ?? newTagName(String(r));
      if (tags.includes(name)) continue;
      if (tags.length >= MAX_TAGS) break;
      tags.push(name);
      if (!entry) unknown.push(name);
    }
    return { tags, unknown };
  }
}
