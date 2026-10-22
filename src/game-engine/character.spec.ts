import { describe, expect, it } from 'vitest';
import { applyDamagePoolRebalance, createCharacter, discardUnequippedItems, migrateCharacter, randomizeStat } from './character';
import { ITEM_CATALOG } from './items';
import type { Character } from './types';
import { createRng } from './rng';
import { TUNING } from './constants/tuning';

describe('createCharacter', () => {
  it('every starter stat falls within its possible range (split ratio + ±5% jitter) across many real-RNG runs', () => {
    const rng = createRng();
    const damagePool = TUNING.BASE_STATS.physicalDamage + TUNING.BASE_STATS.magicDamage;
    const shares = TUNING.DAMAGE_SPLIT_RATIOS.map(([physicalShare]) => physicalShare);
    const minShare = Math.min(...shares);
    const maxShare = Math.max(...shares);

    for (let i = 0; i < 200; i++) {
      const character = createCharacter(rng);
      const { physicalDamage, magicDamage, healing, health, trueDamage } = character.starterStats;

      expect(physicalDamage).toBeGreaterThanOrEqual(damagePool * minShare * 0.95);
      expect(physicalDamage).toBeLessThanOrEqual(damagePool * maxShare * 1.05);

      expect(magicDamage).toBeGreaterThanOrEqual(damagePool * minShare * 0.95);
      expect(magicDamage).toBeLessThanOrEqual(damagePool * maxShare * 1.05);

      // Every split ratio pairs physical/magic shares that sum to 1, so
      // their combined range is tighter than either stat's individual range.
      expect(physicalDamage + magicDamage).toBeGreaterThanOrEqual(damagePool * 0.95);
      expect(physicalDamage + magicDamage).toBeLessThanOrEqual(damagePool * 1.05);

      expect(healing).toBeGreaterThanOrEqual(TUNING.BASE_STATS.healing * 0.95);
      expect(healing).toBeLessThanOrEqual(TUNING.BASE_STATS.healing * 1.05);

      expect(health).toBeGreaterThanOrEqual(TUNING.BASE_STATS.health * 0.95);
      expect(health).toBeLessThanOrEqual(TUNING.BASE_STATS.health * 1.05);

      expect(trueDamage).toBeGreaterThanOrEqual(TUNING.BASE_STATS.trueDamage * 0.95);
      expect(trueDamage).toBeLessThanOrEqual(TUNING.BASE_STATS.trueDamage * 1.05);
    }
  });

  it('picks each configured physical/magic split ratio at least once over many seeds', () => {
    const damagePool = TUNING.BASE_STATS.physicalDamage + TUNING.BASE_STATS.magicDamage;
    const seenShares = new Set<number>();

    for (let seed = 0; seed < 500; seed++) {
      const character = createCharacter(createRng(seed));
      // Reverse the jitter-free share out of the jittered stat by rounding
      // to the nearest configured share — jitter is only ±5%, well inside
      // the gap between adjacent configured shares (10%).
      const approxShare = character.starterStats.physicalDamage / damagePool;
      const closest = TUNING.DAMAGE_SPLIT_RATIOS.map(([p]) => p).reduce((best, p) =>
        Math.abs(p - approxShare) < Math.abs(best - approxShare) ? p : best,
      );
      seenShares.add(closest);
    }

    expect(seenShares.size).toBe(TUNING.DAMAGE_SPLIT_RATIOS.length);
  });

  it('starts at level 1 with 0 exp and currentHealth equal to starter health', () => {
    const rng = createRng(42);
    const character = createCharacter(rng);
    expect(character.level).toBe(1);
    expect(character.exp).toBe(0);
    expect(character.currentHealth).toBe(character.starterStats.health);
  });

  it('starts with no owned or equipped items', () => {
    const character = createCharacter(createRng(1));
    expect(character.ownedItemIds).toEqual([]);
    expect(character.equippedItemIds).toEqual([]);
  });

  it('starts with the base crit chance', () => {
    const character = createCharacter(createRng(1));
    expect(character.critChance).toBe(TUNING.BASE_CRIT_CHANCE);
  });

  it('rolls a newItemUnlockTiers assignment covering every level-gated item', () => {
    const character = createCharacter(createRng(1));
    const levelGatedIds = ITEM_CATALOG.filter((item) => item.levelGated).map((item) => item.id);
    expect(Object.keys(character.newItemUnlockTiers ?? {}).sort()).toEqual(levelGatedIds.sort());
  });

  it('is deterministic: the same seed produces the same character', () => {
    const characterA = createCharacter(createRng(12345));
    const characterB = createCharacter(createRng(12345));
    expect(characterA).toEqual(characterB);
  });

  it('different seeds produce different characters', () => {
    const characterA = createCharacter(createRng(1));
    const characterB = createCharacter(createRng(2));
    expect(characterA).not.toEqual(characterB);
  });
});

