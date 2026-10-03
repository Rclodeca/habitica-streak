import { describe, expect, it } from 'vitest';
import { TUNING } from './constants/tuning';
import {
  assignNewItemUnlockTiers,
  bodySpriteFor,
  describeItemBonus,
  ITEM_CATALOG,
  itemBonusPercent,
  itemFlatBonus,
  maxEquipSlots,
  rollItemDrops,
} from './items';
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
    newItemUnlockTiers: {},
    ...overrides,
  };
}

describe('ITEM_CATALOG', () => {
  it('has exactly 30 original (non-level-gated) items with unique ids', () => {
    const original = ITEM_CATALOG.filter((item) => !item.levelGated);
    expect(original).toHaveLength(30);
    expect(new Set(original.map((item) => item.id)).size).toBe(30);
  });

  it('has at least one item granting lifesteal', () => {
    const lifestealItems = ITEM_CATALOG.filter((item) => item.bonuses.some((b) => b.stat === 'lifesteal'));
    expect(lifestealItems.length).toBeGreaterThan(0);
  });

  it('has exactly one consumable item: the Phoenix Feather', () => {
    const consumables = ITEM_CATALOG.filter((item) => item.type === 'consumable');
    expect(consumables).toHaveLength(1);
    expect(consumables[0].id).toBe('phoenix-feather');
  });

  it('has more common items than rare items among the original (non-level-gated) items', () => {
    // The level-gated tier is deliberately skewed uncommon/rare/epic (no
    // common-rarity new items at all), so this invariant is scoped to the
    // original 30 — it was never meant to describe the full 49-item catalog.
    const original = ITEM_CATALOG.filter((item) => !item.levelGated);
    const common = original.filter((item) => item.rarity === 'common');
    const rare = original.filter((item) => item.rarity === 'rare');
    expect(common.length).toBeGreaterThan(rare.length);
  });

  it('has at least one item granting critChance', () => {
    const critItems = ITEM_CATALOG.filter((item) => item.bonuses.some((b) => b.stat === 'critChance'));
    expect(critItems.length).toBeGreaterThan(0);
  });

  it('has at least one hybrid item granting both physicalDamage and magicDamage', () => {
    const hybrid = ITEM_CATALOG.filter(
      (item) =>
        item.bonuses.some((b) => b.stat === 'physicalDamage') && item.bonuses.some((b) => b.stat === 'magicDamage'),
    );
    expect(hybrid.length).toBeGreaterThan(0);
  });
});

describe('ITEM_CATALOG — level-gated items', () => {
  it('has 49 total items: the original 30 plus 19 level-gated ones', () => {
    expect(ITEM_CATALOG).toHaveLength(49);
    expect(new Set(ITEM_CATALOG.map((item) => item.id)).size).toBe(49);
  });

  it('has exactly 19 items marked levelGated', () => {
    expect(ITEM_CATALOG.filter((item) => item.levelGated).length).toBe(19);
  });

  it('includes Bloodthorn Blade with its full 4-bonus theme', () => {
    const item = ITEM_CATALOG.find((candidate) => candidate.id === 'bloodthorn-blade');
    expect(item).toBeDefined();
    expect(item?.levelGated).toBe(true);
    expect(item?.bonuses).toEqual([
      { stat: 'physicalDamage', flat: 100 },
      { stat: 'physicalDamage', percent: 10 },
      { stat: 'lifesteal', percent: 2 },
      { stat: 'armorPen', percent: 10 },
    ]);
  });

  it('includes Titans Lifeblood with a 1000 flat health bonus', () => {
    const item = ITEM_CATALOG.find((candidate) => candidate.id === 'titans-lifeblood');
    expect(item?.bonuses).toEqual([
      { stat: 'health', flat: 1000 },
      { stat: 'healing', percent: 5 },
      { stat: 'lifesteal', percent: 5 },
    ]);
  });
});

describe('itemFlatBonus — with a real flat-bonus item', () => {
  it('sums a flat physicalDamage bonus from an equipped level-gated item', () => {
    const character = makeCharacter({ equippedItemIds: ['berserkers-war-axe'] });
    expect(itemFlatBonus(character, 'physicalDamage')).toBe(200);
  });
});

