-- Server-side rules: membership helpers, household lifecycle, matching,
-- tie-break, portions, grocery merging and scheduled prompts.
-- Every security definer function pins search_path to '' and qualifies names.

-- ---------------------------------------------------------------------------
-- Membership helpers (used by RLS policies)
-- ---------------------------------------------------------------------------

create or replace function public.is_member(p_household uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = p_household and m.user_id = auth.uid()
  );
$$;

create or replace function public.my_household_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.household_id from public.household_members m
  where m.user_id = auth.uid()
  order by m.joined_at
  limit 1;
$$;

create or replace function public.shares_household(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members a
    join public.household_members b on b.household_id = a.household_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

create or replace function public.is_owner(p_household uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.households h
    where h.id = p_household and h.owner_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text := coalesce(
    nullif(v_meta ->> 'first_name', ''),
    nullif(split_part(coalesce(v_meta ->> 'full_name', v_meta ->> 'name', ''), ' ', 1), ''),
    ''
  );
  v_locale text := case when v_meta ->> 'locale' like 'fr%' then 'fr' else 'en' end;
begin
  insert into public.profiles (id, first_name, locale)
  values (new.id, v_name, v_locale)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Push outbox helper
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_push(p_users uuid[], p_kind text, p_payload jsonb)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.push_outbox (user_id, kind, payload)
  select u, p_kind, coalesce(p_payload, '{}'::jsonb)
  from unnest(p_users) as u
  where u is not null;
$$;
revoke execute on function public.enqueue_push(uuid[], text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Household lifecycle
-- ---------------------------------------------------------------------------

create or replace function public.create_household(p_name text, p_timezone text default 'Europe/Paris')
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from public.household_members where user_id = v_uid) then
    raise exception 'already_in_household';
  end if;
  -- Validates the time zone name; raises on unknown zones.
  perform now() at time zone p_timezone;

  insert into public.households (name, owner_id, timezone)
  values (trim(p_name), v_uid, p_timezone)
  returning id into v_id;

  insert into public.household_members (household_id, user_id, role)
  values (v_id, v_uid, 'owner');

  -- Cook at home every day until the couple says otherwise.
  insert into public.plan_days (household_id, weekday, cook_at_home)
  select v_id, d, true from generate_series(1, 7) as d;

  insert into public.household_staples (household_id, name)
  select v_id, c.name from public.ingredient_catalog c where c.is_staple;

  insert into public.household_aisle_order (household_id, aisle, position)
  select v_id, a, row_number() over ()
  from unnest(enum_range(null::public.aisle)) as a;

  return v_id;
end;
$$;

-- Unambiguous alphabet: no 0/O, 1/I/L.
create or replace function public.random_invite_code()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text := '';
  v_bytes bytea := extensions.gen_random_bytes(6);
begin
  for i in 0..5 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
  end loop;
  return v_code;
end;
$$;

create or replace function public.create_invite()
returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_household uuid := public.my_household_id();
  v_code text;
begin
  if v_household is null then
    raise exception 'no_household';
  end if;
  -- Only one live invite per household.
  delete from public.invites i where i.household_id = v_household and i.used_by is null;

  loop
    v_code := public.random_invite_code();
    begin
      insert into public.invites (code, household_id, created_by)
      values (v_code, v_household, auth.uid());
      exit;
    exception when unique_violation then
      -- try another code
    end;
  end loop;

  return query select i.code, i.expires_at from public.invites i where i.code = v_code;
end;
$$;

create or replace function public.preview_invite(p_code text)
returns table (household_name text, inviter_name text, inviter_color text, member_count int)
language sql stable security definer set search_path = ''
as $$
  select h.name, p.first_name, p.color,
         (select count(*)::int from public.household_members m where m.household_id = h.id)
  from public.invites i
  join public.households h on h.id = i.household_id
  join public.profiles p on p.id = i.created_by
  where i.code = upper(trim(p_code))
    and i.used_by is null
    and i.expires_at > now()
    and auth.uid() is not null;
$$;

create or replace function public.redeem_invite(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.invites;
  v_others uuid[];
  v_name text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_invite from public.invites
  where code = upper(trim(p_code))
  for update;

  if not found or v_invite.used_by is not null or v_invite.expires_at <= now() then
    raise exception 'invalid_invite';
  end if;
  if exists (select 1 from public.household_members where user_id = v_uid) then
    raise exception 'already_in_household';
  end if;

  select array_agg(user_id) into v_others
  from public.household_members where household_id = v_invite.household_id;

  insert into public.household_members (household_id, user_id, role)
  values (v_invite.household_id, v_uid, 'member');

  update public.invites set used_by = v_uid, used_at = now() where code = v_invite.code;

  select first_name into v_name from public.profiles where id = v_uid;
  perform public.enqueue_push(v_others, 'partner_joined', jsonb_build_object('name', v_name));

  return v_invite.household_id;
end;
$$;

-- Leaving keeps the account and personal preferences. If the owner leaves,
-- ownership passes to the longest-standing member; an empty household is deleted.
create or replace function public.leave_household()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid := public.my_household_id();
  v_next uuid;
begin
  if v_household is null then
    return;
  end if;
  delete from public.household_members where household_id = v_household and user_id = v_uid;

  select user_id into v_next from public.household_members
  where household_id = v_household order by joined_at limit 1;

  if v_next is null then
    delete from public.households where id = v_household;
  elsif exists (select 1 from public.households where id = v_household and owner_id = v_uid) then
    update public.households set owner_id = v_next where id = v_household;
    update public.household_members set role = 'owner'
    where household_id = v_household and user_id = v_next;
  end if;
end;
$$;

create or replace function public.remove_member(p_user uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_household uuid := public.my_household_id();
begin
  if not public.is_owner(v_household) then
    raise exception 'owner_only';
  end if;
  if p_user = auth.uid() then
    raise exception 'use_leave_household';
  end if;
  delete from public.household_members where household_id = v_household and user_id = p_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- Recipes
-- ---------------------------------------------------------------------------

-- A household's edit of a seed recipe works on its own copy.
create or replace function public.copy_recipe(p_recipe uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_household uuid := public.my_household_id();
  v_new uuid;
  v_src public.recipes;
begin
  select * into v_src from public.recipes where id = p_recipe;
  if not found or (v_src.household_id is not null and not public.is_member(v_src.household_id)) then
    raise exception 'not_found';
  end if;
  if v_src.household_id = v_household then
    return v_src.id;
  end if;
  select id into v_new from public.recipes where household_id = v_household and copied_from = p_recipe;
  if v_new is not null then
    return v_new;
  end if;

  insert into public.recipes (household_id, copied_from, title, source_type, source_url, image_path,
    servings, total_min, steps, tags, kcal_per_serving, protein_g_per_serving, macros_estimated,
    language, created_by)
  select v_household, v_src.id, v_src.title, v_src.source_type, v_src.source_url, v_src.image_path,
    v_src.servings, v_src.total_min, v_src.steps, v_src.tags, v_src.kcal_per_serving,
    v_src.protein_g_per_serving, v_src.macros_estimated, v_src.language, auth.uid()
  returning id into v_new;

  insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle, is_staple, guessed, raw_text)
  select v_new, position, name, quantity, unit, aisle, is_staple, guessed, raw_text
  from public.recipe_ingredients where recipe_id = v_src.id;

  return v_new;
end;
$$;

-- What a household browses: its own recipes plus seed recipes it has not copied.
create or replace view public.library_recipes
with (security_invoker = true)
as
  select r.* from public.recipes r
  where r.household_id = public.my_household_id()
     or (r.household_id is null and not exists (
           select 1 from public.recipes c
           where c.copied_from = r.id and c.household_id = public.my_household_id()));

-- ---------------------------------------------------------------------------
-- Portions: one pot, plates sized by each eater's dinner calorie target.
-- A recipe fits a member when their plate's protein is within 15% of target.
-- Mirrors supabase/functions/_shared/logic/portions.ts.
-- ---------------------------------------------------------------------------

create or replace function public.my_portion(p_recipe uuid, p_eaters uuid[] default null)
returns table (kcal real, protein_g real, servings real, pot_servings real, fits boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid := public.my_household_id();
  v_recipe public.recipes;
  v_eaters uuid[];
  v_total_kcal real;
  v_goal public.member_goals;
  v_protein real;
begin
  select * into v_recipe from public.recipes where id = p_recipe;
  if not found or (v_recipe.household_id is not null and v_recipe.household_id is distinct from v_household) then
    return;
  end if;
  if v_recipe.kcal_per_serving is null or v_recipe.kcal_per_serving <= 0 then
    return;
  end if;

  v_eaters := coalesce(p_eaters,
    (select array_agg(user_id) from public.household_members where household_id = v_household));
  -- Only household members count; always include the caller.
  select array_agg(distinct m.user_id) into v_eaters
  from public.household_members m
  where m.household_id = v_household and (m.user_id = any (v_eaters) or m.user_id = v_uid);

  select coalesce(sum(coalesce(g.dinner_kcal, 700)), 0) into v_total_kcal
  from unnest(v_eaters) as e(uid)
  left join public.member_goals g on g.user_id = e.uid;

  select * into v_goal from public.member_goals where user_id = v_uid;
  kcal := coalesce(v_goal.dinner_kcal, 700);
  servings := kcal / v_recipe.kcal_per_serving;
  pot_servings := v_total_kcal / v_recipe.kcal_per_serving;
  v_protein := coalesce(v_recipe.protein_g_per_serving, 0) * servings;
  protein_g := v_protein;
  fits := v_goal.dinner_protein_g is null
          or v_goal.dinner_protein_g = 0
          or abs(v_protein - v_goal.dinner_protein_g) / v_goal.dinner_protein_g <= 0.15;
  return next;
end;
$$;

-- Partners see only whether a card fits each other, never the numbers.
create or replace function public.member_fits(p_deck uuid)
returns table (recipe_id uuid, user_id uuid, fits boolean)
language sql stable security definer set search_path = ''
as $$
  select mp.recipe_id, mp.user_id, mp.fits
  from public.member_portions mp
  join public.decks d on d.id = mp.deck_id
  where mp.deck_id = p_deck and public.is_member(d.household_id);
$$;

-- ---------------------------------------------------------------------------
-- Deck progress, matching and tie-break
-- ---------------------------------------------------------------------------

create or replace function public.deck_mutual_yes(p_deck uuid)
returns table (recipe_id uuid, card_position int, musts int)
language sql stable security definer set search_path = ''
as $$
  select c.recipe_id, c.position,
         count(*) filter (where s.verdict = 'must')::int
  from public.deck_cards c
  join public.decks d on d.id = c.deck_id
  join public.swipes s on s.deck_id = c.deck_id and s.recipe_id = c.recipe_id
  where c.deck_id = p_deck
    and s.user_id = any (d.who_eating)
    and s.verdict in ('yes', 'must')
  group by c.recipe_id, c.position, d.who_eating
  having count(distinct s.user_id) = cardinality(d.who_eating)
  order by c.position;
$$;

-- Recipes both said yes to, in deck order, for "See other match".
create or replace function public.deck_matches(p_deck uuid)
returns table (recipe_id uuid, card_position int)
language sql stable security definer set search_path = ''
as $$
  select y.recipe_id, y.card_position
  from public.deck_mutual_yes(p_deck) y
  join public.decks d on d.id = p_deck
  where public.is_member(d.household_id)
    and d.status in ('matched', 'closed');
$$;

-- Three near-misses: cards someone liked, ranked by votes (Must-have counts
-- double) then by the deck's ranking score.
create or replace function public.tiebreak_options(p_deck uuid)
returns table (recipe_id uuid, votes int, score real, liked_by uuid[])
language sql stable security definer set search_path = ''
as $$
  select c.recipe_id,
         sum(case s.verdict when 'must' then 2 when 'yes' then 1 else 0 end)::int as votes,
         c.score,
         array_agg(s.user_id order by s.user_id) filter (where s.verdict in ('yes', 'must'))
  from public.deck_cards c
  join public.decks d on d.id = c.deck_id
  left join public.swipes s on s.deck_id = c.deck_id and s.recipe_id = c.recipe_id
  where c.deck_id = p_deck and public.is_member(d.household_id) and d.status = 'tiebreak'
  group by c.recipe_id, c.score, c.position
  having count(*) filter (where s.verdict in ('yes', 'must')) > 0
  order by votes desc, c.score desc, c.position
  limit 3;
$$;

create or replace function public.record_match(p_deck uuid, p_recipe uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_deck public.decks;
begin
  update public.decks
  set status = 'matched', matched_recipe_id = p_recipe, resolved_at = now()
  where id = p_deck
  returning * into v_deck;

  insert into public.meals (household_id, for_date, recipe_id, deck_id, status)
  values (v_deck.household_id, v_deck.for_date, p_recipe, p_deck, 'planned')
  on conflict (household_id, for_date)
  do update set recipe_id = excluded.recipe_id, deck_id = excluded.deck_id, status = 'planned';

  perform public.enqueue_push(v_deck.who_eating, 'match',
    jsonb_build_object('deck_id', p_deck, 'recipe_id', p_recipe));
end;
$$;
revoke execute on function public.record_match(uuid, uuid) from public, anon, authenticated;

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
    update public.decks set status = 'tiebreak' where id = p_deck;
    perform public.enqueue_push(v_deck.who_eating, 'tiebreak', jsonb_build_object('deck_id', p_deck));
  end if;
end;
$$;
revoke execute on function public.resolve_deck(uuid) from public, anon, authenticated;

create or replace function public.on_swipe()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_deck public.decks;
  v_cards int;
  v_done int;
  v_name text;
begin
  select * into v_deck from public.decks where id = new.deck_id;
  select count(*) into v_cards from public.deck_cards where deck_id = new.deck_id;
  select count(*) into v_done from public.swipes where deck_id = new.deck_id and user_id = new.user_id;

  insert into public.deck_members (deck_id, user_id, swiped_count, finished_at)
  values (new.deck_id, new.user_id, v_done, case when v_done >= v_cards then now() end)
  on conflict (deck_id, user_id) do update
  set swiped_count = excluded.swiped_count,
      finished_at = coalesce(public.deck_members.finished_at, excluded.finished_at);

  -- A just-me deck skips matching: the first yes is dinner.
  if cardinality(v_deck.who_eating) = 1 then
    if new.verdict in ('yes', 'must') then
      perform public.record_match(new.deck_id, new.recipe_id);
    elsif v_done >= v_cards then
      update public.decks set status = 'closed', resolved_at = now() where id = new.deck_id;
    end if;
    return new;
  end if;

  if v_done >= v_cards then
    select first_name into v_name from public.profiles where id = new.user_id;
    perform public.enqueue_push(
      array(select u from unnest(v_deck.who_eating) as u
            where u <> new.user_id
              and not exists (select 1 from public.deck_members dm
                              where dm.deck_id = new.deck_id and dm.user_id = u
                                and dm.finished_at is not null)),
      'partner_finished', jsonb_build_object('deck_id', new.deck_id, 'name', v_name));
    perform public.resolve_deck(new.deck_id);
  end if;
  return new;
end;
$$;

create trigger swipes_after_insert
  after insert on public.swipes
  for each row execute function public.on_swipe();

create or replace function public.on_tiebreak_pick()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_deck public.decks;
  v_picks int;
  v_distinct int;
  v_winner uuid;
begin
  select * into v_deck from public.decks where id = new.deck_id for update;
  if v_deck.status <> 'tiebreak' then
    return new;
  end if;

  select count(*), count(distinct recipe_id) into v_picks, v_distinct
  from public.tiebreak_picks
  where deck_id = new.deck_id and user_id = any (v_deck.who_eating);

  if v_picks < cardinality(v_deck.who_eating) then
    return new;
  end if;

  -- Same pick wins; otherwise the best macro fit for everyone eating.
  select p.recipe_id into v_winner
  from public.tiebreak_picks p
  join public.deck_cards c on c.deck_id = p.deck_id and c.recipe_id = p.recipe_id
  where p.deck_id = new.deck_id
  group by p.recipe_id, c.fit_score, c.score, c.position
  order by count(*) desc, c.fit_score desc, c.score desc, c.position
  limit 1;

  perform public.record_match(new.deck_id, v_winner);
  return new;
end;
$$;

create trigger tiebreak_picks_after_write
  after insert or update on public.tiebreak_picks
  for each row execute function public.on_tiebreak_pick();

-- Switch to another mutual yes ("See other match").
create or replace function public.choose_match(p_deck uuid, p_recipe uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_deck public.decks;
begin
  select * into v_deck from public.decks where id = p_deck;
  if not found or not public.is_member(v_deck.household_id) or v_deck.status <> 'matched' then
    raise exception 'not_allowed';
  end if;
  if not exists (select 1 from public.deck_mutual_yes(p_deck) y where y.recipe_id = p_recipe) then
    raise exception 'not_a_match';
  end if;
  update public.decks set matched_recipe_id = p_recipe where id = p_deck;
  update public.meals set recipe_id = p_recipe
  where household_id = v_deck.household_id and for_date = v_deck.for_date;
end;
$$;

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
  where id = p_deck and status in ('open', 'tiebreak');
end;
$$;

create or replace function public.nudge(p_deck uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_deck public.decks;
  v_targets uuid[];
  v_name text;
begin
  select * into v_deck from public.decks where id = p_deck;
  if not found or not public.is_member(v_deck.household_id) or v_deck.status <> 'open' then
    return false;
  end if;

  select array_agg(u) into v_targets
  from unnest(v_deck.who_eating) as u
  left join public.deck_members dm on dm.deck_id = p_deck and dm.user_id = u
  where u <> auth.uid()
    and dm.finished_at is null
    and (dm.nudged_at is null or dm.nudged_at < now() - interval '5 minutes');

  if v_targets is null then
    return false;
  end if;

  insert into public.deck_members (deck_id, user_id, nudged_at)
  select p_deck, u, now() from unnest(v_targets) as u
  on conflict (deck_id, user_id) do update set nudged_at = now();

  select first_name into v_name from public.profiles where id = auth.uid();
  perform public.enqueue_push(v_targets, 'nudge', jsonb_build_object('deck_id', p_deck, 'name', v_name));
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Groceries
-- ---------------------------------------------------------------------------

-- Adds items, merging quantities into unchecked items with the same name and unit.
-- p_items: [{"name":"spinach","quantity":200,"unit":"g","aisle":"produce","recipe_id":"..."}]
create or replace function public.add_grocery_items(p_items jsonb)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_household uuid := public.my_household_id();
  v_item jsonb;
  v_name text;
  v_unit text;
  v_qty real;
  v_existing uuid;
  v_count int := 0;
begin
  if v_household is null then
    raise exception 'no_household';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := lower(trim(v_item ->> 'name'));
    continue when v_name is null or v_name = '';
    v_unit := nullif(lower(trim(v_item ->> 'unit')), '');
    v_qty := (v_item ->> 'quantity')::real;

    select id into v_existing from public.grocery_items
    where household_id = v_household
      and lower(name) = v_name
      and coalesce(unit, '') = coalesce(v_unit, '')
      and checked_at is null and cleared_at is null
    limit 1;

    if v_existing is not null then
      update public.grocery_items
      set quantity = case when quantity is null or v_qty is null then coalesce(quantity, v_qty)
                          else quantity + v_qty end
      where id = v_existing;
    else
      insert into public.grocery_items (household_id, name, quantity, unit, aisle, recipe_id, added_by, sort_key)
      values (
        v_household, v_name, v_qty, v_unit,
        coalesce((v_item ->> 'aisle')::public.aisle,
                 (select c.default_aisle from public.ingredient_catalog c where c.name = v_name),
                 'other'),
        (v_item ->> 'recipe_id')::uuid,
        auth.uid(),
        extract(epoch from now())
      );
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.clear_checked_items()
returns int
language sql security definer set search_path = ''
as $$
  with cleared as (
    update public.grocery_items set cleared_at = now()
    where household_id = public.my_household_id()
      and checked_at is not null and cleared_at is null
    returning 1
  )
  select count(*)::int from cleared;
$$;

-- ---------------------------------------------------------------------------
-- Scheduled prompts ("Eating in tonight?" and the reminder). Run every few
-- minutes by pg_cron; each household gets each push at most once per local day.
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_due_prompts()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_h record;
  v_count int := 0;
  v_members uuid[];
begin
  for v_h in
    select h.*, (now() at time zone h.timezone) as local_ts
    from public.households h
  loop
    -- Only on cook-at-home days.
    continue when not exists (
      select 1 from public.plan_days p
      where p.household_id = v_h.id
        and p.weekday = extract(isodow from v_h.local_ts)
        and p.cook_at_home);

    select array_agg(user_id) into v_members from public.household_members where household_id = v_h.id;

    if v_h.local_ts::time >= v_h.prompt_time
       and v_h.local_ts::time < v_h.prompt_time + interval '2 hours'
       and v_h.last_prompt_on is distinct from v_h.local_ts::date
       and not exists (select 1 from public.decks d
                       where d.household_id = v_h.id and d.for_date = v_h.local_ts::date) then
      perform public.enqueue_push(v_members, 'prompt', '{}'::jsonb);
      update public.households set last_prompt_on = v_h.local_ts::date where id = v_h.id;
      v_count := v_count + 1;
    end if;

    if v_h.local_ts::time >= v_h.reminder_time
       and v_h.local_ts::time < v_h.reminder_time + interval '2 hours'
       and v_h.last_reminder_on is distinct from v_h.local_ts::date
       and not exists (select 1 from public.meals m
                       where m.household_id = v_h.id and m.for_date = v_h.local_ts::date) then
      perform public.enqueue_push(v_members, 'reminder', '{}'::jsonb);
      update public.households set last_reminder_on = v_h.local_ts::date where id = v_h.id;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.enqueue_due_prompts() from public, anon, authenticated;

create or replace function public.purge_expired_invites()
returns int
language sql security definer set search_path = ''
as $$
  with gone as (
    delete from public.invites
    where used_by is null and expires_at < now() - interval '1 day'
    returning 1
  )
  select count(*)::int from gone;
$$;
revoke execute on function public.purge_expired_invites() from public, anon, authenticated;
