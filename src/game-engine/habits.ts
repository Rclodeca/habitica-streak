import { DIFFICULTY_WEIGHT } from './constants/difficulty';
import { TUNING } from './constants/tuning';
import { pickWeighted, type Rng } from './rng';
import { dayOfWeekIndex } from './time';
import type { DamageType, Difficulty, Habit, Period } from './types';

/**
 * What a brand-new player's first habit can roll: healing has nothing to heal
 * at full HP and no way to hurt the boss, and true damage is confusing as a
 * first hit. Keeps the tuned physical:magic ratio.
 */
const FIRST_HABIT_DAMAGE_TYPES: readonly DamageType[] = ['physical', 'magic'];

function damageTypeWeights(isFirstHabit: boolean): Record<string, number> {
  if (!isFirstHabit) return TUNING.HABIT_DAMAGE_TYPE_WEIGHTS;
  return Object.fromEntries(
    FIRST_HABIT_DAMAGE_TYPES.map((type) => [type, TUNING.HABIT_DAMAGE_TYPE_WEIGHTS[type]]),
  );
}

/** `isFirstHabit` limits the damage type to physical or magic; pass it only when the player has no habits yet. */
export function createHabit(
  name: string,
  period: Period,
  difficulty: Difficulty,
  isBad: boolean,
  rng: Rng,
  days?: number[],
  isFirstHabit = false,
): Habit {
  const dueDays = period === 'daily' ? normalizeDays(days) : undefined;
  return {
    id: crypto.randomUUID(),
    name,
    period,
    difficulty,
    damageType: pickWeighted<DamageType>(damageTypeWeights(isFirstHabit), rng),
    isBad,
    streakCount: 0,
    rank: 0,
    lastCompletedPeriodKey: null,
    lastCheckedPeriodKey: null,
    ...(dueDays && { days: dueDays }),
  };
}

/** Sorted, deduped weekdays (0-6); undefined for none or all seven, i.e. a plain daily. */
export function normalizeDays(days: number[] | undefined): number[] | undefined {
  const unique = [...new Set(days ?? [])].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort((a, b) => a - b);
  return unique.length === 0 || unique.length === 7 ? undefined : unique;
}

/** The share of the week a habit is due: days/7 for a set-day daily, 1 for a plain daily or any weekly. */
export function dueFraction(habit: Habit): number {
  return habit.period === 'daily' && habit.days ? habit.days.length / 7 : 1;
}

/** Whether `habit` can be used on `date`'s day — false only on a set-day daily's rest days. */
export function isDueOn(habit: Habit, date: Date): boolean {
  if (habit.period !== 'daily' || !habit.days) return true;
  return habit.days.includes(dayOfWeekIndex(date));
}

/** The first weekday after `today` (wrapping, so possibly `today` itself a week on) that is in `days`. */
export function nextDueDay(days: number[], today: number): number {
  for (let offset = 1; offset <= 7; offset++) {
    const day = (today + offset) % 7;
    if (days.includes(day)) return day;
  }
  return today;
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
 * `S * poolSizeMultiplier(W)` and each hit is proportional to the habit's
 * difficulty weight, with set-day habits counted in W by their dueFraction:
 *   W = Σ w_j * f_j,   d_i = S * poolMultiplier * (w_i / max(W, w_i))
 * A set-day habit hits like a daily of its difficulty on its due days; the
 * max() caps a hit at the whole pool, so a pool of sparse habits can't pack
 * a week's damage into one check.
 *
 * This is a pure computation over the current habit list every time — a
 * habit's damage value is never stored/cached on the Habit object itself.
 */
export function computeDamageSplit(habitsOfType: Habit[], statValue: number): Map<string, number> {
  const result = new Map<string, number>();
  if (habitsOfType.length === 0) {
    return result;
  }
  const totalWeight = habitsOfType.reduce((sum, habit) => sum + DIFFICULTY_WEIGHT[habit.difficulty] * dueFraction(habit), 0);
  const pool = statValue * poolSizeMultiplier(totalWeight);
  for (const habit of habitsOfType) {
    const weight = DIFFICULTY_WEIGHT[habit.difficulty];
    result.set(habit.id, pool * (weight / Math.max(totalWeight, weight)));
  }
  return result;
}
