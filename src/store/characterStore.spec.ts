// @vitest-environment jsdom
//
// Matches the jsdom convention used by other Pinia-store-touching specs in
// this project (useDailyRollover.spec.ts, useCombatActions.spec.ts) even
// though this particular store doesn't touch localStorage directly.

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCharacterStore } from './characterStore';

describe('characterStore equip/unequip', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('equips an owned item', () => {
    const store = useCharacterStore();
    store.character = { ...store.character, ownedItemIds: ['rusty-blade'], equippedItemIds: [] };

    store.equipItem('rusty-blade');

    expect(store.character.equippedItemIds).toEqual(['rusty-blade']);
  });

  it('does nothing when equipping an item that is not owned', () => {
    const store = useCharacterStore();
    const before = store.character;

    store.equipItem('not-owned');

    expect(store.character).toEqual(before);
  });

  it('does nothing when equipping an item that is already equipped', () => {
    const store = useCharacterStore();
    store.character = { ...store.character, ownedItemIds: ['rusty-blade'], equippedItemIds: ['rusty-blade'] };

    store.equipItem('rusty-blade');

    expect(store.character.equippedItemIds).toEqual(['rusty-blade']);
  });

  it('refuses to equip a 5th item when 4 slots are already full', () => {
    const store = useCharacterStore();
    const owned = ['rusty-blade', 'steel-sword', 'apprentice-wand', 'arcane-staff', 'novices-charm'];
    store.character = { ...store.character, ownedItemIds: owned, equippedItemIds: owned.slice(0, 4) };

    store.equipItem('novices-charm');

    expect(store.character.equippedItemIds).toEqual(owned.slice(0, 4));
    expect(store.character.equippedItemIds).toHaveLength(4);
  });

  it('unequips a currently equipped item', () => {
    const store = useCharacterStore();
    store.character = { ...store.character, ownedItemIds: ['rusty-blade'], equippedItemIds: ['rusty-blade'] };

    store.unequipItem('rusty-blade');

    expect(store.character.equippedItemIds).toEqual([]);
  });

  it('does nothing when unequipping an item that is not currently equipped', () => {
    const store = useCharacterStore();
    const before = store.character;

    store.unequipItem('rusty-blade');

    expect(store.character).toEqual(before);
  });
});
