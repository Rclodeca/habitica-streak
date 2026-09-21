// Handles the two level-threshold permanent bonuses (Special/Ult) and the
// per-level-up Overdrive roll. All three are pure functions over a habit
// list + the character's level, called repeatedly (on every level-up, after
// every new habit is added, and once on app load) rather than fired once —
// see the retry/idempotency notes on each function.

import { TUNING } from './constants/tuning';
import { pickRandom, type Rng } from './rng';
import type { Habit } from './types';

/**
 * Assigns Special to a random eligible (daily, good) habit once the
 * character has reached SPECIAL_LEVEL — a no-op (returns the same array
 * reference) if a habit already has it, or if none is currently eligible.
 * Safe to call on every level-up, after every habit is added, and once on
 * app load: a save already past the level, or a pool that only later gains
 * an eligible habit, still gets the assignment the next time this runs.
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
 * Rolls Overdrive independently for each level gained (OVERDRIVE_CHANCE_PER_LEVEL
 * each), granting a random good habit (either period) permanent Overdrive
 * on a success. Permanent and stacking: a habit that already has it is a
 * valid, no-op pick, so a single roll never "wastes" a grant — it's simply
 * re-checked against the current pool each iteration so a habit granted
 * mid-loop is correctly skipped on a later iteration of the same call.
 * Returns the newly-granted habits (post-update) for activity-log reporting.
 */
export function rollOverdriveForLevelUps(
  habits: Habit[],
  levelsGained: number,
  rng: Rng,
): { habits: Habit[]; granted: Habit[] } {
  let current = habits;
  const granted: Habit[] = [];

  for (let i = 0; i < levelsGained; i++) {
    if (rng() >= TUNING.OVERDRIVE_CHANCE_PER_LEVEL) continue;
    const pool = current.filter((h) => !h.isBad);
    if (pool.length === 0) continue;
    const chosen = pickRandom(pool, rng);
    if (chosen.isOverdrive) continue;
    current = current.map((h) => (h.id === chosen.id ? { ...h, isOverdrive: true } : h));
    granted.push({ ...chosen, isOverdrive: true });
  }
  return { habits: current, granted };
}
