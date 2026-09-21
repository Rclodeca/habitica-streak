import { MILESTONE_EXP, MILESTONES } from './constants/milestones';
import { TUNING } from './constants/tuning';
import type { Habit, Period } from './types';

/** Weeklies use a steeper per-count rate (see TUNING) since their streak climbs far slower than a daily's. */
export function streakMultiplier(streakCount: number, period: Period = 'daily'): number {
  const perCount = period === 'weekly' ? TUNING.WEEKLY_STREAK_MULTIPLIER_PER_COUNT : TUNING.STREAK_MULTIPLIER_PER_COUNT;
  return 1 + streakCount * perCount;
}

export function completeHabitStreak(habit: Habit): { habit: Habit; milestoneExp: number } {
  const streakCount = habit.streakCount + 1;
  const milestoneExp = MILESTONES.includes(streakCount) ? MILESTONE_EXP[streakCount] : 0;
  return { habit: { ...habit, streakCount }, milestoneExp };
}

export function resetHabitStreak(habit: Habit): Habit {
  return { ...habit, streakCount: 0 };
}
