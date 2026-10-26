import { describe, expect, it } from 'vitest';
import { TUNING } from './constants/tuning';
import { effectiveStat } from './leveling';
import { applyDailyRegen, bumpSpellweave, critMultiplierFor, effectDamageMultiplier, hasItemEffect, isForcedCrit, spellweaveStacks } from './itemEffects';
import type { Boss, Character, Habit } from './types';

const DAY_KEY = '2026-01-01';

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
    armor: 0,
    magicResist: 0,
    critChance: 0,
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
    difficulty: 'medium',
    damageType: 'physical',
    isBad: false,
    streakCount: 0,
    lastCompletedPeriodKey: null,
    lastCheckedPeriodKey: null,
    ...overrides,
  };
}

const E = TUNING.ITEM_EFFECTS;

describe('hasItemEffect', () => {
  it('is true only while an item carrying the effect is equipped', () => {
    expect(hasItemEffect(makeCharacter({ equippedItemIds: ['godslayer-greatblade'] }), 'giantslayer')).toBe(true);
    expect(hasItemEffect(makeCharacter({ ownedItemIds: ['godslayer-greatblade'] }), 'giantslayer')).toBe(false);
    expect(hasItemEffect(makeCharacter({ equippedItemIds: ['rusty-blade'] }), 'giantslayer')).toBe(false);
  });
});

describe('effectDamageMultiplier', () => {
  it('is 1 with no effect items', () => {
    expect(effectDamageMultiplier(makeCharacter(), makeHabit(), makeBoss(), DAY_KEY)).toBe(1);
  });

  it('Giantslayer boosts damage only while the boss is above the threshold', () => {
    const c = makeCharacter({ equippedItemIds: ['godslayer-greatblade'] });
    expect(effectDamageMultiplier(c, makeHabit(), makeBoss({ health: 100 }), DAY_KEY)).toBe(E.GIANTSLAYER_MULTIPLIER);
    expect(effectDamageMultiplier(c, makeHabit(), makeBoss({ health: 50 }), DAY_KEY)).toBe(1);
    expect(effectDamageMultiplier(c, makeHabit({ damageType: 'healing' }), makeBoss({ health: 100 }), DAY_KEY)).toBe(1);
  });

  it("Headsman's Mark boosts damage only while the boss is below the threshold", () => {
    const c = makeCharacter({ equippedItemIds: ['headsmans-mark'] });
    expect(effectDamageMultiplier(c, makeHabit(), makeBoss({ health: 20 }), DAY_KEY)).toBe(E.HEADSMAN_MULTIPLIER);
    expect(effectDamageMultiplier(c, makeHabit(), makeBoss({ health: 50 }), DAY_KEY)).toBe(1);
  });

  it('Moonwell boosts weekly skills of any type', () => {
    const c = makeCharacter({ equippedItemIds: ['moonwell'] });
    expect(effectDamageMultiplier(c, makeHabit({ period: 'weekly' }), makeBoss(), DAY_KEY)).toBe(E.MOONWELL_MULTIPLIER);
    expect(effectDamageMultiplier(c, makeHabit({ period: 'weekly', damageType: 'healing' }), makeBoss(), DAY_KEY)).toBe(E.MOONWELL_MULTIPLIER);
    expect(effectDamageMultiplier(c, makeHabit(), makeBoss(), DAY_KEY)).toBe(1);
  });

  it('Spellweave adds a stack per skill used earlier today, magic only, capped', () => {
    const c = makeCharacter({ equippedItemIds: ['runeforged-spellblade'], spellweave: { dayKey: DAY_KEY, count: 2 } });
    expect(effectDamageMultiplier(c, makeHabit({ damageType: 'magic' }), makeBoss(), DAY_KEY)).toBeCloseTo(1 + 2 * E.SPELLWEAVE_PER_SKILL, 10);
    expect(effectDamageMultiplier(c, makeHabit({ damageType: 'physical' }), makeBoss(), DAY_KEY)).toBe(1);
    expect(effectDamageMultiplier(c, makeHabit({ damageType: 'magic' }), makeBoss(), '2026-01-02')).toBe(1);
    const capped = { ...c, spellweave: { dayKey: DAY_KEY, count: 50 } };
    expect(spellweaveStacks(capped, DAY_KEY)).toBe(E.SPELLWEAVE_MAX_STACKS);
  });

  it('Temperance Seal boosts a resisted bad skill', () => {
    const c = makeCharacter({ equippedItemIds: ['temperance-seal'] });
    expect(effectDamageMultiplier(c, makeHabit({ isBad: true }), makeBoss(), DAY_KEY)).toBe(E.TEMPERANCE_MULTIPLIER);
    expect(effectDamageMultiplier(c, makeHabit(), makeBoss(), DAY_KEY)).toBe(1);
  });
});

