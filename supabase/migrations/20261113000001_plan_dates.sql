-- ---------------------------------------------------------------------------
-- This week: cook-at-home days set per date.
--
-- plan_days stays the usual week (one row per weekday). plan_dates holds the
-- days someone set on the "This week" screen; a date with no row follows the
-- usual week, and a weekday with no row counts as a cook day.
-- is_cook_day() is the one place that rule lives, used by the scheduler.
-- ---------------------------------------------------------------------------

create table public.plan_dates (
  household_id uuid not null references public.households (id) on delete cascade,
  for_date date not null,
  cook_at_home boolean not null,
  primary key (household_id, for_date)
);

alter table public.plan_dates enable row level security;
create policy plan_dates_all on public.plan_dates for all to authenticated
  using (household_id = (select public.my_household_id())) with check (household_id = (select public.my_household_id()));

create or replace function public.is_cook_day(p_household uuid, p_day date)
returns boolean
language sql stable set search_path = ''
as $$
  select coalesce(
    (select d.cook_at_home from public.plan_dates d where d.household_id = p_household and d.for_date = p_day),
    (select p.cook_at_home from public.plan_days p
     where p.household_id = p_household and p.weekday = extract(isodow from p_day)),
    true);
$$;
revoke execute on function public.is_cook_day(uuid, date) from public, anon, authenticated;

create or replace function public.enqueue_due_prompts(p_now timestamptz default now())
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_h record;
  v_count int := 0;
  v_members uuid[];
  v_slot timestamp;
  v_day date;
begin
  for v_h in
    select h.*, (p_now at time zone h.timezone) as local_ts
    from public.households h
  loop
    select array_agg(user_id) into v_members from public.household_members where household_id = v_h.id;

    v_slot := v_h.local_ts::date + v_h.prompt_time;
    if v_slot > v_h.local_ts then v_slot := v_slot - interval '1 day'; end if;
    v_day := v_slot::date;
    if v_h.local_ts < v_slot + interval '2 hours'
       and v_h.last_prompt_on is distinct from v_day
       -- Only on cook-at-home days.
       and public.is_cook_day(v_h.id, v_day)
       and not exists (select 1 from public.decks d
                       where d.household_id = v_h.id and d.for_date = v_day) then
      perform public.enqueue_push(v_members, 'prompt', '{}'::jsonb);
      update public.households set last_prompt_on = v_day where id = v_h.id;
      v_count := v_count + 1;
    end if;

    v_slot := v_h.local_ts::date + v_h.reminder_time;
    if v_slot > v_h.local_ts then v_slot := v_slot - interval '1 day'; end if;
    v_day := v_slot::date;
    if v_h.local_ts < v_slot + interval '2 hours'
       and v_h.last_reminder_on is distinct from v_day
       and public.is_cook_day(v_h.id, v_day)
       and not exists (select 1 from public.meals m
                       where m.household_id = v_h.id and m.for_date = v_day) then
      perform public.enqueue_push(v_members, 'reminder', '{}'::jsonb);
      update public.households set last_reminder_on = v_day where id = v_h.id;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.enqueue_due_prompts(timestamptz) from public, anon, authenticated;

-- Both phones see a day switched on or off at once.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.plan_dates;
  end if;
end;
$$;
