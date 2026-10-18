// The permanent habit bonuses (Special/Ult/Overdrive) that the events
// system grants (see events.ts). Pure functions over a habit list; Special
// and Ult are idempotent and level-gated.

import { TUNING } from './constants/tuning';
import { pickRandom, type Rng } from './rng';
import type { Habit } from './types';

/**
 * Assigns Special to a random eligible (daily, good) habit once the
 * character has reached SPECIAL_LEVEL — a no-op (returns the same array
 * reference) if a habit already has it, or if none is currently eligible.
 */
export function assignSpecialIfEligible(habits: Habit[], level: number, rng: Rng): Habit[] {
  if (level < TUNING.SPECIAL_LEVEL) return habits;
  if (habits.some((h) => h.isSpecial)) return habits;
  const eligible = habits.filter((h) => h.period === 'daily' && !h.isBad);
  if (eligible.length === 0) return habits;
  const chosen = pickRandom(eligible, rng);
  return habits.map((h) => (h.id === chosen.id ? { ...h, isSpecial: true } : h));
}

/** Ult counterpart to `assignSpecialIfEligible` — weekly good habits, ULT_LEVEL. */
export function assignUltIfEligible(habits: Habit[], level: number, rng: Rng): Habit[] {
  if (level < TUNING.ULT_LEVEL) return habits;
  if (habits.some((h) => h.isUlt)) return habits;
  const eligible = habits.filter((h) => h.period === 'weekly' && !h.isBad);
  if (eligible.length === 0) return habits;
  const chosen = pickRandom(eligible, rng);
  return habits.map((h) => (h.id === chosen.id ? { ...h, isUlt: true } : h));
}

/**
 * Grants permanent Overdrive to one random good habit (either period).
 * Stacking: a habit that already has it is a valid, no-op pick. Returns the
 * same array reference and `granted: null` when there is nothing to grant
 * (no good habit, or the pick already had Overdrive).
 */
export function grantOverdrive(habits: Habit[], rng: Rng): { habits: Habit[]; granted: Habit | null } {
  const pool = habits.filter((h) => !h.isBad);
  if (pool.length === 0) return { habits, granted: null };
  const chosen = pickRandom(pool, rng);
  if (chosen.isOverdrive) return { habits, granted: null };
  const granted = { ...chosen, isOverdrive: true };
  return { habits: habits.map((h) => (h.id === chosen.id ? granted : h)), granted };
}
