// Reads a schema.org Recipe from a web page's JSON-LD. Most recipe sites
// publish one; when absent the import function falls back to AI extraction.

export interface ExtractedRecipe {
  title: string;
  ingredients: string[];
  steps: string[];
  servings: number | null;
  totalMin: number | null;
  /** Hands-on preparation (schema.org prepTime). */
  prepMin: number | null;
  /** On the heat or in the oven (schema.org cookTime). */
  cookMin: number | null;
  imageUrl: string | null;
  tags: string[];
  language: string | null;
}

type Json = unknown;

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function isRecipe(node: Json): node is Record<string, Json> {
  if (!node || typeof node !== 'object') return false;
  const t = (node as Record<string, Json>)['@type'];
  return asArray(t as string | string[]).some((x) => typeof x === 'string' && x.toLowerCase() === 'recipe');
}

function findRecipe(node: Json): Record<string, Json> | null {
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n);
      if (r) return r;
    }
    return null;
  }
  if (!node || typeof node !== 'object') return null;
  if (isRecipe(node)) return node;
  const obj = node as Record<string, Json>;
  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) {
    if (obj[key]) {
      const r = findRecipe(obj[key]);
      if (r) return r;
    }
  }
  return null;
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
  '&eacute;': 'é', '&egrave;': 'è', '&agrave;': 'à', '&ccedil;': 'ç', '&ocirc;': 'ô', '&icirc;': 'î',
  '&ecirc;': 'ê', '&ucirc;': 'û', '&oelig;': 'œ', '&frac12;': '½', '&frac14;': '¼', '&frac34;': '¾',
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

function clean(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** ISO 8601 duration ("PT1H15M") to minutes. */
export function durationToMinutes(d: Json): number | null {
  if (typeof d !== 'string') return null;
  const m = d.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!m) return null;
  const mins = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) + Math.round(Number(m[4] ?? 0) / 60);
  return mins > 0 ? mins : null;
}

function parseServings(y: Json): number | null {
  for (const v of asArray(y as Json[])) {
    if (typeof v === 'number' && v > 0) return v;
    if (typeof v === 'string') {
      const m = v.match(/\d+/);
      if (m) return Number(m[0]);
    }
  }
  return null;
}

function parseSteps(instr: Json): string[] {
  const out: string[] = [];
  const walk = (n: Json) => {
    if (typeof n === 'string') {
      // Some sites put all steps in one HTML string.
      for (const part of n.split(/<\/?(?:p|li|br)\s*\/?>|\n+/i)) {
        const t = clean(part);
        if (t) out.push(t);
      }
    } else if (Array.isArray(n)) {
      n.forEach(walk);
    } else if (n && typeof n === 'object') {
      const o = n as Record<string, Json>;
      if (o.itemListElement) walk(o.itemListElement);
      else if (typeof o.text === 'string') walk(o.text);
      else if (typeof o.name === 'string') walk(o.name);
    }
  };
  walk(instr);
  return out;
}

function parseImage(img: Json): string | null {
  for (const v of asArray(img as Json[])) {
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object' && typeof (v as Record<string, Json>).url === 'string') {
      return (v as Record<string, string>).url;
    }
  }
  return null;
}

function parseTags(r: Record<string, Json>): string[] {
  const raw = [r.recipeCategory, r.recipeCuisine, r.keywords]
    .flatMap((v) => asArray(v as Json[]))
    .flatMap((v) => (typeof v === 'string' ? v.split(',') : []))
    .map((t) => clean(t).toLowerCase())
    .filter((t) => t.length > 1 && t.length < 30);
  return [...new Set(raw)].slice(0, 12);
}

export function extractJsonLdRecipe(html: string): ExtractedRecipe | null {
  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, body] of scripts) {
    let data: Json;
    try {
      data = JSON.parse(body.trim());
    } catch {
      continue;
    }
    const r = findRecipe(data);
    if (!r) continue;
    const ingredients = asArray(r.recipeIngredient as Json[] ?? r.ingredients as Json[])
      .filter((x): x is string => typeof x === 'string')
      .map(clean)
      .filter(Boolean);
    if (ingredients.length === 0) continue;
    const prepMin = durationToMinutes(r.prepTime);
    const cookMin = durationToMinutes(r.cookTime);
    const lang = html.match(/<html[^>]*\blang=["']([a-z]{2})/i)?.[1]?.toLowerCase() ?? null;
    return {
      title: clean(String(r.name ?? r.headline ?? '')),
      ingredients,
      steps: parseSteps(r.recipeInstructions),
      servings: parseServings(r.recipeYield),
      totalMin: durationToMinutes(r.totalTime) ?? ((prepMin ?? 0) + (cookMin ?? 0) || null),
      prepMin,
      cookMin,
      imageUrl: parseImage(r.image),
      tags: parseTags(r),
      language: (typeof r.inLanguage === 'string' ? r.inLanguage.slice(0, 2).toLowerCase() : null) ?? lang,
    };
  }
  return null;
}

/** Visible text of a page, trimmed for the AI fallback. */
export function pageText(html: string, maxChars = 15000): string {
  const body = html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|li|h\d|div)>/gi, '\n');
  return body
    .split('\n')
    .map(clean)
    .filter(Boolean)
    .join('\n')
    .slice(0, maxChars);
}
