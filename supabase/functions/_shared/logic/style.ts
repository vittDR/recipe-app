// Style + taste (docs/taste-profiles.md): how often someone wants a dish,
// from what they said about others. Every answer is a frequency on one scale
// (FREQUENCY: not for me 0 … a favourite 4), and a dish's expected frequency
// is
//
//   F(r) = clamp( mean + s(plate_r) + t(features_r), 0, 4 )
//
// fitted as one additive Gaussian process:
// - s, style: how often they want a plate like this (plate.ts), whatever is
//   in it. A smooth function over plate space: a linear trend plus a
//   squared-exponential kernel, so a few answers give a broad trend and more
//   answers add detail.
// - t, taste: how much what's in the dish moves that. A sum of one effect per
//   feature (dish:curry, protein:fish, an ingredient…), each with a prior by
//   kind of feature, so a dish family can matter a lot and a single
//   ingredient only a little.
// Fitting both at once (not one after the other) is what lets a pass on a cod
// curry be put down to fish or to richness by the other answers. The posterior
// variance says where the model is unsure, which is what the quiz asks about
// next. Contrast pairs ("which one on a weeknight?", two dishes with the same
// protein) are observations of the difference between two plates: they only
// teach s.
//
// Pure and deterministic, apart from the injected random of the quiz.

import { PLATE_AXES, type Plate, plateDistance } from './plate.ts';
import { PROFILE_HALF_LIFE_DAYS, type Signal } from './profile.ts';

/** A quiz answer's frequency: not for me, now and then, regularly, a favourite. */
export const FREQUENCY = { pass: 0, sometimes: 1, yes: 3, must: 4 } as const;
export type QuizAnswer = keyof typeof FREQUENCY;
export const MAX_FREQUENCY = 4;

/** One thing someone said about a dish, on the frequency scale. */
export interface Observation {
  plate: Plate;
  features: string[];
  /** 0..4 */
  y: number;
  /** Fades and signal kinds weigh observations; a quiz answer is 1. */
  weight?: number;
}

/** "On a normal weeknight, which one?": a is the first dish, b the second. */
export type PairChoice = 'a' | 'b' | 'either' | 'neither';
export interface PairObservation {
  a: Plate;
  b: Plate;
  choice: PairChoice;
  weight?: number;
}

export interface StyleOptions {
  /** Width of the style kernel, in plate distance (plate.ts: far corners are 1 apart). */
  lengthscale?: number;
  /** Prior variance of the style's smooth part. */
  styleVariance?: number;
  /** Prior variance of the linear trend's slope along each axis (frequency points per unit). */
  trendVariance?: number;
  /** Multiplies every feature's prior variance (TASTE_VARIANCE). */
  tasteScale?: number;
  /** Noise variance of one answer: the four answers are coarse, and a dish is more than its features. */
  noise?: number;
  /** Frequency points between the chosen plate and the other in a pair. */
  pairStep?: number;
}
export const STYLE_DEFAULTS: Required<StyleOptions> = {
  lengthscale: 0.15, styleVariance: 1, trendVariance: 4, tasteScale: 1, noise: 1, pairStep: 1.5,
};

/**
 * Prior variance of one feature's effect, by kind: how far one feature can
 * move a dish's frequency (√ of it, in frequency points). Plain features are
 * ingredients, tags and cuisines, and a dish has many: each says little.
 */
export const TASTE_VARIANCE: Record<string, number> = {
  dish: 1, protein: 1, sauce: 0.5, starch: 0.4, heat: 0.8, method: 0.15, plain: 0.08,
};
/**
 * Features that describe the plate rather than what's in it: style already
 * says them, so taste leaves them out and they don't count twice.
 */
export const PLATE_FEATURE = /^(goal:|intent:|texture:|sauce:(cream|cheese|mayonnaise)$|method:deep_fried$)/;

const groupOf = (f: string) => {
  const i = f.indexOf(':');
  return i < 0 ? 'plain' : f.slice(0, i);
};
/** The features taste is learned on, deduplicated. */
export const tasteFeatures = (features: string[]) =>
  [...new Set(features)].filter((f) => !PLATE_FEATURE.test(f) && groupOf(f) in TASTE_VARIANCE);

const clampF = (v: number) => Math.max(0, Math.min(MAX_FREQUENCY, v));

/** Where the linear trend is centred: about the library's middle plate. */
const MIDDLE: Plate = { protein: 0.4, rich: 0.3, veg: 0.55, carb: 0.6 };

