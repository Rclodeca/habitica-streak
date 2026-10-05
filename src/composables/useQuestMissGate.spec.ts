// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useBossStore } from '../store/bossStore';
import { useCharacterStore } from '../store/characterStore';
import { useQuestStore } from '../store/questStore';
import { useQuestMissGate } from './useQuestMissGate';

describe('useQuestMissGate', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    // `pending`/`overridden` are module-scope singletons — reset after each.
    useQuestMissGate().acknowledge();
  });

  it('starts with no pending misses', () => {
    const { misses, hasPending } = useQuestMissGate();
    expect(misses.value).toEqual([]);
    expect(hasPending.value).toBe(false);
  });

  it('queueMiss adds a pending entry visible from a separate call', () => {
    const questStore = useQuestStore();
    const quest = questStore.addQuest('Clean garage', 'medium', '2026-01-01', 1);

    useQuestMissGate().queueMiss(quest);

    const { misses, hasPending } = useQuestMissGate();
    expect(hasPending.value).toBe(true);
    expect(misses.value).toEqual([{ questId: quest.id, description: 'Clean garage', dueDateKey: '2026-01-01' }]);
  });

  it('acknowledge applies damage (failQuest) for a non-overridden miss and clears the queue', () => {
    const characterStore = useCharacterStore();
    const questStore = useQuestStore();
    useBossStore();

    const quest = questStore.addQuest('Clean garage', 'medium', '2026-01-01', 1);
    const healthBefore = characterStore.character.currentHealth;

    useQuestMissGate().queueMiss(quest);
    useQuestMissGate().acknowledge();

    expect(characterStore.character.currentHealth).toBeLessThan(healthBefore);
    expect(questStore.quests).toEqual([]);
    expect(useQuestMissGate().misses.value).toEqual([]);
  });

  it('acknowledge grants the reward (completeQuest) for an overridden miss instead of damage', () => {
    const characterStore = useCharacterStore();
    const questStore = useQuestStore();
    useBossStore();

    const quest = questStore.addQuest('Clean garage', 'medium', '2026-01-01', 1);
    const healthBefore = characterStore.character.currentHealth;
    const expBefore = characterStore.character.exp;

    const { queueMiss, toggleOverride, acknowledge } = useQuestMissGate();
    queueMiss(quest);
    toggleOverride(quest.id); // "I actually did this"
    acknowledge();

    expect(characterStore.character.currentHealth).toBe(healthBefore); // no penalty applied
    expect(characterStore.character.exp).toBeGreaterThan(expBefore); // reward applied instead
    expect(questStore.quests).toEqual([]);
  });

  it('isOverridden reflects toggleOverride, and acknowledge clears overrides for the next round', () => {
    const questStore = useQuestStore();
    useCharacterStore();
    useBossStore();

    const quest = questStore.addQuest('Clean garage', 'medium', '2026-01-01', 1);
    const { queueMiss, isOverridden, toggleOverride, acknowledge } = useQuestMissGate();

    queueMiss(quest);
    expect(isOverridden(quest.id)).toBe(false);
    toggleOverride(quest.id);
    expect(isOverridden(quest.id)).toBe(true);

    acknowledge();
    expect(isOverridden(quest.id)).toBe(false);
  });
});
