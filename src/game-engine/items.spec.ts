import { describe, expect, it } from 'vitest';
import { TUNING } from './constants/tuning';
import { bodySpriteFor, describeItemBonus, ITEM_CATALOG, itemBonusPercent, rollItemDrops } from './items';
import type { ItemDef } from './items';
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
    critChance: 0.01,
    ...overrides,
  };
}

describe('ITEM_CATALOG', () => {
  it('has exactly 30 items with unique ids', () => {
    expect(ITEM_CATALOG).toHaveLength(30);
    expect(new Set(ITEM_CATALOG.map((item) => item.id)).size).toBe(30);
  });

  it('has at least one item granting lifesteal', () => {
    const lifestealItems = ITEM_CATALOG.filter((item) => item.stat === 'lifesteal' || item.extraStat === 'lifesteal');
    expect(lifestealItems.length).toBeGreaterThan(0);
  });

  it('has exactly one consumable item: the Phoenix Feather', () => {
    const consumables = ITEM_CATALOG.filter((item) => item.type === 'consumable');
    expect(consumables).toHaveLength(1);
    expect(consumables[0].id).toBe('phoenix-feather');
  });

  it('has more common items than rare items', () => {
    const common = ITEM_CATALOG.filter((item) => item.rarity === 'common');
    const rare = ITEM_CATALOG.filter((item) => item.rarity === 'rare');
    expect(common.length).toBeGreaterThan(rare.length);
  });

  it('has at least one item granting critChance', () => {
    const critItems = ITEM_CATALOG.filter((item) => item.stat === 'critChance' || item.extraStat === 'critChance');
    expect(critItems.length).toBeGreaterThan(0);
  });

  it('has at least one hybrid item granting both physicalDamage and magicDamage', () => {
    const hybrid = ITEM_CATALOG.filter(
      (item) =>
        (item.stat === 'physicalDamage' && item.extraStat === 'magicDamage') ||
        (item.stat === 'magicDamage' && item.extraStat === 'physicalDamage'),
    );
    expect(hybrid.length).toBeGreaterThan(0);
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

  it('sums extraBonusPercent from a hybrid item into its secondary stat', () => {
    const character = makeCharacter({ equippedItemIds: ['battlemage-gauntlets'] });
    expect(itemBonusPercent(character, 'physicalDamage')).toBe(4);
    expect(itemBonusPercent(character, 'magicDamage')).toBe(4);
  });

  it('sums a primary bonus from one item and a secondary bonus from another for the same stat', () => {
    const character = makeCharacter({ equippedItemIds: ['rusty-blade', 'battlemage-gauntlets'] });
    expect(itemBonusPercent(character, 'physicalDamage')).toBe(3 + 4);
  });

  it('returns 0 for every stat when only the consumable is equipped', () => {
    const character = makeCharacter({ equippedItemIds: ['phoenix-feather'] });
    expect(itemBonusPercent(character, 'critChance')).toBe(0);
    expect(itemBonusPercent(character, 'physicalDamage')).toBe(0);
  });
});

describe('describeItemBonus', () => {
  function itemNamed(id: string): ItemDef {
    const item = ITEM_CATALOG.find((candidate) => candidate.id === id);
    if (!item) throw new Error(`no catalog item named ${id}`);
    return item;
  }

  it('describes a single-stat item', () => {
    expect(describeItemBonus(itemNamed('rusty-blade'))).toBe('+3% physicalDamage');
  });

  it('describes a hybrid item with both its primary and secondary stat', () => {
    expect(describeItemBonus(itemNamed('battlemage-gauntlets'))).toBe('+4% physicalDamage, +4% magicDamage');
  });

  it('describes the consumable distinctly, with no stat percentages', () => {
    expect(describeItemBonus(itemNamed('phoenix-feather'))).toContain('revive');
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
    const owned = ITEM_CATALOG.slice(0, ITEM_CATALOG.length - 2).map((item) => item.id); // 2 remain unowned
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

  it('drops far more common items than rare items across many rolls', () => {
    let commonCount = 0;
    let rareCount = 0;
    for (let seed = 0; seed < 300; seed++) {
      const [item] = rollItemDrops(makeCharacter(), 1, createRng(seed));
      if (item.rarity === 'common') commonCount += 1;
      else rareCount += 1;
    }
    expect(commonCount).toBeGreaterThan(rareCount * 2);
  });

  it('drops the +50%-damage epic tier far less often than any other rarity, across many rolls', () => {
    let epicCount = 0;
    let otherCount = 0;
    for (let seed = 0; seed < 2000; seed++) {
      const [item] = rollItemDrops(makeCharacter(), 1, createRng(seed));
      if (item.rarity === 'epic') epicCount += 1;
      else otherCount += 1;
    }
    expect(otherCount).toBeGreaterThan(epicCount * 50);
  });
});

describe('bodySpriteFor', () => {
  function itemNamed(id: string): ItemDef {
    const item = ITEM_CATALOG.find((candidate) => candidate.id === id);
    if (!item) throw new Error(`no catalog item named ${id}`);
    return item;
  }

  it('returns null for no item', () => {
    expect(bodySpriteFor(null)).toBeNull();
  });

  it('returns null for an expGain item (no body slot)', () => {
    expect(bodySpriteFor(itemNamed('lucky-coin'))).toBeNull();
  });

  it('returns null for a critChance item (no body slot)', () => {
    expect(bodySpriteFor(itemNamed('lucky-dagger'))).toBeNull();
  });

  it('returns null for the consumable Phoenix Feather (no stat, no body slot)', () => {
    expect(bodySpriteFor(itemNamed('phoenix-feather'))).toBeNull();
  });

  it.each([
    ['rusty-blade', 'player/weapon-physical-1'],
    ['steel-sword', 'player/weapon-physical-2'],
    ['warlords-greatsword', 'player/weapon-physical-3'],
    ['apprentice-wand', 'player/weapon-magic-1'],
    ['arcane-staff', 'player/weapon-magic-2'],
    ['archmages-rod', 'player/weapon-magic-3'],
    ['padded-vest', 'player/armor-1'],
    ['chainmail-hauberk', 'player/armor-2'],
    ['plate-armor', 'player/armor-3'],
    ['novices-charm', 'player/shield-1'],
    ['blessed-censer', 'player/shield-2'],
    ['sacred-chalice', 'player/shield-3'],
  ])('maps %s to %s', (id, expected) => {
    expect(bodySpriteFor(itemNamed(id))).toBe(expected);
  });

  it('maps a hybrid item to a tier by threshold, not exact match, using its primary stat', () => {
    expect(bodySpriteFor(itemNamed('battlemage-gauntlets'))).toBe('player/weapon-physical-1'); // bonusPercent 4
    expect(bodySpriteFor(itemNamed('chaos-blade'))).toBe('player/weapon-physical-3'); // bonusPercent 15
  });
});
