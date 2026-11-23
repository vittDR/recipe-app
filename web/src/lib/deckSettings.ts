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

/** The household's weeknight defaults (onboarding step 07, households.deck_defaults). */
export type HouseholdDefaults = Pick<DeckSettings, 'maxMinutes' | 'mood' | 'filters'>;

/** Read from the household row; under an hour, a little effort, any mood when not set. */
export function householdDefaults(household: { deck_defaults?: unknown } | null | undefined): HouseholdDefaults {
  const raw = (household?.deck_defaults ?? {}) as Partial<Record<keyof HouseholdDefaults, unknown>>;
  const set = Object.keys(raw).length > 0;
  return {
    maxMinutes: 'maxMinutes' in raw && (TIMES as readonly (number | null)[]).includes(raw.maxMinutes as number | null)
      ? raw.maxMinutes as number | null : 60,
    mood: MOODS.includes(raw.mood as Mood) ? raw.mood as Mood : 'any',
    filters: set ? normaliseFilters(raw.filters) : { effort: 'some' },
  };
}
