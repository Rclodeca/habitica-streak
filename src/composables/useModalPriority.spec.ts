// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useDeathScreen } from './useDeathScreen';
import { useItemDropQueue } from './useItemDropQueue';
import { useMissedSkillsGate } from './useMissedSkillsGate';
import { useModalPriority } from './useModalPriority';
import { useQuestMissGate } from './useQuestMissGate';
import { useQuestOfferQueue } from './useQuestOfferQueue';
import { useQuestStore } from '../store/questStore';
import { useCharacterStore } from '../store/characterStore';
import { useHabitStore } from '../store/habitStore';
import { createRng } from '../game-engine';

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
    const { current: qCurrent, dismiss: qDismiss } = useQuestOfferQueue();
    while (qCurrent.value !== null) qDismiss();
  });

  describe('questOfferVisible', () => {
    it('is false when no quest offer is queued', () => {
      const { questOfferVisible } = useModalPriority();
      expect(questOfferVisible.value).toBe(false);
    });

    it('is true when a quest offer is queued and nothing else is blocking', () => {
      const { enqueueOffer } = useQuestOfferQueue();
      enqueueOffer(1);

      const { questOfferVisible } = useModalPriority();
      expect(questOfferVisible.value).toBe(true);
    });

    it('is false while the character is dead, even with a quest offer queued', () => {
      useQuestOfferQueue().enqueueOffer(1);
      useDeathScreen().triggerDeath();

      const { questOfferVisible } = useModalPriority();
      expect(questOfferVisible.value).toBe(false);
    });

    it('is false while an item drop is pending, even with a quest offer queued', () => {
      useQuestOfferQueue().enqueueOffer(1);
      useItemDropQueue().enqueueDrops([
        { id: 'rusty-blade', name: 'Rusty Blade', icon: 'items/rusty-blade', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'physicalDamage', percent: 3 }] },
      ]);

      const { questOfferVisible } = useModalPriority();
      expect(questOfferVisible.value).toBe(false);
    });

    it('is false while a quest miss is pending, even with a quest offer queued', () => {
      const questStore = useQuestStore();
      const quest = questStore.addQuest('Clean garage', 'medium', '2026-01-01', 1);
      useQuestMissGate().queueMiss(quest);
      useQuestOfferQueue().enqueueOffer(1);

      const { questOfferVisible } = useModalPriority();
      expect(questOfferVisible.value).toBe(false);
    });
  });

  describe('questMissVisible', () => {
    it('is false when no quest miss is pending', () => {
      const { questMissVisible } = useModalPriority();
      expect(questMissVisible.value).toBe(false);
    });

    it('is true when a quest miss is pending and nothing else is blocking', () => {
      const questStore = useQuestStore();
      const quest = questStore.addQuest('Clean garage', 'medium', '2026-01-01', 1);
      useQuestMissGate().queueMiss(quest);

      const { questMissVisible } = useModalPriority();
      expect(questMissVisible.value).toBe(true);
    });

    it('is false while the character is dead, even with a quest miss pending', () => {
      const questStore = useQuestStore();
      const quest = questStore.addQuest('Clean garage', 'medium', '2026-01-01', 1);
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
      const quest = questStore.addQuest('Clean garage', 'medium', '2026-01-01', 1);
      useQuestMissGate().queueMiss(quest);

      const { questMissVisible } = useModalPriority();
      expect(questMissVisible.value).toBe(false);
    });
  });
});
