-- One household's "Frequently bought" list, cleaned up from a phone note:
-- names mapped to catalogue products, duplicates merged (the count is how
-- many times the item appeared), Picard items put in a "Picard" store.
--
-- Run in SQL Editor after the migrations and seed.sql. Put the email of
-- someone in the household on the line marked EDIT. Safe to re-run.

do $$
declare
  v_email text := 'you@example.com'; -- EDIT
  v_household uuid;
  v_picard uuid;
  v_missing text;
begin
  select m.household_id into v_household
  from public.household_members m join auth.users u on u.id = m.user_id
  where lower(u.email) = lower(v_email);
  if v_household is null then
    raise exception 'No household for %', v_email;
  end if;

  insert into public.household_stores (household_id, name, position)
  select v_household, 'Picard', 1 + greatest(
    (select coalesce(max(position), 0) from public.household_aisle_order where household_id = v_household),
    (select coalesce(max(position), 0) from public.household_stores where household_id = v_household))
  where not exists (select 1 from public.household_stores where household_id = v_household and lower(name) = 'picard');
  select id into v_picard from public.household_stores where household_id = v_household and lower(name) = 'picard';

  create temp table frequent_items (name text, times int, picard boolean) on commit drop;
  insert into frequent_items values
    ('Framboises', 2, true),
    ('Escalopes de poulet', 1, true),
    ('haricots verts', 1, true),
    ('Crevettes décortiquées', 1, true),
    ('Croustibat', 1, true),
    ('petits pois surgelés', 1, true),
    ('Choux de Bruxelles', 1, true),
    ('chou-fleur', 1, false),
    ('œufs', 4, false),
    ('Skyr de brebis', 1, false),
    ('blanc de poulet', 2, false),
    ('tomates cerises', 1, false),
    ('concombre', 3, false),
    ('Fruits', 2, false),
    ('sauce soja', 2, false),
    ('Chocolat', 2, false),
    ('riz', 3, false),
    ('pain', 5, false),
    ('Serviettes en papier', 1, false),
    ('Boissons', 1, false),
    ('Grissini', 1, false),
    ('basilic', 1, false),
    ('aubergine', 1, false),
    ('courgette', 2, false),
    ('Recharge savon mains', 2, false),
    ('Café', 4, false),
    ('Essuie-tout', 2, false),
    ('feta', 1, false),
    ('Butternut', 1, false),
    ('Mâche', 1, false),
    ('Wasa Fibres', 3, false),
    ('Cotons démaquillants', 1, false),
    ('Babybel', 1, false),
    ('Liquide vaisselle', 3, false),
    ('carotte', 1, false),
    ('pavé de saumon', 1, false),
    ('citron', 1, false),
    ('Papier toilette', 2, false),
    ('Café décaféiné', 1, false),
    ('sel', 1, false),
    ('Lessive', 1, false),
    ('Shampoing', 1, false),
    ('Tablettes lave-vaisselle', 2, false),
    ('Scotch', 1, false),
    ('Éponges', 1, false),
    ('Papier sulfurisé', 1, false),
    ('Gommage', 1, false),
    ('Sacs poubelle', 1, false),
    ('Crème pour le corps', 1, false),
    ('quinoa', 1, false),
    ('Poulet au citron', 1, false),
    ('Lait d''avoine', 1, false),
    ('Sardines', 1, false),
    ('Lentilles', 1, false),
    ('huile d''olive', 1, false),
    ('Lingettes humides', 2, false),
    ('Tisane', 1, false),
    ('Dentifrice', 1, false),
    ('vinaigre', 1, false),
    ('thon', 2, false),
    ('pomme', 1, false),
    ('crème fraîche', 1, false),
    ('bouillon de volaille', 1, false),
    ('Purée', 1, false),
    ('Soupe', 1, false),
    ('Sojasun', 1, false);

  select string_agg(f.name, ', ') into v_missing from frequent_items f
  where not exists (select 1 from public.products p
                    where p.household_id is null and p.search_key = public.product_key(f.name));
  if v_missing is not null then
    raise exception 'Not in the product catalogue (run seed.sql first?): %', v_missing;
  end if;

  insert into public.household_products (household_id, product_id, store_id, add_count, pinned, hidden)
  select v_household, p.id, case when f.picard then v_picard end, f.times, true, false
  from frequent_items f
  join public.products p on p.household_id is null and p.search_key = public.product_key(f.name)
  on conflict (household_id, product_id) do update
    set pinned = true, hidden = false,
        store_id = coalesce(excluded.store_id, public.household_products.store_id),
        add_count = greatest(public.household_products.add_count, excluded.add_count);
end;
$$;
