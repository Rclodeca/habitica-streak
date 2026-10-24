import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TUNING } from './constants/tuning';
import {
  assignNewItemUnlockTiers,
  availableRelics,
  backfillUnlockTiers,
  bodySpriteFor,
  describeItemBonus,
  describeItemBonusParts,
  ITEM_CATALOG,
  itemBonusPercent,
  itemFlatBonus,
  MAX_EQUIP_SLOTS,
  maxEquipSlots,
  recordRelicEarned,
  rollItemDrops,
  unownedDroppableItems,
} from './items';
import type { BoostableStat, ItemDef } from './items';
import { createRng } from './rng';
import { createQuest } from './quests';
import type { Character } from './types';

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
    newItemUnlockTiers: {},
    ...overrides,
  };
}

function itemById(id: string): ItemDef {
  const item = ITEM_CATALOG.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`no catalog item named ${id}`);
  return item;
}

const SCALING_STATS: BoostableStat[] = ['physicalDamage', 'magicDamage', 'trueDamage', 'healing', 'health', 'allDamage'];
const SURVIVAL_STATS: BoostableStat[] = ['health', 'lifesteal', 'armor', 'magicResist'];

function hasPositive(item: ItemDef, stat: BoostableStat): boolean {
  return item.bonuses.some((b) => b.stat === stat && ((b.percent ?? 0) > 0 || (b.flat ?? 0) > 0));
}

describe('ITEM_CATALOG', () => {
  it('has 83 items with unique ids: 35 always-drop, 28 random-gated, 5 at L30, 15 relics', () => {
    expect(ITEM_CATALOG).toHaveLength(83);
    expect(new Set(ITEM_CATALOG.map((i) => i.id)).size).toBe(83);
    expect(ITEM_CATALOG.filter((i) => i.rarity === 'relic')).toHaveLength(15);
    expect(ITEM_CATALOG.filter((i) => i.levelGated)).toHaveLength(28);
    expect(ITEM_CATALOG.filter((i) => i.rarity !== 'relic' && i.unlockLevel === 30)).toHaveLength(5);
    expect(ITEM_CATALOG.filter((i) => i.rarity !== 'relic' && !i.levelGated && !i.unlockLevel)).toHaveLength(35);
  });

  it('never puts a flat bonus on a scaling stat', () => {
    for (const item of ITEM_CATALOG) {
      for (const bonus of item.bonuses) {
        if (SCALING_STATS.includes(bonus.stat)) expect(bonus.flat, `${item.id} ${bonus.stat}`).toBeUndefined();
      }
    }
  });

  it('has at most 3 physical+magic hybrids and at most 2 armor+magicResist items', () => {
    const hybrids = ITEM_CATALOG.filter((i) => hasPositive(i, 'physicalDamage') && hasPositive(i, 'magicDamage'));
    const dualResist = ITEM_CATALOG.filter((i) => hasPositive(i, 'armor') && hasPositive(i, 'magicResist'));
    expect(hybrids.length).toBeGreaterThan(0);
    expect(hybrids.length).toBeLessThanOrEqual(3);
    expect(dualResist.length).toBeGreaterThan(0);
    expect(dualResist.length).toBeLessThanOrEqual(2);
  });

  it("gives every physical-themed item, uncommon and up, a survivability bonus — except Berserker's Fury", () => {
    const damageStats: BoostableStat[] = ['physicalDamage', 'magicDamage', 'trueDamage'];
    const physicalThemed = ITEM_CATALOG.filter((item) => {
      if (item.rarity === 'common' || item.rarity === 'relic') return false;
      const damage = item.bonuses.filter((b) => damageStats.includes(b.stat) && (b.percent ?? 0) > 0);
      if (damage.length === 0) return false;
      const biggest = damage.reduce((a, b) => ((b.percent ?? 0) > (a.percent ?? 0) ? b : a));
      // A bigger health/armor/healing bonus means the item's main theme isn't damage.
      const otherBiggest = Math.max(0, ...item.bonuses.filter((b) => !damageStats.includes(b.stat)).map((b) => b.percent ?? 0));
      return biggest.stat === 'physicalDamage' && (biggest.percent ?? 0) >= otherBiggest && !hasPositive(item, 'magicDamage');
    });
    expect(physicalThemed.length).toBeGreaterThan(5);
    for (const item of physicalThemed) {
      if (item.id === 'berserkers-fury') continue;
      expect(SURVIVAL_STATS.some((stat) => hasPositive(item, stat)), item.id).toBe(true);
    }
  });

  it('gives every epic an effect and effectText', () => {
    const epics = ITEM_CATALOG.filter((i) => i.rarity === 'epic');
    expect(epics.length).toBeGreaterThan(0);
    for (const item of epics) {
      expect(item.effect, item.id).toBeDefined();
      expect(item.effectText, item.id).toBeTruthy();
    }
  });

  it('gives every relic an unlockLevel of 1, 15 or 30, and no relic is level-gated', () => {
    for (const item of ITEM_CATALOG.filter((i) => i.rarity === 'relic')) {
      expect([1, 15, 30], item.id).toContain(item.unlockLevel);
      expect(item.levelGated).toBeUndefined();
    }
  });

  it('has exactly one consumable item: the Phoenix Feather', () => {
    const consumables = ITEM_CATALOG.filter((item) => item.type === 'consumable');
    expect(consumables).toHaveLength(1);
    expect(consumables[0].id).toBe('phoenix-feather');
  });

  it('has more common items than rare items among the always-drop items', () => {
    const alwaysDrop = ITEM_CATALOG.filter((i) => i.rarity !== 'relic' && !i.levelGated && !i.unlockLevel);
    expect(alwaysDrop.filter((i) => i.rarity === 'common').length).toBeGreaterThan(alwaysDrop.filter((i) => i.rarity === 'rare').length);
  });

  it('has an icon file for every catalog item', () => {
    const missing = ITEM_CATALOG.filter((item) => !existsSync(fileURLToPath(new URL(`../../public/sprites/${item.icon}.png`, import.meta.url))));
    expect(missing.map((item) => item.id)).toEqual([]);
  });

  it('has true-damage items', () => {
    expect(ITEM_CATALOG.filter((i) => hasPositive(i, 'trueDamage')).length).toBeGreaterThanOrEqual(3);
  });
});

