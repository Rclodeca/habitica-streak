import { describe, expect, it } from 'vitest';
import {
  computeDamageSplit,
  createHabit,
  dueFraction,
  isDueOn,
  migrateHabitDamageType,
  nextDueDay,
  normalizeDays,
  poolSizeMultiplier,
  rerollDamageType,
} from './habits';
import { createRng } from './rng';
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

describe('createHabit', () => {
  it('initializes streak and period-key fields', () => {
    const rng = createRng(1);
    const habit = createHabit('Drink water', 'daily', 'easy', false, rng);
    expect(habit.name).toBe('Drink water');
    expect(habit.period).toBe('daily');
    expect(habit.difficulty).toBe('easy');
    expect(habit.isBad).toBe(false);
    expect(habit.streakCount).toBe(0);
    expect(habit.rank).toBe(0);
    expect(habit.lastCompletedPeriodKey).toBeNull();
    expect(habit.lastCheckedPeriodKey).toBeNull();
  });

  it('sets isBad from the given flag', () => {
    const rng = createRng(1);
    const habit = createHabit('Skip dessert', 'daily', 'easy', true, rng);
    expect(habit.isBad).toBe(true);
  });

  it('generates a unique id per habit', () => {
    const rng = createRng(2);
    const a = createHabit('A', 'daily', 'easy', false, rng);
    const b = createHabit('B', 'daily', 'easy', false, rng);
    expect(a.id).not.toBe(b.id);
    expect(typeof a.id).toBe('string');
    expect(a.id.length).toBeGreaterThan(0);
  });

  it('picks damageType roughly 38/38/16/8 physical/magic/healing/trueDamage over many runs, never expGain', () => {
    const rng = createRng(123);
    const counts: Record<string, number> = { physical: 0, magic: 0, healing: 0, trueDamage: 0 };
    const iterations = 2000;
    for (let i = 0; i < iterations; i++) {
      const habit = createHabit('H', 'daily', 'easy', false, rng);
      counts[habit.damageType] += 1;
    }
    expect(counts.physical / iterations).toBeCloseTo(0.38, 1);
    expect(counts.magic / iterations).toBeCloseTo(0.38, 1);
    expect(counts.healing / iterations).toBeCloseTo(0.16, 1);
    expect(counts.trueDamage / iterations).toBeCloseTo(0.08, 1);
    expect(Object.keys(counts)).not.toContain('expGain');
  });

  it('only picks physical or magic, split evenly, for a first habit', () => {
    const rng = createRng(123);
    const counts: Record<string, number> = { physical: 0, magic: 0, healing: 0, trueDamage: 0 };
    const iterations = 2000;
    for (let i = 0; i < iterations; i++) {
      const habit = createHabit('H', 'daily', 'easy', false, rng, undefined, true);
      counts[habit.damageType] += 1;
    }
    expect(counts.healing).toBe(0);
    expect(counts.trueDamage).toBe(0);
    expect(counts.physical / iterations).toBeCloseTo(0.5, 1);
    expect(counts.magic / iterations).toBeCloseTo(0.5, 1);
  });
});

describe('rerollDamageType', () => {
  it('returns a copy with a freshly rolled damageType, leaving other fields intact', () => {
    const rng = createRng(3);
    const original = makeHabit({ damageType: 'physical' });
    const rerolled = rerollDamageType(original, rng);
    expect(rerolled).not.toBe(original);
    expect(rerolled.id).toBe(original.id);
    expect(rerolled.name).toBe(original.name);
    expect(rerolled.streakCount).toBe(original.streakCount);
    expect(['physical', 'magic', 'healing', 'trueDamage']).toContain(rerolled.damageType);
  });

  it('with excludeCurrent, never returns the current damage type', () => {
    for (let seed = 0; seed < 300; seed++) {
      const rerolled = rerollDamageType(makeHabit({ damageType: 'physical' }), createRng(seed), true);
      expect(rerolled.damageType).not.toBe('physical');
    }
  });

  it('does not mutate the original habit', () => {
    const rng = createRng(4);
    const original = makeHabit({ damageType: 'healing' });
    rerollDamageType(original, rng);
    expect(original.damageType).toBe('healing');
  });
});

describe('computeDamageSplit', () => {
  it('reproduces the seed doc worked example: 5 easy same-type habits, S=100 -> each exactly 20', () => {
    const habits = Array.from({ length: 5 }, (_, i) =>
      makeHabit({ id: `habit-${i}`, difficulty: 'easy', damageType: 'physical' }),
    );
    const split = computeDamageSplit(habits, 100);
    const poolMultiplier = poolSizeMultiplier(5);
    expect(split.size).toBe(5);
    for (const habit of habits) {
      expect(split.get(habit.id)).toBeCloseTo((100 * poolMultiplier) / 5, 10);
    }
  });

  it('splits mixed difficulty (3 easy + 2 hard) proportionally to weight and sums to S', () => {
    const easyHabits = Array.from({ length: 3 }, (_, i) =>
      makeHabit({ id: `easy-${i}`, difficulty: 'easy', damageType: 'physical' }),
    );
    const hardHabits = Array.from({ length: 2 }, (_, i) =>
      makeHabit({ id: `hard-${i}`, difficulty: 'hard', damageType: 'physical' }),
    );
    const habits = [...easyHabits, ...hardHabits];
    const split = computeDamageSplit(habits, 100);

    const pool = 100 * poolSizeMultiplier(3 * 1 + 2 * 2);
    for (const habit of easyHabits) {
      expect(split.get(habit.id)).toBeCloseTo(pool / 7, 4);
    }
    for (const habit of hardHabits) {
      expect(split.get(habit.id)).toBeCloseTo((pool * 2) / 7, 4);
    }

    const total = [...split.values()].reduce((sum, value) => sum + value, 0);
    expect(total).toBeCloseTo(pool, 10);
  });

  it('gives a single habit the full stat value', () => {
    const habit = makeHabit({ id: 'solo', difficulty: 'medium' });
    const split = computeDamageSplit([habit], 42);
    expect(split.get('solo')).toBe(42);
  });

  it('the approved example: a lone medium daily at 100 and a Mon-Wed-Sat medium both hit ~76', () => {
    const reading = makeHabit({ id: 'reading', difficulty: 'medium' });
    const gym = makeHabit({ id: 'gym', difficulty: 'medium', days: [0, 2, 5] });
    expect(computeDamageSplit([reading], 100).get('reading')).toBe(100);
    const split = computeDamageSplit([reading, gym], 100);
    expect(split.get('reading')).toBeCloseTo(76, 6);
    expect(split.get('gym')).toBeCloseTo(76, 6);
  });

  it('caps a hit at the whole pool, so a lone one-day habit hits like a lone daily', () => {
    const split = computeDamageSplit([makeHabit({ id: 'once', difficulty: 'medium', days: [3] })], 100);
    expect(split.get('once')).toBeCloseTo(100, 6);
  });

  it('returns an empty map without dividing by zero when there are no habits of that type', () => {
    const split = computeDamageSplit([], 100);
    expect(split.size).toBe(0);
    expect(split instanceof Map).toBe(true);
  });
});

