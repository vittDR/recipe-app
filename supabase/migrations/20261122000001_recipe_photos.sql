-- Photos added to a typed recipe. The phone shrinks them to 900x675 WebP
-- (like the seed photos) and uploads them to a public bucket under
-- <household_id>/<random id>.webp: public so the image and the service
-- worker's cache work without a signed URL, unguessable names so nobody
-- finds another household's photo. Only household members add or remove
-- their own household's files.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('recipe-photos', 'recipe-photos', true, 1048576, array['image/webp', 'image/jpeg'])
    on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

    drop policy if exists recipe_photos_write on storage.objects;
    drop policy if exists recipe_photos_delete on storage.objects;
    execute $p$
      create policy recipe_photos_write on storage.objects for insert to authenticated
      with check (bucket_id = 'recipe-photos'
                  and ((storage.foldername(name))[1]) = (select public.my_household_id())::text)
    $p$;
    execute $p$
      create policy recipe_photos_delete on storage.objects for delete to authenticated
      using (bucket_id = 'recipe-photos'
             and ((storage.foldername(name))[1]) = (select public.my_household_id())::text)
    $p$;
  end if;
end;
$$;
