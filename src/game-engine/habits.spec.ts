import { describe, expect, it } from 'vitest';
import { computeDamageSplit, createHabit, rerollDamageType } from './habits';
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

  it('picks damageType roughly 40/40/20 physical/magic/healing over many runs', () => {
    const rng = createRng(123);
    const counts: Record<string, number> = { physical: 0, magic: 0, healing: 0 };
    const iterations = 2000;
    for (let i = 0; i < iterations; i++) {
      const habit = createHabit('H', 'daily', 'easy', false, rng);
      counts[habit.damageType] += 1;
    }
    expect(counts.physical / iterations).toBeCloseTo(0.4, 1);
    expect(counts.magic / iterations).toBeCloseTo(0.4, 1);
    expect(counts.healing / iterations).toBeCloseTo(0.2, 1);
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
    expect(['physical', 'magic', 'healing']).toContain(rerolled.damageType);
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
    expect(split.size).toBe(5);
    for (const habit of habits) {
      expect(split.get(habit.id)).toBe(20);
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

    for (const habit of easyHabits) {
      expect(split.get(habit.id)).toBeCloseTo(100 / 7, 4);
    }
    for (const habit of hardHabits) {
      expect(split.get(habit.id)).toBeCloseTo(200 / 7, 4);
    }

    const total = [...split.values()].reduce((sum, value) => sum + value, 0);
    expect(total).toBeCloseTo(100, 10);
  });

  it('gives a single habit the full stat value', () => {
    const habit = makeHabit({ id: 'solo', difficulty: 'medium' });
    const split = computeDamageSplit([habit], 42);
    expect(split.get('solo')).toBe(42);
  });

  it('returns an empty map without dividing by zero when there are no habits of that type', () => {
    const split = computeDamageSplit([], 100);
    expect(split.size).toBe(0);
    expect(split instanceof Map).toBe(true);
  });
});
