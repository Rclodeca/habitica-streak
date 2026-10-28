import { describe, expect, it } from 'vitest';
import { applyResist, bossExpReward } from './boss';
import { MILESTONE_EXP } from './constants/milestones';
import { TUNING } from './constants/tuning';
import { ITEM_CATALOG, itemBonusPercent, itemFlatBonus } from './items';
import { addExpAndResolveLevelUps, effectiveCritChance, effectiveStat, itemStatMultiplier, statAtLevel } from './leveling';
import { createRng } from './rng';
import { rankMultiplier } from './streaks';
import {
  activeWoundsEffect,
  bossMissDamage,
  completeHabit,
  effectiveResistAfterPen,
  expectedMediumDailyDamage,
  habitDamageBreakdown,
  healingMultiplier,
  overdriveHabit,
  overdriveUsesRemaining,
  missHabit,
  resolveBossDefeatIfDead,
  resolvePlayerDeathIfDead,
  reviveWithFeatherIfEquipped,
} from './combat';
import type { Boss, Character, Habit, Period, WoundsStatusEffect } from './types';

// What rankMultiplier gives an unranked skill at this streak.
function unrankedMultiplier(streakCount: number, period: Period = 'daily'): number {
  return rankMultiplier(makeHabit({ streakCount, period }));
}

// Deterministic rng stand-ins for crit rolls: a value this low always beats
// any crit chance used in these tests (never crits); a value of 0 always
// beats it the other way (always crits, since 0 < any positive chance).
const noCritRng = () => 0.99;
const alwaysCritRng = () => 0;

// Placeholder day key for tests that don't exercise day-based effects.
const DAY_KEY = '2026-01-01';
const REFLECT_PCT = TUNING.BOSS_SKILLS.REFLECT_PCT;

function makeCharacter(overrides: Partial<Character> = {}): Character {
  const starterStats = { physicalDamage: 10, magicDamage: 10, healing: 6, health: 50, trueDamage: 6 };
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
    lifestealPct: 0,
    ...overrides,
  };
}

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-id',
    name: 'Test Habit',
    period: 'daily',
    difficulty: 'medium',
    damageType: 'physical',
    isBad: false,
    streakCount: 0,
    lastCompletedPeriodKey: null,
    lastCheckedPeriodKey: null,
    ...overrides,
  };
}

