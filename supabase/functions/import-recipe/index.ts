// Recipe import without AI.
//   { action: 'preview', url }  -> reads the page's schema.org Recipe data and
//                                   returns it for review (nothing is saved).
//   { action: 'save', recipe }   -> normalises ingredients against the
//                                   catalogue, estimates macros from them and
//                                   saves the recipe to the caller's household.
// Pages without structured data return { error: 'no_recipe_data' } and the
// app falls back to typing the recipe in.

import { corsHeaders, json, requireMember, serviceClient, type Caller } from '../_shared/http.ts';
import { extractJsonLdRecipe } from '../_shared/logic/jsonld.ts';
import { DIFFICULTIES, normaliseEquipment, type Difficulty, type Equipment } from '../_shared/logic/facets.ts';
import {
  Catalog, estimateMacros, parseIngredientLine, type CatalogEntry, type NormalisedIngredient,
} from '../_shared/logic/ingredients.ts';
import { productKey } from '../_shared/logic/products.ts';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 3_000_000;
type Source = 'web' | 'instagram' | 'photo' | 'typed' | 'ai';

interface SaveBody {
  title: string;
  source_type?: Source;
  source_url?: string | null;
  image_url?: string | null;
  servings?: number | null;
  total_min?: number | null;
  steps?: string[];
  tags?: string[];
  language?: string | null;
  source_name?: string | null;
  /** Yield the source was written for, when `ingredients` were scaled to `servings`. */
  original_servings?: number | null;
  cuisine?: string | null;
  image_source_url?: string | null;
  difficulty?: Difficulty | null;
  /** { pots, oven, special }: see logic/facets.ts. */
  equipment?: Equipment | null;
  /** Lines as typed or reviewed; `guessed` marks amounts the person was unsure about.
   *  `original_text` is the source's unscaled line, kept for reference only.
   *  `product_id` is the item the person picked or accepted; `new_item` asks for a
   *  new household item even if a name matches. Neither: matched on save. */
  ingredients: {
    text: string; original_text?: string | null; guessed?: boolean;
    product_id?: string | null; new_item?: boolean;
  }[];
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Public http(s) pages only: no localhost or private-network addresses.
function isPublicHttpUrl(s: unknown): s is string {
  try {
    const u = new URL(String(s));
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const h = u.hostname.toLowerCase();
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.includes(':')) return false;
    if (/^(10|127|0)\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    return h.includes('.');
  } catch {
    return false;
  }
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      // Some recipe sites serve JSON-LD only to browser-like agents.
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`fetch_failed_${res.status}`);
  const text = await res.text();
  return text.slice(0, MAX_HTML_BYTES);
}

