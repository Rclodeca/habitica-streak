import { MILESTONE_EXP, MILESTONES } from './constants/milestones';
import { TUNING } from './constants/tuning';
import type { Habit, Period } from './types';

/** How many of the period's rank milestones `streakCount` has reached (0-8). */
export function rankForStreak(streakCount: number, period: Period): number {
  return TUNING.RANK_MILESTONES[period].filter((milestone) => streakCount >= milestone).length;
}

/** The streak that earns `rank + 1`; undefined once the last rank is reached. */
export function nextRankMilestone(rank: number, period: Period): number | undefined {
  return TUNING.RANK_MILESTONES[period][rank];
}

/** The rank's share of a hit's multiplier: +100% a rank, +25% for healing. Undefined rank reads as 0. */
export function rankBonus(habit: Habit): number {
  const perRank = habit.damageType === 'healing' ? TUNING.HEAL_RANK_BONUS : TUNING.RANK_BONUS;
  return (habit.rank ?? 0) * perRank;
}

/** The streak's share of a hit's multiplier: +1% a day, +3% a week for a weekly. */
export function streakBonus(habit: Habit): number {
  const perCount = habit.period === 'weekly' ? TUNING.WEEKLY_STREAK_BONUS : TUNING.STREAK_BONUS;
  return habit.streakCount * perCount;
}

/** 1 + rank bonus + streak bonus, from the habit as it stands (before this completion bumps it). */
export function rankMultiplier(habit: Habit): number {
  return 1 + rankBonus(habit) + streakBonus(habit);
}

/** Bumps the streak and ranks up on reaching the next milestone. A rank never goes down. */
export function completeHabitStreak(habit: Habit): { habit: Habit; milestoneExp: number } {
  const streakCount = habit.streakCount + 1;
  const milestoneExp = MILESTONES.includes(streakCount) ? MILESTONE_EXP[streakCount] : 0;
  const rank = Math.max(habit.rank ?? 0, rankForStreak(streakCount, habit.period));
  return { habit: { ...habit, streakCount, rank }, milestoneExp };
}

/** A miss drops the streak to 0; the rank stays. */
export function resetHabitStreak(habit: Habit): Habit {
  return { ...habit, streakCount: 0 };
}

/** Gives a saved habit from before ranks the rank its current streak has earned; a habit with a rank comes back unchanged. */
export function migrateHabitRank(habit: Habit): Habit {
  return habit.rank === undefined ? { ...habit, rank: rankForStreak(habit.streakCount, habit.period) } : habit;
}
