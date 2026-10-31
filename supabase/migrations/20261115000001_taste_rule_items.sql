-- Love / never rules are catalogue items, and only that. Recipe tags (moods
-- and dishes: "curry", "soup") are not rules: liking or avoiding one is a
-- learned preference that weighs on the deck ("Show more" / "Show less").

-- Older free-text rules that name an item become that item's rule.
update public.taste_rules r
set product_id = public.find_product(
  (select m.household_id from public.household_members m where m.user_id = r.user_id limit 1), r.value)
where r.kind in ('never', 'love')
  and r.product_id is null
  and not exists (select 1 from public.tag_catalog t where t.kind = 'tag' and t.name = lower(trim(r.value)));

-- Rules on a tag become accepted preferences on it, at full weight.
insert into public.learned_patterns (user_id, pattern, status, weight)
select r.user_id,
       jsonb_build_object('kind', case r.kind when 'never' then 'avoid' else 'prefer' end, 'value', lower(trim(r.value))),
       'accepted',
       case r.kind when 'never' then -1 else 1 end
from public.taste_rules r
where r.kind in ('never', 'love') and r.product_id is null
  and exists (select 1 from public.tag_catalog t where t.kind = 'tag' and t.name = lower(trim(r.value)))
on conflict (user_id, (pattern)) do update set status = 'accepted', weight = excluded.weight, updated_at = now();

-- What is left names neither an item nor a tag; and one rule per item.
delete from public.taste_rules where kind in ('never', 'love') and product_id is null;
delete from public.taste_rules r using public.taste_rules s
where r.user_id = s.user_id and r.kind = s.kind and r.product_id = s.product_id
  and (r.created_at, r.id) > (s.created_at, s.id);

alter table public.taste_rules add constraint taste_rules_item check ((kind = 'diet') = (product_id is null));
create unique index taste_rules_one_per_item on public.taste_rules (user_id, kind, product_id) where product_id is not null;
