import { describe, expect, it } from 'vitest';
import { addExpAndResolveLevelUps, effectiveCritChance, effectiveStat, expToNextLevel, statAtLevel } from './leveling';
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
      ownedItemIds: [],
      equippedItemIds: [],
      critChance: 0.01,
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

  it('heals a percent of max health on level-up when a lifesteal item is equipped', () => {
    const character = makeCharacter({
      currentHealth: 10,
      ownedItemIds: ['vampiric-fang'],
      equippedItemIds: ['vampiric-fang'],
    });
    const result = addExpAndResolveLevelUps(character, 25); // exactly enough for 1 level

    expect(result.levelsGained).toBe(1);
    const maxHealthAtNewLevel = statAtLevel(character.starterStats.health, result.character.level);
    const expectedHeal = maxHealthAtNewLevel * 0.05; // vampiric-fang bonusPercent: 5
    expect(result.character.currentHealth).toBeCloseTo(10 + expectedHeal, 10);
  });

  it('does not heal on level-up without a lifesteal item equipped', () => {
    const character = makeCharacter({ currentHealth: 10 });
    const result = addExpAndResolveLevelUps(character, 25);

    expect(result.levelsGained).toBe(1);
    expect(result.character.currentHealth).toBe(10);
  });

  it('does not heal from lifesteal when no level was gained', () => {
    const character = makeCharacter({
      currentHealth: 10,
      ownedItemIds: ['vampiric-fang'],
      equippedItemIds: ['vampiric-fang'],
    });
    const result = addExpAndResolveLevelUps(character, 5); // below the level-1 threshold

    expect(result.levelsGained).toBe(0);
    expect(result.character.currentHealth).toBe(10);
  });

  it('caps levelsGained instead of hanging on an astronomically large single exp grant', () => {
    // A single boss-kill EXP reward can in principle be enormous (e.g. a
    // very deep boss index) while expToNextLevel only grows quadratically —
    // without a cap, resolving this would walk one level at a time for an
    // impractically long time. See MAX_LEVEL_UPS_PER_GRANT in leveling.ts.
    const character = makeCharacter();
    const result = addExpAndResolveLevelUps(character, 1e60);

    expect(result.levelsGained).toBe(2000);
    expect(Number.isFinite(result.character.exp)).toBe(true);
    expect(Number.isFinite(result.character.level)).toBe(true);
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

describe('effectiveStat', () => {
  function makeCharacter(overrides: Partial<Character> = {}): Character {
    return {
      level: 1,
      exp: 0,
      starterStats: { physicalDamage: 10, magicDamage: 10, healing: 6, health: 50 },
      currentHealth: 50,
      ownedItemIds: [],
      equippedItemIds: [],
      critChance: 0.01,
      ...overrides,
    };
  }

  it('equals statAtLevel with no equipped items', () => {
    const character = makeCharacter();
    expect(effectiveStat(character, 'physicalDamage')).toBeCloseTo(
      statAtLevel(character.starterStats.physicalDamage, character.level),
      10,
    );
  });

  it('scales up by the equipped item bonus percent', () => {
    const character = makeCharacter({ ownedItemIds: ['rusty-blade'], equippedItemIds: ['rusty-blade'] });
    const base = statAtLevel(character.starterStats.physicalDamage, character.level);
    expect(effectiveStat(character, 'physicalDamage')).toBeCloseTo(base * 1.03, 10);
  });

  it('sums bonuses from multiple equipped items on the same stat', () => {
    const character = makeCharacter({
      ownedItemIds: ['rusty-blade', 'steel-sword'],
      equippedItemIds: ['rusty-blade', 'steel-sword'],
    });
    const base = statAtLevel(character.starterStats.physicalDamage, character.level);
    expect(effectiveStat(character, 'physicalDamage')).toBeCloseTo(base * 1.09, 10);
  });
});

describe('addExpAndResolveLevelUps with item bonuses', () => {
  function makeCharacter(overrides: Partial<Character> = {}): Character {
    return {
      level: 1,
      exp: 0,
      starterStats: { physicalDamage: 10, magicDamage: 10, healing: 6, health: 50 },
      currentHealth: 50,
      ownedItemIds: [],
      equippedItemIds: [],
      critChance: 0.01,
      ...overrides,
    };
  }

  it('scales exp gained by the equipped expGain bonus before applying it', () => {
    const character = makeCharacter({ ownedItemIds: ['lucky-coin'], equippedItemIds: ['lucky-coin'] });
    const result = addExpAndResolveLevelUps(character, 10);
    expect(result.character.exp).toBeCloseTo(10 * 1.03, 10);
  });
});

describe('effectiveCritChance', () => {
  function makeCharacter(overrides: Partial<Character> = {}): Character {
    return {
      level: 1,
      exp: 0,
      starterStats: { physicalDamage: 10, magicDamage: 10, healing: 6, health: 50 },
      currentHealth: 50,
      ownedItemIds: [],
      equippedItemIds: [],
      critChance: 0.01,
      ...overrides,
    };
  }

  it('equals the character base crit chance with no items equipped', () => {
    expect(effectiveCritChance(makeCharacter())).toBeCloseTo(0.01, 10);
  });

  it('adds equipped critChance item bonuses (as percentage points) to the base', () => {
    const character = makeCharacter({ ownedItemIds: ['lucky-dagger'], equippedItemIds: ['lucky-dagger'] });
    expect(effectiveCritChance(character)).toBeCloseTo(0.01 + 0.02, 10);
  });

  it('caps at TUNING.CRIT_CHANCE_CAP even when base + item bonuses would exceed it', () => {
    const character = makeCharacter({
      critChance: 0.9, // synthetic — real base is always TUNING.BASE_CRIT_CHANCE, but the cap must hold regardless
      ownedItemIds: ['eagle-eye-lens'],
      equippedItemIds: ['eagle-eye-lens'],
    });
    expect(effectiveCritChance(character)).toBe(TUNING.CRIT_CHANCE_CAP);
  });
});