describe('completeHabit', () => {
  it('deals baseDamage * rankMultiplier reduced by the boss armor for a physical habit, increments streak, and returns milestone exp when the new streak crosses a milestone', () => {
    const character = makeCharacter();
    const habit = makeHabit({ damageType: 'physical', streakCount: 4 });
    const boss = makeBoss({ armor: 15, health: 500 });

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);

    // Solo habit of its type -> baseDamage is the full stat value at level.
    const statValue = statAtLevel(character.starterStats.physicalDamage, character.level);
    const expectedMultiplier = unrankedMultiplier(4); // damage applies at the pre-increment streak (4), then it bumps to 5
    const expectedAmount = statValue * expectedMultiplier;
    const expectedDealt = applyResist(expectedAmount, boss.armor);

    expect(result.damageDealt).toBeCloseTo(expectedDealt, 10);
    expect(result.boss.health).toBeCloseTo(500 - expectedDealt, 10);
    expect(result.updatedHabit.streakCount).toBe(5);
    // Streak 4 -> 5 crosses the milestone at 5 (MILESTONE_EXP[5] = 20).
    expect(result.milestoneExp).toBe(MILESTONE_EXP[5]);
    expect(result.milestoneExp).toBe(5);
  });

  it('deals baseDamage * rankMultiplier reduced by the boss magicResist for a magic habit, and returns 0 milestone exp on a non-milestone completion', () => {
    const character = makeCharacter();
    const habit = makeHabit({ damageType: 'magic', streakCount: 0 });
    const boss = makeBoss({ magicResist: 25, health: 500 });

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);

    const statValue = statAtLevel(character.starterStats.magicDamage, character.level);
    const expectedAmount = statValue * unrankedMultiplier(0);
    const expectedDealt = applyResist(expectedAmount, boss.magicResist);

    expect(result.damageDealt).toBeCloseTo(expectedDealt, 10);
    expect(result.boss.health).toBeCloseTo(500 - expectedDealt, 10);
    // Streak 0 -> 1 does not cross any milestone.
    expect(result.milestoneExp).toBe(0);
  });

  it('deals WEEKLY_BONUS_MULTIPLIER extra damage for a weekly habit vs. a daily one, each at its own period-specific streak rate', () => {
    const character = makeCharacter();
    const daily = makeHabit({ period: 'daily', damageType: 'physical', streakCount: 0 });
    const weekly = makeHabit({ period: 'weekly', damageType: 'physical', streakCount: 0 });
    const boss = makeBoss({ armor: 0, health: 1000 }); // armor 0 -> no reduction, easier to reason about

    const dailyResult = completeHabit(character, daily, [daily], boss, DAY_KEY, noCritRng);
    const weeklyResult = completeHabit(character, weekly, [weekly], boss, DAY_KEY, noCritRng);

    const statValue = statAtLevel(character.starterStats.physicalDamage, character.level);
    expect(dailyResult.damageDealt).toBeCloseTo(statValue * unrankedMultiplier(0, 'daily'), 10);
    expect(weeklyResult.damageDealt).toBeCloseTo(
      statValue * unrankedMultiplier(0, 'weekly') * TUNING.WEEKLY_BONUS_MULTIPLIER,
      10,
    );
  });

  it('heals WEEKLY_BONUS_MULTIPLIER extra for a weekly healing habit vs. a daily one, each at its own period-specific streak rate', () => {
    const dailyCharacter = makeCharacter({ currentHealth: 1 });
    const weeklyCharacter = makeCharacter({ currentHealth: 1 });
    const daily = makeHabit({ period: 'daily', damageType: 'healing', streakCount: 0 });
    const weekly = makeHabit({ period: 'weekly', damageType: 'healing', streakCount: 0 });
    const boss = makeBoss();

    const dailyResult = completeHabit(dailyCharacter, daily, [daily], boss, DAY_KEY, noCritRng);
    const weeklyResult = completeHabit(weeklyCharacter, weekly, [weekly], boss, DAY_KEY, noCritRng);

    const statValue = statAtLevel(dailyCharacter.starterStats.healing, dailyCharacter.level);
    const dailyHealed = dailyResult.character.currentHealth - dailyCharacter.currentHealth;
    const weeklyHealed = weeklyResult.character.currentHealth - weeklyCharacter.currentHealth;
    expect(dailyHealed).toBeCloseTo(statValue * unrankedMultiplier(0, 'daily'), 10);
    expect(weeklyHealed).toBeCloseTo(statValue * unrankedMultiplier(0, 'weekly') * TUNING.WEEKLY_BONUS_MULTIPLIER, 10);
  });

  it('hits each skill for its full stat, weighted by difficulty', () => {
    const character = makeCharacter();
    const easy = makeHabit({ id: 'easy', difficulty: 'easy', damageType: 'physical' });
    const medium = makeHabit({ id: 'medium', damageType: 'physical' });
    const hard = makeHabit({ id: 'hard', difficulty: 'hard', damageType: 'physical' });
    const all = [easy, medium, hard];
    const boss = makeBoss({ armor: 0, health: 1000 });

    const statValue = statAtLevel(character.starterStats.physicalDamage, character.level);
    expect(completeHabit(character, medium, all, boss, DAY_KEY, noCritRng).damageDealt).toBeCloseTo(statValue, 10);
    expect(completeHabit(character, hard, all, boss, DAY_KEY, noCritRng).damageDealt).toBeCloseTo((statValue * 4) / 3, 10);
    expect(completeHabit(character, easy, all, boss, DAY_KEY, noCritRng).damageDealt).toBeCloseTo((statValue * 2) / 3, 10);
  });

  it('two medium physical skills each hit for the full stat', () => {
    const character = makeCharacter();
    const h1 = makeHabit({ id: 'h1' });
    const h2 = makeHabit({ id: 'h2' });
    const boss = makeBoss({ armor: 0, health: 1000 });

    const pair = completeHabit(character, h1, [h1, h2], boss, DAY_KEY, noCritRng);
    const solo = completeHabit(character, h1, [h1], boss, DAY_KEY, noCritRng);
    expect(pair.damageDealt).toBeCloseTo(solo.damageDealt!, 10);
  });

  it('a set-day daily on a due day hits like a plain daily', () => {
    const character = makeCharacter();
    const plain = makeHabit({ id: 'plain' });
    const gym = makeHabit({ id: 'gym', days: [0, 2, 5] });
    const boss = makeBoss({ armor: 0, health: 1000 });

    const plainHit = completeHabit(character, plain, [plain, gym], boss, DAY_KEY, noCritRng).damageDealt;
    expect(completeHabit(character, gym, [plain, gym], boss, DAY_KEY, noCritRng).damageDealt).toBeCloseTo(plainHit!, 10);
  });

  it('crowds the 16th skill to 0.7x without changing the first', () => {
    const character = makeCharacter();
    const habits = Array.from({ length: 16 }, (_, i) => makeHabit({ id: `h${i}` }));
    const boss = makeBoss({ armor: 0, health: 1000 });

    const first = completeHabit(character, habits[0], habits, boss, DAY_KEY, noCritRng).damageDealt!;
    const sixteenth = completeHabit(character, habits[15], habits, boss, DAY_KEY, noCritRng).damageDealt!;
    expect(sixteenth).toBeCloseTo(first * 0.7, 10);
    expect(habitDamageBreakdown(character, habits[15], habits).crowded).toBe(true);
    expect(habitDamageBreakdown(character, habits[0], habits).crowded).toBe(false);
    expect(habitDamageBreakdown(character, habits[0], habits).effectiveDamage).toBeCloseTo(
      habitDamageBreakdown(character, habits[0], habits.slice(0, 15)).effectiveDamage,
      10,
    );
  });

  it('a crowded healing skill heals 0.7x a full one', () => {
    const character = makeCharacter({ currentHealth: 1 });
    const habits = Array.from({ length: 16 }, (_, i) => makeHabit({ id: `h${i}`, damageType: 'healing' }));
    const boss = makeBoss();

    const full = completeHabit(character, habits[0], habits, boss, DAY_KEY, noCritRng).character.currentHealth - 1;
    const crowded = completeHabit(character, habits[15], habits, boss, DAY_KEY, noCritRng).character.currentHealth - 1;
    expect(crowded).toBeCloseTo(full * 0.7, 10);
  });

  it('deals more damage when an item bonus is equipped for that damage type', () => {
    const character = makeCharacter({ ownedItemIds: ['rusty-blade'], equippedItemIds: ['rusty-blade'] });
    const habit = makeHabit({ damageType: 'physical' });
    const boss = makeBoss({ armor: 0, health: 1000 });

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);

    const boosted = effectiveStat(character, 'physicalDamage');
    expect(boosted).toBeCloseTo(statAtLevel(character.starterStats.physicalDamage, character.level) * 1.03, 10);
    expect(result.damageDealt).toBeCloseTo(boosted * unrankedMultiplier(0), 10);
  });

  it('never reduces boss health below 0', () => {
    const character = makeCharacter({ level: 20 });
    const habit = makeHabit({ damageType: 'physical' });
    const boss = makeBoss({ armor: 0, health: 1 });

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);

    expect(result.boss.health).toBe(0);
  });

  it('for a healing habit, increases currentHealth and does not touch the boss', () => {
    const character = makeCharacter({ currentHealth: 30 });
    const habit = makeHabit({ damageType: 'healing', streakCount: 0 });
    const boss = makeBoss();

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);

    const statValue = statAtLevel(character.starterStats.healing, character.level);
    const expectedHealAmount = statValue * unrankedMultiplier(0);
    const maxHealth = statAtLevel(character.starterStats.health, character.level);

    expect(result.character.currentHealth).toBeCloseTo(Math.min(30 + expectedHealAmount, maxHealth), 10);
    expect(result.boss).toBe(boss); // unchanged, same reference
    expect(result.damageDealt).toBeUndefined();
  });

  it('caps healing at max health for the character level', () => {
    const character = makeCharacter({ currentHealth: 49 });
    const habit = makeHabit({ damageType: 'healing', streakCount: 100 }); // huge streak -> huge heal
    const boss = makeBoss();

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);

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

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);

    const expectedHeal = (result.damageDealt ?? 0) * 0.03; // vampiric-fang: +3% lifesteal
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

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);

    // Healed only by the habit's own healing amount, not doubled by lifesteal.
    const statValue = statAtLevel(character.starterStats.healing, character.level);
    const expectedHealAmount = statValue * unrankedMultiplier(0);
    expect(result.character.currentHealth).toBeCloseTo(1 + expectedHealAmount, 10);
  });

  it('does not heal when no lifesteal item is equipped', () => {
    const character = makeCharacter({ currentHealth: 1 });
    const habit = makeHabit({ damageType: 'physical' });
    const boss = makeBoss({ armor: 0, health: 1000 });

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);

    expect(result.character.currentHealth).toBe(1);
  });

  it('damages the character back for a percent of damage dealt while the boss has Reflect', () => {
    const character = makeCharacter({ currentHealth: 50 });
    const habit = makeHabit({ damageType: 'physical' });
    const boss = makeBoss({ armor: 0, health: 1000, reflectDayKey: DAY_KEY });

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);

    const expectedReflect = ((result.damageDealt ?? 0) * REFLECT_PCT) / 100;
    expect(result.character.currentHealth).toBeCloseTo(50 - expectedReflect, 10);
    expect(result.reflectedDamage).toBeCloseTo(expectedReflect, 10);
  });

  it('reflects on the day Reflect fires and the next, then stops', () => {
    const habit = makeHabit({ damageType: 'physical' });
    const boss = makeBoss({ armor: 0, health: 1000, reflectDayKey: DAY_KEY });

    expect(completeHabit(makeCharacter(), habit, [habit], boss, DAY_KEY, noCritRng).reflectedDamage).toBeGreaterThan(0);
    expect(completeHabit(makeCharacter(), habit, [habit], boss, '2026-01-02', noCritRng).reflectedDamage).toBeGreaterThan(0);
    expect(completeHabit(makeCharacter(), habit, [habit], boss, '2026-01-03', noCritRng).reflectedDamage).toBeUndefined();
  });

  it('does not reflect before Reflect has fired', () => {
    const habit = makeHabit({ damageType: 'physical' });
    const boss = makeBoss({ armor: 0, health: 1000 });

    const result = completeHabit(makeCharacter({ currentHealth: 50 }), habit, [habit], boss, DAY_KEY, noCritRng);

    expect(result.reflectedDamage).toBeUndefined();
    expect(result.character.currentHealth).toBe(50);
  });

  it('nets lifesteal healing against boss reflect damage into a single health change', () => {
    const character = makeCharacter({
      currentHealth: 50,
      ownedItemIds: ['vampiric-fang'],
      equippedItemIds: ['vampiric-fang'],
    });
    const habit = makeHabit({ damageType: 'physical' });
    const boss = makeBoss({ armor: 0, health: 1000, reflectDayKey: DAY_KEY });

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);

    const dealt = result.damageDealt ?? 0;
    const expectedHealthChange = dealt * 0.03 - (dealt * REFLECT_PCT) / 100; // vampiric-fang 3% lifesteal vs Reflect
    expect(result.character.currentHealth).toBeCloseTo(50 + expectedHealthChange, 10);
  });

  it('never reduces currentHealth below 0 from reflect', () => {
    const character = makeCharacter({ level: 20, currentHealth: 1 });
    const habit = makeHabit({ damageType: 'physical' });
    const boss = makeBoss({ armor: 0, health: 1_000_000, reflectDayKey: DAY_KEY });

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);

    expect(result.character.currentHealth).toBe(0);
  });

  it('does not apply reflect on a healing habit (no damage dealt)', () => {
    const character = makeCharacter({ currentHealth: 30 });
    const habit = makeHabit({ damageType: 'healing' });
    const boss = makeBoss({ reflectDayKey: DAY_KEY });

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);

    const statValue = statAtLevel(character.starterStats.healing, character.level);
    const expectedHealAmount = statValue * unrankedMultiplier(0);
    expect(result.character.currentHealth).toBeCloseTo(30 + expectedHealAmount, 10);
  });

  it('heals by difficulty weight per skill', () => {
    const character = makeCharacter({ currentHealth: 10 });
    const easy = makeHabit({ id: 'easy', difficulty: 'easy', damageType: 'healing' });
    const hard = makeHabit({ id: 'hard', difficulty: 'hard', damageType: 'healing' });
    const boss = makeBoss();

    const result = completeHabit(character, easy, [easy, hard], boss, DAY_KEY, noCritRng);

    const statValue = statAtLevel(character.starterStats.healing, character.level);
    expect(result.character.currentHealth).toBeCloseTo(10 + (statValue * 2) / 3, 10);
  });

  it('hard healing habit heals twice an easy one', () => {
    const character = makeCharacter({ currentHealth: 10 });
    const easy = makeHabit({ id: 'easy', difficulty: 'easy', damageType: 'healing' });
    const hard = makeHabit({ id: 'hard', difficulty: 'hard', damageType: 'healing' });
    const boss = makeBoss();

    const easyResult = completeHabit(character, easy, [easy, hard], boss, DAY_KEY, noCritRng);
    const hardResult = completeHabit(character, hard, [easy, hard], boss, DAY_KEY, noCritRng);

    const easyHealed = easyResult.character.currentHealth - character.currentHealth;
    const hardHealed = hardResult.character.currentHealth - character.currentHealth;

    // hard weight=2, easy weight=1 -> hard heals 2x as much as easy
    expect(hardHealed).toBeCloseTo(easyHealed * 2, 10);
  });

  it('a good healing skill heals the same beside a bad one', () => {
    const character = makeCharacter({ currentHealth: 10 });
    const goodEasy = makeHabit({ id: 'good-easy', difficulty: 'easy', damageType: 'healing', isBad: false });
    const badHard = makeHabit({ id: 'bad-hard', difficulty: 'hard', damageType: 'healing', isBad: true });
    const boss = makeBoss();

    const paired = completeHabit(character, goodEasy, [goodEasy, badHard], boss, DAY_KEY, noCritRng);
    const solo = completeHabit(character, goodEasy, [goodEasy], boss, DAY_KEY, noCritRng);
    expect(paired.character.currentHealth).toBeCloseTo(solo.character.currentHealth, 10);
  });

  it('reduces the boss resist stat by the equipped armorPen percent before applying it, for a physical habit', () => {
    const character = makeCharacter({ equippedItemIds: ['serrated-ripper'] }); // +24% physicalDamage, +20% armorPen
    const habit = makeHabit({ damageType: 'physical', streakCount: 0 });
    const boss = makeBoss({ armor: 1000 });

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);

    const statValue = statAtLevel(character.starterStats.physicalDamage, character.level) + itemFlatBonus(character, 'physicalDamage');
    const amount = statValue * itemStatMultiplier(character, 'physicalDamage') * unrankedMultiplier(0);
    const expectedEffectiveArmor = effectiveResistAfterPen(boss.armor, itemBonusPercent(character, 'armorPen'));
    const expectedDealt = applyResist(amount, expectedEffectiveArmor);
    expect(result.damageDealt).toBeCloseTo(expectedDealt, 10);
  });

  it('sums armorPen across multiple equipped items before applying the cap', () => {
    // serrated-ripper (20% armorPen) + piercing-fang-gauntlets (35% armorPen) + headsmans-mark (20% armorPen)
    // = 75% total armorPen, still under the 90% cap.
    const character = makeCharacter({ equippedItemIds: ['serrated-ripper', 'piercing-fang-gauntlets', 'headsmans-mark'] });
    const habit = makeHabit({ damageType: 'physical', streakCount: 0 });
    const boss = makeBoss({ armor: 1000 });

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);

    const statValue = statAtLevel(character.starterStats.physicalDamage, character.level) + itemFlatBonus(character, 'physicalDamage');
    const amount = statValue * itemStatMultiplier(character, 'physicalDamage') * unrankedMultiplier(0);
    const expectedEffectiveArmor = effectiveResistAfterPen(boss.armor, itemBonusPercent(character, 'armorPen'));
    const expectedDealt = applyResist(amount, expectedEffectiveArmor);
    expect(result.damageDealt).toBeCloseTo(expectedDealt, 10);
  });

  it('applies magicPen (not armorPen) for a magic habit', () => {
    const character = makeCharacter({ equippedItemIds: ['chaos-conduit'] }); // +34% magicDamage, +20% magicPen
    const habit = makeHabit({ damageType: 'magic', streakCount: 0 });
    const boss = makeBoss({ magicResist: 1000 });

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);

    const statValue = statAtLevel(character.starterStats.magicDamage, character.level) + itemFlatBonus(character, 'magicDamage');
    const amount = statValue * itemStatMultiplier(character, 'magicDamage') * unrankedMultiplier(0);
    const expectedEffectiveResist = effectiveResistAfterPen(boss.magicResist, itemBonusPercent(character, 'magicPen'));
    const expectedDealt = applyResist(amount, expectedEffectiveResist);
    expect(result.damageDealt).toBeCloseTo(expectedDealt, 10);
  });
});

