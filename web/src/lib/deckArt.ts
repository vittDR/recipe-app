import burger from '../assets/deck/burger.webp';
import croqueMonsieur from '../assets/deck/croque-monsieur.webp';
import curry from '../assets/deck/curry.webp';
import greekSalad from '../assets/deck/greek-salad.webp';
import herbOmelette from '../assets/deck/herb-omelette.webp';
import mushroomRisotto from '../assets/deck/mushroom-risotto.webp';
import pasta from '../assets/deck/pasta.webp';
import pizza from '../assets/deck/pizza.webp';
import pokeBowl from '../assets/deck/poke-bowl.webp';
import roastChicken from '../assets/deck/roast-chicken.webp';
import salmon from '../assets/deck/salmon.webp';
import scallops from '../assets/deck/scallops.webp';
import shakshuka from '../assets/deck/shakshuka.webp';
import springRolls from '../assets/deck/spring-rolls.webp';
import steak from '../assets/deck/steak.webp';
import stirFry from '../assets/deck/stir-fry.webp';
import tacos from '../assets/deck/tacos.webp';
import type { Mood } from './types.ts';

/** Illustrated recipe cards for the deck fans (Tonight, no match), by the colour of the card. */
const CARDS = {
  pasta: [pasta, 'green'],
  pizza: [pizza, 'yellow'],
  stirFry: [stirFry, 'cream'],
  tacos: [tacos, 'pink'],
  salmon: [salmon, 'blue'],
  shakshuka: [shakshuka, 'teal'],
  curry: [curry, 'lilac'],
  burger: [burger, 'peach'],
  steak: [steak, 'rose'],
  mushroomRisotto: [mushroomRisotto, 'mauve'],
  scallops: [scallops, 'blue'],
  roastChicken: [roastChicken, 'peach'],
  greekSalad: [greekSalad, 'green'],
  pokeBowl: [pokeBowl, 'lilac'],
  springRolls: [springRolls, 'teal'],
  herbOmelette: [herbOmelette, 'yellow'],
  croqueMonsieur: [croqueMonsieur, 'pink'],
} as const;
type Card = keyof typeof CARDS;

/**
 * The cards that look like each mood; a card can suit several. A mood with
 * fewer cards than a fan needs is topped up from the others.
 */
const MOOD_ART: Record<Exclude<Mood, 'any'>, Card[]> = {
  comfort: ['pasta', 'pizza', 'curry', 'burger', 'shakshuka', 'croqueMonsieur'],
  light: ['salmon', 'stirFry', 'greekSalad', 'pokeBowl', 'springRolls'],
  quick: ['stirFry', 'tacos', 'shakshuka', 'herbOmelette', 'croqueMonsieur'],
  fancy: ['steak', 'mushroomRisotto', 'scallops', 'roastChicken'],
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
 * `n` different cards for a mood, most fitting first (put it in front), and
 * no two of one colour while another card can stand in. Picked from a seed
 * so a screen keeps the same cards across live refreshes and only changes
 * when the seed or mood does (a new day, a new deck).
 */
export function pickDeckArt(seed: string, n: number, mood: Mood | null = 'any'): string[] {
  const random = seeded(seed);
  const all = Object.keys(CARDS) as Card[];
  const fits = !mood || mood === 'any' ? all : MOOD_ART[mood];
  const order = [...shuffle(fits, random), ...shuffle(all.filter((c) => !fits.includes(c)), random)];
  const colours = new Set<string>();
  const picked: Card[] = [];
  for (const c of order) {
    if (picked.length === n) break;
    if (colours.has(CARDS[c][1])) continue;
    picked.push(c);
    colours.add(CARDS[c][1]);
  }
  // Fewer colours than cards: allow repeats rather than show too few.
  for (const c of order) if (picked.length < n && !picked.includes(c)) picked.push(c);
  return picked.map((c) => CARDS[c][0]);
}
