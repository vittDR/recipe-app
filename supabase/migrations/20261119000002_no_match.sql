-- No veto, no tie-break: when everyone has finished and no recipe has
-- everyone's yes, the deck ends as "no_match". Ce soir then offers a new
-- deck, which leaves out these cards and leans towards what people liked
-- (deal-deck). The tie-break picks, options and trigger go.

update public.decks set status = 'no_match', resolved_at = coalesce(resolved_at, now()) where status = 'tiebreak';

-- The table first: its policies use tiebreak_options().
drop table if exists public.tiebreak_picks;
drop function if exists public.on_tiebreak_pick();
drop function if exists public.tiebreak_options(uuid);

create or replace function public.resolve_deck(p_deck uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_deck public.decks;
  v_unfinished int;
  v_first uuid;
begin
  select * into v_deck from public.decks where id = p_deck for update;
  if v_deck.status <> 'open' then
    return;
  end if;

  select count(*) into v_unfinished
  from unnest(v_deck.who_eating) as e(uid)
  left join public.deck_members dm on dm.deck_id = p_deck and dm.user_id = e.uid
  where dm.finished_at is null;

  if v_unfinished > 0 then
    return;
  end if;

  select y.recipe_id into v_first from public.deck_mutual_yes(p_deck) y order by y.card_position limit 1;

  if v_first is not null then
    perform public.record_match(p_deck, v_first);
  else
    update public.decks set status = 'no_match', resolved_at = now() where id = p_deck;
    perform public.enqueue_push(v_deck.who_eating, 'no_match', jsonb_build_object('deck_id', p_deck));
  end if;
end;
$$;
revoke execute on function public.resolve_deck(uuid) from public, anon, authenticated;

-- Closes the current deck so a fresh one can be dealt.
create or replace function public.close_deck(p_deck uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_deck public.decks;
begin
  select * into v_deck from public.decks where id = p_deck;
  if not found or not public.is_member(v_deck.household_id) then
    raise exception 'not_allowed';
  end if;
  update public.decks set status = 'closed', resolved_at = coalesce(resolved_at, now())
  where id = p_deck and status = 'open';
end;
$$;

-- Turned-off "tie-break" pushes now mean the no-match push.
update public.profiles set push_muted = array_replace(push_muted, 'tiebreak', 'no_match')
where 'tiebreak' = any (push_muted);