// ---------------------------------------------------------------------------
// Linear algebra: Cholesky of a small symmetric positive-definite matrix
// ---------------------------------------------------------------------------

function cholesky(A: number[][]): number[][] {
  const n = A.length;
  const L = A.map(() => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = A[i][j];
      for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(Math.max(sum, 1e-9)) : sum / L[j][j];
    }
  }
  return L;
}
/** L⁻¹ b (forward substitution). */
function forward(L: number[][], b: number[]): number[] {
  const x = new Array<number>(b.length);
  for (let i = 0; i < b.length; i++) {
    let sum = b[i];
    for (let k = 0; k < i; k++) sum -= L[i][k] * x[k];
    x[i] = sum / L[i][i];
  }
  return x;
}
/** L⁻ᵀ b (back substitution). */
function backward(L: number[][], b: number[]): number[] {
  const n = b.length;
  const x = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i];
    for (let k = i + 1; k < n; k++) sum -= L[k][i] * x[k];
    x[i] = sum / L[i][i];
  }
  return x;
}

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

export interface StyleModel {
  /** Style: how often they want a plate like this, mean included, 0..4 (not clamped). */
  style(p: Plate): number;
  /** Posterior variance of the style at this plate: high where little was said near it. */
  styleVariance(p: Plate): number;
  /** Taste: frequency points the dish's contents add or take away. */
  taste(features: string[]): number;
  /** Posterior variance of the taste of these contents. */
  tasteVariance(features: string[]): number;
  /** Each feature's learned effect, with how many answers it rests on. */
  tasteWeights: Map<string, { t: number; n: number }>;
  /** Expected frequency of a dish, 0..4: its best plate (as written, or without optional lines). */
  frequency(plates: Plate[], features: string[]): number;
  /** The same before clamping to 0..4: still ranks dishes that are all "a favourite". */
  rawFrequency(plates: Plate[], features: string[]): number;
  /** Posterior variance of a dish's frequency, before clamping. */
  variance(plate: Plate, features: string[]): number;
  /** 0..1: how much of the prior uncertainty about a dish is left (1 = nothing said about anything like it). */
  uncertainty(plate: Plate, features: string[]): number;
  /** A dish, prepared for posterior covariances between many dishes (dishCovariance). */
  dish(plate: Plate, features: string[]): ModelDish;
  /** Posterior covariance of two dishes' frequencies: how much an answer on one says about the other. */
  dishCovariance(a: ModelDish, b: ModelDish): number;
  /** The mean answer: the level style and taste are measured from. */
  mean: number;
}

/** A dish as dishCovariance reads it. */
export interface ModelDish { plate: Plate; feats: Set<string>; v: number[] }

/** One training point of the process: a dish (plate and features), or a pair's difference. */
type Point = { kind: 'dish'; plate: Plate; features: string[] } | { kind: 'pair'; a: Plate; b: Plate };

