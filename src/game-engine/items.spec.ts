import { describe, expect, it } from 'vitest';
import { TUNING } from './constants/tuning';
import { ITEM_CATALOG, itemBonusPercent, rollItemDrops } from './items';
import { createRng } from './rng';
import type { Character } from './types';

function makeCharacter(overrides: Partial<Character> = {}): Character {
  const starterStats = { physicalDamage: 10, magicDamage: 10, healing: 6, health: 50 };
  return {
    level: 1,
    exp: 0,
    starterStats,
    currentHealth: starterStats.health,
    ownedItemIds: [],
    equippedItemIds: [],
    ...overrides,
  };
}

describe('ITEM_CATALOG', () => {
  it('has exactly 15 items, 3 per stat category, with unique ids', () => {
    expect(ITEM_CATALOG).toHaveLength(15);
    expect(new Set(ITEM_CATALOG.map((item) => item.id)).size).toBe(15);

    const byStat: Record<string, number> = {};
    for (const item of ITEM_CATALOG) {
      byStat[item.stat] = (byStat[item.stat] ?? 0) + 1;
    }
    expect(byStat).toEqual({ physicalDamage: 3, magicDamage: 3, healing: 3, health: 3, expGain: 3 });
  });
});

describe('itemBonusPercent', () => {
  it('returns 0 when nothing is equipped', () => {
    expect(itemBonusPercent(makeCharacter(), 'physicalDamage')).toBe(0);
  });

  it('sums bonusPercent across multiple equipped items matching the stat', () => {
    const character = makeCharacter({ equippedItemIds: ['rusty-blade', 'steel-sword'] });
    expect(itemBonusPercent(character, 'physicalDamage')).toBe(3 + 6);
  });

  it('ignores equipped items that do not match the requested stat', () => {
    const character = makeCharacter({ equippedItemIds: ['rusty-blade', 'apprentice-wand'] });
    expect(itemBonusPercent(character, 'physicalDamage')).toBe(3);
    expect(itemBonusPercent(character, 'magicDamage')).toBe(3);
    expect(itemBonusPercent(character, 'healing')).toBe(0);
  });
});

describe('rollItemDrops', () => {
  it('drops exactly 1 item for boss index 1 when the pool is full', () => {
    expect(rollItemDrops(makeCharacter(), 1, createRng(1))).toHaveLength(1);
  });

  it('drops more items for later boss indices, following the step curve', () => {
    const character = makeCharacter();
    expect(rollItemDrops(character, 1, createRng(1))).toHaveLength(1);
    expect(rollItemDrops(character, TUNING.ITEM_DROP_EVERY_N_BOSSES + 1, createRng(1))).toHaveLength(2);
    expect(rollItemDrops(character, TUNING.ITEM_DROP_EVERY_N_BOSSES * 2 + 1, createRng(1))).toHaveLength(3);
  });

  it('caps drop count at ITEM_DROP_MAX_COUNT even for very high boss indices', () => {
    const result = rollItemDrops(makeCharacter(), 1000, createRng(1));
    expect(result.length).toBeLessThanOrEqual(TUNING.ITEM_DROP_MAX_COUNT);
  });

  it('never drops an already-owned item, and shrinks the count as the pool depletes', () => {
    const owned = ITEM_CATALOG.slice(0, 13).map((item) => item.id); // 2 remain unowned
    const character = makeCharacter({ ownedItemIds: owned });
    const result = rollItemDrops(character, 50, createRng(1)); // curve wants 3, only 2 remain
    expect(result).toHaveLength(2);
    for (const item of result) {
      expect(owned).not.toContain(item.id);
    }
  });

  it('returns [] once every catalog item is owned', () => {
    const character = makeCharacter({ ownedItemIds: ITEM_CATALOG.map((item) => item.id) });
    expect(rollItemDrops(character, 50, createRng(1))).toEqual([]);
  });

  it('never returns duplicate items within a single roll', () => {
    const result = rollItemDrops(makeCharacter(), 50, createRng(7));
    const ids = result.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
