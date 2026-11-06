import burger from '../assets/deck/burger.webp';
import curry from '../assets/deck/curry.webp';
import pasta from '../assets/deck/pasta.webp';
import pizza from '../assets/deck/pizza.webp';
import salmon from '../assets/deck/salmon.webp';
import shakshuka from '../assets/deck/shakshuka.webp';
import stirFry from '../assets/deck/stir-fry.webp';
import tacos from '../assets/deck/tacos.webp';

/** Illustrated recipe cards for the deck fans (Tonight, no match). */
export const DECK_ART = [pasta, pizza, stirFry, tacos, salmon, shakshuka, curry, burger];

/**
 * `n` different cards, picked from a seed so a screen keeps the same cards
 * across live refreshes and only changes when the seed does (a new day, a
 * new deck).
 */
export function pickDeckArt(seed: string, n: number): string[] {
  // FNV-1a hash of the seed, then a small PRNG (mulberry32) for the shuffle.
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const random = () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const cards = [...DECK_ART];
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards.slice(0, n);
}
