import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

/**
 * Calls an edge function as the signed-in user; throws with the function's error code.
 * `timeout` (ms) gives up on a stalled request instead of waiting out the platform's limit.
 */
export async function callFunction<T>(name: string, body: Record<string, unknown>, timeout?: number): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body, timeout });
  if (error) {
    let code = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      const payload = await ctx.json().catch(() => null);
      if (payload?.error) code = payload.error;
    }
    throw new Error(code);
  }
  return data as T;
}

/** Throws on a Supabase error so callers can use try/catch. */
export function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}
