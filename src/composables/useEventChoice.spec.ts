// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRng } from '../game-engine';
import { useBossStore } from '../store/bossStore';
import { useCharacterStore } from '../store/characterStore';
import { useHabitStore } from '../store/habitStore';
import { useQuestStore } from '../store/questStore';
import { useEventChoice } from './useEventChoice';
import { useItemDropQueue } from './useItemDropQueue';

describe('useEventChoice', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  // `options` is module-scoped; resolve any leftover picks so it can't leak between tests.
  afterEach(() => {
    useEventChoice().dismissReveal();
    const characterStore = useCharacterStore();
    characterStore.setCharacter({ ...characterStore.character, pendingEventPicks: 0 });
    useEventChoice().ensureChoices();
  });

  function setup(level: number, pendingEventPicks: number) {
    const characterStore = useCharacterStore();
    characterStore.setCharacter({ ...characterStore.character, level, pendingEventPicks, takenEventIds: [] });
    const habitStore = useHabitStore();
    habitStore.addHabit('Daily good', 'daily', 'medium', false, createRng(1));
    const events = useEventChoice();
    events.ensureChoices();
    return { characterStore, habitStore, events };
  }

  it('rolls up to 3 choices while a pick is pending and none when not', () => {
    const { events } = setup(7, 1);
    expect(events.choices.value.length).toBeGreaterThan(0);
    expect(events.choices.value.length).toBeLessThanOrEqual(3);

    const characterStore = useCharacterStore();
    characterStore.setCharacter({ ...characterStore.character, pendingEventPicks: 0 });
    events.ensureChoices();
    expect(events.choices.value).toEqual([]);
  });

  it('applying a one-time event spends the pick and marks it taken', () => {
    const { characterStore, habitStore, events } = setup(7, 2);
    events.choose('special');

    expect(characterStore.character.pendingEventPicks).toBe(1);
    expect(characterStore.character.takenEventIds).toEqual(['special']);
    expect(habitStore.habits.filter((h) => h.isSpecial)).toHaveLength(1);
    // next pick gets freshly rolled choices that no longer include the taken event
    events.ensureChoices();
    expect(events.choices.value.map((c) => c.id)).not.toContain('special');
  });

  it('item-slots takes effect on the character', () => {
    const { characterStore, events } = setup(7, 1);
    events.choose('item-slots');
    expect(characterStore.character.takenEventIds).toContain('item-slots');
  });

  it('overdrive grants Overdrive to a good habit', () => {
    const { habitStore, events } = setup(3, 1);
    events.choose('overdrive');
    expect(habitStore.habits[0].isOverdrive).toBe(true);
  });

  it('reroll changes the chosen skill to a different damage type', () => {
    const { habitStore, events } = setup(3, 1);
    const before = habitStore.habits[0].damageType;
    events.chooseReroll(habitStore.habits[0].id);
    expect(habitStore.habits[0].damageType).not.toBe(before);
  });

  it('heal restores health and spends the pick', () => {
    const { characterStore, events } = setup(1, 1);
    const full = characterStore.character.currentHealth;
    characterStore.setCharacter({ ...characterStore.character, currentHealth: 0 });
    events.choose('heal');
    expect(characterStore.character.currentHealth).toBeGreaterThan(0);
    expect(characterStore.character.currentHealth).toBeLessThan(full);
    expect(characterStore.character.pendingEventPicks).toBe(0);
  });

  it('item-drop grants exactly one new owned item and queues it for the drop popup', () => {
    const { characterStore, events } = setup(1, 1);
    const { current, dismiss } = useItemDropQueue();
    useBossStore().setBoss({ ...useBossStore().boss, index: 30 }); // a late boss would normally drop several
    events.choose('item-drop');
    expect(characterStore.character.ownedItemIds).toHaveLength(1);
    expect(current.value?.id).toBe(characterStore.character.ownedItemIds[0]);
    dismiss();
  });

  it('double-item enchants an equipped item, reveals it, and the reveal can be dismissed', () => {
    const { characterStore, events } = setup(10, 1);
    characterStore.setCharacter({ ...characterStore.character, ownedItemIds: ['rusty-blade'], equippedItemIds: ['rusty-blade'] });
    events.choose('double-item');

    expect(characterStore.character.doubledItemId).toBe('rusty-blade');
    expect(events.revealed.value?.id).toBe('rusty-blade');
    events.dismissReveal();
    expect(events.revealed.value).toBeNull();
  });

  it('quest creates a quest locked to the current boss index and spends the pick', () => {
    const { characterStore, events } = setup(1, 1);
    useBossStore().setBoss({ ...useBossStore().boss, index: 4 });
    events.chooseQuest('Clean garage', 'hard', '2099-01-01');

    const quests = useQuestStore().quests;
    expect(quests).toHaveLength(1);
    expect(quests[0].bossIndexAtOffer).toBe(4);
    expect(characterStore.character.pendingEventPicks).toBe(0);
    expect(characterStore.character.takenEventIds).toEqual([]);
  });
});