describe('effectiveResistAfterPen', () => {
  it('reduces resist by the pen percent when under the cap', () => {
    expect(effectiveResistAfterPen(1000, 20)).toBeCloseTo(800, 5);
  });

  it('returns the resist stat unchanged at 0% pen', () => {
    expect(effectiveResistAfterPen(1000, 0)).toBe(1000);
  });

  it('clamps pen at ARMOR_MAGIC_PEN_CAP_PCT even when given a percent far past it', () => {
    expect(effectiveResistAfterPen(1000, 150)).toBeCloseTo(1000 * (1 - TUNING.ARMOR_MAGIC_PEN_CAP_PCT / 100), 5);
  });
});

describe('missHabit', () => {
  // bossMissDamage's doc comment defines it as the damage dealt on a missed
  // medium daily habit specifically (medium's DIFFICULTY_WEIGHT / 1.5
  // cancels to exactly 1) — every makeHabit({ difficulty: 'medium' })
  // override below is required for the bossMissDamage(...) expected-value
  // shortcut to be valid; makeHabit()'s own default is 'easy'.
  it('mitigates physical miss damage through equipped armor, using the same resist formula as boss armor', () => {
    // currentHealth set comfortably above any damage this test computes, so the health delta below
    // reflects the resist formula directly rather than being clamped by missHabit's health-floor.
    const character = makeCharacter({ currentHealth: 100000, equippedItemIds: ['juggernaut-carapace'] }); // +450 flat armor
    const habit = makeHabit({ difficulty: 'medium' });
    const boss = makeBoss({ physicalAttack: 1000, critChance: 0 });
    const forcePhysicalNoCrit = () => 0.4; // < 0.5 picks 'physical'; also beats critChance 0
    const result = missHabit(character, habit, boss, DAY_KEY, forcePhysicalNoCrit);

    const rawDamage = bossMissDamage(boss.physicalAttack); // medium difficulty, no crit, no weekly multiplier
    const expectedMitigated = applyResist(rawDamage, 450);
    expect(character.currentHealth - result.character.currentHealth).toBeCloseTo(expectedMitigated, 5);
  });

  it('mitigates magic miss damage through equipped magicResist, not armor', () => {
    const character = makeCharacter({ currentHealth: 100000, equippedItemIds: ['warding-sigil'] }); // +150 flat magicResist, no armor
    const habit = makeHabit({ difficulty: 'medium' });
    const boss = makeBoss({ magicAttack: 1000, critChance: 0 });
    const forceMagicNoCrit = () => 0.6; // >= 0.5 picks 'magic'
    const result = missHabit(character, habit, boss, DAY_KEY, forceMagicNoCrit);

    const rawDamage = bossMissDamage(boss.magicAttack);
    const expectedMitigated = applyResist(rawDamage, 150);
    expect(character.currentHealth - result.character.currentHealth).toBeCloseTo(expectedMitigated, 5);
  });

  it('boss lifesteal heals off the mitigated damage, not the raw pre-mitigation amount', () => {
    const character = makeCharacter({ equippedItemIds: ['juggernaut-carapace'] }); // +450 flat armor
    const habit = makeHabit({ difficulty: 'medium' });
    const boss = makeBoss({ physicalAttack: 1000, critChance: 0, lifestealPct: 1, maxHealth: 100000, health: 100 });
    const forcePhysicalNoCrit = () => 0.4;
    const result = missHabit(character, habit, boss, DAY_KEY, forcePhysicalNoCrit);

    const rawDamage = bossMissDamage(boss.physicalAttack);
    const expectedMitigated = applyResist(rawDamage, 450);
    // lifestealPct 1 (100%) means the boss heals for exactly the mitigated amount, not the larger raw amount.
    expect(result.bossLifestealHealed).toBeCloseTo(expectedMitigated, 5);
  });

  it('with no armor/magicResist equipped, mitigation is a no-op (matches pre-overhaul behavior)', () => {
    const character = makeCharacter({ currentHealth: 100000 });
    const habit = makeHabit({ difficulty: 'medium' });
    const boss = makeBoss({ physicalAttack: 1000, critChance: 0 });
    const forcePhysicalNoCrit = () => 0.4;
    const result = missHabit(character, habit, boss, DAY_KEY, forcePhysicalNoCrit);

    const rawDamage = bossMissDamage(boss.physicalAttack);
    expect(character.currentHealth - result.character.currentHealth).toBeCloseTo(rawDamage, 5);
  });

  it('damages using a random pick of the boss physical/magic attack (not their average), scaled by difficulty weight, and resets streak', () => {
    const character = makeCharacter({ currentHealth: 100 });
    const habit = makeHabit({ difficulty: 'medium', streakCount: 7 });
    const boss = makeBoss({ physicalAttack: 30, magicAttack: 10 });

    const result = missHabit(character, habit, boss, DAY_KEY, noCritRng); // 0.99 -> picks magicAttack, no crit

    const expectedDamage = boss.magicAttack * TUNING.MISS_DAMAGE_FACTOR * (1.5 / 1.5); // medium weight = 1.5
    expect(result.character.currentHealth).toBeCloseTo(100 - expectedDamage, 10);
    expect(result.updatedHabit.streakCount).toBe(0);
    expect(result.attackType).toBe('magic');
  });

  it('deals 2x damage for a missed weekly habit compared to an otherwise-identical missed daily habit', () => {
    const dailyCharacter = makeCharacter({ currentHealth: 1000 });
    const weeklyCharacter = makeCharacter({ currentHealth: 1000 });
    const daily = makeHabit({ period: 'daily', difficulty: 'medium' });
    const weekly = makeHabit({ period: 'weekly', difficulty: 'medium' });
    const boss = makeBoss({ physicalAttack: 30, magicAttack: 10 });

    const dailyResult = missHabit(dailyCharacter, daily, boss, DAY_KEY, noCritRng);
    const weeklyResult = missHabit(weeklyCharacter, weekly, boss, DAY_KEY, noCritRng);

    const dailyDamage = dailyCharacter.currentHealth - dailyResult.character.currentHealth;
    const weeklyDamage = weeklyCharacter.currentHealth - weeklyResult.character.currentHealth;
    expect(weeklyDamage).toBeCloseTo(dailyDamage * TUNING.WEEKLY_MISS_MULTIPLIER, 10);
  });

  it('picks physicalAttack instead of magicAttack when the rng rolls below 0.5', () => {
    const character = makeCharacter({ currentHealth: 100 });
    const habit = makeHabit({ difficulty: 'medium' });
    const boss = makeBoss({ physicalAttack: 30, magicAttack: 10 });
    const pickPhysicalNoCritRng = () => 0.02; // < 0.5 -> physicalAttack; >= boss.critChance (0.01) -> no crit

    const result = missHabit(character, habit, boss, DAY_KEY, pickPhysicalNoCritRng);

    const expectedDamage = boss.physicalAttack * TUNING.MISS_DAMAGE_FACTOR * (1.5 / 1.5);
    expect(result.character.currentHealth).toBeCloseTo(100 - expectedDamage, 10);
    expect(result.attackType).toBe('physical');
  });

  it("uses the boss's physicalShare as the cutoff between a physical and a magic hit", () => {
    const habit = makeHabit({ difficulty: 'medium' });
    const leansMagic = makeBoss({ physicalAttack: 30, magicAttack: 10, physicalShare: 0.3 });
    const leansPhysical = makeBoss({ physicalAttack: 30, magicAttack: 10, physicalShare: 0.7 });
    // 0.4 is physical under the default 50/50 and under a 70% physical lean, magic under a 30% one.
    const roll = () => 0.4;

    expect(missHabit(makeCharacter({ currentHealth: 100 }), habit, leansMagic, DAY_KEY, roll).attackType).toBe('magic');
    expect(missHabit(makeCharacter({ currentHealth: 100 }), habit, leansPhysical, DAY_KEY, roll).attackType).toBe('physical');
  });

  it('treats a boss with no physicalShare (an older save) as 50/50', () => {
    const habit = makeHabit({ difficulty: 'medium' });
    const boss = makeBoss({ physicalAttack: 30, magicAttack: 10 });
    expect(boss.physicalShare).toBeUndefined();
    expect(missHabit(makeCharacter({ currentHealth: 100 }), habit, boss, DAY_KEY, () => 0.49).attackType).toBe('physical');
    expect(missHabit(makeCharacter({ currentHealth: 100 }), habit, boss, DAY_KEY, () => 0.51).attackType).toBe('magic');
  });

  it('never reduces currentHealth below 0', () => {
    const character = makeCharacter({ currentHealth: 1 });
    const habit = makeHabit({ difficulty: 'hard' });
    const boss = makeBoss({ physicalAttack: 1000, magicAttack: 1000 });

    const result = missHabit(character, habit, boss, DAY_KEY, noCritRng);

    expect(result.character.currentHealth).toBe(0);
  });

  it('heals the boss for a percent of damage dealt when it has lifesteal', () => {
    const character = makeCharacter({ currentHealth: 100 });
    const habit = makeHabit({ difficulty: 'medium' });
    const boss = makeBoss({ physicalAttack: 20, magicAttack: 20, health: 50, lifestealPct: 0.1 });

    const result = missHabit(character, habit, boss, DAY_KEY, noCritRng);

    const damageDealt = 100 - result.character.currentHealth;
    expect(result.boss.health).toBeCloseTo(50 + damageDealt * 0.1, 10);
  });

  it('caps boss lifesteal healing at maxHealth', () => {
    const character = makeCharacter({ currentHealth: 100 });
    const habit = makeHabit({ difficulty: 'medium' });
    const boss = makeBoss({ physicalAttack: 20, magicAttack: 20, health: 99, maxHealth: 100, lifestealPct: 1 });

    const result = missHabit(character, habit, boss, DAY_KEY, noCritRng);

    expect(result.boss.health).toBe(100);
  });

  it('leaves the boss untouched when it has no lifesteal', () => {
    const character = makeCharacter({ currentHealth: 100 });
    const habit = makeHabit({ difficulty: 'medium' });
    const boss = makeBoss({ physicalAttack: 20, magicAttack: 20 });

    const result = missHabit(character, habit, boss, DAY_KEY, noCritRng);

    expect(result.boss).toBe(boss);
  });
});

