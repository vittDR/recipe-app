// Preference learning from swipes. Soft weights nudge deck ranking straight
// away; patterns are only suggested and affect decks once the member accepts
// them ("Never show" becomes a taste rule, "Show less" a negative weight).

export type Verdict = 'pass' | 'yes' | 'must';

export interface Exposure {
  verdict: Verdict;
  /** Tags and main ingredient names of the swiped recipe, lowercase. */
  features: string[];
  createdAt: string; // ISO
}

export interface PatternSuggestion {
  pattern: { kind: 'avoid' | 'prefer'; value: string };
  evidence: number;
  window: number;
}

export const PATTERN_WINDOW = 10;
export const PATTERN_THRESHOLD = 8;

/** Per-feature weight in [-1, 1] from yes vs pass counts, smoothed for small samples. */
export function softWeights(exposures: Exposure[]): Map<string, number> {
  const counts = new Map<string, { yes: number; pass: number }>();
  for (const e of exposures) {
    for (const f of new Set(e.features)) {
      const c = counts.get(f) ?? { yes: 0, pass: 0 };
      if (e.verdict === 'pass') c.pass += 1;
      else c.yes += e.verdict === 'must' ? 1.5 : 1;
      counts.set(f, c);
    }
  }
  const weights = new Map<string, number>();
  for (const [f, c] of counts) {
    weights.set(f, (c.yes - c.pass) / (c.yes + c.pass + 2));
  }
  return weights;
}

/**
 * A feature becomes a suggestion when the member passed (or said yes) on it in
 * at least `threshold` of their last `window` exposures to it.
 */
export function detectPatterns(
  exposures: Exposure[],
  opts: { window?: number; threshold?: number } = {},
): PatternSuggestion[] {
  const window = opts.window ?? PATTERN_WINDOW;
  const threshold = opts.threshold ?? PATTERN_THRESHOLD;
  const newestFirst = [...exposures].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const recent = new Map<string, Verdict[]>();
  for (const e of newestFirst) {
    for (const f of new Set(e.features)) {
      const list = recent.get(f) ?? [];
      if (list.length < window) list.push(e.verdict);
      recent.set(f, list);
    }
  }
  const out: PatternSuggestion[] = [];
  for (const [value, verdicts] of recent) {
    const passes = verdicts.filter((v) => v === 'pass').length;
    const yeses = verdicts.length - passes;
    if (passes >= threshold) out.push({ pattern: { kind: 'avoid', value }, evidence: passes, window: verdicts.length });
    else if (yeses >= threshold) out.push({ pattern: { kind: 'prefer', value }, evidence: yeses, window: verdicts.length });
  }
  return out.sort((a, b) => b.evidence - a.evidence);
}

/** Features of a recipe used for learning: its tags plus non-staple ingredient names. */
export function recipeFeatures(tags: string[], ingredients: { name: string; is_staple?: boolean }[]): string[] {
  return [
    ...tags.map((t) => t.toLowerCase()),
    ...ingredients.filter((i) => !i.is_staple).map((i) => i.name.toLowerCase()),
  ];
}
