import { describe, expect, it } from 'vitest';
import { assignSpecialIfEligible, assignUltIfEligible, rollOverdriveForLevelUps } from './levelRewards';
import { createRng } from './rng';
import { TUNING } from './constants/tuning';
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

describe('assignSpecialIfEligible', () => {
  it('is a no-op below SPECIAL_LEVEL', () => {
    const habits = [makeHabit({ id: 'a', period: 'daily' })];
    const result = assignSpecialIfEligible(habits, TUNING.SPECIAL_LEVEL - 1, createRng(1));
    expect(result).toBe(habits);
    expect(result.some((h) => h.isSpecial)).toBe(false);
  });

  it('is a no-op when there is no eligible (daily, good) habit', () => {
    const habits = [
      makeHabit({ id: 'weekly', period: 'weekly' }),
      makeHabit({ id: 'bad-daily', period: 'daily', isBad: true }),
    ];
    const result = assignSpecialIfEligible(habits, TUNING.SPECIAL_LEVEL, createRng(1));
    expect(result).toBe(habits);
  });

  it('assigns isSpecial to exactly one eligible habit at or above SPECIAL_LEVEL', () => {
    const habits = [
      makeHabit({ id: 'a', period: 'daily' }),
      makeHabit({ id: 'b', period: 'daily' }),
      makeHabit({ id: 'weekly', period: 'weekly' }),
      makeHabit({ id: 'bad', period: 'daily', isBad: true }),
    ];
    const result = assignSpecialIfEligible(habits, TUNING.SPECIAL_LEVEL, createRng(1));
    const specials = result.filter((h) => h.isSpecial);
    expect(specials).toHaveLength(1);
    expect(['a', 'b']).toContain(specials[0].id);
  });

  it('is a no-op once a habit already has isSpecial, even if called again', () => {
    const habits = [
      makeHabit({ id: 'a', period: 'daily', isSpecial: true }),
      makeHabit({ id: 'b', period: 'daily' }),
    ];
    const result = assignSpecialIfEligible(habits, TUNING.SPECIAL_LEVEL, createRng(2));
    expect(result).toBe(habits);
  });

  it('retroactively assigns once an eligible habit exists, having previously been a no-op', () => {
    let habits: Habit[] = [makeHabit({ id: 'weekly-only', period: 'weekly' })];
    habits = assignSpecialIfEligible(habits, TUNING.SPECIAL_LEVEL, createRng(1));
    expect(habits.some((h) => h.isSpecial)).toBe(false);

    habits = [...habits, makeHabit({ id: 'newly-added-daily', period: 'daily' })];
    habits = assignSpecialIfEligible(habits, TUNING.SPECIAL_LEVEL, createRng(1));
    expect(habits.find((h) => h.id === 'newly-added-daily')?.isSpecial).toBe(true);
  });
});

describe('assignUltIfEligible', () => {
  it('is a no-op below ULT_LEVEL', () => {
    const habits = [makeHabit({ id: 'a', period: 'weekly' })];
    const result = assignUltIfEligible(habits, TUNING.ULT_LEVEL - 1, createRng(1));
    expect(result).toBe(habits);
  });

  it('assigns isUlt to an eligible (weekly, good) habit at or above ULT_LEVEL', () => {
    const habits = [
      makeHabit({ id: 'weekly-good', period: 'weekly' }),
      makeHabit({ id: 'daily-good', period: 'daily' }),
      makeHabit({ id: 'weekly-bad', period: 'weekly', isBad: true }),
    ];
    const result = assignUltIfEligible(habits, TUNING.ULT_LEVEL, createRng(1));
    const ults = result.filter((h) => h.isUlt);
    expect(ults).toHaveLength(1);
    expect(ults[0].id).toBe('weekly-good');
  });
});

describe('rollOverdriveForLevelUps', () => {
  it('grants no Overdrive when levelsGained is 0', () => {
    const habits = [makeHabit({ id: 'a' })];
    const { habits: result, granted } = rollOverdriveForLevelUps(habits, 0, createRng(1));
    expect(result).toBe(habits);
    expect(granted).toEqual([]);
  });

  it('is a no-op when there are no good habits to grant it to', () => {
    const habits = [makeHabit({ id: 'a', isBad: true })];
    const { habits: result, granted } = rollOverdriveForLevelUps(habits, 5, createRng(1));
    expect(result).toBe(habits);
    expect(granted).toEqual([]);
  });

  it('never grants Overdrive to a bad habit, only good ones', () => {
    const habits = [makeHabit({ id: 'good', isBad: false }), makeHabit({ id: 'bad', isBad: true })];
    // A rng biased to always succeed the chance roll and always pick index 0
    // of whatever pool is passed in.
    const alwaysSucceedRng = () => 0;
    const { habits: result } = rollOverdriveForLevelUps(habits, 3, alwaysSucceedRng);
    expect(result.find((h) => h.id === 'bad')?.isOverdrive).toBeFalsy();
  });

  it('grants Overdrive to a random good habit roughly OVERDRIVE_CHANCE_PER_LEVEL of the time across many single-level rolls', () => {
    const iterations = 2000;
    let grantedCount = 0;
    for (let seed = 0; seed < iterations; seed++) {
      const habits = [makeHabit({ id: 'a' })];
      const { granted } = rollOverdriveForLevelUps(habits, 1, createRng(seed));
      if (granted.length > 0) grantedCount += 1;
    }
    expect(grantedCount / iterations).toBeCloseTo(TUNING.OVERDRIVE_CHANCE_PER_LEVEL, 1);
  });

  it('can grant multiple distinct habits across multiple levels gained in one call', () => {
    const habits = [makeHabit({ id: 'a' }), makeHabit({ id: 'b' }), makeHabit({ id: 'c' })];
    const alwaysSucceedRng = createRng(3);
    // Force every chance-roll to succeed by wrapping: first call of each
    // pair (the chance roll) always passes, second call (the pick) uses the
    // real rng for variety.
    let callCount = 0;
    const forcedRng = () => {
      callCount += 1;
      return callCount % 2 === 1 ? 0 : alwaysSucceedRng();
    };
    const { granted } = rollOverdriveForLevelUps(habits, 3, forcedRng);
    expect(granted.length).toBeGreaterThan(0);
    for (const habit of granted) {
      expect(habit.isOverdrive).toBe(true);
    }
  });

  it('does not double-count a habit that already had Overdrive granted earlier in the same call', () => {
    const habits = [makeHabit({ id: 'only-one' })];
    const alwaysSucceedRng = () => 0; // chance roll always passes, pick always index 0
    const { granted } = rollOverdriveForLevelUps(habits, 5, alwaysSucceedRng);
    // Only one habit exists, so it can only be granted once — every later
    // roll re-picks it but sees isOverdrive already true and skips.
    expect(granted).toHaveLength(1);
  });
});