describe('crit chance', () => {
  it('completeHabit doubles the pre-resist damage and reports wasCrit=true on a crit roll', () => {
    const character = makeCharacter();
    const habit = makeHabit({ damageType: 'physical' });
    const boss = makeBoss({ armor: 0, health: 1000 });

    const normal = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);
    const habitForCrit = makeHabit({ damageType: 'physical' }); // fresh streak so both start at 0 -> 1
    const crit = completeHabit(character, habitForCrit, [habitForCrit], boss, DAY_KEY, alwaysCritRng);

    expect(crit.wasCrit).toBe(true);
    expect(normal.wasCrit).toBe(false);
    expect(crit.damageDealt).toBeCloseTo((normal.damageDealt ?? 0) * TUNING.CRIT_MULTIPLIER, 10);
  });

  it('healing habits never crit, regardless of the rng roll', () => {
    const character = makeCharacter({ currentHealth: 1 });
    const habit = makeHabit({ damageType: 'healing' });
    const boss = makeBoss();

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, alwaysCritRng);

    expect(result.wasCrit).toBeUndefined();
  });

  it('missHabit doubles damage and reports wasCrit=true on a crit roll, using the boss crit chance', () => {
    const character = makeCharacter({ currentHealth: 100 });
    const habit = makeHabit({ difficulty: 'medium' });
    // physicalAttack === magicAttack so the attack-type coin flip doesn't affect the comparison below.
    const boss = makeBoss({ physicalAttack: 20, magicAttack: 20 });

    const normal = missHabit(character, habit, boss, DAY_KEY, noCritRng);
    const crit = missHabit(character, habit, boss, DAY_KEY, alwaysCritRng);

    expect(crit.wasCrit).toBe(true);
    expect(normal.wasCrit).toBe(false);
    const normalDamage = 100 - normal.character.currentHealth;
    const critDamage = 100 - crit.character.currentHealth;
    expect(critDamage).toBeCloseTo(normalDamage * TUNING.CRIT_MULTIPLIER, 10);
  });
});

