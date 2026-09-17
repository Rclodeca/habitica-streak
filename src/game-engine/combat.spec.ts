import { describe, expect, it } from 'vitest';
import { applyResist, bossExpReward } from './boss';
import { MILESTONE_EXP } from './constants/milestones';
import { TUNING } from './constants/tuning';
import { ITEM_CATALOG } from './items';
import { addExpAndResolveLevelUps, effectiveStat, statAtLevel } from './leveling';
import { createRng } from './rng';
import { streakMultiplier } from './streaks';
import {
  completeHabit,
  missHabit,
  resolveBossDefeatIfDead,
  resolvePlayerDeathIfDead,
  reviveWithFeatherIfEquipped,
} from './combat';
import type { Boss, Character, Habit } from './types';

// Deterministic rng stand-ins for crit rolls: a value this low always beats
// any crit chance used in these tests (never crits); a value of 0 always
// beats it the other way (always crits, since 0 < any positive chance).
const noCritRng = () => 0.99;
const alwaysCritRng = () => 0;

function makeCharacter(overrides: Partial<Character> = {}): Character {
  const starterStats = { physicalDamage: 10, magicDamage: 10, healing: 6, health: 50 };
  return {
    level: 1,
    exp: 0,
    starterStats,
    currentHealth: starterStats.health,
    ownedItemIds: [],
    equippedItemIds: [],
    critChance: 0.01,
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
    critChance: 0.01,
    reflectPct: 0,
    lifestealPct: 0,
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

    const result = completeHabit(character, habit, [habit], boss, noCritRng);

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

    const result = completeHabit(character, habit, [habit], boss, noCritRng);

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

    const result = completeHabit(character, easy, [easy, hard], boss, noCritRng);

    const statValue = statAtLevel(character.starterStats.physicalDamage, character.level);
    // easy weight=1, hard weight=2 -> easy gets 1/3 of the stat value.
    const expectedBase = statValue * (1 / 3);
    const expectedAmount = expectedBase * streakMultiplier(1);

    expect(result.damageDealt).toBeCloseTo(expectedAmount, 10);
  });

  it('deals more damage when an item bonus is equipped for that damage type', () => {
    const character = makeCharacter({ ownedItemIds: ['rusty-blade'], equippedItemIds: ['rusty-blade'] });
    const habit = makeHabit({ damageType: 'physical' });
    const boss = makeBoss({ armor: 0, health: 1000 });

    const result = completeHabit(character, habit, [habit], boss, noCritRng);

    const boosted = effectiveStat(character, 'physicalDamage');
    expect(boosted).toBeCloseTo(statAtLevel(character.starterStats.physicalDamage, character.level) * 1.03, 10);
    expect(result.damageDealt).toBeCloseTo(boosted * streakMultiplier(1), 10);
  });

  it('never reduces boss health below 0', () => {
    const character = makeCharacter({ level: 20 });
    const habit = makeHabit({ damageType: 'physical' });
    const boss = makeBoss({ armor: 0, health: 1 });

    const result = completeHabit(character, habit, [habit], boss, noCritRng);

    expect(result.boss.health).toBe(0);
  });

  it('for a healing habit, increases currentHealth and does not touch the boss', () => {
    const character = makeCharacter({ currentHealth: 30 });
    const habit = makeHabit({ damageType: 'healing', streakCount: 0 });
    const boss = makeBoss();

    const result = completeHabit(character, habit, [habit], boss, noCritRng);

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

    const result = completeHabit(character, habit, [habit], boss, noCritRng);

    const maxHealth = statAtLevel(character.starterStats.health, character.level);
    expect(result.character.currentHealth).toBe(maxHealth);
  });

  it('heals a percent of damage dealt back as health when a lifesteal item is equipped', () => {
    const character = makeCharacter({
      currentHealth: 1,
      ownedItemIds: ['vampiric-fang'],
      equippedItemIds: ['vampiric-fang'],
    });
    const habit = makeHabit({ damageType: 'physical' });
    const boss = makeBoss({ armor: 0, health: 1000 });

    const result = completeHabit(character, habit, [habit], boss, noCritRng);

    const expectedHeal = (result.damageDealt ?? 0) * 0.05; // vampiric-fang bonusPercent: 5
    expect(result.character.currentHealth).toBeCloseTo(1 + expectedHeal, 10);
  });

  it('does not heal from lifesteal on a healing habit (no damage dealt)', () => {
    const character = makeCharacter({
      currentHealth: 1,
      ownedItemIds: ['vampiric-fang'],
      equippedItemIds: ['vampiric-fang'],
    });
    const habit = makeHabit({ damageType: 'healing' });
    const boss = makeBoss();

    const result = completeHabit(character, habit, [habit], boss, noCritRng);

    // Healed only by the habit's own healing amount, not doubled by lifesteal.
    const statValue = statAtLevel(character.starterStats.healing, character.level);
    const expectedHealAmount = statValue * streakMultiplier(1);
    expect(result.character.currentHealth).toBeCloseTo(1 + expectedHealAmount, 10);
  });

  it('does not heal when no lifesteal item is equipped', () => {
    const character = makeCharacter({ currentHealth: 1 });
    const habit = makeHabit({ damageType: 'physical' });
    const boss = makeBoss({ armor: 0, health: 1000 });

    const result = completeHabit(character, habit, [habit], boss, noCritRng);

    expect(result.character.currentHealth).toBe(1);
  });

  it('damages the character back for a percent of damage dealt when the boss has reflect', () => {
    const character = makeCharacter({ currentHealth: 50 });
    const habit = makeHabit({ damageType: 'physical' });
    const boss = makeBoss({ armor: 0, health: 1000, reflectPct: 0.2 });

    const result = completeHabit(character, habit, [habit], boss, noCritRng);

    const expectedReflect = (result.damageDealt ?? 0) * 0.2;
    expect(result.character.currentHealth).toBeCloseTo(50 - expectedReflect, 10);
  });

  it('nets lifesteal healing against boss reflect damage into a single health change', () => {
    const character = makeCharacter({
      currentHealth: 50,
      ownedItemIds: ['vampiric-fang'],
      equippedItemIds: ['vampiric-fang'],
    });
    const habit = makeHabit({ damageType: 'physical' });
    const boss = makeBoss({ armor: 0, health: 1000, reflectPct: 0.2 });

    const result = completeHabit(character, habit, [habit], boss, noCritRng);

    const dealt = result.damageDealt ?? 0;
    const expectedHealthChange = dealt * 0.05 - dealt * 0.2; // vampiric-fang 5% lifesteal vs 20% reflect
    expect(result.character.currentHealth).toBeCloseTo(50 + expectedHealthChange, 10);
  });

  it('never reduces currentHealth below 0 from reflect', () => {
    const character = makeCharacter({ level: 20, currentHealth: 1 });
    const habit = makeHabit({ damageType: 'physical' });
    const boss = makeBoss({ armor: 0, health: 1_000_000, reflectPct: 0.2 });

    const result = completeHabit(character, habit, [habit], boss, noCritRng);

    expect(result.character.currentHealth).toBe(0);
  });

  it('does not apply reflect on a healing habit (no damage dealt)', () => {
    const character = makeCharacter({ currentHealth: 30 });
    const habit = makeHabit({ damageType: 'healing' });
    const boss = makeBoss({ reflectPct: 0.2 });

    const result = completeHabit(character, habit, [habit], boss, noCritRng);

    const statValue = statAtLevel(character.starterStats.healing, character.level);
    const expectedHealAmount = statValue * streakMultiplier(1);
    expect(result.character.currentHealth).toBeCloseTo(30 + expectedHealAmount, 10);
  });
});

