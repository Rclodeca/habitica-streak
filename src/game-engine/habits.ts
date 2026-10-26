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

/** A skill's difficulty weight around medium: easy ×2/3, medium ×1, hard ×4/3. */
export function difficultyFactor(difficulty: Difficulty): number {
  return DIFFICULTY_WEIGHT[difficulty] / DIFFICULTY_WEIGHT.medium;
}

/**
 * Crowding by creation order: the FULL_POWER_SKILLS oldest skills hit in
 * full, later ones by CROWDED_SKILL_FACTORS (the last factor for every one
 * past the end). A habit not in `allHabits` counts as the next one added.
 */
export function crowdingFactor(habit: Habit, allHabits: Habit[]): number {
  const found = allHabits.findIndex((h) => h.id === habit.id);
  const index = found === -1 ? allHabits.length : found;
  if (index < TUNING.FULL_POWER_SKILLS) return 1;
  const factors = TUNING.CROWDED_SKILL_FACTORS;
  return factors[Math.min(index - TUNING.FULL_POWER_SKILLS, factors.length - 1)];
}

/**
 * What a skill hits for before items, rank, streak and bonuses: its type's
 * full stat, weighted by difficulty and crowding. No pools — adding a skill
 * never changes another skill's number, unless it's crowded past the 15th.
 * Computed fresh every time; never stored on the Habit.
 */
export function skillBaseDamage(habit: Habit, allHabits: Habit[], statValue: number): number {
  return statValue * difficultyFactor(habit.difficulty) * crowdingFactor(habit, allHabits);
}