describe('completeHabit — Special/Ult bonus', () => {
  it('applies SPECIAL_MULTIPLIER for a habit with isSpecial on a normal (non-Overdrive) use', () => {
    const character = makeCharacter();
    const habit = makeHabit({ damageType: 'physical', isSpecial: true });
    const boss = makeBoss({ armor: 0, health: 1000 });

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);

    const statValue = statAtLevel(character.starterStats.physicalDamage, character.level);
    const expected = statValue * unrankedMultiplier(0) * TUNING.SPECIAL_MULTIPLIER;
    expect(result.damageDealt).toBeCloseTo(expected, 10);
  });

  it('applies ULT_MULTIPLIER for a weekly habit with isUlt on a normal use', () => {
    const character = makeCharacter();
    const habit = makeHabit({ period: 'weekly', damageType: 'physical', isUlt: true });
    const boss = makeBoss({ armor: 0, health: 1000 });

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);

    const statValue = statAtLevel(character.starterStats.physicalDamage, character.level);
    const expected = statValue * unrankedMultiplier(0, 'weekly') * TUNING.WEEKLY_BONUS_MULTIPLIER * TUNING.ULT_MULTIPLIER;
    expect(result.damageDealt).toBeCloseTo(expected, 10);
  });

  it('does not apply the Special bonus when isSpecial is falsy', () => {
    const character = makeCharacter();
    const habit = makeHabit({ damageType: 'physical' });
    const boss = makeBoss({ armor: 0, health: 1000 });

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);

    const statValue = statAtLevel(character.starterStats.physicalDamage, character.level);
    expect(result.damageDealt).toBeCloseTo(statValue * unrankedMultiplier(0), 10);
  });
});

describe('completeHabit — rank multiplier', () => {
  const boss = makeBoss({ armor: 0, magicResist: 0, health: 1e9 });
  const character = makeCharacter();
  const S = statAtLevel(character.starterStats.physicalDamage, character.level);

  it('hits for 1 + rank + 1% a day, then bumps the streak', () => {
    const habit = makeHabit({ rank: 3, streakCount: 29 });
    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);
    expect(result.damageDealt).toBeCloseTo(S * 4.29, 10);
    expect(result.updatedHabit).toMatchObject({ streakCount: 30, rank: 3 });
  });

  it('uses the pre-completion rank on the hit that ranks it up', () => {
    const habit = makeHabit({ rank: 0, streakCount: 9 });
    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);
    expect(result.damageDealt).toBeCloseTo(S * 1.09, 10);
    expect(result.updatedHabit.rank).toBe(1);
  });

  it('a healing rank is worth +50%', () => {
    const wounded = makeCharacter({ currentHealth: 1 });
    const habit = makeHabit({ damageType: 'healing', rank: 4, streakCount: 0 });
    const result = completeHabit(wounded, habit, [habit], boss, DAY_KEY, noCritRng);
    expect(result.character.currentHealth - 1).toBeCloseTo(statAtLevel(wounded.starterStats.healing, 1) * 3, 10);
  });

  it('a weekly streak is worth 3% a week', () => {
    const habit = makeHabit({ period: 'weekly', rank: 1, streakCount: 3 });
    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);
    expect(result.damageDealt).toBeCloseTo(S * 2.09 * TUNING.WEEKLY_BONUS_MULTIPLIER, 10);
  });

  it('Overdrive never bumps the streak or the rank', () => {
    const habit = makeHabit({ isOverdrive: true, rank: 0, streakCount: 9 });
    const result = overdriveHabit(character, habit, [habit], boss, DAY_KEY, 'period-key', noCritRng);
    expect(result.updatedHabit).toMatchObject({ streakCount: 9, rank: 0 });
  });

  it('breaks the multiplier into rank and streak', () => {
    const habit = makeHabit({ rank: 5, streakCount: 112 });
    const breakdown = habitDamageBreakdown(character, habit, [habit]);
    expect(breakdown.rankBonus).toBe(5);
    expect(breakdown.streakBonus).toBeCloseTo(1.12, 10);
    expect(breakdown.rankMultiplier).toBeCloseTo(7.12, 10);
  });
});

describe('overdriveHabit / overdriveUsesRemaining', () => {
  it('deals OVERDRIVE_DAMAGE_FACTOR damage, without the Special bonus, and does not touch the streak', () => {
    const character = makeCharacter();
    const habit = makeHabit({ damageType: 'physical', isSpecial: true, isOverdrive: true, streakCount: 4 });
    const boss = makeBoss({ armor: 0, health: 1000 });

    const result = overdriveHabit(character, habit, [habit], boss, DAY_KEY, 'period-key', noCritRng);

    const statValue = statAtLevel(character.starterStats.physicalDamage, character.level);
    // Streak unchanged (still 4, not bumped to 5) -> multiplier(4), no Special bonus, half damage.
    const expected = statValue * unrankedMultiplier(4) * TUNING.OVERDRIVE_DAMAGE_FACTOR;
    expect(result.damageDealt).toBeCloseTo(expected, 10);
    expect(result.updatedHabit.streakCount).toBe(4);
    expect(result.milestoneExp).toBe(0);
  });

  it('bumps overdriveUsesThisPeriod for the given period key, lazily resetting a stale one', () => {
    const character = makeCharacter();
    const habit = makeHabit({
      isOverdrive: true,
      overdrivePeriodKey: 'stale-key',
      overdriveUsesThisPeriod: 2, // stale — belongs to a different, prior period
    });
    const boss = makeBoss({ armor: 0, health: 1000 });

    const result = overdriveHabit(character, habit, [habit], boss, DAY_KEY, 'current-key', noCritRng);

    expect(result.updatedHabit.overdrivePeriodKey).toBe('current-key');
    expect(result.updatedHabit.overdriveUsesThisPeriod).toBe(1); // reset to 0, then bumped once
  });

  it('increments across repeated calls within the same period key', () => {
    const character = makeCharacter();
    let habit = makeHabit({ isOverdrive: true });
    const boss = makeBoss({ armor: 0, health: 1000 });

    const first = overdriveHabit(character, habit, [habit], boss, DAY_KEY, 'k', noCritRng);
    habit = first.updatedHabit;
    const second = overdriveHabit(character, habit, [habit], boss, DAY_KEY, 'k', noCritRng);

    expect(second.updatedHabit.overdriveUsesThisPeriod).toBe(2);
  });
});