/** Fits style and taste to what someone said. */
export function fitStyle(obs: Observation[], pairs: PairObservation[] = [], options: StyleOptions = {}): StyleModel {
  const o = { ...STYLE_DEFAULTS, ...options };
  const wOf = (x: { weight?: number }) => x.weight ?? 1;
  const totalW = obs.reduce((s, x) => s + wOf(x), 0);
  const mean = totalW ? obs.reduce((s, x) => s + wOf(x) * x.y, 0) / totalW : 2;

  const kPlate = (a: Plate, b: Plate) => {
    const d = plateDistance(a, b);
    let lin = 0;
    for (const axis of PLATE_AXES) lin += (a[axis] - MIDDLE[axis]) * (b[axis] - MIDDLE[axis]);
    return o.trendVariance * lin + o.styleVariance * Math.exp(-(d * d) / (2 * o.lengthscale * o.lengthscale));
  };
  const fv = (f: string) => o.tasteScale * TASTE_VARIANCE[groupOf(f)];
  const kTaste = (a: Set<string>, b: Set<string>) => {
    let s = 0;
    for (const f of a) if (b.has(f)) s += fv(f);
    return s;
  };

  const points: (Point & { y: number; noise: number; feats?: Set<string> })[] = [
    ...obs.map((x) => ({
      kind: 'dish' as const, plate: x.plate, features: x.features, feats: new Set(tasteFeatures(x.features)),
      y: x.y - mean, noise: o.noise / wOf(x),
    })),
    ...pairs.flatMap((pr) => {
      const step = pr.choice === 'a' ? o.pairStep : pr.choice === 'b' ? -o.pairStep : 0;
      const out: (Point & { y: number; noise: number; feats?: Set<string> })[] = [
        { kind: 'pair', a: pr.a, b: pr.b, y: step, noise: o.noise / wOf(pr) },
      ];
      // "Neither" also says both are below the usual: style only, as the dishes' contents were matched.
      if (pr.choice === 'neither') {
        out.push({ kind: 'dish', plate: pr.a, features: [], feats: new Set(), y: -1, noise: (2 * o.noise) / wOf(pr) },
          { kind: 'dish', plate: pr.b, features: [], feats: new Set(), y: -1, noise: (2 * o.noise) / wOf(pr) });
      }
      return out;
    }),
  ];
  const n = points.length;

  /** Covariance of the style part between a plate and a training point. */
  const sCov = (p: Plate, q: (typeof points)[number]) =>
    q.kind === 'dish' ? kPlate(p, q.plate) : kPlate(p, q.a) - kPlate(p, q.b);
  /** Covariance of the taste part between features and a training point (pairs have none). */
  const tCov = (fs: Set<string>, q: (typeof points)[number]) => (q.kind === 'dish' ? kTaste(fs, q.feats!) : 0);
  const pointCov = (p: (typeof points)[number], q: (typeof points)[number]) => {
    if (p.kind === 'dish') return sCov(p.plate, q) + tCov(p.feats!, q);
    return sCov(p.a, q) - sCov(p.b, q);
  };

  const K = points.map((p, i) => points.map((q, j) => (j <= i ? pointCov(p, q) : 0)));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) K[j][i] = K[i][j];
    K[i][i] += points[i].noise;
  }
  const L = n ? cholesky(K) : [];
  const alpha = n ? backward(L, forward(L, points.map((p) => p.y))) : [];

  const sVec = (p: Plate) => points.map((q) => sCov(p, q));
  const tVec = (fs: Set<string>) => points.map((q) => tCov(fs, q));
  const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
  const explained = (k: number[]) => {
    if (!n) return 0;
    const v = forward(L, k);
    return dot(v, v);
  };
  const priorTaste = (fs: Set<string>) => [...fs].reduce((s, f) => s + fv(f), 0);

  const style = (p: Plate) => mean + dot(sVec(p), alpha);
  const tasteOf = (fs: Set<string>) => dot(tVec(fs), alpha);
  const taste = (features: string[]) => tasteOf(new Set(tasteFeatures(features)));
  const raw = (plates: Plate[], features: string[]) =>
    (plates.length ? Math.max(...plates.map(style)) : mean) + taste(features);

  const tasteWeights = new Map<string, { t: number; n: number }>();
  points.forEach((q, i) => {
    if (q.kind !== 'dish') return;
    for (const f of q.feats!) {
      const e = tasteWeights.get(f) ?? { t: 0, n: 0 };
      e.t += fv(f) * alpha[i];
      e.n += 1;
      tasteWeights.set(f, e);
    }
  });

  return {
    style,
    styleVariance: (p) => Math.max(0, kPlate(p, p) - explained(sVec(p))),
    taste,
    tasteVariance: (features) => {
      const fs = new Set(tasteFeatures(features));
      return Math.max(0, priorTaste(fs) - explained(tVec(fs)));
    },
    tasteWeights,
    frequency: (plates, features) => clampF(raw(plates, features)),
    rawFrequency: (plates, features) => raw(plates, features),
    variance: (plate, features) => {
      const fs = new Set(tasteFeatures(features));
      const k = sVec(plate).map((v, i) => v + tCov(fs, points[i]));
      return Math.max(0, kPlate(plate, plate) + priorTaste(fs) - explained(k));
    },
    uncertainty: (plate, features) => {
      const fs = new Set(tasteFeatures(features));
      const prior = kPlate(plate, plate) + priorTaste(fs);
      const k = sVec(plate).map((v, i) => v + tCov(fs, points[i]));
      return prior > 0 ? Math.sqrt(Math.max(0, prior - explained(k)) / prior) : 0;
    },
    dish: (plate, features) => {
      const feats = new Set(tasteFeatures(features));
      return { plate, feats, v: n ? forward(L, sVec(plate).map((v, i) => v + tCov(feats, points[i]))) : [] };
    },
    dishCovariance: (a, b) => kPlate(a.plate, b.plate) + kTaste(a.feats, b.feats) - dot(a.v, b.v),
    mean,
  };
}

// ---------------------------------------------------------------------------
// The quiz: which card next
// ---------------------------------------------------------------------------