describe('poolSizeMultiplier', () => {
  it('is exactly 1 for a single medium habit', () => {
    expect(poolSizeMultiplier(1.5)).toBe(1);
  });

  it('grows 20% of base per extra medium-equivalent habit', () => {
    expect(poolSizeMultiplier(1.5 * 2)).toBeCloseTo(1.2, 10);
    expect(poolSizeMultiplier(1.5 * 10)).toBeCloseTo(2.8, 10);
  });

  it('weights growth by difficulty — an easy habit adds less than a hard one', () => {
    expect(poolSizeMultiplier(1.5 + 1)).toBeLessThan(poolSizeMultiplier(1.5 + 2));
  });

  it('never drops below 1 (a lone easy habit is not penalized)', () => {
    expect(poolSizeMultiplier(1)).toBe(1);
  });
});

describe('removed expGain damage type', () => {
  it('rerollDamageType never produces expGain, with or without excludeCurrent', () => {
    for (let seed = 0; seed < 500; seed++) {
      const habit = makeHabit({ damageType: 'physical' });
      expect(rerollDamageType(habit, createRng(seed)).damageType).not.toBe('expGain');
      expect(rerollDamageType(habit, createRng(seed), true).damageType).not.toBe('expGain');
    }
  });

  it('migrateHabitDamageType re-rolls a saved expGain habit to a remaining type and keeps everything else', () => {
    const legacy = makeHabit({ damageType: 'expGain' as never, streakCount: 7 });
    const migrated = migrateHabitDamageType(legacy, createRng(1));
    expect(['physical', 'magic', 'healing', 'trueDamage']).toContain(migrated.damageType);
    expect(migrated.id).toBe(legacy.id);
    expect(migrated.streakCount).toBe(7);
  });

  it('migrateHabitDamageType returns a habit with a valid type untouched (same object)', () => {
    const habit = makeHabit({ damageType: 'magic' });
    expect(migrateHabitDamageType(habit, createRng(1))).toBe(habit);
  });
});

describe('set days', () => {
  it('normalizeDays sorts, dedupes, and turns all seven or none into undefined', () => {
    expect(normalizeDays([5, 0, 2, 2])).toEqual([0, 2, 5]);
    expect(normalizeDays([0, 1, 2, 3, 4, 5, 6])).toBeUndefined();
    expect(normalizeDays([])).toBeUndefined();
    expect(normalizeDays(undefined)).toBeUndefined();
  });

  it('dueFraction is days/7 for a set-day daily and 1 otherwise', () => {
    expect(dueFraction(makeHabit({ days: [0, 2, 5] }))).toBeCloseTo(3 / 7, 10);
    expect(dueFraction(makeHabit())).toBe(1);
    expect(dueFraction(makeHabit({ period: 'weekly', days: [0] }))).toBe(1);
  });

  it('isDueOn follows the Pacific business day', () => {
    const monOnly = makeHabit({ days: [0] });
    expect(isDueOn(monOnly, new Date(Date.UTC(2024, 0, 16, 10, 59)))).toBe(true); // Tue 02:59 PST is still Monday
    expect(isDueOn(monOnly, new Date(Date.UTC(2024, 0, 16, 11, 0)))).toBe(false);
  });

  it('isDueOn is always true for a plain daily and for a weekly, even with stray days', () => {
    const tue = new Date(Date.UTC(2024, 0, 16, 20));
    expect(isDueOn(makeHabit(), tue)).toBe(true);
    expect(isDueOn(makeHabit({ period: 'weekly', days: [0] }), tue)).toBe(true);
  });

  it('nextDueDay wraps around the week', () => {
    expect(nextDueDay([0, 2, 5], 1)).toBe(2);
    expect(nextDueDay([0, 2, 5], 5)).toBe(0);
    expect(nextDueDay([3], 3)).toBe(3);
  });

  it('createHabit keeps normalized days on a daily only', () => {
    expect(createHabit('Gym', 'daily', 'hard', false, createRng(1), [5, 0, 2]).days).toEqual([0, 2, 5]);
    expect('days' in createHabit('Read', 'daily', 'easy', false, createRng(1), [0, 1, 2, 3, 4, 5, 6])).toBe(false);
    expect('days' in createHabit('Hike', 'weekly', 'hard', false, createRng(1), [0])).toBe(false);
  });
});
