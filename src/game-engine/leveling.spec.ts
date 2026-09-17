import { describe, expect, it } from 'vitest';
import { addExpAndResolveLevelUps, expToNextLevel, statAtLevel } from './leveling';
import { TUNING } from './constants/tuning';
import type { Character } from './types';

describe('expToNextLevel', () => {
  it('matches the formula at level 1', () => {
    expect(expToNextLevel(1)).toBe(25);
  });

  it('matches the formula at level 4', () => {
    expect(expToNextLevel(4)).toBe(100);
  });

  it('matches the formula at level 5 (fixed value)', () => {
    expect(expToNextLevel(5)).toBe(150);
  });

  it('matches the formula at level 6', () => {
    expect(expToNextLevel(6)).toBe(210);
  });

  it('matches the formula at level 10', () => {
    expect(expToNextLevel(10)).toBe(260);
  });

  it('is monotonically increasing across a range of levels', () => {
    let previous = expToNextLevel(1);
    for (let level = 2; level <= 50; level++) {
      const current = expToNextLevel(level);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
  });
});

describe('addExpAndResolveLevelUps', () => {
  function makeCharacter(overrides: Partial<Character> = {}): Character {
    return {
      level: 1,
      exp: 0,
      starterStats: { physicalDamage: 10, magicDamage: 10, healing: 6, health: 50 },
      currentHealth: 50,
      ...overrides,
    };
  }

  it('does not level up when exp gained is less than the threshold', () => {
    const character = makeCharacter();
    const result = addExpAndResolveLevelUps(character, 10);
    expect(result.levelsGained).toBe(0);
    expect(result.character.level).toBe(1);
    expect(result.character.exp).toBe(10);
  });

  it('levels up exactly once when exp gained equals the threshold', () => {
    const character = makeCharacter();
    const result = addExpAndResolveLevelUps(character, 25);
    expect(result.levelsGained).toBe(1);
    expect(result.character.level).toBe(2);
    expect(result.character.exp).toBe(0);
  });

  it('rolls over multiple level-ups from one large exp grant', () => {
    // level 1 -> 2 needs 25, 2 -> 3 needs 50, 3 -> 4 needs 75 (sum 150).
    // Granting 160 should jump 3 levels and leave exp = 10 at level 4.
    const character = makeCharacter();
    const result = addExpAndResolveLevelUps(character, 160);
    expect(result.levelsGained).toBe(3);
    expect(result.character.level).toBe(4);
    expect(result.character.exp).toBe(10);
  });

  it('preserves other character fields', () => {
    const character = makeCharacter({ currentHealth: 42 });
    const result = addExpAndResolveLevelUps(character, 5);
    expect(result.character.currentHealth).toBe(42);
    expect(result.character.starterStats).toEqual(character.starterStats);
  });
});

describe('statAtLevel', () => {
  it('equals the starter value exactly at level 1', () => {
    expect(statAtLevel(37.5, 1)).toBe(37.5);
  });

  it('matches the compounding formula at level 10', () => {
    const starter = 37.5;
    const expected = starter * Math.pow(1 + TUNING.LEVEL_STAT_GROWTH_RATE, 9);
    expect(statAtLevel(starter, 10)).toBeCloseTo(expected, 10);
  });
});
