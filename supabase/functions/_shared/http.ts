// Small helpers shared by the edge functions.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Projects on the newer API keys may not expose the legacy anon / service_role
// keys to functions; SECRET_KEY and PUBLISHABLE_KEY are then set as function
// secrets (the CLI refuses names starting with SUPABASE_).
export function serviceClient(): SupabaseClient {
  const key = Deno.env.get('SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(Deno.env.get('SUPABASE_URL')!, key, {
    auth: { persistSession: false },
  });
}

/** Client acting as the caller, so RLS applies. */
function userClient(req: Request): SupabaseClient {
  const key = Deno.env.get('PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!;
  return createClient(Deno.env.get('SUPABASE_URL')!, key, {
    auth: { persistSession: false },
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
}

export interface Caller {
  userId: string;
  householdId: string;
  db: SupabaseClient; // as the caller
}

export async function requireMember(req: Request): Promise<Caller | Response> {
  const db = userClient(req);
  const { data: auth, error } = await db.auth.getUser();
  if (error || !auth.user) return json({ error: 'not_authenticated' }, 401);
  const { data: householdId } = await db.rpc('my_household_id');
  if (!householdId) return json({ error: 'no_household' }, 403);
  return { userId: auth.user.id, householdId: householdId as string, db };
}
