import { MILESTONE_EXP, MILESTONES } from './constants/milestones';
import { TUNING } from './constants/tuning';
import type { Habit } from './types';

export function streakMultiplier(streakCount: number): number {
  return 1 + streakCount * TUNING.STREAK_MULTIPLIER_PER_COUNT;
}

export function completeHabitStreak(habit: Habit): { habit: Habit; milestoneExp: number } {
  const streakCount = habit.streakCount + 1;
  const milestoneExp = MILESTONES.includes(streakCount) ? MILESTONE_EXP[streakCount] : 0;
  return { habit: { ...habit, streakCount }, milestoneExp };
}

export function resetHabitStreak(habit: Habit): Habit {
  return { ...habit, streakCount: 0 };
}
