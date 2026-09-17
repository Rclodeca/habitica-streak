import { describe, expect, it } from 'vitest';
import { completeHabitStreak, resetHabitStreak, streakMultiplier } from './streaks';
import type { Habit } from './types';

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-id',
    name: 'Test Habit',
    period: 'daily',
    difficulty: 'easy',
    damageType: 'physical',
    isBad: false,
    streakCount: 0,
    lastCompletedPeriodKey: null,
    lastCheckedPeriodKey: null,
    ...overrides,
  };
}

describe('streakMultiplier', () => {
  it.each([
    [0, 1.0],
    [1, 1.1],
    [10, 2.0],
    [30, 4.0],
    [100, 11.0],
  ])('equals %s at streakCount=%s', (streakCount, expected) => {
    expect(streakMultiplier(streakCount)).toBeCloseTo(expected, 10);
  });
});

describe('completeHabitStreak', () => {
  it('increments streakCount by 1', () => {
    const habit = makeHabit({ streakCount: 3 });
    const result = completeHabitStreak(habit);
    expect(result.habit.streakCount).toBe(4);
  });

  it('returns a new habit object, not a mutation', () => {
    const habit = makeHabit({ streakCount: 0 });
    const result = completeHabitStreak(habit);
    expect(result.habit).not.toBe(habit);
    expect(habit.streakCount).toBe(0);
  });

  it.each([1, 4, 6, 11])(
    'returns milestoneExp = 0 when the new streak count is %s (non-milestone)',
    (previousCount) => {
      const habit = makeHabit({ streakCount: previousCount - 1 });
      const result = completeHabitStreak(habit);
      expect(result.habit.streakCount).toBe(previousCount);
      expect(result.milestoneExp).toBe(0);
    },
  );

  it.each([
    [5, 20],
    [10, 50],
    [20, 120],
    [30, 220],
    [50, 450],
    [100, 1200],
  ])('returns milestoneExp = %s at streak count %s', (streakCount, expectedExp) => {
    const habit = makeHabit({ streakCount: streakCount - 1 });
    const result = completeHabitStreak(habit);
    expect(result.habit.streakCount).toBe(streakCount);
    expect(result.milestoneExp).toBe(expectedExp);
  });

  it('re-fires milestone EXP every time a streak crosses a milestone again (no already-awarded tracking)', () => {
    let habit = makeHabit({ streakCount: 4 });

    // Cross the 5-milestone the first time.
    let result = completeHabitStreak(habit);
    expect(result.habit.streakCount).toBe(5);
    expect(result.milestoneExp).toBe(20);

    // Reset and rebuild the streak back up past 5.
    habit = resetHabitStreak(result.habit);
    expect(habit.streakCount).toBe(0);

    for (let i = 0; i < 4; i++) {
      result = completeHabitStreak(habit);
      habit = result.habit;
      expect(result.milestoneExp).toBe(0);
    }
    expect(habit.streakCount).toBe(4);

    // Cross the 5-milestone the second time — should fire again.
    result = completeHabitStreak(habit);
    expect(result.habit.streakCount).toBe(5);
    expect(result.milestoneExp).toBe(20);
  });
});

describe('resetHabitStreak', () => {
  it('sets streakCount to 0', () => {
    const habit = makeHabit({ streakCount: 42 });
    const result = resetHabitStreak(habit);
    expect(result.streakCount).toBe(0);
  });

  it('does not touch lastCompletedPeriodKey or lastCheckedPeriodKey', () => {
    const habit = makeHabit({
      streakCount: 42,
      lastCompletedPeriodKey: '2026-09-15',
      lastCheckedPeriodKey: '2026-09-16',
    });
    const result = resetHabitStreak(habit);
    expect(result.lastCompletedPeriodKey).toBe('2026-09-15');
    expect(result.lastCheckedPeriodKey).toBe('2026-09-16');
  });

  it('returns a new object, not a mutation', () => {
    const habit = makeHabit({ streakCount: 5 });
    const result = resetHabitStreak(habit);
    expect(result).not.toBe(habit);
    expect(habit.streakCount).toBe(5);
  });
});
