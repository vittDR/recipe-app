import burger from '../assets/deck/burger.webp';
import curry from '../assets/deck/curry.webp';
import pasta from '../assets/deck/pasta.webp';
import pizza from '../assets/deck/pizza.webp';
import salmon from '../assets/deck/salmon.webp';
import shakshuka from '../assets/deck/shakshuka.webp';
import stirFry from '../assets/deck/stir-fry.webp';
import tacos from '../assets/deck/tacos.webp';
import type { Mood } from './types.ts';

/** Illustrated recipe cards for the deck fans (Tonight, no match). */
export const DECK_ART = { pasta, pizza, stirFry, tacos, salmon, shakshuka, curry, burger };
type Card = keyof typeof DECK_ART;

/**
 * The cards that look like each mood; a card can suit several. A mood with
 * fewer cards than a fan needs is topped up from the others.
 */
const MOOD_ART: Record<Exclude<Mood, 'any'>, Card[]> = {
  comfort: ['pasta', 'pizza', 'curry', 'burger', 'shakshuka'],
  light: ['salmon', 'stirFry'],
  quick: ['stirFry', 'tacos', 'shakshuka'],
  fancy: ['salmon'],
};

/** A seeded PRNG: FNV-1a hash of the seed, then mulberry32. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * `n` different cards for a mood, most fitting first (put it in front).
 * Picked from a seed so a screen keeps the same cards across live refreshes
 * and only changes when the seed or mood does (a new day, a new deck).
 */
export function pickDeckArt(seed: string, n: number, mood: Mood | null = 'any'): string[] {
  const random = seeded(seed);
  const all = Object.keys(DECK_ART) as Card[];
  const fits = !mood || mood === 'any' ? all : MOOD_ART[mood];
  const picked = [...shuffle(fits, random), ...shuffle(all.filter((c) => !fits.includes(c)), random)];
  return picked.slice(0, n).map((c) => DECK_ART[c]);
}
