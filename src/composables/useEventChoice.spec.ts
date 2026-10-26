// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { availableRelics, createRng } from '../game-engine';
import { TUNING } from '../game-engine/constants/tuning';
import { useActivityLogStore } from '../store/activityLogStore';
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

  it('logs the new slot count when a slots event is taken', () => {
    const { characterStore, events } = setup(20, 1);
    characterStore.setCharacter({ ...characterStore.character, takenEventIds: ['item-slots'] });
    events.choose('item-slots-2');
    expect(useActivityLogStore().entries[0]).toMatchObject({ kind: 'item-slots-gained', slots: 8 });
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

    expect(characterStore.character.doubledItemIds).toEqual(['rusty-blade']);
    expect(events.revealed.value?.id).toBe('rusty-blade');
    events.dismissReveal();
    expect(events.revealed.value).toBeNull();
  });

  it('side-quest creates a side quest promised an available relic and spends the pick', () => {
    const { characterStore, events } = setup(1, 1);
    const relics = availableRelics(characterStore.character, []).map((i) => i.id);
    events.chooseSideQuest('Clean garage', 'hard', '2099-01-01');

    const quests = useQuestStore().quests;
    expect(quests).toHaveLength(1);
    expect(quests[0]).toMatchObject({ kind: 'side', difficulty: 'hard', dueDateKey: '2099-01-01' });
    expect(relics).toContain(quests[0].rewardItemId);
    expect(characterStore.character.pendingEventPicks).toBe(0);
    expect(characterStore.character.takenEventIds).toEqual([]);
  });

  it('a second side quest is promised a different relic, never the same one', () => {
    const { characterStore, events } = setup(1, 2);
    events.chooseSideQuest('One', 'easy', '2099-01-01');
    characterStore.setCharacter({ ...characterStore.character, pendingEventPicks: 1 });
    events.ensureChoices();
    events.chooseSideQuest('Two', 'easy', '2099-01-01');

    const rewards = useQuestStore().quests.map((q) => q.rewardItemId);
    expect(new Set(rewards).size).toBe(2);
  });

  it('resets the guarantee count when side-quest is offered, even if the pick claims the last available relic', () => {
    const characterStore = useCharacterStore();
    const habitStore = useHabitStore();
    habitStore.addHabit('Daily good', 'daily', 'medium', false, createRng(1));
    const [onlyItem, ...rest] = availableRelics({ ...characterStore.character, level: 1 }, []).map((i) => i.id);
    characterStore.setCharacter({
      ...characterStore.character,
      level: 1,
      pendingEventPicks: 1,
      takenEventIds: [],
      earnedRelicIds: rest,
      sideQuestPicksMissed: TUNING.SIDE_QUEST_GUARANTEE_LEVELS,
    });
    const events = useEventChoice();
    events.ensureChoices();
    expect(events.choices.value.map((c) => c.id)).toContain('side-quest');

    events.chooseSideQuest('Slay it', 'easy', '2099-01-01');

    expect(useQuestStore().quests[0].rewardItemId).toBe(onlyItem);
    expect(characterStore.character.sideQuestPicksMissed).toBe(0);
  });

  it('counts a pick where side-quest was eligible but not offered, toward the guarantee', () => {
    const { characterStore, events } = setup(7, 1);
    const offered = events.choices.value.map((c) => c.id);
    const pick = offered.find((id) => id !== 'side-quest' && id !== 'reroll-skill');
    expect(pick).toBeDefined();
    events.choose(pick as Exclude<typeof offered[number], 'side-quest' | 'reroll-skill'>);
    expect(characterStore.character.sideQuestPicksMissed).toBe(offered.includes('side-quest') ? 0 : 1);
  });
});
