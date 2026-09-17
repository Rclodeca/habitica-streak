import { describe, expect, it } from 'vitest';
import { applyResist, bossExpReward } from './boss';
import { MILESTONE_EXP } from './constants/milestones';
import { addExpAndResolveLevelUps, statAtLevel } from './leveling';
import { createRng } from './rng';
import { streakMultiplier } from './streaks';
import {
  completeHabit,
  missHabit,
  resolveBossDefeatIfDead,
  resolvePlayerDeathIfDead,
} from './combat';
import type { Boss, Character, Habit } from './types';

function makeCharacter(overrides: Partial<Character> = {}): Character {
  const starterStats = { physicalDamage: 10, magicDamage: 10, healing: 6, health: 50 };
  return {
    level: 1,
    exp: 0,
    starterStats,
    currentHealth: starterStats.health,
    ...overrides,
  };
}

function makeBoss(overrides: Partial<Boss> = {}): Boss {
  return {
    index: 1,
    personality: 'balanced',
    maxHealth: 100,
    health: 100,
    physicalAttack: 20,
    magicAttack: 20,
    armor: 10,
    magicResist: 10,
    ...overrides,
  };
}

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-id',
    name: 'Test Habit',
    period: 'daily',
    difficulty: 'easy',
    damageType: 'physical',
    streakCount: 0,
    lastCompletedPeriodKey: null,
    lastCheckedPeriodKey: null,
    ...overrides,
  };
}

describe('completeHabit', () => {
  it('deals baseDamage * streakMultiplier reduced by the boss armor for a physical habit, increments streak, and returns milestone exp when the new streak crosses a milestone', () => {
    const character = makeCharacter();
    const habit = makeHabit({ damageType: 'physical', streakCount: 4 });
    const boss = makeBoss({ armor: 15, health: 500 });

    const result = completeHabit(character, habit, [habit], boss);

    // Solo habit of its type -> baseDamage is the full stat value at level.
    const statValue = statAtLevel(character.starterStats.physicalDamage, character.level);
    const expectedMultiplier = streakMultiplier(5); // streak bumped from 4 -> 5
    const expectedAmount = statValue * expectedMultiplier;
    const expectedDealt = applyResist(expectedAmount, boss.armor);

    expect(result.damageDealt).toBeCloseTo(expectedDealt, 10);
    expect(result.boss.health).toBeCloseTo(500 - expectedDealt, 10);
    expect(result.updatedHabit.streakCount).toBe(5);
    // Streak 4 -> 5 crosses the milestone at 5 (MILESTONE_EXP[5] = 20).
    expect(result.milestoneExp).toBe(MILESTONE_EXP[5]);
    expect(result.milestoneExp).toBe(20);
  });

  it('deals baseDamage * streakMultiplier reduced by the boss magicResist for a magic habit, and returns 0 milestone exp on a non-milestone completion', () => {
    const character = makeCharacter();
    const habit = makeHabit({ damageType: 'magic', streakCount: 0 });
    const boss = makeBoss({ magicResist: 25, health: 500 });

    const result = completeHabit(character, habit, [habit], boss);

    const statValue = statAtLevel(character.starterStats.magicDamage, character.level);
    const expectedAmount = statValue * streakMultiplier(1);
    const expectedDealt = applyResist(expectedAmount, boss.magicResist);

    expect(result.damageDealt).toBeCloseTo(expectedDealt, 10);
    expect(result.boss.health).toBeCloseTo(500 - expectedDealt, 10);
    // Streak 0 -> 1 does not cross any milestone.
    expect(result.milestoneExp).toBe(0);
  });

  it('splits damage proportionally to difficulty weight across multiple habits of the same type', () => {
    const character = makeCharacter();
    const easy = makeHabit({ id: 'easy', difficulty: 'easy', damageType: 'physical' });
    const hard = makeHabit({ id: 'hard', difficulty: 'hard', damageType: 'physical' });
    const boss = makeBoss({ armor: 0, health: 1000 }); // armor 0 -> no reduction, easier to reason about

    const result = completeHabit(character, easy, [easy, hard], boss);

    const statValue = statAtLevel(character.starterStats.physicalDamage, character.level);
    // easy weight=1, hard weight=2 -> easy gets 1/3 of the stat value.
    const expectedBase = statValue * (1 / 3);
    const expectedAmount = expectedBase * streakMultiplier(1);

    expect(result.damageDealt).toBeCloseTo(expectedAmount, 10);
  });

  it('never reduces boss health below 0', () => {
    const character = makeCharacter({ level: 20 });
    const habit = makeHabit({ damageType: 'physical' });
    const boss = makeBoss({ armor: 0, health: 1 });

    const result = completeHabit(character, habit, [habit], boss);

    expect(result.boss.health).toBe(0);
  });

  it('for a healing habit, increases currentHealth and does not touch the boss', () => {
    const character = makeCharacter({ currentHealth: 30 });
    const habit = makeHabit({ damageType: 'healing', streakCount: 0 });
    const boss = makeBoss();

    const result = completeHabit(character, habit, [habit], boss);

    const statValue = statAtLevel(character.starterStats.healing, character.level);
    const expectedHealAmount = statValue * streakMultiplier(1);
    const maxHealth = statAtLevel(character.starterStats.health, character.level);

    expect(result.character.currentHealth).toBeCloseTo(Math.min(30 + expectedHealAmount, maxHealth), 10);
    expect(result.boss).toBe(boss); // unchanged, same reference
    expect(result.damageDealt).toBeUndefined();
  });

  it('caps healing at max health for the character level', () => {
    const character = makeCharacter({ currentHealth: 49 });
    const habit = makeHabit({ damageType: 'healing', streakCount: 100 }); // huge streak -> huge heal
    const boss = makeBoss();

    const result = completeHabit(character, habit, [habit], boss);

    const maxHealth = statAtLevel(character.starterStats.health, character.level);
    expect(result.character.currentHealth).toBe(maxHealth);
  });
});

