-- The prompt and reminder windows (2 hours from their time) can cross
-- midnight: a 22:30 reminder runs until 00:30. Adding an interval to a time
-- wraps, so such windows never matched. Windows are now worked out on
-- timestamps, and a window that started yesterday counts for yesterday's
-- cook day.
create or replace function public.enqueue_due_prompts()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_h record;
  v_count int := 0;
  v_members uuid[];
  v_kind text;
  v_start timestamp;
  v_day date;
begin
  for v_h in
    select h.*, (now() at time zone h.timezone) as local_ts
    from public.households h
  loop
    foreach v_kind in array array['prompt', 'reminder'] loop
      -- The latest window start at or before now.
      v_start := v_h.local_ts::date + case v_kind when 'prompt' then v_h.prompt_time else v_h.reminder_time end;
      if v_start > v_h.local_ts then
        v_start := v_start - interval '1 day';
      end if;
      continue when v_h.local_ts >= v_start + interval '2 hours';
      v_day := v_start::date;

      -- Only on cook-at-home days, once per day.
      continue when not exists (
        select 1 from public.plan_days p
        where p.household_id = v_h.id and p.weekday = extract(isodow from v_day) and p.cook_at_home);
      continue when (case v_kind when 'prompt' then v_h.last_prompt_on else v_h.last_reminder_on end)
                    is not distinct from v_day;
      -- Prompt until a deck is dealt; remind until a meal is planned.
      continue when v_kind = 'prompt' and exists (
        select 1 from public.decks d where d.household_id = v_h.id and d.for_date = v_day);
      continue when v_kind = 'reminder' and exists (
        select 1 from public.meals m where m.household_id = v_h.id and m.for_date = v_day);

      select array_agg(user_id) into v_members from public.household_members where household_id = v_h.id;
      perform public.enqueue_push(v_members, v_kind, '{}'::jsonb);
      if v_kind = 'prompt' then
        update public.households set last_prompt_on = v_day where id = v_h.id;
      else
        update public.households set last_reminder_on = v_day where id = v_h.id;
      end if;
      v_count := v_count + 1;
    end loop;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.enqueue_due_prompts() from public, anon, authenticated;