describe('overdriveUsesRemaining', () => {
  it('is 0 for a habit that is not Overdrive-capable', () => {
    const habit = makeHabit();
    expect(overdriveUsesRemaining(habit, 'k')).toBe(0);
  });

  it('is OVERDRIVE_MAX_EXTRA_USES for an Overdrive habit with no uses yet this period', () => {
    const habit = makeHabit({ isOverdrive: true });
    expect(overdriveUsesRemaining(habit, 'k')).toBe(TUNING.OVERDRIVE_MAX_EXTRA_USES);
  });

  it('subtracts uses already spent this period, and ignores a stale period key', () => {
    const habit = makeHabit({ isOverdrive: true, overdrivePeriodKey: 'k', overdriveUsesThisPeriod: 1 });
    expect(overdriveUsesRemaining(habit, 'k')).toBe(TUNING.OVERDRIVE_MAX_EXTRA_USES - 1);
    expect(overdriveUsesRemaining(habit, 'different-k')).toBe(TUNING.OVERDRIVE_MAX_EXTRA_USES);
  });

  it('never goes negative even if uses recorded somehow exceed the max', () => {
    const habit = makeHabit({ isOverdrive: true, overdrivePeriodKey: 'k', overdriveUsesThisPeriod: 99 });
    expect(overdriveUsesRemaining(habit, 'k')).toBe(0);
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
  it('pays kill EXP at the slayer\'s level, and none for a live boss', () => {
    const character = makeCharacter({ level: 10, exp: 0 });
    const scripted = [0.5];
    const rng = () => scripted.shift() ?? 0.99;
    const result = resolveBossDefeatIfDead(character, makeBoss({ health: 0 }), rng);
    expect(result.expReward).toBeCloseTo(104, 10);
    expect(result.character.exp).toBeCloseTo(104, 10);
    expect(resolveBossDefeatIfDead(character, makeBoss({ health: 1 }), createRng(1)).expReward).toBe(0);
  });

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

    const leveled = addExpAndResolveLevelUps(character, bossExpReward(character.level, createRng(1)));
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

  it('carries the defeated boss.difficultyModifier forward onto the next boss unchanged', () => {
    const character = makeCharacter();
    const boss = makeBoss({ index: 3, health: 0, difficultyModifier: 1.1 });

    const result = resolveBossDefeatIfDead(character, boss, createRng(1));

    expect(result.boss.difficultyModifier).toBe(1.1);
  });

  it("sizes the next boss's attack with the damped expected-level anchor, so a higher-level player takes a smaller hit as % of max HP", () => {
    const hitPctNextBoss = (level: number) => {
      const character = makeCharacter({ level });
      const result = resolveBossDefeatIfDead(character, makeBoss({ index: 14, health: 0 }), createRng(5));
      return (result.boss.physicalAttack * TUNING.MISS_DAMAGE_FACTOR) / statAtLevel(character.starterStats.health, result.character.level);
    };
    expect(hitPctNextBoss(25)).toBeLessThan(hitPctNextBoss(10));
  });

  it('treats a tiny positive boss.health that rounds to 0 as defeated', () => {
    const character = makeCharacter();
    const boss = makeBoss({ index: 3, health: 0.3 }); // rounds to 0 on the health bar, but is not literally 0

    const result = resolveBossDefeatIfDead(character, boss, createRng(1));

    expect(result.defeated).toBe(true);
  });
});

describe('resolvePlayerDeathIfDead', () => {
  it('keeps every habit\'s rank through a death', () => {
    const habits = [makeHabit({ id: 'a', rank: 4 }), makeHabit({ id: 'b', rank: 1, damageType: 'healing' })];
    const result = resolvePlayerDeathIfDead(makeCharacter({ currentHealth: 0 }), makeBoss(), habits, createRng(1));
    expect(result.habits.map((h) => h.rank)).toEqual([4, 1]);
  });

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

  it('rolls a brand new difficultyModifier for the fresh run instead of carrying the dead run\'s forward', () => {
    const character = makeCharacter({ currentHealth: 0 });
    const habits = [makeHabit()];
    const oldBoss = makeBoss({ index: 7, difficultyModifier: 1.1 });

    const rolledModifiers = new Set<number>();
    for (let seed = 0; seed < 20; seed++) {
      const result = resolvePlayerDeathIfDead(character, oldBoss, habits, createRng(seed));
      rolledModifiers.add(result.boss.difficultyModifier as number);
    }

    expect(rolledModifiers.size).toBeGreaterThan(1); // proves it's re-rolled, not just copied from oldBoss
  });

  it('treats a tiny positive currentHealth that rounds to 0 as dead', () => {
    const character = makeCharacter({ currentHealth: 0.3 }); // rounds to 0 on the health bar, but is not literally 0
    const boss = makeBoss({ index: 7 });
    const habits = [makeHabit()];
    const rng = createRng(1);

    const result = resolvePlayerDeathIfDead(character, boss, habits, rng);

    expect(result.died).toBe(true);
  });

  it('retains habit definitions (id/name/period/difficulty) and streak, but re-rolls damageType', () => {
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
    expect(rerolled.streakCount).toBe(12);
  });

  it('leaves an already-zero streak at zero (death should never appear to reset it)', () => {
    const character = makeCharacter({ currentHealth: 0 });
    const boss = makeBoss();
    const original = makeHabit({ streakCount: 0 });

    const result = resolvePlayerDeathIfDead(character, boss, [original], createRng(1));

    expect(result.habits[0].streakCount).toBe(0);
  });

  it('clears Special/Ult/Overdrive flags and overdrive-use tracking on reset', () => {
    const character = makeCharacter({ currentHealth: 0 });
    const boss = makeBoss();
    const original = makeHabit({
      isSpecial: true,
      isUlt: true,
      isOverdrive: true,
      overdrivePeriodKey: 'some-key',
      overdriveUsesThisPeriod: 2,
    });

    const result = resolvePlayerDeathIfDead(character, boss, [original], createRng(1));

    const [reset] = result.habits;
    expect(reset.isSpecial).toBe(false);
    expect(reset.isUlt).toBe(false);
    expect(reset.isOverdrive).toBe(false);
    expect(reset.overdrivePeriodKey).toBeNull();
    expect(reset.overdriveUsesThisPeriod).toBe(0);
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

describe('activeWoundsEffect / healingMultiplier', () => {
  function makeWounds(overrides: Partial<WoundsStatusEffect> = {}): WoundsStatusEffect {
    return { type: 'wounds', appliedDayKey: '2026-01-01', durationDays: 2, effectRate: 0.5, ...overrides };
  }

  it('is undefined/1 when the character has no status effects', () => {
    const character = makeCharacter();
    expect(activeWoundsEffect(character, '2026-01-01')).toBeUndefined();
    expect(healingMultiplier(character, '2026-01-01')).toBe(1);
  });

  it('is active on the day it was applied and until durationDays have fully elapsed', () => {
    const wounds = makeWounds({ appliedDayKey: '2026-01-01', durationDays: 2 });
    const character = makeCharacter({ statusEffects: [wounds] });

    expect(activeWoundsEffect(character, '2026-01-01')).toEqual(wounds); // day 0
    expect(activeWoundsEffect(character, '2026-01-02')).toEqual(wounds); // day 1, still < 2
    expect(healingMultiplier(character, '2026-01-02')).toBe(0.5);
  });

  it('expires once durationDays have fully elapsed', () => {
    const wounds = makeWounds({ appliedDayKey: '2026-01-01', durationDays: 2 });
    const character = makeCharacter({ statusEffects: [wounds] });

    expect(activeWoundsEffect(character, '2026-01-03')).toBeUndefined(); // day 2 == durationDays -> expired
    expect(healingMultiplier(character, '2026-01-03')).toBe(1);
  });
});

describe('missHabit — no Wounds from boss hits', () => {
  it('never applies Wounds on a miss, even for a boss saved with the old Wounds ability', () => {
    const boss = { ...makeBoss({ physicalAttack: 20, magicAttack: 20 }), woundsAbility: { hitChance: 1, durationDays: 2, effectRate: 0.5 } } as Boss;
    const result = missHabit(makeCharacter(), makeHabit(), boss, DAY_KEY, () => 0);
    expect(result.character.statusEffects ?? []).toEqual([]);
    expect('woundsApplied' in result).toBe(false);
  });
});

describe('completeHabit — healing reduced by an active Wounds effect', () => {
  it('multiplies healing by effectRate while Wounds is active', () => {
    const wounds: WoundsStatusEffect = { type: 'wounds', appliedDayKey: '2026-01-01', durationDays: 2, effectRate: 0.5 };
    const character = makeCharacter({ currentHealth: 1, statusEffects: [wounds] });
    const habit = makeHabit({ damageType: 'healing', streakCount: 0 });
    const boss = makeBoss();

    const result = completeHabit(character, habit, [habit], boss, '2026-01-02', noCritRng); // still active

    const statValue = statAtLevel(character.starterStats.healing, character.level);
    const expectedFullHeal = statValue * unrankedMultiplier(0);
    expect(result.character.currentHealth).toBeCloseTo(1 + expectedFullHeal * 0.5, 10);
  });

  it('heals at full strength once the Wounds effect has expired', () => {
    const wounds: WoundsStatusEffect = { type: 'wounds', appliedDayKey: '2026-01-01', durationDays: 1, effectRate: 0.5 };
    const character = makeCharacter({ currentHealth: 1, statusEffects: [wounds] });
    const habit = makeHabit({ damageType: 'healing', streakCount: 0 });
    const boss = makeBoss();

    const result = completeHabit(character, habit, [habit], boss, '2026-01-03', noCritRng); // expired

    const statValue = statAtLevel(character.starterStats.healing, character.level);
    const expectedFullHeal = statValue * unrankedMultiplier(0);
    expect(result.character.currentHealth).toBeCloseTo(1 + expectedFullHeal, 10);
  });
});

describe('habitDamageBreakdown — weekly bonus', () => {
  it('keeps the weekly bonus out of baseDamage, folded only into effectiveDamage', () => {
    const character = makeCharacter();
    const daily = makeHabit({ period: 'daily', damageType: 'physical', streakCount: 0 });
    const weekly = makeHabit({ period: 'weekly', damageType: 'physical', streakCount: 0 });

    const dailyBreakdown = habitDamageBreakdown(character, daily, [daily]);
    const weeklyBreakdown = habitDamageBreakdown(character, weekly, [weekly]);

    // Both hit for the same full stat — the weekly bonus must show up as its
    // own multiplier, not as a bigger baseDamage.
    expect(weeklyBreakdown.baseDamage).toBeCloseTo(dailyBreakdown.baseDamage, 10);
    expect(dailyBreakdown.weeklyMultiplier).toBe(1);
    expect(weeklyBreakdown.weeklyMultiplier).toBe(TUNING.WEEKLY_BONUS_MULTIPLIER);
    expect(weeklyBreakdown.effectiveDamage).toBeCloseTo(dailyBreakdown.effectiveDamage * TUNING.WEEKLY_BONUS_MULTIPLIER, 10);
  });
});

describe('expectedMediumDailyDamage', () => {
  it('is the raw stat times the item multiplier, whatever habits exist', () => {
    const character = makeCharacter({ level: 4, equippedItemIds: ['serrated-ripper'] });
    const expected =
      (statAtLevel(character.starterStats.physicalDamage, character.level) + itemFlatBonus(character, 'physicalDamage')) *
      itemStatMultiplier(character, 'physicalDamage');
    expect(expectedMediumDailyDamage(character, 'physical')).toBeCloseTo(expected, 10);
  });
});

describe('completeHabit — item effects', () => {
  const E = TUNING.ITEM_EFFECTS;
  const NO_RESIST = { armor: 0, magicResist: 0 };
  function hit(equipped: string[], habit: Partial<Habit>, boss: Partial<Boss>, rng = noCritRng, character: Partial<Character> = {}) {
    return completeHabit(
      makeCharacter({ equippedItemIds: equipped, ...character }),
      makeHabit(habit),
      [makeHabit(habit)],
      makeBoss({ ...NO_RESIST, maxHealth: 100000, health: 100000, ...boss }),
      DAY_KEY,
      rng,
    );
  }

  it('Godslayer deals ×1.3 while the boss is above 75% health', () => {
    const full = hit(['godslayer-greatblade'], {}, { health: 100000 }).damageDealt ?? 0;
    const half = hit(['godslayer-greatblade'], {}, { health: 50000 }).damageDealt ?? 0;
    expect(full / half).toBeCloseTo(E.GIANTSLAYER_MULTIPLIER, 10);
  });

  it("Headsman's Mark deals ×1.5 to a boss below 25% health", () => {
    const low = hit(['headsmans-mark'], {}, { health: 20000 }).damageDealt ?? 0;
    const half = hit(['headsmans-mark'], {}, { health: 50000 }).damageDealt ?? 0;
    expect(low / half).toBeCloseTo(E.HEADSMAN_MULTIPLIER, 10);
  });

  it('Moonwell makes a weekly skill hit ×1.5 and leaves dailies alone', () => {
    const weeklyWith = hit(['moonwell'], { period: 'weekly' }, {}).damageDealt ?? 0;
    const weeklyWithout = hit([], { period: 'weekly' }, {}).damageDealt ?? 0;
    expect(weeklyWith / weeklyWithout).toBeCloseTo(E.MOONWELL_MULTIPLIER, 10);
    expect(hit(['moonwell'], {}, {}).damageDealt).toBeCloseTo(hit([], {}, {}).damageDealt ?? 0, 10);
  });

  it('Spellweave grows magic damage with each skill used today and counts this one', () => {
    const fresh = hit(['runeforged-spellblade'], { damageType: 'magic' }, {});
    const third = hit(['runeforged-spellblade'], { damageType: 'magic' }, {}, noCritRng, { spellweave: { dayKey: DAY_KEY, count: 2 } });
    expect((third.damageDealt ?? 0) / (fresh.damageDealt ?? 0)).toBeCloseTo(1 + 2 * E.SPELLWEAVE_PER_SKILL, 10);
    expect(third.character.spellweave).toEqual({ dayKey: DAY_KEY, count: 3 });
    const staleDay = hit(['runeforged-spellblade'], { damageType: 'magic' }, {}, noCritRng, { spellweave: { dayKey: '2025-12-31', count: 4 } });
    expect(staleDay.damageDealt).toBeCloseTo(fresh.damageDealt ?? 0, 10);
  });

  it('Temperance Seal makes a resisted bad skill hit ×1.5', () => {
    const bad = hit(['temperance-seal'], { isBad: true }, {}).damageDealt ?? 0;
    const good = hit(['temperance-seal'], {}, {}).damageDealt ?? 0;
    expect(bad / good).toBeCloseTo(E.TEMPERANCE_MULTIPLIER, 10);
  });

  it("Voidcaller's Scepter makes magic crits deal ×3", () => {
    const crit = hit(['voidcallers-scepter'], { damageType: 'magic' }, {}, alwaysCritRng).damageDealt ?? 0;
    const plain = hit(['voidcallers-scepter'], { damageType: 'magic' }, {}).damageDealt ?? 0;
    expect(crit / plain).toBeCloseTo(E.VOID_CRIT_MULTIPLIER, 10);
  });

  it('First Blood crits the first hit on a boss, and only the first', () => {
    const first = hit(['first-blood'], {}, {});
    expect(first.wasCrit).toBe(true);
    expect(first.boss.playerHasHit).toBe(true);
    const second = completeHabit(first.character, makeHabit(), [makeHabit()], first.boss, DAY_KEY, noCritRng);
    expect(second.wasCrit).toBe(false);
  });

  it("Starfall crits the day's first magic skill and stamps the day", () => {
    const first = hit(['starfall-staff'], { damageType: 'magic' }, { playerHasHit: true });
    expect(first.wasCrit).toBe(true);
    expect(first.character.effectDayKeys?.starfall).toBe(DAY_KEY);
    const second = completeHabit(first.character, makeHabit({ damageType: 'magic' }), [makeHabit({ damageType: 'magic' })], first.boss, DAY_KEY, noCritRng);
    expect(second.wasCrit).toBe(false);
    expect(hit(['starfall-staff'], { damageType: 'physical' }, { playerHasHit: true }).character.effectDayKeys).toBeUndefined();
  });

  it("Hunter's Eye crits ignore armor", () => {
    const armored = hit(['hunters-eye'], {}, { armor: 1000 }, alwaysCritRng).damageDealt ?? 0;
    const bare = hit(['hunters-eye'], {}, { armor: 0 }, alwaysCritRng).damageDealt ?? 0;
    expect(armored).toBeCloseTo(bare, 10);
    expect(hit(['hunters-eye'], {}, { armor: 1000 }).damageDealt ?? 0).toBeLessThan(hit(['hunters-eye'], {}, { armor: 0 }).damageDealt ?? 0);
  });

  it('Dynamo Core makes an Overdrive use deal full damage', () => {
    const habit = makeHabit({ isOverdrive: true });
    const boss = makeBoss({ ...NO_RESIST, maxHealth: 100000, health: 100000 });
    const character = makeCharacter({ equippedItemIds: ['dynamo-core'] });
    const normal = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng).damageDealt ?? 0;
    const overdrive = overdriveHabit(character, habit, [habit], boss, DAY_KEY, DAY_KEY, noCritRng).damageDealt ?? 0;
    expect(overdrive).toBeCloseTo(normal, 10);
    const without = overdriveHabit(makeCharacter(), habit, [habit], boss, DAY_KEY, DAY_KEY, noCritRng).damageDealt ?? 0;
    expect(without / (completeHabit(makeCharacter(), habit, [habit], boss, DAY_KEY, noCritRng).damageDealt ?? 1)).toBeCloseTo(TUNING.OVERDRIVE_DAMAGE_FACTOR, 10);
  });

  it('Banner of Endurance doubles streak-milestone EXP', () => {
    expect(hit(['banner-of-endurance'], { streakCount: 4 }, {}).milestoneExp).toBe(MILESTONE_EXP[5] * E.BANNER_MILESTONE_MULTIPLIER);
    expect(hit([], { streakCount: 4 }, {}).milestoneExp).toBe(MILESTONE_EXP[5]);
  });

  it('Null Mirror blocks boss reflect', () => {
    const result = hit(['null-mirror'], {}, { reflectDayKey: DAY_KEY });
    expect(result.reflectedDamage).toBeUndefined();
    expect(result.character.currentHealth).toBe(50);
  });

  it('Bloodthorn Blade crits also heal 5% of max health', () => {
    const result = hit(['bloodthorn-blade'], {}, {}, alwaysCritRng, { currentHealth: 1 });
    const character = makeCharacter({ equippedItemIds: ['bloodthorn-blade'] });
    const expected = 1 + (result.damageDealt ?? 0) * 0.03 + effectiveStat(character, 'health') * (E.BLOODTHORN_CRIT_HEAL_PCT / 100);
    expect(result.character.currentHealth).toBeCloseTo(expected, 10);
  });

  it("Titan's Lifeblood heals ×1.5 while below half health", () => {
    const low = hit(['titans-lifeblood'], { damageType: 'healing' }, {}, noCritRng, { currentHealth: 10 });
    const high = hit(['titans-lifeblood'], { damageType: 'healing' }, {}, noCritRng, { currentHealth: 40 });
    expect((low.character.currentHealth - 10) / (high.character.currentHealth - 40)).toBeCloseTo(E.TITANS_MENDING_MULTIPLIER, 10);
  });

  it('Censer of Wrath makes a heal also hit the boss for half, even at full health', () => {
    const character = makeCharacter({ equippedItemIds: ['censer-of-wrath'] });
    const habit = makeHabit({ damageType: 'healing' });
    const boss = makeBoss({ health: 100 });
    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);
    const healAmount = statAtLevel(character.starterStats.healing, 1) * itemStatMultiplier(character, 'healing');
    expect(result.damageDealt).toBeCloseTo(healAmount * E.CENSER_DAMAGE_FRACTION, 10);
    expect(result.boss.health).toBeCloseTo(100 - healAmount * E.CENSER_DAMAGE_FRACTION, 10);
  });

  it('records overkill on a killing blow', () => {
    const result = hit([], {}, { health: 5 });
    expect(result.boss.health).toBe(0);
    expect(result.boss.overkill).toBeCloseTo((result.damageDealt ?? 0) - 5, 10);
  });

  it('habitDamageBreakdown folds the effect multiplier into its preview', () => {
    const character = makeCharacter({ equippedItemIds: ['godslayer-greatblade'] });
    const habit = makeHabit();
    const boss = makeBoss({ ...NO_RESIST });
    const breakdown = habitDamageBreakdown(character, habit, [habit], boss, DAY_KEY);
    expect(breakdown.effectMultiplier).toBe(E.GIANTSLAYER_MULTIPLIER);
    expect(breakdown.effectiveDamage).toBeCloseTo(completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng).damageDealt ?? 0, 10);
  });
});

describe('missHabit — item effects', () => {
  const E = TUNING.ITEM_EFFECTS;
  const forcePhysicalNoCrit = () => 0.4; // < 0.5 picks 'physical'; beats critChance 0

  it('Bloodbound Carapace stops boss lifesteal', () => {
    const boss = makeBoss({ critChance: 0, lifestealPct: 1, maxHealth: 1000, health: 100 });
    const result = missHabit(makeCharacter({ currentHealth: 1000, equippedItemIds: ['bloodbound-carapace'] }), makeHabit(), boss, DAY_KEY, forcePhysicalNoCrit);
    expect(result.bossLifestealHealed).toBeUndefined();
    expect(result.boss.health).toBe(100);
  });

  it('Dawnguard Helm halves the first hit each day only', () => {
    const boss = makeBoss({ critChance: 0, physicalAttack: 1000 });
    const character = makeCharacter({ currentHealth: 100000, equippedItemIds: ['dawnguard-helm'] });
    const first = missHabit(character, makeHabit(), boss, DAY_KEY, forcePhysicalNoCrit);
    const second = missHabit(first.character, makeHabit(), boss, DAY_KEY, forcePhysicalNoCrit);
    const firstDamage = character.currentHealth - first.character.currentHealth;
    const secondDamage = first.character.currentHealth - second.character.currentHealth;
    expect(firstDamage / secondDamage).toBeCloseTo(E.DAWNGUARD_FACTOR, 10);
    const nextDay = missHabit(second.character, makeHabit(), boss, '2026-01-02', forcePhysicalNoCrit);
    expect((second.character.currentHealth - nextDay.character.currentHealth) / secondDamage).toBeCloseTo(E.DAWNGUARD_FACTOR, 10);
  });
});

describe('resolveBossDefeatIfDead — item effects', () => {
  const E = TUNING.ITEM_EFFECTS;

  it('Soul Lantern heals 15% of max health when a boss falls', () => {
    const character = makeCharacter({ currentHealth: 10, equippedItemIds: ['soul-lantern'] });
    const result = resolveBossDefeatIfDead(character, makeBoss({ health: 0 }), createRng(1));
    const lantern = (effectiveStat(result.character, 'health') * E.SOUL_LANTERN_HEAL_PCT) / 100;
    const without = resolveBossDefeatIfDead(makeCharacter({ currentHealth: 10 }), makeBoss({ health: 0 }), createRng(1));
    expect(result.itemHealed).toBeCloseTo(lantern, 10);
    expect(result.character.currentHealth).toBeCloseTo(without.character.currentHealth + lantern, 5);
    expect(without.itemHealed).toBeUndefined();
  });

  it('Echoing Blade carries overkill into the next boss', () => {
    const withBlade = resolveBossDefeatIfDead(makeCharacter({ equippedItemIds: ['echoing-blade'] }), makeBoss({ health: 0, overkill: 50 }), createRng(1));
    const without = resolveBossDefeatIfDead(makeCharacter(), makeBoss({ health: 0, overkill: 50 }), createRng(1));
    expect(withBlade.boss.health).toBeCloseTo(withBlade.boss.maxHealth - 50, 10);
    expect(without.boss.health).toBe(without.boss.maxHealth);
  });

  it('Echoing Blade never kills the next boss outright, however big the overkill', () => {
    const result = resolveBossDefeatIfDead(makeCharacter({ equippedItemIds: ['echoing-blade'] }), makeBoss({ health: 0, overkill: 1e12 }), createRng(1));
    expect(result.defeated).toBe(true);
    expect(result.boss.index).toBe(2);
    expect(result.boss.health).toBe(1);
  });
});

describe('boss skill effects in combat', () => {
  const blind = { type: 'blind' as const, appliedDayKey: DAY_KEY, durationDays: 2 };
  const sunder = { type: 'sunder' as const, appliedDayKey: DAY_KEY, durationDays: 2 };
  const forcePhysicalNoCrit = () => 0.4; // < 0.5 picks 'physical'; beats critChance 0

  it('Blind drops crit chance to 0, but only when a day key is given', () => {
    const character = makeCharacter({ critChance: 0.3, statusEffects: [blind] });
    expect(effectiveCritChance(character, DAY_KEY)).toBe(0);
    expect(effectiveCritChance(character)).toBeCloseTo(0.3, 10);
  });

  it('Blind stops rolled crits', () => {
    const character = makeCharacter({ critChance: 0.5, statusEffects: [blind] });
    const habit = makeHabit();
    const result = completeHabit(character, habit, [habit], makeBoss({ health: 500, maxHealth: 500, playerHasHit: true }), DAY_KEY, alwaysCritRng);
    expect(result.wasCrit).toBe(false);
  });

  it('Blind still lets First Blood force a crit on the first hit', () => {
    const character = makeCharacter({ statusEffects: [blind], ownedItemIds: ['first-blood'], equippedItemIds: ['first-blood'] });
    const habit = makeHabit();
    const result = completeHabit(character, habit, [habit], makeBoss({ health: 500, maxHealth: 500 }), DAY_KEY, noCritRng);
    expect(result.wasCrit).toBe(true);
  });

  it('Sunder halves the armor a miss is mitigated by', () => {
    const boss = makeBoss({ critChance: 0, physicalAttack: 400 });
    const sundered = missHabit(
      makeCharacter({ currentHealth: 1000, equippedItemIds: ['executioners-axe'], statusEffects: [sunder] }), // 150 armor, halved
      makeHabit(), boss, DAY_KEY, forcePhysicalNoCrit,
    );
    const halfArmor = missHabit(makeCharacter({ currentHealth: 1000, equippedItemIds: ['iron-buckler'] }), makeHabit(), boss, DAY_KEY, forcePhysicalNoCrit); // 75 armor
    expect(1000 - sundered.character.currentHealth).toBeCloseTo(1000 - halfArmor.character.currentHealth, 10);
  });

  it('Bloodlust heals the boss 3% of its max HP per hit, on top of its lifesteal', () => {
    const boss = makeBoss({ critChance: 0, maxHealth: 1000, health: 500, lifestealPct: 0.1, bloodlustDayKey: DAY_KEY });
    const result = missHabit(makeCharacter({ currentHealth: 1000 }), makeHabit(), boss, DAY_KEY, forcePhysicalNoCrit);
    const dealt = 1000 - result.character.currentHealth;
    expect(result.boss.health).toBeCloseTo(500 + dealt * 0.1 + 30, 10);
    expect(result.bossLifestealHealed).toBeCloseTo(dealt * 0.1 + 30, 10);
  });

  it('Bloodlust heals no more than to full', () => {
    const boss = makeBoss({ critChance: 0, maxHealth: 1000, health: 990, bloodlustDayKey: DAY_KEY });
    expect(missHabit(makeCharacter({ currentHealth: 1000 }), makeHabit(), boss, DAY_KEY, forcePhysicalNoCrit).boss.health).toBe(1000);
  });

  it('Bloodbound Carapace blocks the Bloodlust heal too', () => {
    const boss = makeBoss({ critChance: 0, maxHealth: 1000, health: 500, bloodlustDayKey: DAY_KEY });
    const result = missHabit(makeCharacter({ currentHealth: 1000, equippedItemIds: ['bloodbound-carapace'] }), makeHabit(), boss, DAY_KEY, forcePhysicalNoCrit);
    expect(result.boss.health).toBe(500);
    expect(result.bossLifestealHealed).toBeUndefined();
  });

  it('Bloodlust has worn off two days later', () => {
    const boss = makeBoss({ critChance: 0, maxHealth: 1000, health: 500, bloodlustDayKey: DAY_KEY });
    expect(missHabit(makeCharacter({ currentHealth: 1000 }), makeHabit(), boss, '2026-01-03', forcePhysicalNoCrit).boss.health).toBe(500);
  });
});
