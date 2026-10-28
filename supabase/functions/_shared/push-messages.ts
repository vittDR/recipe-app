// Push notification copy, by outbox kind and profile locale.

type Locale = 'en' | 'fr';
type Payload = Record<string, unknown>;

interface Message {
  title: string;
  body: string;
  url: string;
}

const name = (p: Payload) => String(p.name ?? '').trim();

const count = (p: Payload) => Number(p.count ?? 0);
const item = (p: Payload, key: 'item_fr' | 'item_en') => String(p[key] ?? '').trim().toLocaleLowerCase();

const MESSAGES: Record<string, Record<Locale, (p: Payload) => Message>> = {
  prompt: {
    en: () => ({ title: 'Eating in tonight?', body: 'Deal a deck and pick dinner together.', url: '/' }),
    fr: () => ({ title: 'On mange à la maison ce soir ?', body: 'Lancez un deck et choisissez le dîner ensemble.', url: '/' }),
  },
  reminder: {
    en: () => ({ title: 'Dinner still undecided', body: 'Two minutes and it’s sorted.', url: '/' }),
    fr: () => ({ title: 'Toujours pas de dîner ?', body: 'Deux minutes et c’est réglé.', url: '/' }),
  },
  deck_dealt: {
    en: (p) => ({ title: `${name(p) || 'Your partner'} dealt tonight’s deck`, body: 'Join and swipe.', url: `/deck/${p.deck_id}` }),
    fr: (p) => ({ title: `${name(p) || 'Votre partenaire'} a lancé le deck du soir`, body: 'Rejoignez et swipez.', url: `/deck/${p.deck_id}` }),
  },
  partner_finished: {
    en: (p) => ({ title: `${name(p) || 'Your partner'} finished swiping`, body: 'Your turn to finish the deck.', url: `/deck/${p.deck_id}` }),
    fr: (p) => ({ title: `${name(p) || 'Votre partenaire'} a fini de swiper`, body: 'À vous de finir le deck.', url: `/deck/${p.deck_id}` }),
  },
  nudge: {
    en: (p) => ({ title: `${name(p) || 'Your partner'} is waiting`, body: 'Finish the deck to see tonight’s dinner.', url: `/deck/${p.deck_id}` }),
    fr: (p) => ({ title: `${name(p) || 'Votre partenaire'} vous attend`, body: 'Finissez le deck pour voir le dîner.', url: `/deck/${p.deck_id}` }),
  },
  match: {
    en: (p) => ({ title: 'It’s a match!', body: 'Tonight’s dinner is decided.', url: `/deck/${p.deck_id}` }),
    fr: (p) => ({ title: 'C’est un match !', body: 'Le dîner de ce soir est choisi.', url: `/deck/${p.deck_id}` }),
  },
  tiebreak: {
    en: (p) => ({ title: 'No match this time', body: 'Pick one of the three closest calls.', url: `/deck/${p.deck_id}` }),
    fr: (p) => ({ title: 'Pas de match cette fois', body: 'Choisissez parmi les trois plus proches.', url: `/deck/${p.deck_id}` }),
  },
  partner_joined: {
    en: (p) => ({ title: `${name(p) || 'Your partner'} joined your household`, body: 'You can now decide dinner together.', url: '/' }),
    fr: (p) => ({ title: `${name(p) || 'Votre partenaire'} a rejoint le foyer`, body: 'Vous pouvez choisir le dîner ensemble.', url: '/' }),
  },
  groceries_added: {
    en: (p) => ({
      title: 'Groceries',
      body: count(p) === 1 && item(p, 'item_en')
        ? `${name(p) || 'Your partner'} added ${item(p, 'item_en')} to the list`
        : `${name(p) || 'Your partner'} added ${count(p)} items to the list`,
      url: '/groceries',
    }),
    fr: (p) => ({
      title: 'Courses',
      body: count(p) === 1 && item(p, 'item_fr')
        ? `${name(p) || 'Votre partenaire'} a ajouté ${item(p, 'item_fr')} à la liste`
        : `${name(p) || 'Votre partenaire'} a ajouté ${count(p)} articles à la liste`,
      url: '/groceries',
    }),
  },
};

export function pushMessage(kind: string, locale: string, payload: Payload): Message | null {
  const byLocale = MESSAGES[kind];
  if (!byLocale) return null;
  return byLocale[locale === 'fr' ? 'fr' : 'en'](payload);
}
