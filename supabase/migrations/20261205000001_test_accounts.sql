-- Test accounts: sign in and go through onboarding again, as often as you
-- like, without making new accounts. Every sign-in of an account listed here
-- wipes what it set up, so it lands on onboarding with a fresh household:
--   * a household whose members are all test accounts is deleted, with
--     everything in it (recipes, decks, lists, plan, invites…);
--   * a real household it joined is only left (its own rows go, nobody
--     else's);
--   * its goals, tastes, allergies, signals, swipes and notifications go;
--   * onboarded_at goes back to null. Its first name stays.
-- Runs on the server when Supabase Auth records the session, before the app
-- gets it, so the app never sees the old household. A token refresh is not a
-- sign-in and doesn't reset. Add an account with:
--   insert into public.test_accounts (user_id)
--   select id from auth.users where email = '…';

create table if not exists public.test_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
-- Not readable or writable from the app: managed in SQL only.
alter table public.test_accounts enable row level security;

create or replace function public.reset_test_account(p_user uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.test_accounts where user_id = p_user) then
    return false;
  end if;

  -- Households made only of test accounts go entirely (rows cascade).
  delete from public.households h
  where exists (select 1 from public.household_members m where m.household_id = h.id and m.user_id = p_user)
    and not exists (
      select 1 from public.household_members m
      where m.household_id = h.id and m.user_id not in (select user_id from public.test_accounts));
  -- From a real household, just leave.
  delete from public.household_members where user_id = p_user;

  delete from public.member_goals where user_id = p_user;
  delete from public.taste_rules where user_id = p_user;
  delete from public.learned_patterns where user_id = p_user;
  delete from public.member_allergies where user_id = p_user;
  delete from public.taste_signals where user_id = p_user;
  delete from public.swipes where user_id = p_user;
  delete from public.member_portions where user_id = p_user;
  delete from public.deck_members where user_id = p_user;
  delete from public.invites where created_by = p_user;
  delete from public.push_subscriptions where user_id = p_user;
  delete from public.push_outbox where user_id = p_user;
  delete from public.grocery_add_batches where user_id = p_user;
  delete from public.grocery_presence where user_id = p_user;

  update public.profiles set onboarded_at = null where id = p_user;
  return true;
end;
$$;
revoke execute on function public.reset_test_account(uuid) from public, anon, authenticated;

create or replace function public.reset_test_account_on_sign_in()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Cheap exit for everyone else; and a reset that fails must never block a sign-in.
  if exists (select 1 from public.test_accounts where user_id = new.user_id) then
    begin
      perform public.reset_test_account(new.user_id);
    exception when others then
      raise warning 'reset_test_account(%) failed: %', new.user_id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;
revoke execute on function public.reset_test_account_on_sign_in() from public, anon, authenticated;

drop trigger if exists reset_test_account_on_sign_in on auth.sessions;
create trigger reset_test_account_on_sign_in
  after insert on auth.sessions
  for each row execute function public.reset_test_account_on_sign_in();
