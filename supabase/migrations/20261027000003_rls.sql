-- Row-level security. Rule of thumb: household data is readable and writable
-- by members; personal goals, taste rules and patterns only by their owner.
-- Anything that must be computed from another member's private numbers goes
-- through a security definer function that returns booleans only.

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.invites enable row level security;
alter table public.member_goals enable row level security;
alter table public.taste_rules enable row level security;
alter table public.learned_patterns enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.ingredient_catalog enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.ai_cache enable row level security;
alter table public.decks enable row level security;
alter table public.deck_cards enable row level security;
alter table public.member_portions enable row level security;
alter table public.deck_members enable row level security;
alter table public.swipes enable row level security;
alter table public.tiebreak_picks enable row level security;
alter table public.meals enable row level security;
alter table public.plan_days enable row level security;
alter table public.grocery_items enable row level security;
alter table public.household_staples enable row level security;
alter table public.household_aisle_order enable row level security;
alter table public.push_outbox enable row level security;

-- profiles: self write; household members read name + color.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_household(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- households: members read and edit settings; owner deletes. Created via create_household().
create policy households_select on public.households for select to authenticated
  using (public.is_member(id));
create policy households_update on public.households for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));
create policy households_delete on public.households for delete to authenticated
  using (owner_id = auth.uid());
-- Members edit settings only; ownership changes via leave_household() and the
-- scheduler's bookkeeping columns are server-only. (A column-level revoke would
-- not override the table-level grant, so grant the editable columns instead.)
revoke update on public.households from anon, authenticated;
grant update (name, timezone, store_name, prompt_time, reminder_time) on public.households to authenticated;

-- household_members: members read. Changes go through RPCs.
create policy members_select on public.household_members for select to authenticated
  using (public.is_member(household_id));

-- invites: the creator reads; redeemed via redeem_invite().
create policy invites_select on public.invites for select to authenticated
  using (created_by = auth.uid());

-- Private per-person data.
create policy goals_all on public.member_goals for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy taste_all on public.taste_rules for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy patterns_all on public.learned_patterns for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_subscriptions_all on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ingredient_catalog: read all.
create policy catalog_select on public.ingredient_catalog for select to authenticated using (true);

-- recipes: members + seed read; members write their household's own recipes.
create policy recipes_select on public.recipes for select to authenticated
  using (household_id is null or public.is_member(household_id));
create policy recipes_insert on public.recipes for insert to authenticated
  with check (household_id is not null and public.is_member(household_id));
create policy recipes_update on public.recipes for update to authenticated
  using (household_id is not null and public.is_member(household_id))
  with check (household_id is not null and public.is_member(household_id));
create policy recipes_delete on public.recipes for delete to authenticated
  using (household_id is not null and public.is_member(household_id));

create policy ingredients_select on public.recipe_ingredients for select to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id
                 and (r.household_id is null or public.is_member(r.household_id))));
create policy ingredients_write on public.recipe_ingredients for all to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id
                 and r.household_id is not null and public.is_member(r.household_id)))
  with check (exists (select 1 from public.recipes r where r.id = recipe_id
                      and r.household_id is not null and public.is_member(r.household_id)));

-- ai_cache and push_outbox: service role only (no policies).

-- decks: members read; dealt by the deal-deck function (service role).
create policy decks_select on public.decks for select to authenticated
  using (public.is_member(household_id));

create policy deck_cards_select on public.deck_cards for select to authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id and public.is_member(d.household_id)));

-- member_portions: self only.
create policy portions_select on public.member_portions for select to authenticated
  using (user_id = auth.uid());

-- deck_members: progress counts are visible to the household.
create policy deck_members_select on public.deck_members for select to authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id and public.is_member(d.household_id)));

-- swipes: own write while the deck is open; others' verdicts become visible
-- only once the reader has finished, so nobody is influenced mid-swipe.
create policy swipes_select on public.swipes for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.decks d
      join public.deck_members me on me.deck_id = d.id and me.user_id = auth.uid()
      where d.id = deck_id and public.is_member(d.household_id) and me.finished_at is not null
    )
  );
create policy swipes_insert on public.swipes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.decks d
      join public.deck_cards c on c.deck_id = d.id and c.recipe_id = swipes.recipe_id
      where d.id = deck_id and d.status = 'open'
        and auth.uid() = any (d.who_eating)
        and public.is_member(d.household_id)
    )
  );

-- tiebreak_picks: members read; own pick from the three options while in tie-break.
create policy picks_select on public.tiebreak_picks for select to authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id and public.is_member(d.household_id)));
create policy picks_insert on public.tiebreak_picks for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.decks d where d.id = deck_id and d.status = 'tiebreak'
                and auth.uid() = any (d.who_eating))
    and exists (select 1 from public.tiebreak_options(deck_id) o where o.recipe_id = tiebreak_picks.recipe_id)
  );
create policy picks_update on public.tiebreak_picks for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.decks d where d.id = deck_id and d.status = 'tiebreak')
    and exists (select 1 from public.tiebreak_options(deck_id) o where o.recipe_id = tiebreak_picks.recipe_id)
  );

-- Household-scoped tables: members do everything.
create policy meals_all on public.meals for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy plan_days_all on public.plan_days for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy grocery_all on public.grocery_items for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy staples_all on public.household_staples for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy aisle_order_all on public.household_aisle_order for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

-- Function privileges: keep internal helpers away from clients.
revoke execute on function public.random_invite_code() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.deck_mutual_yes(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: both phones see list, deck and tie-break changes live.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.grocery_items, public.decks, public.deck_members, public.tiebreak_picks, public.meals;
  end if;
end;
$$;
