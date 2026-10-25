// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useCelebration } from './useCelebration';
import { useDeathScreen } from './useDeathScreen';
import { useEventChoice } from './useEventChoice';
import { useItemDropQueue } from './useItemDropQueue';
import { useMissedSkillsGate } from './useMissedSkillsGate';
import { useModalPriority } from './useModalPriority';
import { useQuestMissGate } from './useQuestMissGate';
import { useQuestStore } from '../store/questStore';
import { useCharacterStore } from '../store/characterStore';
import { useHabitStore } from '../store/habitStore';
import { createRng, ITEM_CATALOG } from '../game-engine';

describe('useModalPriority', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    // Every gate here is a module-scope singleton — drain them all so one
    // test's pending state can't leak into the next.
    useDeathScreen().dismiss();
    const { current, dismiss } = useItemDropQueue();
    while (current.value) dismiss();
    useMissedSkillsGate().acknowledge();
    useQuestMissGate().acknowledge();
    useCelebration().clear();
  });

  describe('eventChoiceVisible', () => {
    function givePendingPick() {
      const characterStore = useCharacterStore();
      characterStore.setCharacter({ ...characterStore.character, pendingEventPicks: 1 });
    }

    it('stays visible for an enchant reveal even with no picks left', () => {
      const characterStore = useCharacterStore();
      characterStore.setCharacter({ ...characterStore.character, level: 10, questsUnlocked: true, ownedItemIds: ['rusty-blade'], equippedItemIds: ['rusty-blade'], pendingEventPicks: 1 });
      const events = useEventChoice();
      events.choose('double-item');
      expect(characterStore.character.pendingEventPicks).toBe(0);
      expect(useModalPriority().eventChoiceVisible.value).toBe(true);
      events.dismissReveal();
      expect(useModalPriority().eventChoiceVisible.value).toBe(false);
    });

    it('is false when no event pick is pending', () => {
      const { eventChoiceVisible } = useModalPriority();
      expect(eventChoiceVisible.value).toBe(false);
    });

    it('is true when an event pick is pending and nothing else is blocking', () => {
      givePendingPick();
      const { eventChoiceVisible } = useModalPriority();
      expect(eventChoiceVisible.value).toBe(true);
    });

    it('is false while the character is dead', () => {
      givePendingPick();
      useDeathScreen().triggerDeath();
      const { eventChoiceVisible } = useModalPriority();
      expect(eventChoiceVisible.value).toBe(false);
    });

    it('is false while an item drop is pending', () => {
      givePendingPick();
      useItemDropQueue().enqueueDrops([
        { id: 'rusty-blade', name: 'Rusty Blade', icon: 'items/rusty-blade', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'physicalDamage', percent: 3 }] },
      ]);
      const { eventChoiceVisible } = useModalPriority();
      expect(eventChoiceVisible.value).toBe(false);
    });

    it('is false while a habit miss is pending', () => {
      givePendingPick();
      const habit = useHabitStore().addHabit('Meditate', 'daily', 'medium', false, createRng());
      useMissedSkillsGate().queueMiss(habit, '2024-01-02');
      const { eventChoiceVisible } = useModalPriority();
      expect(eventChoiceVisible.value).toBe(false);
    });

    it('is false while a quest miss is pending', () => {
      givePendingPick();
      const quest = useQuestStore().addQuest('Clean garage', 'medium', '2026-01-01');
      useQuestMissGate().queueMiss(quest);
      const { eventChoiceVisible } = useModalPriority();
      expect(eventChoiceVisible.value).toBe(false);
    });

    it('waits for the level-up beat to finish playing', () => {
      givePendingPick();
      useCelebration().celebrateLevelUp(1);
      const { eventChoiceVisible } = useModalPriority();
      expect(eventChoiceVisible.value).toBe(false);
      useCelebration().clear();
      expect(eventChoiceVisible.value).toBe(true);
    });
  });

  describe('questMissVisible', () => {
    it('is false when no quest miss is pending', () => {
      const { questMissVisible } = useModalPriority();
      expect(questMissVisible.value).toBe(false);
    });

    it('is true when a quest miss is pending and nothing else is blocking', () => {
      const questStore = useQuestStore();
      const quest = questStore.addQuest('Clean garage', 'medium', '2026-01-01');
      useQuestMissGate().queueMiss(quest);

      const { questMissVisible } = useModalPriority();
      expect(questMissVisible.value).toBe(true);
    });

    it('is false while the character is dead, even with a quest miss pending', () => {
      const questStore = useQuestStore();
      const quest = questStore.addQuest('Clean garage', 'medium', '2026-01-01');
      useQuestMissGate().queueMiss(quest);
      useDeathScreen().triggerDeath();

      const { questMissVisible } = useModalPriority();
      expect(questMissVisible.value).toBe(false);
    });

    it('is false while a habit miss is pending, even with a quest miss pending', () => {
      useCharacterStore();
      const habitStore = useHabitStore();
      const questStore = useQuestStore();
      const habit = habitStore.addHabit('Meditate', 'daily', 'medium', false, createRng());
      useMissedSkillsGate().queueMiss(habit, '2024-01-02');
      const quest = questStore.addQuest('Clean garage', 'medium', '2026-01-01');
      useQuestMissGate().queueMiss(quest);

      const { questMissVisible } = useModalPriority();
      expect(questMissVisible.value).toBe(false);
    });
  });

  describe('questUnlockVisible', () => {
    function reachUnlockLevel() {
      const characterStore = useCharacterStore();
      characterStore.setCharacter({ ...characterStore.character, level: 3, questsUnlocked: false, pendingEventPicks: 1 });
    }

    it('waits for the level-up beat to finish playing', () => {
      reachUnlockLevel();
      useCelebration().celebrateLevelUp(2);
      const { questUnlockVisible } = useModalPriority();
      expect(questUnlockVisible.value).toBe(false);
      useCelebration().clear();
      expect(questUnlockVisible.value).toBe(true);
    });

    it('shows on reaching level 3, ahead of the level-up pick', () => {
      reachUnlockLevel();
      const { questUnlockVisible, eventChoiceVisible } = useModalPriority();
      expect(questUnlockVisible.value).toBe(true);
      expect(eventChoiceVisible.value).toBe(false);
    });

    it('hands over to the level-up pick once quests are unlocked', () => {
      reachUnlockLevel();
      useCharacterStore().unlockQuests();
      const { questUnlockVisible, eventChoiceVisible } = useModalPriority();
      expect(questUnlockVisible.value).toBe(false);
      expect(eventChoiceVisible.value).toBe(true);
    });

    it('waits for an item drop', () => {
      reachUnlockLevel();
      useItemDropQueue().enqueueDrops([ITEM_CATALOG[0]]);
      expect(useModalPriority().questUnlockVisible.value).toBe(false);
    });
  });
});
