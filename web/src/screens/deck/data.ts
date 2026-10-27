import { must, supabase } from '../../lib/supabase.ts';
import type { Deck, DeckCard, DeckMemberProgress, MemberPortion, Swipe } from '../../lib/types.ts';

export interface DeckData {
  deck: Deck;
  cards: DeckCard[];
  portions: Map<string, MemberPortion>;
  progress: DeckMemberProgress[];
  mySwipes: Swipe[];
  /** recipe_id -> user_id -> fits (booleans only; partners' numbers stay private). */
  fits: Map<string, Map<string, boolean>>;
}

export async function loadDeck(id: string, userId: string): Promise<DeckData> {
  const [deck, cards, portions, progress, swipes, fits] = await Promise.all([
    supabase.from('decks').select('*').eq('id', id).single(),
    supabase.from('deck_cards').select('*, recipe:recipes(*)').eq('deck_id', id).order('position'),
    supabase.from('member_portions').select('recipe_id, kcal, protein_g, servings, fits').eq('deck_id', id),
    supabase.from('deck_members').select('*').eq('deck_id', id),
    supabase.from('swipes').select('*').eq('deck_id', id).eq('user_id', userId),
    supabase.rpc('member_fits', { p_deck: id }),
  ]);
  const fitMap = new Map<string, Map<string, boolean>>();
  for (const f of (must(fits) ?? []) as { recipe_id: string; user_id: string; fits: boolean }[]) {
    const m = fitMap.get(f.recipe_id) ?? new Map<string, boolean>();
    m.set(f.user_id, f.fits);
    fitMap.set(f.recipe_id, m);
  }
  return {
    deck: must(deck) as Deck,
    cards: must(cards) as unknown as DeckCard[],
    portions: new Map((must(portions) as MemberPortion[]).map((p) => [p.recipe_id, p])),
    progress: must(progress) as DeckMemberProgress[],
    mySwipes: must(swipes) as Swipe[],
    fits: fitMap,
  };
}
