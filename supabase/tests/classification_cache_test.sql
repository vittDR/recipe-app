-- The stored classification goes stale when the recipe or its ingredients change.
\set ON_ERROR_STOP on
create or replace function pg_temp.check(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FAILED: %', p_msg; end if;
  raise notice 'ok - %', p_msg;
end $$;

select id as rid from recipes where household_id is null order by title limit 1 \gset
select store_classifications(jsonb_build_array(jsonb_build_object('id', :'rid', 'classification', '{"version":1}'::jsonb, 'classified_with', 'v1')));
select pg_temp.check((select classification is not null and classified_with = 'v1' from recipes where id = :'rid'), 'stored');
update recipes set image_path = image_path where id = :'rid';
select pg_temp.check((select classification is not null from recipes where id = :'rid'), 'a photo change keeps it');
update recipes set total_min = coalesce(total_min, 30) + 1 where id = :'rid';
select pg_temp.check((select classification is null and classified_with is null from recipes where id = :'rid'), 'a recipe change clears it');
select store_classifications(jsonb_build_array(jsonb_build_object('id', :'rid', 'classification', '{"version":1}'::jsonb, 'classified_with', 'v1')));
update recipe_ingredients set quantity = quantity where id = (select id from recipe_ingredients where recipe_id = :'rid' limit 1);
select pg_temp.check((select classification is null from recipes where id = :'rid'), 'an ingredient change clears it');
update recipes set total_min = total_min - 1 where id = :'rid';