describe('itemBonusPercent — drawbacks and enchanting', () => {
  it('sums a negative percent as a drawback', () => {
    const character = makeCharacter({ equippedItemIds: ['void-crystal'] });
    expect(itemBonusPercent(character, 'magicDamage')).toBe(38);
    expect(itemBonusPercent(character, 'health')).toBe(-10);
  });

  it('doubles only positive bonuses on an enchanted item', () => {
    const character = makeCharacter({ equippedItemIds: ['void-crystal'], doubledItemId: 'void-crystal' });
    expect(itemBonusPercent(character, 'magicDamage')).toBe(76);
    expect(itemBonusPercent(character, 'health')).toBe(-10);
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

  it('splits 28 items into groups of 10/10/8 across tiers 10/15/20', () => {
    const tiers = assignNewItemUnlockTiers(createRng(1));
    const counts = { 10: 0, 15: 0, 20: 0 };
    for (const tier of Object.values(tiers)) counts[tier] += 1;
    expect(counts[10]).toBe(10);
    expect(counts[15]).toBe(10);
    expect(counts[20]).toBe(8);
  });

  it('produces a different assignment for a different seed', () => {
    const tiersA = assignNewItemUnlockTiers(createRng(1));
    const tiersB = assignNewItemUnlockTiers(createRng(2));
    expect(tiersA).not.toEqual(tiersB);
  });
});

describe('backfillUnlockTiers', () => {
  it('keeps existing assignments and assigns every missing gated id to 10/15/20', () => {
    const tiers = backfillUnlockTiers({ 'chaos-conduit': 15 }, createRng(1));
    expect(tiers['chaos-conduit']).toBe(15);
    const gatedIds = ITEM_CATALOG.filter((item) => item.levelGated).map((item) => item.id);
    expect(Object.keys(tiers).sort()).toEqual(gatedIds.sort());
    for (const id of gatedIds) expect([10, 15, 20]).toContain(tiers[id]);
  });
});

describe('itemBonusPercent', () => {
  it('returns 0 when nothing is equipped', () => {
    expect(itemBonusPercent(makeCharacter(), 'physicalDamage')).toBe(0);
  });

  it('sums bonusPercent across multiple equipped items matching the stat', () => {
    const character = makeCharacter({ equippedItemIds: ['rusty-blade', 'steel-sword'] });
    expect(itemBonusPercent(character, 'physicalDamage')).toBe(3 + 5);
  });

  it('ignores equipped items that do not match the requested stat', () => {
    const character = makeCharacter({ equippedItemIds: ['rusty-blade', 'apprentice-wand'] });
    expect(itemBonusPercent(character, 'physicalDamage')).toBe(3);
    expect(itemBonusPercent(character, 'magicDamage')).toBe(4);
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

  it('returns 0 when equipped items have no flat bonus for that stat', () => {
    const character = makeCharacter({ equippedItemIds: ['rusty-blade', 'battlemage-gauntlets'] });
    expect(itemFlatBonus(character, 'physicalDamage')).toBe(0);
  });
});

describe('describeItemBonus', () => {
  const itemNamed = itemById;

  it('describes a single-stat item', () => {
    expect(describeItemBonus(itemNamed('rusty-blade'))).toBe('Physical +3%');
  });

  it('describes a hybrid item with both its primary and secondary stat', () => {
    expect(describeItemBonus(itemNamed('battlemage-gauntlets'))).toBe('Physical +4%, Magic +4%');
  });

  it('describes flat bonuses without a percent sign, and drawbacks with a minus sign', () => {
    expect(describeItemBonus(itemNamed('juggernaut-carapace'))).toBe('Armor +450, Health +15%, Physical \u221210%');
  });

  it("appends an epic's effect text", () => {
    expect(describeItemBonus(itemNamed('godslayer-greatblade'))).toBe('Physical +42%, Health +10%, Lifesteal +3% \u00b7 +30% damage to bosses above 75% HP.');
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
    const original = ITEM_CATALOG.filter((item) => !item.levelGated && !item.unlockLevel && item.rarity !== 'relic');
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

  it('never drops a relic, at any level', () => {
    const character = makeCharacter({ level: 40, newItemUnlockTiers: assignNewItemUnlockTiers(createRng(1)) });
    for (let seed = 0; seed < 200; seed++) {
      expect(rollItemDrops(character, 50, createRng(seed)).some((item) => item.rarity === 'relic')).toBe(false);
    }
  });

  it('drops an L30-wave item only from level 30', () => {
    const l30Ids = ITEM_CATALOG.filter((i) => i.rarity !== 'relic' && i.unlockLevel === 30).map((i) => i.id);
    const others = ITEM_CATALOG.filter((i) => !l30Ids.includes(i.id)).map((i) => i.id);
    expect(rollItemDrops(makeCharacter({ level: 29, ownedItemIds: others }), 50, createRng(1))).toEqual([]);
    expect(rollItemDrops(makeCharacter({ level: 30, ownedItemIds: others }), 50, createRng(1)).length).toBeGreaterThan(0);
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
  const itemNamed = itemById;

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

  it('maps the first positive body-relevant percent bonus, skipping drawbacks', () => {
    expect(bodySpriteFor(itemNamed('void-crystal'))).toBe('player/weapon-magic-3'); // +38% magic, -10% health
    expect(bodySpriteFor(itemNamed('glass-crown'))).toBeNull(); // allDamage has no body slot; the health bonus is a drawback
    expect(bodySpriteFor(itemNamed('titans-lifeblood'))).toBe('player/shield-3'); // +30% healing first
  });
});

describe('maxEquipSlots', () => {
  it('is 4 until the item-slots event is taken', () => {
    expect(maxEquipSlots({})).toBe(4);
    expect(maxEquipSlots({ takenEventIds: ['special'] })).toBe(4);
  });

  it('is 6 once the item-slots event is taken', () => {
    expect(maxEquipSlots({ takenEventIds: ['item-slots'] })).toBe(6);
  });

  it('is 8 (MAX_EQUIP_SLOTS) once the second item-slots event is taken too', () => {
    expect(maxEquipSlots({ takenEventIds: ['item-slots', 'item-slots-2'] })).toBe(8);
    expect(MAX_EQUIP_SLOTS).toBe(8);
  });
});

describe('describeItemBonusParts', () => {
  it('pairs each bonus with its stat and a plain-English label', () => {
    const item = ITEM_CATALOG.find((i) => i.id === 'battlemage-gauntlets');
    if (!item) throw new Error('missing fixture item');
    const parts = describeItemBonusParts(item);
    expect(parts).toEqual([
      { stat: 'physicalDamage', text: '+4%', label: 'Physical damage' },
      { stat: 'magicDamage', text: '+4%', label: 'Magic damage' },
    ]);
  });

  it('renders a drawback with a minus sign', () => {
    expect(describeItemBonusParts(itemById('void-crystal'))).toContainEqual({ stat: 'health', text: '\u221210%', label: 'Max health' });
  });

  it('has no parts for a consumable', () => {
    const feather = ITEM_CATALOG.find((i) => i.type === 'consumable');
    if (!feather) throw new Error('missing fixture item');
    expect(describeItemBonusParts(feather)).toEqual([]);
  });
});

describe('relics', () => {
  it('Magpie Charm rolls drop rarity as if from a boss 10 indexes later', () => {
    const epicShare = (equipped: string[]) => {
      let epics = 0;
      for (let seed = 0; seed < 3000; seed++) {
        const [item] = rollItemDrops(makeCharacter({ equippedItemIds: equipped, ownedItemIds: equipped }), 1, createRng(seed));
        if (item.rarity === 'epic' || item.rarity === 'rare') epics += 1;
      }
      return epics;
    };
    expect(epicShare(['magpie-charm'])).toBeGreaterThan(epicShare([]) * 3);
  });

  const relicIdsAt = (level: number) => ITEM_CATALOG.filter((i) => i.rarity === 'relic' && (i.unlockLevel ?? 1) <= level).map((i) => i.id);

  it('availableRelics offers the relics unlocked at the character level', () => {
    expect(availableRelics(makeCharacter({ level: 1 }), [])).toHaveLength(7);
    expect(availableRelics(makeCharacter({ level: 15 }), [])).toHaveLength(12);
    expect(availableRelics(makeCharacter({ level: 30 }), [])).toHaveLength(15);
    expect(availableRelics(makeCharacter({ level: 1 }), []).every((i) => i.rarity === 'relic')).toBe(true);
  });

  it('availableRelics excludes earned, owned, and promised relics', () => {
    const [a, b, c] = relicIdsAt(1);
    const character = makeCharacter({ level: 1, earnedRelicIds: [a], ownedItemIds: [b] });
    const promised = createQuest('q', 'easy', '2099-01-01', 'side', c);
    const ids = availableRelics(character, [promised]).map((i) => i.id);
    expect(ids).not.toContain(a);
    expect(ids).not.toContain(b);
    expect(ids).not.toContain(c);
    expect(ids).toHaveLength(4);
    // Once that quest is gone (missed), its relic is available again.
    expect(availableRelics(character, []).map((i) => i.id)).toContain(c);
  });

  it('recordRelicEarned records a relic once and ignores other items', () => {
    const character = makeCharacter();
    const earned = recordRelicEarned(character, 'ember-heart');
    expect(earned.earnedRelicIds).toEqual(['ember-heart']);
    expect(recordRelicEarned(earned, 'ember-heart')).toBe(earned);
    expect(recordRelicEarned(character, 'rusty-blade')).toBe(character);
  });

  it('never lets a relic drop from a boss or the item-drop pool', () => {
    expect(unownedDroppableItems(makeCharacter({ level: 40 })).some((i) => i.rarity === 'relic')).toBe(false);
  });
});
