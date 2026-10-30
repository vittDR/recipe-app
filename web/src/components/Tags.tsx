// Recipe tags in the app's language: shown on a recipe (a household's own tag
// with no label in this language can be translated in place) and picked when
// adding a recipe. Rules live in @logic/tags.ts.
import { useState } from 'react';
import { MAX_TAGS, newTagName, tagKey, type TagCatalog } from '@logic/tags.ts';
import { useI18n } from '../i18n/index.tsx';
import { supabase } from '../lib/supabase.ts';
import { Icon } from './Icon.tsx';
import { Button, Chip, Field, Sheet, SheetHeader, Tag, toast } from './ui.tsx';

export function RecipeTags({ names, tags, householdId, onTranslated }: {
  names: string[];
  tags: TagCatalog | null;
  householdId: string;
  onTranslated: () => void;
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState('');
  const label = (name: string) => tags?.label(name, locale) ?? name;

  const save = async () => {
    if (!open || !text.trim()) return;
    const { error } = await supabase.from('tag_catalog')
      .update(locale === 'fr' ? { name_fr: text.trim() } : { name_en: text.trim() })
      .eq('household_id', householdId).eq('name', open);
    if (error) toast(t('app.error'));
    else onTranslated();
    setOpen(null);
  };

  return (
    <>
      {names.map((name) => tags?.untranslated(name, locale) ? (
        <button key={name} type="button" className="chip chip--tag" aria-label={t('tags.translateTitle', { tag: label(name) })}
          onClick={() => { setOpen(name); setText(''); }}>
          {label(name)} <Icon name="pencil" size={14} />
        </button>
      ) : <Tag key={name}>{label(name)}</Tag>)}
      <Sheet open={!!open} onClose={() => setOpen(null)} label={open ? t('tags.translateTitle', { tag: label(open) }) : ''}>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          {open && <SheetHeader title={t('tags.translateTitle', { tag: label(open) })} />}
          <Field label={t(locale === 'fr' ? 'tags.inFrench' : 'tags.inEnglish')}>
            <input className="input" autoFocus value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <Button block type="submit" disabled={!text.trim()}>{t('tags.save')}</Button>
        </form>
      </Sheet>
    </>
  );
}

/** Picks a recipe's tags: catalogue tags by their label in either language,
 *  or new words, which become the household's own tags on save. */
export function TagEditor({ value, onChange, tags }: {
  value: string[];
  onChange: (names: string[]) => void;
  tags: TagCatalog | null;
}) {
  const { t, locale } = useI18n();
  const [text, setText] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const label = (name: string) => tags?.label(name, locale) ?? name;

  const add = (list: string[]) => {
    const next = [...value];
    let ingredient: string | null = null;
    for (const words of list) {
      if (!tagKey(words)) continue;
      const entry = tags?.find(words);
      if (entry?.kind === 'ingredient') ingredient = words.trim();
      if (entry && entry.kind !== 'tag') continue;
      const name = entry?.name ?? newTagName(words);
      if (!next.includes(name) && next.length < MAX_TAGS) next.push(name);
    }
    setHint(ingredient && t('tags.isIngredient', { tag: ingredient }));
    if (next.length !== value.length) onChange(next);
  };

  const key = tagKey(text);
  const suggestions = key && tags
    ? tags.choices(locale).filter((c) => !value.includes(c.name) && (tagKey(c.label).includes(key) || tagKey(c.name).includes(key))).slice(0, 6)
    : [];

  return (
    <div className="stack">
      {value.length > 0 && (
        <div className="chips">
          {value.map((name) => (
            <Chip key={name} onRemove={() => onChange(value.filter((x) => x !== name))} removeLabel={t('tags.remove', { tag: label(name) })}>
              {label(name)}{tags && !tags.find(name) && ` · ${t('tags.new')}`}
            </Chip>
          ))}
        </div>
      )}
      {value.length < MAX_TAGS && (
        <input className="input" value={text} placeholder={t('tags.add')} aria-label={t('tags.add')} enterKeyHint="done"
          onChange={(e) => {
            // Typing or pasting "a, b, c" adds each finished word.
            const parts = e.target.value.split(',');
            if (parts.length > 1) add(parts.slice(0, -1));
            setText(parts[parts.length - 1]);
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add([text]); setText(''); } }}
          // Leaving the field keeps what was typed (suggestions don't take focus).
          onBlur={() => { add([text]); setText(''); }} />
      )}
      {suggestions.length > 0 && (
        <div className="chips">
          {suggestions.map((c) => (
            <button key={c.name} type="button" className="chip" onMouseDown={(e) => e.preventDefault()}
              onClick={() => { add([c.name]); setText(''); }}>{c.label}</button>
          ))}
        </div>
      )}
      {hint && <span className="small muted">{hint}</span>}
    </div>
  );
}