describe('bumpSpellweave', () => {
  it('counts skills per day while Spellweave is equipped, and is a no-op otherwise', () => {
    const plain = makeCharacter();
    expect(bumpSpellweave(plain, DAY_KEY)).toBe(plain);
    const c = makeCharacter({ equippedItemIds: ['runeforged-spellblade'] });
    const once = bumpSpellweave(c, DAY_KEY);
    expect(once.spellweave).toEqual({ dayKey: DAY_KEY, count: 1 });
    expect(bumpSpellweave(once, DAY_KEY).spellweave).toEqual({ dayKey: DAY_KEY, count: 2 });
    expect(bumpSpellweave(once, '2026-01-02').spellweave).toEqual({ dayKey: '2026-01-02', count: 1 });
  });
});

describe('isForcedCrit', () => {
  it('First Blood forces a crit on the first hit of a boss only', () => {
    const c = makeCharacter({ equippedItemIds: ['first-blood'] });
    expect(isForcedCrit(c, makeHabit(), makeBoss(), DAY_KEY)).toBe(true);
    expect(isForcedCrit(c, makeHabit(), makeBoss({ playerHasHit: true }), DAY_KEY)).toBe(false);
    expect(isForcedCrit(c, makeHabit({ damageType: 'healing' }), makeBoss(), DAY_KEY)).toBe(false);
  });

  it("Starfall forces a crit on the day's first magic skill only", () => {
    const c = makeCharacter({ equippedItemIds: ['starfall-staff'] });
    expect(isForcedCrit(c, makeHabit({ damageType: 'magic' }), makeBoss({ playerHasHit: true }), DAY_KEY)).toBe(true);
    expect(isForcedCrit(c, makeHabit({ damageType: 'physical' }), makeBoss({ playerHasHit: true }), DAY_KEY)).toBe(false);
    const used = { ...c, effectDayKeys: { starfall: DAY_KEY } };
    expect(isForcedCrit(used, makeHabit({ damageType: 'magic' }), makeBoss({ playerHasHit: true }), DAY_KEY)).toBe(false);
  });
});

describe('critMultiplierFor', () => {
  it("is ×3 for a magic skill with Voidcaller's Scepter, the normal crit multiplier otherwise", () => {
    const c = makeCharacter({ equippedItemIds: ['voidcallers-scepter'] });
    expect(critMultiplierFor(c, makeHabit({ damageType: 'magic' }))).toBe(E.VOID_CRIT_MULTIPLIER);
    expect(critMultiplierFor(c, makeHabit({ damageType: 'physical' }))).toBe(TUNING.CRIT_MULTIPLIER);
    expect(critMultiplierFor(makeCharacter(), makeHabit({ damageType: 'magic' }))).toBe(TUNING.CRIT_MULTIPLIER);
  });
});

describe('applyDailyRegen', () => {
  it('Ember Heart heals 5% of max health once per day', () => {
    const c = makeCharacter({ currentHealth: 10, equippedItemIds: ['ember-heart'] });
    const { character, healed } = applyDailyRegen(c, DAY_KEY);
    expect(healed).toBeCloseTo(effectiveStat(c, 'health') * (E.EMBER_HEART_HEAL_PCT / 100), 10);
    expect(character.currentHealth).toBeCloseTo(10 + healed, 10);
    expect(character.effectDayKeys?.emberHeart).toBe(DAY_KEY);
    expect(applyDailyRegen(character, DAY_KEY)).toEqual({ character, healed: 0 });
    expect(applyDailyRegen(character, '2026-01-02').healed).toBeGreaterThan(0);
  });

  it('is a no-op without Ember Heart', () => {
    const c = makeCharacter({ currentHealth: 10 });
    expect(applyDailyRegen(c, DAY_KEY)).toEqual({ character: c, healed: 0 });
  });
});
