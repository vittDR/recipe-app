// This person's diet (the 'diet' taste rule; none means "everything"): what
// the deck art, the deck's protein choices and the recipe list follow.
import { useLive } from './hooks.ts';
import { useSession } from './session.tsx';
import { must, supabase } from './supabase.ts';
import type { Diet } from './types.ts';

export async function loadDiet(userId: string): Promise<Diet> {
  const row = must(await supabase.from('taste_rules').select('value').eq('user_id', userId).eq('kind', 'diet').maybeSingle());
  return ((row as { value: Diet } | null)?.value) ?? 'everything';
}

/** Null until loaded; reloaded each time a screen using it opens, so a change in Us > Tastes shows on return. */
export function useDiet(): Diet | null {
  const { userId } = useSession();
  return useLive<Diet>(userId ? `diet:${userId}` : null, () => loadDiet(userId!)).data;
}
