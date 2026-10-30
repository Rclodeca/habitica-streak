import { DIFFICULTY_WEIGHT } from './constants/difficulty';
import { TUNING } from './constants/tuning';
import type { HeroClass } from './character';
import { pickWeighted, type Rng } from './rng';
import { dayOfWeekIndex } from './time';
import type { DamageType, Difficulty, Habit, Period } from './types';

/**
 * What a brand-new player's first habit can roll: healing has nothing to heal
 * at full HP and no way to hurt the boss, and true damage is confusing as a
 * first hit. Keeps the tuned physical:magic ratio.
 */
const FIRST_HABIT_DAMAGE_TYPES: readonly DamageType[] = ['physical', 'magic'];

/** The damage type roll odds for `heroClass`: a ranger rolls true damage more often. */
function classDamageTypeWeights(heroClass?: HeroClass): Record<DamageType, number> {
  return heroClass === 'ranger' ? TUNING.RANGER_HABIT_DAMAGE_TYPE_WEIGHTS : TUNING.HABIT_DAMAGE_TYPE_WEIGHTS;
}

function damageTypeWeights(isFirstHabit: boolean, excludeHealing: boolean, heroClass?: HeroClass): Record<string, number> {
  const classWeights = classDamageTypeWeights(heroClass);
  const weights: Record<string, number> = isFirstHabit
    ? Object.fromEntries(FIRST_HABIT_DAMAGE_TYPES.map((type) => [type, classWeights[type]]))
    : { ...classWeights };
  if (excludeHealing) delete weights.healing;
  return weights;
}

/**
 * Whether one more healing skill fits: the healing skills among
 * `otherHabits` are fewer than HEAL_SKILL_CAP_SHARE of `skillCount` (rounded
 * up). Checked on new rolls only; healing skills over the cap are never
 * touched outside a reroll.
 */
export function healingAllowed(otherHabits: Habit[], skillCount: number): boolean {
  const healing = otherHabits.filter((h) => h.damageType === 'healing').length;
  return healing < Math.ceil(skillCount * TUNING.HEAL_SKILL_CAP_SHARE);
}

/**
 * Whether the next skill rolled must be healing: there are already
 * GUARANTEED_HEAL_SKILL - 1 `otherHabits` (daily or weekly) and none of
 * them heals.
 */
export function healingRequired(otherHabits: Habit[]): boolean {
  return otherHabits.length >= TUNING.GUARANTEED_HEAL_SKILL - 1 && !otherHabits.some((h) => h.damageType === 'healing');
}

/**
 * `isFirstHabit` limits the damage type to physical or magic; pass it only
 * when the player has no habits yet. `excludeHealing` keeps it off healing
 * (see healingAllowed) and `forceHealing` makes it healing (see
 * healingRequired). `heroClass` picks the roll odds (see
 * classDamageTypeWeights).
 */
export function createHabit(
  name: string,
  period: Period,
  difficulty: Difficulty,
  isBad: boolean,
  rng: Rng,
  days?: number[],
  isFirstHabit = false,
  excludeHealing = false,
  heroClass?: HeroClass,
  forceHealing = false,
): Habit {
  const dueDays = period === 'daily' ? normalizeDays(days) : undefined;
  return {
    id: crypto.randomUUID(),
    name,
    period,
    difficulty,
    damageType: forceHealing ? 'healing' : pickWeighted<DamageType>(damageTypeWeights(isFirstHabit, excludeHealing, heroClass), rng),
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

/**
 * Re-rolls a habit's damage type; with `excludeCurrent`, the result is
 * guaranteed to differ from the current type, with `excludeHealing` it's
 * never healing, and with `forceHealing` it's always healing. `heroClass`
 * picks the roll odds.
 */
export function rerollDamageType(
  habit: Habit,
  rng: Rng,
  excludeCurrent = false,
  excludeHealing = false,
  heroClass?: HeroClass,
  forceHealing = false,
): Habit {
  if (forceHealing) return { ...habit, damageType: 'healing' };
  const weights: Record<string, number> = { ...classDamageTypeWeights(heroClass) };
  if (excludeCurrent) delete weights[habit.damageType];
  if (excludeHealing) delete weights.healing;
  return {
    ...habit,
    damageType: pickWeighted<DamageType>(weights, rng),
  };
}

/**
 * Re-rolls every habit's damage type in order (a run reset) at `heroClass`'s
 * odds, keeping healing out once the habits rerolled so far fill the cap for
 * `habits.length`, and forcing it on the GUARANTEED_HEAL_SKILL-th if none
 * before it healed. Order, ranks and streaks are kept.
 */
export function rerollAllDamageTypes(habits: Habit[], rng: Rng, heroClass?: HeroClass): Habit[] {
  const rerolled: Habit[] = [];
  for (const habit of habits) {
    rerolled.push(rerollDamageType(habit, rng, false, !healingAllowed(rerolled, habits.length), heroClass, healingRequired(rerolled)));
  }
  return rerolled;
}

const VALID_DAMAGE_TYPES = new Set<string>(Object.keys(TUNING.HABIT_DAMAGE_TYPE_WEIGHTS));

/** Re-rolls a saved habit whose damage type no longer exists (the removed expGain type); otherwise returns it untouched. */
export function migrateHabitDamageType(habit: Habit, rng: Rng): Habit {
  return VALID_DAMAGE_TYPES.has(habit.damageType) ? habit : rerollDamageType(habit, rng);
}

/** A skill can't be removed on the day it was added (no add-and-delete to dodge a crowded slot). Older saves without the stamp never lock. */
export function removalLocked(habit: Habit, currentDayKey: string): boolean {
  return habit.createdDayKey === currentDayKey;
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
 * past the end). A healing skill past the FULL_POWER_HEAL_SKILLS oldest
 * healing ones is also cut to CROWDED_HEAL_SKILL_FACTOR. A habit not in
 * `allHabits` counts as the next one added.
 */
export function crowdingFactor(habit: Habit, allHabits: Habit[]): number {
  const found = allHabits.findIndex((h) => h.id === habit.id);
  const index = found === -1 ? allHabits.length : found;
  const olderHeals = allHabits.slice(0, index).filter((h) => h.damageType === 'healing').length;
  const healFactor = habit.damageType === 'healing' && olderHeals >= TUNING.FULL_POWER_HEAL_SKILLS ? TUNING.CROWDED_HEAL_SKILL_FACTOR : 1;
  if (index < TUNING.FULL_POWER_SKILLS) return healFactor;
  const factors = TUNING.CROWDED_SKILL_FACTORS;
  return factors[Math.min(index - TUNING.FULL_POWER_SKILLS, factors.length - 1)] * healFactor;
}

/**
 * What a skill hits for before items, rank, streak and bonuses: its type's
 * full stat, weighted by difficulty and crowding. No pools — adding a skill
 * never changes another skill's number, unless it's crowded past the 15th
 * (or, for healing, past the second healing skill).
 * Computed fresh every time; never stored on the Habit.
 */
export function skillBaseDamage(habit: Habit, allHabits: Habit[], statValue: number): number {
  return statValue * difficultyFactor(habit.difficulty) * crowdingFactor(habit, allHabits);
}
