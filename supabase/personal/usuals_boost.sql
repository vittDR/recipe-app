-- One household's usuals, given a head start: the 30 items that came up most
-- in the phone note (see frequent_items.sql), each written as 8 to 10 past
-- shops, so Usuals shows them at the top right away. Usuals halve every month
-- (logic/usuals.ts), so real shopping takes over within a few weeks.
--
-- The made-up shops are a week apart, the last one 1 to 6 days ago, top of
-- the list most recent: they keep this order and don't all come due the same
-- day. Their check-off time is put before the 14-day "probably at home"
-- window, so recipes still ask for them.
--
-- Run in SQL Editor after the migrations and seed.sql. Put the email of
-- someone in the household on the line marked EDIT. Safe to re-run: it
-- replaces the shops it wrote before (sort_key = -1).

do $$
declare
  v_email text := 'you@example.com'; -- EDIT
  v_household uuid;
  v_missing text;
begin
  select m.household_id into v_household
  from public.household_members m join auth.users u on u.id = m.user_id
  where lower(u.email) = lower(v_email);
  if v_household is null then
    raise exception 'No household for %', v_email;
  end if;

  -- Name in the catalogue, shops to write (10 = in the note 3+ times, 9 = twice, 8 = once).
  create temp table usual_items (pos int, name text, times int) on commit drop;
  insert into usual_items values
    (1, 'pain', 10),
    (2, 'œufs', 10),
    (3, 'Café', 10),
    (4, 'concombre', 10),
    (5, 'riz', 10),
    (6, 'Wasa Fibres', 10),
    (7, 'Liquide vaisselle', 10),
    (8, 'blanc de poulet', 9),
    (9, 'Framboises', 9),
    (10, 'Fruits', 9),
    (11, 'sauce soja', 9),
    (12, 'Chocolat', 9),
    (13, 'courgette', 9),
    (14, 'thon', 9),
    (15, 'Essuie-tout', 9),
    (16, 'Papier toilette', 9),
    (17, 'Tablettes lave-vaisselle', 9),
    (18, 'Lingettes humides', 9),
    (19, 'Recharge savon mains', 9),
    (20, 'Skyr de brebis', 8),
    (21, 'tomates cerises', 8),
    (22, 'feta', 8),
    (23, 'Mâche', 8),
    (24, 'carotte', 8),
    (25, 'citron', 8),
    (26, 'pavé de saumon', 8),
    (27, 'Lait d''avoine', 8),
    (28, 'Babybel', 8),
    (29, 'Sojasun', 8),
    (30, 'Escalopes de poulet', 8);

  select string_agg(f.name, ', ') into v_missing from usual_items f
  where not exists (select 1 from public.products p
                    where p.household_id is null and p.search_key = public.product_key(f.name));
  if v_missing is not null then
    raise exception 'Not in the product catalogue (run seed.sql first?): %', v_missing;
  end if;

  delete from public.grocery_items
  where household_id = v_household and sort_key = -1 and cleared_at is not null;

  insert into public.grocery_items
    (household_id, product_id, name, quantity, unit, aisle, store_id,
     checked_at, cleared_at, sort_key, created_at)
  select v_household, p.id, p.name_fr, p.default_qty, p.default_unit,
         coalesce(hp.aisle, p.default_aisle), hp.store_id,
         shop.at - interval '15 days', shop.at, -1, shop.at - interval '15 days 1 hour'
  from usual_items f
  join public.products p on p.household_id is null and p.search_key = public.product_key(f.name)
  left join public.household_products hp on hp.household_id = v_household and hp.product_id = p.id
  cross join lateral (
    select date_trunc('day', now()) + interval '18 hours'
           - make_interval(days => 1 + (f.pos - 1) / 5 + 7 * n) as at
    from generate_series(0, f.times - 1) n
  ) shop;
end;
$$;
