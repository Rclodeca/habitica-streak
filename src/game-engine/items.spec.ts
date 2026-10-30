import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TUNING } from './constants/tuning';
import {
  availableRelics,
  describeItemBonus,
  describeItemBonusParts,
  dropRarityShares,
  ITEM_CATALOG,
  itemBonusPercent,
  itemDoubleFactor,
  itemFlatBonus,
  MAX_EQUIP_SLOTS,
  maxEquipSlots,
  recordRelicEarned,
  rollItemDrops,
  unownedDroppableItems,
} from './items';
import type { BoostableStat, DropRarity, ItemDef } from './items';
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
  it('has 91 items with unique ids: 16 common, 17 uncommon, 28 rare, 15 epic, 15 relics', () => {
    expect(ITEM_CATALOG).toHaveLength(91);
    expect(new Set(ITEM_CATALOG.map((i) => i.id)).size).toBe(91);
    const count = (rarity: string) => ITEM_CATALOG.filter((i) => i.rarity === rarity).length;
    expect(['common', 'uncommon', 'rare', 'epic', 'relic'].map(count)).toEqual([16, 17, 28, 15, 15]);
  });

  it('has no level gates left on any item', () => {
    for (const item of ITEM_CATALOG) {
      expect('levelGated' in item, item.id).toBe(false);
      expect('unlockLevel' in item, item.id).toBe(false);
    }
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

  it('gives most physical-themed items, uncommon and up, a survivability bonus', () => {
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
    // Physical tends to sustain; a few pure-damage pieces (Molten Fury, Berserker's War Axe) are fine.
    const sustained = physicalThemed.filter((item) => SURVIVAL_STATS.some((stat) => hasPositive(item, stat)));
    expect(sustained.length / physicalThemed.length).toBeGreaterThan(0.5);
  });

  it('gives every epic an effect and effectText, except the four stat-only epics', () => {
    const epics = ITEM_CATALOG.filter((i) => i.rarity === 'epic');
    expect(epics.filter((i) => !i.effect).map((i) => i.id).sort()).toEqual(['archons-halo', 'colossus-plate', 'sunpiercer-bow', 'worldbreaker-maul']);
    for (const item of epics.filter((i) => i.effect)) {
      expect(item.effectText, item.id).toBeTruthy();
    }
  });

  it('has exactly one consumable item: the Phoenix Feather', () => {
    const consumables = ITEM_CATALOG.filter((item) => item.type === 'consumable');
    expect(consumables).toHaveLength(1);
    expect(consumables[0].id).toBe('phoenix-feather');
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
    expect(itemBonusPercent(character, 'magicDamage')).toBe(42);
    expect(itemBonusPercent(character, 'health')).toBe(-10);
  });

  it('doubles only positive bonuses on an enchanted item', () => {
    const character = makeCharacter({ equippedItemIds: ['void-crystal'], doubledItemIds: ['void-crystal'] });
    expect(itemBonusPercent(character, 'magicDamage')).toBe(84);
    expect(itemBonusPercent(character, 'health')).toBe(-10);
  });

  it('doubles each item on the doubled list and no other', () => {
    const character = makeCharacter({ equippedItemIds: ['rusty-blade', 'steel-sword', 'plate-armor'], doubledItemIds: ['rusty-blade', 'steel-sword'] });
    expect(itemDoubleFactor(character, 'rusty-blade')).toBe(TUNING.DOUBLED_ITEM_MULTIPLIER);
    expect(itemDoubleFactor(character, 'steel-sword')).toBe(TUNING.DOUBLED_ITEM_MULTIPLIER);
    expect(itemDoubleFactor(character, 'plate-armor')).toBe(1);
  });
});

const SHARE_ORDER: DropRarity[] = ['common', 'uncommon', 'rare', 'epic'];

function expectShares(shares: Record<DropRarity, number>, percents: number[]) {
  SHARE_ORDER.forEach((rarity, i) => expect(shares[rarity] * 100, rarity).toBeCloseTo(percents[i], 6));
}