describe('missHabit', () => {
  it('damages using a random pick of the boss physical/magic attack (not their average), scaled by difficulty weight, and resets streak', () => {
    const character = makeCharacter({ currentHealth: 100 });
    const habit = makeHabit({ difficulty: 'medium', streakCount: 7 });
    const boss = makeBoss({ physicalAttack: 30, magicAttack: 10 });

    const result = missHabit(character, habit, boss, noCritRng); // 0.99 -> picks magicAttack, no crit

    const expectedDamage = boss.magicAttack * TUNING.MISS_DAMAGE_FACTOR * (1.5 / 1.5); // medium weight = 1.5
    expect(result.character.currentHealth).toBeCloseTo(100 - expectedDamage, 10);
    expect(result.updatedHabit.streakCount).toBe(0);
  });

  it('picks physicalAttack instead of magicAttack when the rng rolls below 0.5', () => {
    const character = makeCharacter({ currentHealth: 100 });
    const habit = makeHabit({ difficulty: 'medium' });
    const boss = makeBoss({ physicalAttack: 30, magicAttack: 10 });
    const pickPhysicalNoCritRng = () => 0.02; // < 0.5 -> physicalAttack; >= boss.critChance (0.01) -> no crit

    const result = missHabit(character, habit, boss, pickPhysicalNoCritRng);

    const expectedDamage = boss.physicalAttack * TUNING.MISS_DAMAGE_FACTOR * (1.5 / 1.5);
    expect(result.character.currentHealth).toBeCloseTo(100 - expectedDamage, 10);
  });

  it('never reduces currentHealth below 0', () => {
    const character = makeCharacter({ currentHealth: 1 });
    const habit = makeHabit({ difficulty: 'hard' });
    const boss = makeBoss({ physicalAttack: 1000, magicAttack: 1000 });

    const result = missHabit(character, habit, boss, noCritRng);

    expect(result.character.currentHealth).toBe(0);
  });

  it('heals the boss for a percent of damage dealt when it has lifesteal', () => {
    const character = makeCharacter({ currentHealth: 100 });
    const habit = makeHabit({ difficulty: 'medium' });
    const boss = makeBoss({ physicalAttack: 20, magicAttack: 20, health: 50, lifestealPct: 0.1 });

    const result = missHabit(character, habit, boss, noCritRng);

    const damageDealt = 100 - result.character.currentHealth;
    expect(result.boss.health).toBeCloseTo(50 + damageDealt * 0.1, 10);
  });

  it('caps boss lifesteal healing at maxHealth', () => {
    const character = makeCharacter({ currentHealth: 100 });
    const habit = makeHabit({ difficulty: 'medium' });
    const boss = makeBoss({ physicalAttack: 20, magicAttack: 20, health: 99, maxHealth: 100, lifestealPct: 1 });

    const result = missHabit(character, habit, boss, noCritRng);

    expect(result.boss.health).toBe(100);
  });

  it('leaves the boss untouched when it has no lifesteal', () => {
    const character = makeCharacter({ currentHealth: 100 });
    const habit = makeHabit({ difficulty: 'medium' });
    const boss = makeBoss({ physicalAttack: 20, magicAttack: 20 });

    const result = missHabit(character, habit, boss, noCritRng);

    expect(result.boss).toBe(boss);
  });
});

