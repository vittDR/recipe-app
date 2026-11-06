// Allergies on Nous: everyone's, as tags by person, and a sheet to edit your
// own: the EU's 14 allergens or any catalogue item. Each allergen stands for
// its linked ingredients and preparations; the screens never explain that.
import { useState } from 'react';
import { productName } from '@logic/products.ts';
import { useI18n } from '../i18n/index.tsx';
import { useLive, useSave } from '../lib/hooks.ts';
import { searchProducts, useGroceryCatalog } from '../lib/products.ts';
import { useSession } from '../lib/session.tsx';
import { must, supabase } from '../lib/supabase.ts';
import { Icon } from './Icon.tsx';
import { Avatar, Button, Chip, ListRow, SearchField, Section, Sheet, SheetHeader, Tag, toast } from './ui.tsx';

interface Allergen {
  key: string;
  name_fr: string;
  name_en: string;
}

interface MemberAllergy {
  id: string;
  user_id: string;
  allergen: string | null;
  ingredient: string | null;
}

export function useAllergies() {
  const { household } = useSession();
  return useLive<{ allergens: Allergen[]; mine: MemberAllergy[] }>(`allergies:${household!.id}`, async () => {
    const [a, m] = await Promise.all([
      supabase.from('allergens').select('key, name_fr, name_en').order('position'),
      supabase.from('member_allergies').select('id, user_id, allergen, ingredient').order('created_at'),
    ]);
    return { allergens: must(a) as Allergen[], mine: must(m) as MemberAllergy[] };
  }, [{ table: 'member_allergies' }]);
}

export function AllergiesCard() {
  const { t, locale } = useI18n();
  const { userId, members, household, memberName, memberColor } = useSession();
  const { data: catalog } = useGroceryCatalog(household!.id);
  const { data, reload } = useAllergies();
  const [open, setOpen] = useState(false);

  const label = (a: MemberAllergy) => {
    if (a.allergen) {
      const x = data?.allergens.find((e) => e.key === a.allergen);
      return x ? (locale === 'fr' ? x.name_fr : x.name_en) : a.allergen;
    }
    const p = a.ingredient ? catalog?.index.ofIngredient(a.ingredient) : undefined;
    return p ? productName(p, locale) : a.ingredient ?? '';
  };
  // You first, then the others.
  const people = [...members].sort((a, b) => (a.user_id === userId ? -1 : b.user_id === userId ? 1 : 0));
  const any = (data?.mine.length ?? 0) > 0;

  return (
    <>
      <button type="button" className="card allergies-card" onClick={() => setOpen(true)}>
        <span className="row row--between">
          <span className="card__title">{t('allergies.title')}</span>
          <span className="chevron"><Icon name="chevron" size={18} /></span>
        </span>
        {any ? (
          <span className="chips">
            {people.flatMap((m) => (data?.mine ?? []).filter((a) => a.user_id === m.user_id).map((a, k) => (
              <span key={a.id} className="row allergy-tag">
                {k === 0 && <Avatar name={memberName(m.user_id)} color={memberColor(m.user_id)} size="sm" />}
                <Tag tone={m.user_id === userId ? 'accent' : 'iris'}>{label(a)}</Tag>
              </span>
            )))}
          </span>
        ) : <span className="t-callout muted">{t('allergies.none')}</span>}
      </button>
      <AllergiesSheet open={open} onClose={() => { setOpen(false); void reload(); }} label={label} />
    </>
  );
}

function AllergiesSheet({ open, onClose, label }: { open: boolean; onClose: () => void; label: (a: MemberAllergy) => string }) {
  const { t, locale } = useI18n();
  const { userId, household } = useSession();
  const { data: catalog } = useGroceryCatalog(household!.id);
  const { data, set } = useAllergies();
  const save = useSave();
  const [query, setQuery] = useState('');
  const mine = (data?.mine ?? []).filter((a) => a.user_id === userId);
  const custom = mine.filter((a) => a.ingredient);

  const add = async (fields: { allergen?: string; ingredient?: string }) => {
    const { data: row, error } = await supabase.from('member_allergies').insert(fields).select('id, user_id, allergen, ingredient').single();
    if (error || !row) toast(t('app.error'));
    else set((d) => d && { ...d, mine: [...d.mine, row as MemberAllergy] });
  };
  const remove = async (a: MemberAllergy) => {
    set((d) => d && { ...d, mine: d.mine.filter((x) => x.id !== a.id) });
    await save(supabase.from('member_allergies').delete().eq('id', a.id));
  };

  // Catalogue items that stand for an ingredient, not already chosen.
  const taken = new Set(custom.map((a) => a.ingredient));
  const results = searchProducts(catalog, query, { limit: 6 }).results.filter((p) => p.ingredient && !taken.has(p.ingredient));

  return (
    <Sheet open={open} onClose={onClose} label={t('allergies.yours')} className="sheet--fixed">
      <SheetHeader title={t('allergies.yours')} action={<Button small variant="text" onClick={onClose}>OK</Button>} />
      <Section label={t('allergies.common')} flush>
        <div className="chips">
          {(data?.allergens ?? []).map((a) => {
            const chosen = mine.find((m) => m.allergen === a.key);
            return (
              <Chip key={a.key} pressed={!!chosen} onClick={() => void (chosen ? remove(chosen) : add({ allergen: a.key }))}>
                {locale === 'fr' ? a.name_fr : a.name_en}
              </Chip>
            );
          })}
        </div>
      </Section>
      <Section label={t('allergies.others')}>
        <div className="stack">
          {custom.length > 0 && (
            <div className="chips">
              {custom.map((a) => (
                <Chip key={a.id} pressed onRemove={() => void remove(a)} removeLabel={`${t('app.delete')} ${label(a)}`}>{label(a)}</Chip>
              ))}
            </div>
          )}
          <SearchField value={query} onChange={setQuery} placeholder={t('allergies.search')} label={t('allergies.search')}
            onEnter={() => results[0] && void add({ ingredient: results[0].ingredient! }).then(() => setQuery(''))} />
          {query.trim() && results.length > 0 && (
            <div className="list" role="listbox" aria-label={t('allergies.search')}>
              {results.map((p) => (
                <ListRow key={p.id} role="option" title={productName(p, locale)} trailing={<Icon name="plus" size={20} />}
                  onClick={() => { void add({ ingredient: p.ingredient! }); setQuery(''); }} />
              ))}
            </div>
          )}
        </div>
      </Section>
    </Sheet>
  );
}
