-- ---------------------------------------------------------------------------
-- Groceries for planned meals: remember when a meal's ingredients went to the
-- list, so Ce soir's groceries card only counts the meals not sent yet.
-- A new dish for the evening (a later match, or a recipe swapped by hand)
-- needs its own shop, so changing recipe_id clears it.
-- ---------------------------------------------------------------------------

alter table public.meals add column listed_at timestamptz;

create or replace function public.meals_reset_listed()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.recipe_id is distinct from old.recipe_id and new.listed_at is not distinct from old.listed_at then
    new.listed_at := null;
  end if;
  return new;
end;
$$;

create trigger meals_reset_listed before update of recipe_id on public.meals
  for each row execute function public.meals_reset_listed();