describe('crit chance', () => {
  it('completeHabit doubles the pre-resist damage and reports wasCrit=true on a crit roll', () => {
    const character = makeCharacter();
    const habit = makeHabit({ damageType: 'physical' });
    const boss = makeBoss({ armor: 0, health: 1000 });

    const normal = completeHabit(character, habit, [habit], boss, noCritRng);
    const habitForCrit = makeHabit({ damageType: 'physical' }); // fresh streak so both start at 0 -> 1
    const crit = completeHabit(character, habitForCrit, [habitForCrit], boss, alwaysCritRng);

    expect(crit.wasCrit).toBe(true);
    expect(normal.wasCrit).toBe(false);
    expect(crit.damageDealt).toBeCloseTo((normal.damageDealt ?? 0) * TUNING.CRIT_MULTIPLIER, 10);
  });

  it('healing habits never crit, regardless of the rng roll', () => {
    const character = makeCharacter({ currentHealth: 1 });
    const habit = makeHabit({ damageType: 'healing' });
    const boss = makeBoss();

    const result = completeHabit(character, habit, [habit], boss, alwaysCritRng);

    expect(result.wasCrit).toBeUndefined();
  });

  it('missHabit doubles damage and reports wasCrit=true on a crit roll, using the boss crit chance', () => {
    const character = makeCharacter({ currentHealth: 100 });
    const habit = makeHabit({ difficulty: 'medium' });
    // physicalAttack === magicAttack so the attack-type coin flip doesn't affect the comparison below.
    const boss = makeBoss({ physicalAttack: 20, magicAttack: 20 });

    const normal = missHabit(character, habit, boss, noCritRng);
    const crit = missHabit(character, habit, boss, alwaysCritRng);

    expect(crit.wasCrit).toBe(true);
    expect(normal.wasCrit).toBe(false);
    const normalDamage = 100 - normal.character.currentHealth;
    const critDamage = 100 - crit.character.currentHealth;
    expect(critDamage).toBeCloseTo(normalDamage * TUNING.CRIT_MULTIPLIER, 10);
  });
});

