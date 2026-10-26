import { describe, expect, it } from 'vitest';
import {
  completeHabitStreak,
  migrateHabitRank,
  nextRankMilestone,
  rankForStreak,
  rankMultiplier,
  resetHabitStreak,
  streakMultiplier,
} from './streaks';
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
  ])('equals %s at streakCount=%s for a daily habit (default period)', (streakCount, expected) => {
    expect(streakMultiplier(streakCount)).toBeCloseTo(expected, 10);
    expect(streakMultiplier(streakCount, 'daily')).toBeCloseTo(expected, 10);
  });

  it.each([
    [0, 1.0],
    [1, 1.3],
    [10, 4.0],
    [30, 10.0],
  ])('equals %s at streakCount=%s for a weekly habit (3x the daily rate)', (streakCount, expected) => {
    expect(streakMultiplier(streakCount, 'weekly')).toBeCloseTo(expected, 10);
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
    [5, 5],
    [10, 12],
    [20, 30],
    [30, 55],
    [50, 112],
    [100, 300],
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
    expect(result.milestoneExp).toBe(5);

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
    expect(result.milestoneExp).toBe(5);
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

describe('skill ranks', () => {
  it('counts reached milestones per period', () => {
    expect([9, 10, 49, 50, 500, 9999].map((s) => rankForStreak(s, 'daily'))).toEqual([0, 1, 3, 4, 8, 8]);
    expect([2, 3, 9, 10, 167].map((s) => rankForStreak(s, 'weekly'))).toEqual([0, 1, 2, 3, 8]);
  });
  it('names the next milestone, none past rank 8', () => {
    expect(nextRankMilestone(0, 'daily')).toBe(10);
    expect(nextRankMilestone(5, 'daily')).toBe(200);
    expect(nextRankMilestone(2, 'weekly')).toBe(10);
    expect(nextRankMilestone(8, 'daily')).toBeUndefined();
  });
  it('ranks up on reaching the next milestone, and only then', () => {
    expect(completeHabitStreak(makeHabit({ streakCount: 9, rank: 0 })).habit.rank).toBe(1);
    expect(completeHabitStreak(makeHabit({ streakCount: 49, rank: 3 })).habit.rank).toBe(4);
    expect(completeHabitStreak(makeHabit({ streakCount: 2, period: 'weekly' })).habit.rank).toBe(1);
    expect(completeHabitStreak(makeHabit({ streakCount: 599, rank: 8 })).habit.rank).toBe(8);
  });
  it('a rank III skill rebuilding after a miss keeps rank III through 10, 20 and 30', () => {
    for (const s of [9, 19, 29]) expect(completeHabitStreak(makeHabit({ streakCount: s, rank: 3 })).habit.rank).toBe(3);
  });
  it('a miss resets the streak but never the rank', () => {
    expect(resetHabitStreak(makeHabit({ streakCount: 40, rank: 3 }))).toMatchObject({ streakCount: 0, rank: 3 });
  });
  it('multiplies by 1 + rank + 1% a day (healing +25% a rank, weeklies 3% a week)', () => {
    expect(rankMultiplier(makeHabit({ rank: 5, streakCount: 112 }))).toBeCloseTo(7.12);
    expect(rankMultiplier(makeHabit({ rank: 8, streakCount: 500 }))).toBeCloseTo(14);
    expect(rankMultiplier(makeHabit({ rank: 2, streakCount: 23, damageType: 'healing' }))).toBeCloseTo(1.73);
    expect(rankMultiplier(makeHabit({ rank: 2, streakCount: 9, period: 'weekly' }))).toBeCloseTo(3.27);
    expect(rankMultiplier(makeHabit({ streakCount: 0 }))).toBe(1); // no rank field
  });
  it('migrates a missing rank from the current streak, and only a missing one', () => {
    expect(migrateHabitRank(makeHabit({ streakCount: 34 })).rank).toBe(3);
    expect(migrateHabitRank(makeHabit({ streakCount: 12, period: 'weekly' })).rank).toBe(3);
    const ranked = makeHabit({ streakCount: 50, rank: 2 });
    expect(migrateHabitRank(ranked)).toBe(ranked);
  });
});
