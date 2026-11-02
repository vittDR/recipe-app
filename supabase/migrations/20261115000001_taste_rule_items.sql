-- Love / never rules are catalogue items, and only that. Recipe tags (moods
-- and dishes: "curry", "soup") are not rules: liking or avoiding one is a
-- learned preference that weighs on the deck ("Show more" / "Show less").

-- Offal is a catalogue item (seed.sql has the same row), so a "never abats"
-- rule has an item to name.
insert into public.ingredient_catalog
  (id, name, name_fr, name_it, aliases, default_aisle, is_staple, kcal_100g, protein_100g, grams_per_unit, diet_class)
values ('f4038739-756a-4f05-9d3f-ae7eb7991d0c', 'offal', 'abats', 'frattaglie',
        '{abat}', 'meat_fish', false, 135, 20, 100, 'meat')
on conflict (name) do nothing;
select public.sync_products_from_catalog();

-- Older free-text rules, sorted into the recipe tag they name (any language
-- or alias: "soupe" is the soup tag) or else the item they name.
create temporary table rule_targets as
select r.id, r.user_id, r.kind, (public.find_tag(m.household_id, r.value)).name as tag,
       (public.find_tag(m.household_id, r.value)).kind as tag_kind,
       public.find_product(m.household_id, r.value) as product_id
from public.taste_rules r
left join public.household_members m on m.user_id = r.user_id
where r.kind in ('never', 'love') and r.product_id is null;

-- Rules on a tag become accepted preferences on it, at full weight.
insert into public.learned_patterns (user_id, pattern, status, weight)
select distinct on (t.user_id, t.kind, t.tag) t.user_id,
       jsonb_build_object('kind', case t.kind when 'never' then 'avoid' else 'prefer' end, 'value', t.tag),
       'accepted'::public.pattern_status,
       case t.kind when 'never' then -1 else 1 end
from rule_targets t
where t.tag_kind = 'tag'
on conflict (user_id, (pattern)) do update set status = 'accepted', weight = excluded.weight, updated_at = now();

-- The others that name an item become that item's rule.
update public.taste_rules r set product_id = t.product_id
from rule_targets t
where t.id = r.id and t.tag_kind is distinct from 'tag' and t.product_id is not null;

-- What is left names neither an item nor a tag; and one rule per item.
delete from public.taste_rules where kind in ('never', 'love') and product_id is null;
delete from public.taste_rules r using public.taste_rules s
where r.user_id = s.user_id and r.kind = s.kind and r.product_id = s.product_id
  and (r.created_at, r.id) > (s.created_at, s.id);

drop table rule_targets;

alter table public.taste_rules add constraint taste_rules_item check ((kind = 'diet') = (product_id is null));
create unique index taste_rules_one_per_item on public.taste_rules (user_id, kind, product_id) where product_id is not null;
