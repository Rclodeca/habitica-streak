// @vitest-environment jsdom
//
// Matches the jsdom convention used by other Pinia-store-touching specs in
// this project (characterStore.spec.ts, useCombatActions.spec.ts).

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ItemDef } from '../game-engine';
import { useCharacterStore } from '../store/characterStore';
import { useItemDropQueue } from './useItemDropQueue';

function makeItem(overrides: Partial<ItemDef> = {}): ItemDef {
  return {
    id: 'rusty-blade',
    name: 'Rusty Blade',
    icon: 'items/rusty-blade',
    type: 'equipment',
    rarity: 'common',
    stat: 'physicalDamage',
    bonusPercent: 3,
    ...overrides,
  };
}

describe('useItemDropQueue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  // `queue` is a module-scope singleton by design (see useItemDropQueue.ts),
  // so it survives across `it()` blocks in this file even though Pinia is
  // reset each time — drain it through the same public API real callers
  // use, rather than reaching into module internals just for tests.
  afterEach(() => {
    const { current, dismiss } = useItemDropQueue();
    while (current.value) dismiss();
  });

  it('auto-equips a drop immediately when a slot is open', () => {
    const characterStore = useCharacterStore();
    const item = makeItem();
    characterStore.character = { ...characterStore.character, ownedItemIds: [item.id], equippedItemIds: [] };

    const { current, isFull, enqueueDrops } = useItemDropQueue();
    enqueueDrops([item]);

    expect(characterStore.character.equippedItemIds).toEqual([item.id]);
    expect(current.value).toEqual(item);
    expect(isFull.value).toBe(false);
  });

  it('dismiss advances the queue to the next item', () => {
    const characterStore = useCharacterStore();
    const first = makeItem({ id: 'rusty-blade' });
    const second = makeItem({ id: 'apprentice-wand', stat: 'magicDamage' });
    characterStore.character = {
      ...characterStore.character,
      ownedItemIds: [first.id, second.id],
      equippedItemIds: [],
    };

    const { current, enqueueDrops, dismiss } = useItemDropQueue();
    enqueueDrops([first, second]);

    expect(current.value).toEqual(first);
    dismiss();
    expect(current.value).toEqual(second);
    dismiss();
    expect(current.value).toBeNull();
  });

  it('fills remaining slots across a multi-item drop before requiring a choice', () => {
    const characterStore = useCharacterStore();
    const existing = ['steel-sword', 'archmages-rod', 'padded-vest']; // 3 equipped, 1 slot open
    const dropped = [makeItem({ id: 'rusty-blade' }), makeItem({ id: 'lucky-coin', stat: 'expGain' })];
    characterStore.character = {
      ...characterStore.character,
      ownedItemIds: [...existing, ...dropped.map((d) => d.id)],
      equippedItemIds: existing,
    };

    const { isFull, enqueueDrops } = useItemDropQueue();
    enqueueDrops(dropped);

    // First drop fills the one open slot...
    expect(characterStore.character.equippedItemIds).toContain('rusty-blade');
    expect(characterStore.character.equippedItemIds).toHaveLength(4);
    // ...so the second drop is now blocked on a forced choice.
    expect(isFull.value).toBe(true);
    expect(characterStore.character.equippedItemIds).not.toContain('lucky-coin');
  });

  it('replace unequips the chosen item and equips the pending drop, then advances the queue', () => {
    const characterStore = useCharacterStore();
    const existing = ['steel-sword', 'archmages-rod', 'padded-vest', 'sacred-chalice'];
    const dropped = makeItem({ id: 'rusty-blade' });
    characterStore.character = {
      ...characterStore.character,
      ownedItemIds: [...existing, dropped.id],
      equippedItemIds: existing,
    };

    const { current, isFull, enqueueDrops, replace } = useItemDropQueue();
    enqueueDrops([dropped]);

    expect(isFull.value).toBe(true);
    expect(characterStore.character.equippedItemIds).toEqual(existing); // untouched until a choice is made

    replace('padded-vest');

    expect(characterStore.character.equippedItemIds).not.toContain('padded-vest');
    expect(characterStore.character.equippedItemIds).toContain('rusty-blade');
    expect(characterStore.character.equippedItemIds).toHaveLength(4);
    expect(current.value).toBeNull();
  });
});
