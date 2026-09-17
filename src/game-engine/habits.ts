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

export function rerollDamageType(habit: Habit, rng: Rng): Habit {
  return {
    ...habit,
    damageType: pickWeighted<DamageType>(TUNING.HABIT_DAMAGE_TYPE_WEIGHTS, rng),
  };
}

/**
 * Damage-split formula (the core balancing formula): given a base stat value
 * `S` for a damage type and the list of habits of that type, each habit's
 * share of `S` is proportional to its difficulty weight:
 *   d_i = S * (w_i / Σ w_j)
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
  for (const habit of habitsOfType) {
    const weight = DIFFICULTY_WEIGHT[habit.difficulty];
    result.set(habit.id, statValue * (weight / totalWeight));
  }
  return result;
}
