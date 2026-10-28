-- A "Hygiène et beauté" aisle for shampoo, toothpaste and the like, between
-- drinks and household. Its own migration: a new enum value can't be used in
-- the transaction that adds it.

alter type public.aisle add value if not exists 'hygiene' before 'household';