describe('missHabit', () => {
  it('reduces currentHealth using avgAttack * MISS_DAMAGE_FACTOR * (difficultyWeight/1.5), and resets streak', () => {
    const character = makeCharacter({ currentHealth: 100 });
    const habit = makeHabit({ difficulty: 'medium', streakCount: 7 });
    const boss = makeBoss({ physicalAttack: 30, magicAttack: 10 });

    const result = missHabit(character, habit, boss);

    const avgAttack = (30 + 10) / 2;
    const expectedDamage = avgAttack * 0.5 * (1.5 / 1.5); // medium weight = 1.5
    expect(result.character.currentHealth).toBeCloseTo(100 - expectedDamage, 10);
    expect(result.updatedHabit.streakCount).toBe(0);
  });

  it('never reduces currentHealth below 0', () => {
    const character = makeCharacter({ currentHealth: 1 });
    const habit = makeHabit({ difficulty: 'hard' });
    const boss = makeBoss({ physicalAttack: 1000, magicAttack: 1000 });

    const result = missHabit(character, habit, boss);

    expect(result.character.currentHealth).toBe(0);
  });
});

describe('resolveBossDefeatIfDead', () => {
  it('is a no-op when boss.health > 0', () => {
    const character = makeCharacter();
    const boss = makeBoss({ health: 1 });
    const rng = createRng(1);

    const result = resolveBossDefeatIfDead(character, boss, rng);

    expect(result.defeated).toBe(false);
    expect(result.levelsGained).toBe(0);
    expect(result.character).toBe(character);
    expect(result.boss).toBe(boss);
  });

  it('grants the correct EXP and spawns the next boss when boss.health <= 0', () => {
    const character = makeCharacter();
    const boss = makeBoss({ index: 3, health: 0 });
    const rng = createRng(1);

    const result = resolveBossDefeatIfDead(character, boss, rng);

    const expected = addExpAndResolveLevelUps(character, bossExpReward(3));
    expect(result.defeated).toBe(true);
    expect(result.character).toEqual(expected.character);
    expect(result.levelsGained).toBe(expected.levelsGained);
    expect(result.boss.index).toBe(4);
  });
});

describe('resolvePlayerDeathIfDead', () => {
  it('is a no-op when currentHealth > 0', () => {
    const character = makeCharacter({ currentHealth: 5 });
    const boss = makeBoss();
    const habits = [makeHabit()];
    const rng = createRng(1);

    const result = resolvePlayerDeathIfDead(character, boss, habits, rng);

    expect(result.died).toBe(false);
    expect(result.character).toBe(character);
    expect(result.boss).toBe(boss);
    expect(result.habits).toBe(habits);
  });

  it('produces a fresh level-1/0-exp character and resets the boss index to 1 when currentHealth <= 0', () => {
    const character = makeCharacter({ currentHealth: 0 });
    const boss = makeBoss({ index: 7 });
    const habits = [makeHabit()];
    const rng = createRng(1);

    const result = resolvePlayerDeathIfDead(character, boss, habits, rng);

    expect(result.died).toBe(true);
    expect(result.character.level).toBe(1);
    expect(result.character.exp).toBe(0);
    expect(result.character.currentHealth).toBe(result.character.starterStats.health);
    expect(result.boss.index).toBe(1);
  });

  it('retains habit definitions (id/name/period/difficulty) but resets streak and re-rolls damageType', () => {
    const character = makeCharacter({ currentHealth: -5 });
    const boss = makeBoss();
    const original = makeHabit({
      id: 'keep-me',
      name: 'Read a book',
      period: 'weekly',
      difficulty: 'hard',
      damageType: 'physical',
      streakCount: 12,
    });

    const result = resolvePlayerDeathIfDead(character, boss, [original], createRng(1));

    expect(result.habits).toHaveLength(1);
    const [rerolled] = result.habits;
    expect(rerolled.id).toBe(original.id);
    expect(rerolled.name).toBe(original.name);
    expect(rerolled.period).toBe(original.period);
    expect(rerolled.difficulty).toBe(original.difficulty);
    expect(rerolled.streakCount).toBe(0);
  });

  it('actually re-randomizes damageType across many seeds (not just structurally present)', () => {
    const original = makeHabit({ damageType: 'physical' });
    const counts: Record<string, number> = { physical: 0, magic: 0, healing: 0 };
    const iterations = 300;
    let differentFromOriginal = 0;

    for (let seed = 0; seed < iterations; seed++) {
      const character = makeCharacter({ currentHealth: 0 });
      const boss = makeBoss();
      const rng = createRng(seed);
      const result = resolvePlayerDeathIfDead(character, boss, [original], rng);
      const damageType = result.habits[0].damageType;
      counts[damageType] += 1;
      if (damageType !== original.damageType) differentFromOriginal += 1;
    }

    // With weights 0.4/0.4/0.2, most seeds should NOT reroll back to 'physical'.
    expect(differentFromOriginal).toBeGreaterThan(iterations * 0.3);
    expect(counts.magic).toBeGreaterThan(0);
    expect(counts.healing).toBeGreaterThan(0);
  });
});
