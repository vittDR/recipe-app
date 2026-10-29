-- The seed library has two Poulet basquaise: the French one from Chef Simon
-- goes, the AI-generated English one stays. Households' own copies stay
-- (copied_from is cleared); the seed recipe's swipes and deck cards go with it.
delete from public.recipes
where household_id is null
  and source_url = 'https://chefsimon.com/gourmets/chef-simon/recettes/poulet-basquaise--17';