describe('reviveWithFeatherIfEquipped', () => {
  it('is a no-op when currentHealth > 0, even with the feather equipped', () => {
    const character = makeCharacter({
      currentHealth: 5,
      ownedItemIds: ['phoenix-feather'],
      equippedItemIds: ['phoenix-feather'],
    });

    const result = reviveWithFeatherIfEquipped(character);

    expect(result.revived).toBe(false);
    expect(result.character).toBe(character);
  });

  it('is a no-op when dead but the feather is not equipped', () => {
    const character = makeCharacter({ currentHealth: 0 });

    const result = reviveWithFeatherIfEquipped(character);

    expect(result.revived).toBe(false);
    expect(result.character).toBe(character);
  });

  it('treats a tiny positive currentHealth that rounds to 0 as dead, and still revives with the feather', () => {
    const character = makeCharacter({
      currentHealth: 0.3, // rounds to 0 on the health bar, but is not literally 0
      ownedItemIds: ['phoenix-feather'],
      equippedItemIds: ['phoenix-feather'],
    });

    const result = reviveWithFeatherIfEquipped(character);

    expect(result.revived).toBe(true);
  });

  it('consumes the feather and revives at half max health when dead with it equipped', () => {
    const character = makeCharacter({
      currentHealth: 0,
      level: 3,
      ownedItemIds: ['phoenix-feather', 'rusty-blade'],
      equippedItemIds: ['phoenix-feather', 'rusty-blade'],
    });

    const result = reviveWithFeatherIfEquipped(character);

    expect(result.revived).toBe(true);
    expect(result.character.currentHealth).toBeCloseTo(effectiveStat(character, 'health') * 0.5, 10);
    expect(result.character.equippedItemIds).toEqual(['rusty-blade']);
    expect(result.character.ownedItemIds).toEqual(['rusty-blade']);
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
    expect(result.itemsDropped).toEqual([]);
  });

  it('grants the correct EXP, drops an item, and spawns the next boss when boss.health <= 0', () => {
    const character = makeCharacter();
    const boss = makeBoss({ index: 3, health: 0 });
    const rng = createRng(1);

    const result = resolveBossDefeatIfDead(character, boss, rng);

    const leveled = addExpAndResolveLevelUps(character, bossExpReward(3));
    expect(result.defeated).toBe(true);
    expect(result.character.level).toBe(leveled.character.level);
    expect(result.character.exp).toBeCloseTo(leveled.character.exp, 10);
    expect(result.levelsGained).toBe(leveled.levelsGained);
    expect(result.boss.index).toBe(4);
    expect(result.itemsDropped).toHaveLength(1); // boss index 3 -> drop-count curve gives 1
    expect(result.character.ownedItemIds).toEqual(result.itemsDropped.map((item) => item.id));
  });

  it('returns no items dropped once the character already owns the full catalog', () => {
    const character = makeCharacter({ ownedItemIds: ITEM_CATALOG.map((item) => item.id) });
    const boss = makeBoss({ index: 5, health: 0 });

    const result = resolveBossDefeatIfDead(character, boss, createRng(1));

    expect(result.itemsDropped).toEqual([]);
    expect(result.character.ownedItemIds).toHaveLength(ITEM_CATALOG.length);
  });

  it('treats a tiny positive boss.health that rounds to 0 as defeated', () => {
    const character = makeCharacter();
    const boss = makeBoss({ index: 3, health: 0.3 }); // rounds to 0 on the health bar, but is not literally 0

    const result = resolveBossDefeatIfDead(character, boss, createRng(1));

    expect(result.defeated).toBe(true);
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

  it('treats a tiny positive currentHealth that rounds to 0 as dead', () => {
    const character = makeCharacter({ currentHealth: 0.3 }); // rounds to 0 on the health bar, but is not literally 0
    const boss = makeBoss({ index: 7 });
    const habits = [makeHabit()];
    const rng = createRng(1);

    const result = resolvePlayerDeathIfDead(character, boss, habits, rng);

    expect(result.died).toBe(true);
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