export interface QuizCandidate {
  id: string;
  plate: Plate;
  features: string[];
  /** What the card should vary on for taste (profile.ts quizFacets). */
  facets: string[];
  hasPhoto?: boolean;
}

export const QUIZ_CARDS = 26;
export const QUIZ_PAIRS = 6;
/** Cards answered before the person may stop. */
export const QUIZ_MIN = 20;
/** Library dishes the information of a card is measured on (a random sample, for speed). */
export const QUIZ_REFERENCE = 150;

export interface QuizOptions extends StyleOptions {
  /** How many first cards only map plate space (farthest plate first); 0 to go by information from the start. */
  anchors?: number;
}

function facetGain(c: QuizCandidate, seen: Map<string, number>) {
  return c.facets.reduce((s, f) => s + 1 / (1 + 2 * (seen.get(f) ?? 0)), 0);
}

/**
 * The next quiz card: the one whose answer would most reduce what the model
 * doesn't know about the rest of the library (integrated variance reduction:
 * Σ over library dishes of cov(card, dish)² / (var(card) + noise)). A card
 * like many others, on a plate and with contents nothing has said much about
 * yet, wins; an odd dish or one like those already answered doesn't.
 * Optionally, the first `anchors` cards just spread over plate space.
 */
export function nextQuizCard(
  pool: QuizCandidate[],
  shown: { candidate: QuizCandidate; y: number }[],
  pairs: PairObservation[] = [],
  random: () => number = Math.random,
  options: QuizOptions = {},
): QuizCandidate | null {
  const seenIds = new Set(shown.map((s) => s.candidate.id));
  const left = pool.filter((c) => !seenIds.has(c.id));
  if (left.length === 0) return null;
  const photo = left.some((c) => c.hasPhoto) ? left.filter((c) => c.hasPhoto) : left;
  const seen = new Map<string, number>();
  for (const s of shown) for (const f of s.candidate.facets) seen.set(f, (seen.get(f) ?? 0) + 1);

  let best: QuizCandidate | null = null;
  let bestScore = -Infinity;
  if (shown.length < (options.anchors ?? 0)) {
    for (const c of photo) {
      const far = shown.length ? Math.min(...shown.map((s) => plateDistance(c.plate, s.candidate.plate))) : 1;
      const score = far + 0.03 * facetGain(c, seen) + 0.02 * random();
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  const model = fitStyle(shown.map((s) => ({ plate: s.candidate.plate, features: s.candidate.features, y: s.y })), pairs, options);
  const noise = options.noise ?? STYLE_DEFAULTS.noise;
  const reference = sample(left, QUIZ_REFERENCE, random).map((c) => model.dish(c.plate, c.features));
  for (const c of photo) {
    const d = model.dish(c.plate, c.features);
    const v = model.dishCovariance(d, d);
    const gain = reference.reduce((sum, r) => sum + model.dishCovariance(d, r) ** 2, 0) / (v + noise);
    const score = gain / reference.length + 0.01 * random();
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

/** Up to n items, at random. */
function sample<T>(items: T[], n: number, random: () => number): T[] {
  if (items.length <= n) return items;
  const copy = [...items];
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

/** Two dishes make a pair when they share a protein and differ in plate at least this much. */
export const PAIR_MIN_DISTANCE = 0.2;

/**
 * The next contrast pair: two dishes with the same protein (and cuisine when
 * possible) on different plates, where style is least certain between them.
 * Neither was shown before, as a card or in a pair.
 */
export function nextQuizPair(
  pool: QuizCandidate[],
  used: Set<string>,
  model: StyleModel,
  random: () => number = Math.random,
): [QuizCandidate, QuizCandidate] | null {
  const left = pool.filter((c) => !used.has(c.id) && c.hasPhoto !== false);
  const proteins = (c: QuizCandidate) => c.features.filter((f) => f.startsWith('protein:'));
  const cuisines = (c: QuizCandidate) => new Set(c.facets.filter((f) => f.startsWith('cuisine:')));
  let best: [QuizCandidate, QuizCandidate] | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < left.length; i++) {
    const a = left[i];
    const pa = new Set(proteins(a));
    if (pa.size === 0) continue;
    const ca = cuisines(a);
    for (let j = i + 1; j < left.length; j++) {
      const b = left[j];
      const pb = proteins(b);
      if (pb.length !== pa.size || !pb.every((p) => pa.has(p))) continue;
      const d = plateDistance(a.plate, b.plate);
      if (d < PAIR_MIN_DISTANCE) continue;
      const sameCuisine = [...cuisines(b)].some((x) => ca.has(x)) ? 0.3 : 0;
      const unsure = Math.sqrt(model.styleVariance(a.plate) + model.styleVariance(b.plate));
      // Where style can't yet tell the two plates apart.
      const close = Math.exp(-((model.style(a.plate) - model.style(b.plate)) ** 2));
      const score = unsure + 0.5 * close + Math.min(d, 0.5) + sameCuisine + 0.02 * random();
      if (score > bestScore) { bestScore = score; best = [a, b]; }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// From recorded signals (profile.ts signalsFor)
// ---------------------------------------------------------------------------

/**
 * What each signal says on the frequency scale, and how much it weighs
 * against a quiz answer (docs/taste-profiles.md §2). Signals not listed say
 * nothing about how often: a plain deck pass is mostly "not tonight", a pass
 * for tonight's reasons and "not eaten" say nothing at all.
 */
export const SIGNAL_WEIGHT = {
  starter: 1,
  swipe: 0.5,
  rating: 1,
  /** Cooked without a rating: they made it, so they want it about regularly. */
  cooked: 0.25,
  pair: 1,
} as const;
export const SWIPE_FREQUENCY = { yes: 3, must: 4, not_for_me: 0 } as const;
export const RATING_FREQUENCY = { loved: 4, fine: 2.5, not_again: 0 } as const;
export const COOKED_FREQUENCY = 3;
/** Older signals fade, as in the taste profile. */
export const STYLE_HALF_LIFE_DAYS = PROFILE_HALF_LIFE_DAYS;
/** The model's cost grows with the cube of its observations: past this, the weakest go. */
export const MAX_OBSERVATIONS = 600;

/**
 * A person's signals as style observations and pairs. `platesOf` gives a
 * recipe's plates (plate.ts platesOf); a dish without one says nothing here.
 * A dish is judged as written, on its first plate.
 */
export function observationsFor(
  signals: Signal[],
  platesOf: (recipeId: string) => Plate[] | undefined,
  now: number = Date.now(),
): { observations: Observation[]; pairs: PairObservation[] } {
  const fade = (at: string) => 0.5 ** (Math.max(0, (now - Date.parse(at)) / 86_400_000) / STYLE_HALF_LIFE_DAYS);
  const plate = (id: string | undefined) => (id ? platesOf(id)?.[0] : undefined);
  // A rating says more than having cooked it.
  const rated = new Set(signals.flatMap((s) => (s.kind === 'rating' && s.mealId ? [s.mealId] : [])));
  const observations: Observation[] = [];
  const pairs: PairObservation[] = [];
  for (const s of signals) {
    if (s.kind === 'pair') {
      const a = plate(s.recipeId);
      const b = plate(s.otherRecipeId);
      if (a && b) pairs.push({ a, b, choice: s.choice, weight: SIGNAL_WEIGHT.pair * fade(s.at) });
      continue;
    }
    const p = plate(s.recipeId);
    if (!p) continue;
    let y: number | null = null;
    let w = 0;
    switch (s.kind) {
      case 'starter':
        y = FREQUENCY[s.verdict];
        w = SIGNAL_WEIGHT.starter;
        break;
      case 'swipe':
        if (s.verdict !== 'pass') y = SWIPE_FREQUENCY[s.verdict];
        else if (s.reason === 'not_for_me') y = SWIPE_FREQUENCY.not_for_me;
        w = SIGNAL_WEIGHT.swipe;
        break;
      case 'rating':
        if (s.rating !== 'not_eaten') y = RATING_FREQUENCY[s.rating];
        w = SIGNAL_WEIGHT.rating;
        break;
      case 'cooked':
        if (!s.mealId || !rated.has(s.mealId)) y = COOKED_FREQUENCY;
        w = SIGNAL_WEIGHT.cooked;
        break;
    }
    if (y !== null) observations.push({ plate: p, features: s.features, y, weight: w * fade(s.at) });
  }
  if (observations.length > MAX_OBSERVATIONS) {
    observations.sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1));
    observations.length = MAX_OBSERVATIONS;
  }
  return { observations, pairs };
}

/** A person's style + taste model, from everything they chose. */
export function styleModelFor(
  signals: Signal[],
  platesOf: (recipeId: string) => Plate[] | undefined,
  now: number = Date.now(),
  options: StyleOptions = {},
): StyleModel {
  const { observations, pairs } = observationsFor(signals, platesOf, now);
  return fitStyle(observations, pairs, options);
}
