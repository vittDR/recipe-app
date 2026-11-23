-- Partners' must-haves on an open deck. Other verdicts stay hidden until the
-- reader has finished (swipes_select), so nobody is swayed by a yes or a pass;
-- a must-have is the one thing a partner wants said out loud: it puts the card
-- first in the others' decks with a "{name} wants this" tag.
create or replace function public.partner_musts(p_deck uuid)
returns table (recipe_id uuid, user_id uuid)
language sql stable security definer set search_path = ''
as $$
  select s.recipe_id, s.user_id
  from public.swipes s
  join public.decks d on d.id = s.deck_id
  where s.deck_id = p_deck
    and s.verdict = 'must'
    and s.user_id <> (select auth.uid())
    and d.household_id = (select public.my_household_id())
    and (select auth.uid()) = any (d.who_eating);
$$;
revoke execute on function public.partner_musts(uuid) from public, anon;
grant execute on function public.partner_musts(uuid) to authenticated;
