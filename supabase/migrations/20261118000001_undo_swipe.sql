-- Undo on the swipe screen: takes back this person's last choice on an open
-- deck they haven't finished. A finished deck has already been resolved (or
-- is waiting on the others with the choices counted), so it can't be undone.
create or replace function public.undo_swipe(p_deck uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_recipe uuid;
begin
  if not exists (
    select 1 from public.decks d
    where d.id = p_deck and d.status = 'open' and v_me = any (d.who_eating)
      and d.household_id = public.my_household_id()
  ) then
    return null;
  end if;
  if exists (select 1 from public.deck_members where deck_id = p_deck and user_id = v_me and finished_at is not null) then
    return null;
  end if;

  delete from public.swipes s
  where s.ctid = (select ctid from public.swipes
                  where deck_id = p_deck and user_id = v_me
                  order by created_at desc limit 1)
  returning s.recipe_id into v_recipe;
  if v_recipe is null then
    return null;
  end if;

  -- A pass reason belongs to the choice it explained.
  delete from public.taste_signals
  where user_id = v_me and kind = 'reason' and deck_id = p_deck and recipe_id = v_recipe;
  update public.deck_members
  set swiped_count = (select count(*) from public.swipes where deck_id = p_deck and user_id = v_me)
  where deck_id = p_deck and user_id = v_me;
  return v_recipe;
end;
$$;
revoke execute on function public.undo_swipe(uuid) from public, anon;
grant execute on function public.undo_swipe(uuid) to authenticated;
