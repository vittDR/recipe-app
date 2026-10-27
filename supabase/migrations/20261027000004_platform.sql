-- Supabase platform pieces: recipe image storage and scheduled jobs.
-- Guarded so the migrations also apply to a plain Postgres used in tests.

-- Recipe images live in a private bucket under <household_id>/<file>.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public)
    values ('recipe-images', 'recipe-images', false)
    on conflict (id) do nothing;

    execute $p$
      create policy recipe_images_read on storage.objects for select to authenticated
      using (bucket_id = 'recipe-images'
             and public.is_member(((storage.foldername(name))[1])::uuid))
    $p$;
    execute $p$
      create policy recipe_images_write on storage.objects for insert to authenticated
      with check (bucket_id = 'recipe-images'
                  and public.is_member(((storage.foldername(name))[1])::uuid))
    $p$;
    execute $p$
      create policy recipe_images_delete on storage.objects for delete to authenticated
      using (bucket_id = 'recipe-images'
             and public.is_member(((storage.foldername(name))[1])::uuid))
    $p$;
  end if;
end;
$$;

-- Scheduled jobs (pg_cron). Enable the pg_cron and pg_net extensions in the
-- dashboard first (Database > Extensions). push-dispatch is called through
-- pg_net; its URL and secret are read from Vault (see supabase/README.md).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net;

    perform cron.schedule('dineamite-prompts', '*/5 * * * *',
      'select public.enqueue_due_prompts()');
    perform cron.schedule('dineamite-purge-invites', '17 3 * * *',
      'select public.purge_expired_invites()');
    perform cron.schedule('dineamite-push-dispatch', '* * * * *', $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'push_dispatch_url'),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' ||
            (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
        body := '{}'::jsonb)
      where exists (select 1 from public.push_outbox where sent_at is null)
    $job$);
  end if;
end;
$$;