describe('migrateCharacter', () => {
  it('backfills trueDamage on a pre-migration save, leaving every other field untouched', () => {
    const character = createCharacter(createRng(1));
    const { trueDamage, ...rest } = character.starterStats;
    void trueDamage;
    const preMigrationSave = { ...character, starterStats: rest } as typeof character;

    const migrated = migrateCharacter(preMigrationSave, createRng(2));

    expect(migrated.starterStats.trueDamage).toBeGreaterThan(0);
    expect({ ...migrated.starterStats, trueDamage: undefined }).toEqual({ ...rest, trueDamage: undefined });
    expect(migrated.level).toBe(character.level);
    expect(migrated.currentHealth).toBe(character.currentHealth);
  });

  it('drops a stray starterStats.expGain and expGainRebalanceApplied from a save written before the expGain skill was removed', () => {
    const character = createCharacter(createRng(1));
    const legacy = {
      ...character,
      expGainRebalanceApplied: true,
      starterStats: { ...character.starterStats, expGain: 11 },
    } as unknown as Character;

    const migrated = migrateCharacter(legacy, createRng(2));

    expect('expGain' in migrated.starterStats).toBe(false);
    expect('expGainRebalanceApplied' in migrated).toBe(false);
    expect(migrated.starterStats).toEqual(character.starterStats);
    expect(migrated.level).toBe(character.level);
  });

  it('is a no-op on a character with nothing to migrate', () => {
    const character = createCharacter(createRng(3));
    const migrated = migrateCharacter(character, createRng(4));
    expect(migrated).toEqual(character);
  });

  it('backfills newItemUnlockTiers on a save that predates level-gated items, leaving existing tiers alone', () => {
    const character = createCharacter(createRng(7));
    const { newItemUnlockTiers, ...withoutTiers } = character;

    const migrated = migrateCharacter(withoutTiers as typeof character, createRng(8));
    expect(Object.keys(migrated.newItemUnlockTiers ?? {}).sort()).toEqual(Object.keys(newItemUnlockTiers ?? {}).sort());
    expect(migrated.starterStats).toEqual(character.starterStats);

    expect(migrateCharacter(character, createRng(9)).newItemUnlockTiers).toEqual(newItemUnlockTiers);
  });
});

describe('createCharacter — quests v2 / run state', () => {
  it('starts with TUNING.SIDE_QUEST_ITEM_COUNT distinct side-only rare/epic items', () => {
    const { sideOnlyItemIds } = createCharacter(createRng(1));
    expect(sideOnlyItemIds).toHaveLength(TUNING.SIDE_QUEST_ITEM_COUNT);
    expect(new Set(sideOnlyItemIds).size).toBe(TUNING.SIDE_QUEST_ITEM_COUNT);
    for (const id of sideOnlyItemIds ?? []) {
      const item = ITEM_CATALOG.find((i) => i.id === id);
      expect(['rare', 'epic']).toContain(item?.rarity);
      expect(item?.levelGated).toBeUndefined();
      expect(item?.type).toBe('equipment');
    }
  });

  it('rolls a fresh side-only set per character (a death re-rolls it)', () => {
    const sets = new Set(Array.from({ length: 30 }, (_, seed) => (createCharacter(createRng(seed)).sideOnlyItemIds ?? []).join(',')));
    expect(sets.size).toBeGreaterThan(1);
  });

  it('has no expGain starter stat or rebalance flag', () => {
    const character = createCharacter(createRng(1));
    expect('expGain' in character.starterStats).toBe(false);
    expect('expGainRebalanceApplied' in character).toBe(false);
    expect(character.questWeek).toBeUndefined();
  });
});

