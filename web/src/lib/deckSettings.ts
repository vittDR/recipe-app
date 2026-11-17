// The deck settings this person last picked, so the next deck starts from
// them (Tonight.tsx). Kept on this device; the last deck they dealt covers
// the others.
import { normaliseFilters } from '@logic/deckFilters.ts';
import { MOODS, TIMES, type DeckSettings } from '../components/DeckSettings.tsx';
import type { Mood } from './types.ts';

/** What a deck starts from: the time, mood and filters this person last picked. Who eats is not remembered. */
export type LastSettings = Pick<DeckSettings, 'maxMinutes' | 'mood' | 'filters'> & { at: string };

const lastKey = (userId: string) => `dineamite.deckSettings.${userId}`;

/** The last choice made on this device; null when none or unreadable. */
export function loadLastSettings(userId: string): LastSettings | null {
  try {
    const raw = JSON.parse(localStorage.getItem(lastKey(userId)) ?? 'null') as Partial<LastSettings> | null;
    if (!raw || typeof raw.at !== 'string') return null;
    return {
      at: raw.at,
      maxMinutes: (TIMES as readonly (number | null)[]).includes(raw.maxMinutes ?? null) ? raw.maxMinutes ?? null : 60,
      mood: MOODS.includes(raw.mood as Mood) ? raw.mood as Mood : 'any',
      filters: normaliseFilters(raw.filters),
    };
  } catch {
    return null;
  }
}

/** Remembers a choice on this device and returns it, stamped. */
export function saveLastSettings(userId: string, s: DeckSettings): LastSettings {
  const last: LastSettings = { maxMinutes: s.maxMinutes, mood: s.mood, filters: s.filters, at: new Date().toISOString() };
  try {
    localStorage.setItem(lastKey(userId), JSON.stringify(last));
  } catch {
    // Private mode or storage full: remembered for this visit only.
  }
  return last;
}
