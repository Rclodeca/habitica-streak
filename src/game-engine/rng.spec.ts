import { describe, expect, it } from 'vitest';
import { createRng, pickWeighted, shuffle } from './rng';

describe('createRng', () => {
  it('produces floats in [0, 1) when seeded', () => {
    const rng = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('produces the exact same sequence for the same seed', () => {
    const rngA = createRng(42);
    const rngB = createRng(42);
    const sequenceA = Array.from({ length: 20 }, () => rngA());
    const sequenceB = Array.from({ length: 20 }, () => rngB());
    expect(sequenceA).toEqual(sequenceB);
  });

  it('produces different sequences for different seeds', () => {
    const rngA = createRng(1);
    const rngB = createRng(2);
    const sequenceA = Array.from({ length: 10 }, () => rngA());
    const sequenceB = Array.from({ length: 10 }, () => rngB());
    expect(sequenceA).not.toEqual(sequenceB);
  });

  it('does not repeat itself trivially call-to-call', () => {
    const rng = createRng(7);
    const first = rng();
    const second = rng();
    expect(first).not.toBe(second);
  });

  it('falls back to Math.random-backed values in [0, 1) when unseeded', () => {
    const rng = createRng();
    for (let i = 0; i < 100; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('pickWeighted', () => {
  it('always picks the only key when it has all the weight', () => {
    const rng = () => 0.5;
    const result = pickWeighted<'only'>({ only: 1 }, rng);
    expect(result).toBe('only');
  });

  it('normalizes weights that do not sum to 1', () => {
    // weights sum to 10, "a" occupies [0, 4), "b" occupies [4, 10) of the roll range.
    const weights = { a: 4, b: 6 };
    expect(pickWeighted<'a' | 'b'>(weights, () => 0)).toBe('a');
    expect(pickWeighted<'a' | 'b'>(weights, () => 0.39999)).toBe('a');
    expect(pickWeighted<'a' | 'b'>(weights, () => 0.40001)).toBe('b');
    expect(pickWeighted<'a' | 'b'>(weights, () => 0.99999)).toBe('b');
  });

  it('distributes roughly proportionally to weight over many draws', () => {
    const weights = { physical: 0.4, magic: 0.4, healing: 0.2 };
    const rng = createRng(99);
    const counts: Record<string, number> = { physical: 0, magic: 0, healing: 0 };
    const iterations = 20000;
    for (let i = 0; i < iterations; i++) {
      const pick = pickWeighted<'physical' | 'magic' | 'healing'>(weights, rng);
      counts[pick] += 1;
    }
    expect(counts.physical / iterations).toBeCloseTo(0.4, 1);
    expect(counts.magic / iterations).toBeCloseTo(0.4, 1);
    expect(counts.healing / iterations).toBeCloseTo(0.2, 1);
  });
});

describe('shuffle', () => {
  it('returns an array with the same elements (order may differ)', () => {
    const rng = createRng(5);
    const result = shuffle([1, 2, 3, 4, 5], rng);
    expect(result).toHaveLength(5);
    expect([...result].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not mutate the input array', () => {
    const rng = createRng(5);
    const input = [1, 2, 3, 4, 5];
    shuffle(input, rng);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it('is deterministic for a given seed', () => {
    const resultA = shuffle([1, 2, 3, 4, 5], createRng(123));
    const resultB = shuffle([1, 2, 3, 4, 5], createRng(123));
    expect(resultA).toEqual(resultB);
  });

  it('produces a different order than the input across most seeds', () => {
    let differentCount = 0;
    for (let seed = 0; seed < 50; seed++) {
      const input = [1, 2, 3, 4, 5, 6, 7, 8];
      const result = shuffle(input, createRng(seed));
      if (!result.every((value, i) => value === input[i])) differentCount += 1;
    }
    expect(differentCount).toBeGreaterThan(40);
  });
});