describe('migrateCharacter — side-only items', () => {
  it('backfills side-only items on a save that predates side quests, never picking one the player owns', () => {
    const character = createCharacter(createRng(3));
    const rareOwned = ITEM_CATALOG.filter((i) => (i.rarity === 'rare' || i.rarity === 'epic') && i.type === 'equipment' && !i.levelGated).map((i) => i.id);
    const preSideQuests: Character = { ...character, sideOnlyItemIds: undefined, ownedItemIds: rareOwned.slice(2), equippedItemIds: [] };

    const migrated = migrateCharacter(preSideQuests, createRng(4));

    expect(migrated.sideOnlyItemIds).toHaveLength(2);
    for (const id of migrated.sideOnlyItemIds ?? []) expect(preSideQuests.ownedItemIds).not.toContain(id);
  });

  it('leaves existing side-only items alone', () => {
    const character = createCharacter(createRng(3));
    expect(migrateCharacter(character, createRng(4))).toBe(character);
  });
});

describe('applyDamagePoolRebalance', () => {
  it('scales only physicalDamage/magicDamage/healing down by ONE_TIME_DAMAGE_POOL_REBALANCE_PCT on a pre-rebalance character', () => {
    const character = { ...createCharacter(createRng(1)), damagePoolRebalanceApplied: undefined };
    const factor = 1 - TUNING.ONE_TIME_DAMAGE_POOL_REBALANCE_PCT / 100;

    const rebalanced = applyDamagePoolRebalance(character);

    expect(rebalanced.starterStats.physicalDamage).toBeCloseTo(character.starterStats.physicalDamage * factor, 10);
    expect(rebalanced.starterStats.magicDamage).toBeCloseTo(character.starterStats.magicDamage * factor, 10);
    expect(rebalanced.starterStats.healing).toBeCloseTo(character.starterStats.healing * factor, 10);
    // health/trueDamage are deliberately exempt.
    expect(rebalanced.starterStats.health).toBe(character.starterStats.health);
    expect(rebalanced.starterStats.trueDamage).toBe(character.starterStats.trueDamage);
    expect(rebalanced.damagePoolRebalanceApplied).toBe(true);
  });

  it('is a no-op once damagePoolRebalanceApplied is already true (never double-applies on reload)', () => {
    const character = createCharacter(createRng(2)); // already flagged true by createCharacter
    const rebalanced = applyDamagePoolRebalance(character);
    expect(rebalanced).toEqual(character);
  });

  it('is idempotent when called twice in a row', () => {
    const character = { ...createCharacter(createRng(3)), damagePoolRebalanceApplied: undefined };
    const once = applyDamagePoolRebalance(character);
    const twice = applyDamagePoolRebalance(once);
    expect(twice).toEqual(once);
  });
});

describe('randomizeStat', () => {
  it('stays within base * [1 - pct, 1 + pct] for a deterministic rng sweep', () => {
    // Sweep rng() across [0, 1) via a fake sequence to hit both jitter extremes.
    const samples = [0, 0.25, 0.5, 0.75, 0.999999];
    for (const sample of samples) {
      const rng = () => sample;
      const result = randomizeStat(100, rng);
      expect(result).toBeGreaterThanOrEqual(100 * (1 - TUNING.STAT_RANDOMIZATION_PCT));
      expect(result).toBeLessThanOrEqual(100 * (1 + TUNING.STAT_RANDOMIZATION_PCT));
    }
  });
});

describe('discardUnequippedItems', () => {
  it('drops owned items that are not equipped', () => {
    const character = { ...createCharacter(createRng(1)), ownedItemIds: ['a', 'b', 'c'], equippedItemIds: ['b'] };
    expect(discardUnequippedItems(character).ownedItemIds).toEqual(['b']);
  });

  it('returns the same object when everything owned is equipped', () => {
    const character = { ...createCharacter(createRng(1)), ownedItemIds: ['a'], equippedItemIds: ['a'] };
    expect(discardUnequippedItems(character)).toBe(character);
  });
});
