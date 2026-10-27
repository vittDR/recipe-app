-- ---------------------------------------------------------------------------
-- Scheduled prompts: fix windows that cross midnight.
--
-- The 2-hour window used to be checked on `time` values, and `time + interval`
-- wraps at midnight, so a prompt or reminder set after 22:00 never fired. The
-- window is now anchored to the most recent local occurrence of the slot time
-- (today's, or yesterday's if today's is still ahead). That slot's date is the
-- "local day" used for the cook-day check, the once-per-day markers
-- (last_prompt_on, last_reminder_on) and the deck/meal lookups, so a 23:30
-- prompt that goes out at 00:10 still counts for the evening it belongs to.
--
-- p_now lets tests pin the clock; pg_cron keeps calling it with no argument.
-- ---------------------------------------------------------------------------

drop function if exists public.enqueue_due_prompts();

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
       and exists (select 1 from public.plan_days p
                   where p.household_id = v_h.id
                     and p.weekday = extract(isodow from v_day)
                     and p.cook_at_home)
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
       and exists (select 1 from public.plan_days p
                   where p.household_id = v_h.id
                     and p.weekday = extract(isodow from v_day)
                     and p.cook_at_home)
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