/** A household item named after the line, or the one it already has with that name. */
async function createItem(caller: Caller, name: string): Promise<string | null> {
  const { data, error } = await caller.db.from('products')
    .insert({ household_id: caller.householdId, name_fr: name, created_by: caller.userId })
    .select('id').single();
  if (!error) return data.id as string;
  // Same name already (any case or accents): use it.
  const { data: own } = await caller.db.from('products').select('id, name_fr').eq('household_id', caller.householdId);
  return (own ?? []).find((p) => productKey(p.name_fr) === productKey(name))?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const caller = await requireMember(req);
  if (caller instanceof Response) return caller;
  const admin = serviceClient();
  const body = await req.json().catch(() => ({}));

  if (body.action === 'preview') {
    if (!isPublicHttpUrl(body.url)) return json({ error: 'bad_url' }, 400);
    const url = String(body.url).trim();
    const hash = await sha256(`jsonld:${url}`);
    const { data: cached } = await admin.from('ai_cache').select('result').eq('input_hash', hash).maybeSingle();
    if (cached) return json({ recipe: cached.result, cached: true });

    let html: string;
    try {
      html = await fetchPage(url);
    } catch (e) {
      return json({ error: 'fetch_failed', detail: String(e) }, 502);
    }
    const extracted = extractJsonLdRecipe(html);
    if (!extracted) return json({ error: 'no_recipe_data' }, 422);
    const isInstagram = /(^|\.)instagram\.com$/i.test(new URL(url).hostname);
    const recipe = { ...extracted, source_url: url, source_type: isInstagram ? 'instagram' : 'web' };
    await admin.from('ai_cache').upsert({ input_hash: hash, kind: 'jsonld', result: recipe });
    return json({ recipe, cached: false });
  }

  if (body.action === 'save') {
    const r = body.recipe as SaveBody | undefined;
    if (!r?.title?.trim() || !Array.isArray(r.ingredients) || r.ingredients.length === 0) {
      return json({ error: 'missing_fields' }, 400);
    }
    const { data: entries } = await admin.from('ingredient_catalog').select('*');
    const catalog = new Catalog((entries ?? []) as CatalogEntry[]);
    const byName = new Map(((entries ?? []) as CatalogEntry[]).map((e) => [e.name, e]));
    const servings = r.servings && r.servings > 0 ? r.servings : 2;
    const lines = r.ingredients.filter((i) => i.text?.trim());

    // Items picked in the app; RLS hides other households' items.
    const ids = [...new Set(lines.map((i) => i.product_id).filter(Boolean))] as string[];
    const { data: picked } = ids.length
      ? await caller.db.from('products').select('id, name_fr, ingredient, default_aisle').in('id', ids)
      : { data: [] };
    const products = new Map((picked ?? []).map((p) => [p.id as string, p]));

    const ingredients: (NormalisedIngredient & { guessed: boolean; original_text: string | null; product_id: string | null })[] = [];
    for (const i of lines) {
      const parsed = parseIngredientLine(i.text);
      const product = i.product_id ? products.get(i.product_id) : undefined;
      let norm: NormalisedIngredient;
      let productId: string | null = product?.id ?? null;
      const entry = product?.ingredient ? byName.get(product.ingredient) : undefined;
      if (entry) {
        norm = { ...parsed, name: entry.name, aisle: entry.default_aisle, is_staple: entry.is_staple, catalog: entry };
      } else if (product) {
        norm = { ...parsed, name: product.name_fr, aisle: product.default_aisle, is_staple: false };
      } else if (i.new_item && parsed.name) {
        norm = { ...parsed, aisle: 'other', is_staple: false };
        productId = await createItem(caller, parsed.name);
      } else {
        norm = catalog.normalise(parsed); // the database links it to an item on insert
      }
      ingredients.push({ ...norm, guessed: !!i.guessed, original_text: i.original_text?.trim() || null, product_id: productId });
    }
    const macros = estimateMacros(ingredients, servings);

    const { data: saved, error } = await caller.db.from('recipes').insert({
      household_id: caller.householdId,
      title: r.title.trim().slice(0, 200),
      source_type: r.source_type ?? (r.source_url ? 'web' : 'typed'),
      source_url: r.source_url ?? null,
      image_path: r.image_url ?? null,
      servings,
      total_min: r.total_min && r.total_min > 0 ? Math.round(r.total_min) : null,
      steps: (r.steps ?? []).map((s) => String(s).trim()).filter(Boolean),
      tags: (r.tags ?? []).map((t) => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 12),
      kcal_per_serving: macros.kcalPerServing,
      protein_g_per_serving: macros.proteinGPerServing,
      macros_estimated: macros.estimated,
      language: r.language === 'fr' || r.language === 'it' ? r.language : 'en',
      source_name: r.source_name?.trim() || null,
      original_servings: r.original_servings && r.original_servings > 0 ? r.original_servings : null,
      cuisine: r.cuisine?.toLowerCase().trim() || null,
      image_source_url: r.image_source_url ?? null,
      difficulty: r.difficulty && DIFFICULTIES.includes(r.difficulty) ? r.difficulty : null,
      equipment: r.equipment ? normaliseEquipment(r.equipment) : null,
      created_by: caller.userId,
    }).select('id').single();
    if (error) {
      const duplicate = error.code === '23505';
      return json({ error: duplicate ? 'already_imported' : error.message }, duplicate ? 409 : 500);
    }

    const { error: ingErr } = await caller.db.from('recipe_ingredients').insert(ingredients.map((i, position) => ({
      recipe_id: saved.id, position, name: i.name, quantity: i.quantity, unit: i.unit,
      aisle: i.aisle, is_staple: i.is_staple, guessed: i.guessed, raw_text: i.raw_text, original_text: i.original_text,
      product_id: i.product_id,
    })));
    if (ingErr) {
      await caller.db.from('recipes').delete().eq('id', saved.id);
      return json({ error: ingErr.message }, 500);
    }
    return json({
      recipe_id: saved.id,
      macros_estimated: macros.estimated,
      unknown_ingredients: macros.unknown,
    });
  }

  return json({ error: 'unknown_action' }, 400);
});
