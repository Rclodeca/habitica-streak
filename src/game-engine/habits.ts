import { DIFFICULTY_WEIGHT } from './constants/difficulty';
import { TUNING } from './constants/tuning';
import { pickWeighted, type Rng } from './rng';
import type { DamageType, Difficulty, Habit, Period } from './types';

export function createHabit(
  name: string,
  period: Period,
  difficulty: Difficulty,
  isBad: boolean,
  rng: Rng,
): Habit {
  return {
    id: crypto.randomUUID(),
    name,
    period,
    difficulty,
    damageType: pickWeighted<DamageType>(TUNING.HABIT_DAMAGE_TYPE_WEIGHTS, rng),
    isBad,
    streakCount: 0,
    lastCompletedPeriodKey: null,
    lastCheckedPeriodKey: null,
  };
}

/** Re-rolls a habit's damage type; with `excludeCurrent`, the result is guaranteed to differ from the current type. */
export function rerollDamageType(habit: Habit, rng: Rng, excludeCurrent = false): Habit {
  const weights: Record<string, number> = { ...TUNING.HABIT_DAMAGE_TYPE_WEIGHTS };
  if (excludeCurrent) delete weights[habit.damageType];
  return {
    ...habit,
    damageType: pickWeighted<DamageType>(weights, rng),
  };
}

const VALID_DAMAGE_TYPES = new Set<string>(Object.keys(TUNING.HABIT_DAMAGE_TYPE_WEIGHTS));

/** Re-rolls a saved habit whose damage type no longer exists (the removed expGain type); otherwise returns it untouched. */
export function migrateHabitDamageType(habit: Habit, rng: Rng): Habit {
  return VALID_DAMAGE_TYPES.has(habit.damageType) ? habit : rerollDamageType(habit, rng);
}

/** Strips the level-triggered Special/Ult/Overdrive bonuses on a run reset (see `resolvePlayerDeathIfDead`). */
export function resetLevelRewards(habit: Habit): Habit {
  return {
    ...habit,
    isSpecial: false,
    isUlt: false,
    isOverdrive: false,
    overdrivePeriodKey: null,
    overdriveUsesThisPeriod: 0,
  };
}

/**
 * How much a damage-type pool grows with the total difficulty weight in it:
 * 1.0 for a single medium habit, +POOL_GROWTH_PER_MEDIUM_HABIT of base per
 * extra medium-equivalent habit (easy/hard scaled by weight, so spamming
 * easy habits isn't a shortcut). Never below 1.
 */
export function poolSizeMultiplier(totalWeight: number): number {
  const growth = TUNING.POOL_GROWTH_PER_MEDIUM_HABIT;
  return Math.max(1, 1 - growth + (growth * totalWeight) / DIFFICULTY_WEIGHT.medium);
}

/**
 * Damage-split formula (the core balancing formula): given a base stat value
 * `S` for a damage type and the list of habits of that type, the pool is
 * `S * poolSizeMultiplier(...)` and each habit's share of it is proportional
 * to its difficulty weight:
 *   d_i = S * poolMultiplier * (w_i / Σ w_j)
 *
 * This is a pure computation over the current habit list every time — a
 * habit's damage value is never stored/cached on the Habit object itself.
 */
export function computeDamageSplit(habitsOfType: Habit[], statValue: number): Map<string, number> {
  const result = new Map<string, number>();
  if (habitsOfType.length === 0) {
    return result;
  }
  const totalWeight = habitsOfType.reduce((sum, habit) => sum + DIFFICULTY_WEIGHT[habit.difficulty], 0);
  const pool = statValue * poolSizeMultiplier(totalWeight);
  for (const habit of habitsOfType) {
    const weight = DIFFICULTY_WEIGHT[habit.difficulty];
    result.set(habit.id, pool * (weight / totalWeight));
  }
  return result;
}
