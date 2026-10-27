// Sends queued pushes (public.push_outbox) as Web Push. Called every minute by
// pg_cron with the CRON_SECRET; not callable by app users.
// Secrets: CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)

import webpush from 'npm:web-push@3.6.7';
import { json, serviceClient } from '../_shared/http.ts';
import { pushMessage } from '../_shared/push-messages.ts';

const BATCH = 100;

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('Authorization') !== `Bearer ${secret}`) {
    return json({ error: 'forbidden' }, 403);
  }
  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  );
  const admin = serviceClient();

  const { data: pending, error } = await admin.from('push_outbox')
    .select('id, user_id, kind, payload, created_at')
    .is('sent_at', null).order('created_at').limit(BATCH);
  if (error) return json({ error: error.message }, 500);
  if (!pending?.length) return json({ sent: 0 });

  const users = [...new Set(pending.map((p) => p.user_id))];
  const [{ data: subs }, { data: profiles }] = await Promise.all([
    admin.from('push_subscriptions').select('endpoint, user_id, p256dh, auth').in('user_id', users),
    admin.from('profiles').select('id, locale').in('id', users),
  ]);
  const localeOf = new Map((profiles ?? []).map((p) => [p.id, p.locale]));

  let sent = 0;
  const gone = new Set<string>();
  for (const item of pending) {
    // Stale prompts are not worth sending.
    const stale = Date.now() - Date.parse(item.created_at) > 2 * 3_600_000;
    const msg = stale ? null : pushMessage(item.kind, localeOf.get(item.user_id) ?? 'en', item.payload ?? {});
    const targets = (subs ?? []).filter((s) => s.user_id === item.user_id && !gone.has(s.endpoint));
    let lastError: string | null = null;
    if (msg) {
      for (const s of targets) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ ...msg, tag: item.kind }),
            { TTL: 3600, urgency: 'high' },
          );
          sent += 1;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.add(s.endpoint);
          else lastError = String(e);
        }
      }
    }
    await admin.from('push_outbox')
      .update({ sent_at: new Date().toISOString(), error: stale ? 'stale' : lastError })
      .eq('id', item.id);
  }
  if (gone.size) await admin.from('push_subscriptions').delete().in('endpoint', [...gone]);
  return json({ sent, processed: pending.length });
});