describe('assignNewItemUnlockTiers', () => {
  it('assigns every level-gated item id to exactly one of 10/15/20', () => {
    const tiers = assignNewItemUnlockTiers(createRng(1));
    const levelGatedIds = ITEM_CATALOG.filter((item) => item.levelGated).map((item) => item.id);
    expect(Object.keys(tiers).sort()).toEqual(levelGatedIds.sort());
    for (const id of levelGatedIds) {
      expect([10, 15, 20]).toContain(tiers[id]);
    }
  });

  it('splits 19 items into groups of 7/7/5 across tiers 10/15/20', () => {
    const tiers = assignNewItemUnlockTiers(createRng(1));
    const counts = { 10: 0, 15: 0, 20: 0 };
    for (const tier of Object.values(tiers)) counts[tier] += 1;
    expect(counts[10]).toBe(7);
    expect(counts[15]).toBe(7);
    expect(counts[20]).toBe(5);
  });

  it('produces a different assignment for a different seed', () => {
    const tiersA = assignNewItemUnlockTiers(createRng(1));
    const tiersB = assignNewItemUnlockTiers(createRng(2));
    expect(tiersA).not.toEqual(tiersB);
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

describe('itemFlatBonus', () => {
  it('returns 0 when nothing is equipped', () => {
    expect(itemFlatBonus(makeCharacter(), 'physicalDamage')).toBe(0);
  });

  it('returns 0 when equipped items have no flat bonus for that stat (none of the original 30 do)', () => {
    const character = makeCharacter({ equippedItemIds: ['rusty-blade', 'battlemage-gauntlets'] });
    expect(itemFlatBonus(character, 'physicalDamage')).toBe(0);
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
    // Scoped to the non-level-gated items: this character's default level 1
    // / empty newItemUnlockTiers already locks every level-gated item out of
    // the droppable pool regardless of ownership (see the level-gating tests
    // below), so slicing against the original (always-droppable) items keeps
    // this test's ownership/depletion intent independent of that mechanic.
    const original = ITEM_CATALOG.filter((item) => !item.levelGated);
    const owned = original.slice(0, original.length - 2).map((item) => item.id); // 2 remain unowned
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

  it('never drops a level-gated item before the character reaches its assigned unlock level', () => {
    const tiers = assignNewItemUnlockTiers(createRng(1));
    const lockedId = Object.keys(tiers).find((id) => tiers[id] > 1); // true for every id, since tiers are 10/15/20
    const character = makeCharacter({ level: 1, newItemUnlockTiers: tiers });
    for (let seed = 0; seed < 100; seed++) {
      const result = rollItemDrops(character, 50, createRng(seed)); // boss 50: max drop-count curve
      expect(result.map((item) => item.id)).not.toContain(lockedId);
    }
  });

  it('drops a level-gated item once the character reaches its assigned unlock level', () => {
    const tiers = assignNewItemUnlockTiers(createRng(1));
    const unlockedId = Object.keys(tiers)[0];
    const unlockLevel = tiers[unlockedId];
    const character = makeCharacter({ level: unlockLevel, newItemUnlockTiers: tiers, ownedItemIds: ITEM_CATALOG.filter((i) => i.id !== unlockedId).map((i) => i.id) });
    const result = rollItemDrops(character, 50, createRng(1));
    expect(result.map((item) => item.id)).toEqual([unlockedId]);
  });

  it('treats every level-gated item as locked when newItemUnlockTiers is undefined (old-save compatibility)', () => {
    const character = makeCharacter({ level: 20, newItemUnlockTiers: undefined });
    for (let seed = 0; seed < 50; seed++) {
      const result = rollItemDrops(character, 50, createRng(seed));
      expect(result.every((item) => !item.levelGated)).toBe(true);
    }
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

describe('maxEquipSlots', () => {
  it('is 4 below level 10', () => {
    expect(maxEquipSlots(1)).toBe(4);
    expect(maxEquipSlots(9)).toBe(4);
  });

  it('is 6 at level 10 and above', () => {
    expect(maxEquipSlots(10)).toBe(6);
    expect(maxEquipSlots(20)).toBe(6);
  });
});