describe('dropRarityShares', () => {
  it('matches the table at each row', () => {
    expectShares(dropRarityShares(1), [75, 22, 3, 0]);
    expectShares(dropRarityShares(5), [55, 33, 11, 1]);
    expectShares(dropRarityShares(10), [30, 40, 25, 5]);
    expectShares(dropRarityShares(20), [10, 40, 38, 12]);
    expectShares(dropRarityShares(30), [0, 35, 48, 17]);
  });

  it('blends linearly between rows', () => {
    expectShares(dropRarityShares(15), [20, 40, 31.5, 8.5]);
    expectShares(dropRarityShares(25), [5, 37.5, 43, 14.5]);
  });

  it('uses the level-30 row for every level past it', () => {
    expect(dropRarityShares(45)).toEqual(dropRarityShares(30));
  });

  it('always sums to 1', () => {
    for (let level = 1; level <= 60; level++) {
      for (const magpie of [false, true]) {
        const shares = dropRarityShares(level, magpie);
        expect(SHARE_ORDER.reduce((sum, rarity) => sum + shares[rarity], 0), `L${level}`).toBeCloseTo(1, 9);
      }
    }
  });

  it("doubles the rare and epic shares for Magpie's Diamond, then scales back to 100%", () => {
    expectShares(dropRarityShares(1, true), [7500 / 103, 2200 / 103, 600 / 103, 0]);
    expectShares(dropRarityShares(10, true), [3000 / 130, 4000 / 130, 5000 / 130, 1000 / 130]);
    expectShares(dropRarityShares(30, true), [0, 3500 / 165, 9600 / 165, 3400 / 165]);
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
    expect(describeItemBonus(itemNamed('godslayer-greatblade'))).toBe('Physical +42%, Health +20% \u00b7 +30% damage to bosses above 75% HP.');
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
    const droppable = ITEM_CATALOG.filter((item) => item.rarity !== 'relic');
    const owned = droppable.slice(0, droppable.length - 2).map((item) => item.id); // 2 remain unowned
    const character = makeCharacter({ level: 10, ownedItemIds: owned });
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

  it('drops far more common items than rare items across many rolls at level 1', () => {
    let commonCount = 0;
    let rareCount = 0;
    for (let seed = 0; seed < 300; seed++) {
      const [item] = rollItemDrops(makeCharacter(), 1, createRng(seed));
      if (item.rarity === 'common') commonCount += 1;
      else rareCount += 1;
    }
    expect(commonCount).toBeGreaterThan(rareCount * 2);
  });

  it("drops each rarity at about its level's share, however many items the rarity has", () => {
    const counts: Record<string, number> = { common: 0, uncommon: 0, rare: 0, epic: 0 };
    const rolls = 4000;
    for (let seed = 0; seed < rolls; seed++) {
      const [item] = rollItemDrops(makeCharacter({ level: 10 }), 1, createRng(seed));
      counts[item.rarity] += 1;
    }
    const shares = dropRarityShares(10);
    for (const rarity of SHARE_ORDER) expect(Math.abs(counts[rarity] / rolls - shares[rarity]), rarity).toBeLessThan(0.03);
  });

  it('never drops an epic at level 1, or a common from level 30', () => {
    for (let seed = 0; seed < 300; seed++) {
      expect(rollItemDrops(makeCharacter({ level: 1 }), 50, createRng(seed)).some((item) => item.rarity === 'epic')).toBe(false);
      expect(rollItemDrops(makeCharacter({ level: 30 }), 50, createRng(seed)).some((item) => item.rarity === 'common')).toBe(false);
    }
  });

  it('has no level gates: a former gated or level-30 item can drop at level 5', () => {
    for (const id of ['chaos-conduit', 'starfall-staff', 'colossus-plate']) {
      const character = makeCharacter({ level: 5, ownedItemIds: ITEM_CATALOG.filter((i) => i.id !== id).map((i) => i.id) });
      expect(rollItemDrops(character, 50, createRng(1)).map((item) => item.id), id).toEqual([id]);
    }
  });

  it('gives a fully owned rarity\'s share to the others', () => {
    const owned = ITEM_CATALOG.filter((i) => i.rarity === 'common' || i.rarity === 'uncommon').map((i) => i.id);
    for (let seed = 0; seed < 50; seed++) {
      const result = rollItemDrops(makeCharacter({ level: 10, ownedItemIds: owned }), 50, createRng(seed));
      expect(result).toHaveLength(TUNING.ITEM_DROP_MAX_COUNT);
      expect(result.every((item) => item.rarity === 'rare' || item.rarity === 'epic')).toBe(true);
    }
  });

  it('drops nothing, and offers nothing, when only 0% rarities are left', () => {
    const allBut = (rarity: string) => ITEM_CATALOG.filter((i) => i.rarity !== rarity).map((i) => i.id);
    const onlyCommons = makeCharacter({ level: 30, ownedItemIds: allBut('common') });
    const onlyEpics = makeCharacter({ level: 1, ownedItemIds: allBut('epic') });
    for (const character of [onlyCommons, onlyEpics]) {
      expect(rollItemDrops(character, 50, createRng(1))).toEqual([]);
      expect(unownedDroppableItems(character)).toEqual([]);
    }
  });

  it('never drops a relic, at any level', () => {
    const character = makeCharacter({ level: 40 });
    for (let seed = 0; seed < 200; seed++) {
      expect(rollItemDrops(character, 50, createRng(seed)).some((item) => item.rarity === 'relic')).toBe(false);
    }
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
  it("Magpie's Diamond drops rare and epic items at its doubled share", () => {
    const rareOrEpicShare = (equipped: string[]) => {
      let hits = 0;
      for (let seed = 0; seed < 3000; seed++) {
        const [item] = rollItemDrops(makeCharacter({ level: 10, equippedItemIds: equipped, ownedItemIds: equipped }), 1, createRng(seed));
        if (item.rarity === 'epic' || item.rarity === 'rare') hits += 1;
      }
      return hits / 3000;
    };
    expect(rareOrEpicShare(['magpie-charm'])).toBeCloseTo(6000 / 130 / 100, 1);
    expect(rareOrEpicShare([])).toBeCloseTo(0.3, 1);
  });

  it("states Magpie's Diamond's effect plainly", () => {
    expect(itemById('magpie-charm').effectText).toBe('Rare and epic items drop twice as often.');
  });

  const relicIds = ITEM_CATALOG.filter((i) => i.rarity === 'relic').map((i) => i.id);

  it('availableRelics offers every relic from level 1', () => {
    expect(availableRelics(makeCharacter({ level: 1 }), []).map((i) => i.id)).toEqual(relicIds);
  });

  it('availableRelics excludes earned, owned, and promised relics', () => {
    const [a, b, c] = relicIds;
    const character = makeCharacter({ level: 1, earnedRelicIds: [a], ownedItemIds: [b] });
    const promised = createQuest('q', 'easy', '2099-01-01', 'side', c);
    const ids = availableRelics(character, [promised]).map((i) => i.id);
    expect(ids).not.toContain(a);
    expect(ids).not.toContain(b);
    expect(ids).not.toContain(c);
    expect(ids).toHaveLength(relicIds.length - 3);
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
