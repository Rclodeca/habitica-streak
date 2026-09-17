// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRng } from '../game-engine';
import { useBossStore } from '../store/bossStore';
import { useCharacterStore } from '../store/characterStore';
import { useHabitStore } from '../store/habitStore';
import { useMissedSkillsGate } from './useMissedSkillsGate';

describe('useMissedSkillsGate', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    // `pending` is a module-scope singleton, shared across every call to
    // useMissedSkillsGate() (by design) — so it also persists across
    // `it()` blocks in this file. Reset it after each.
    useMissedSkillsGate().acknowledge();
  });

  it('starts with no pending misses', () => {
    const { misses, hasPending } = useMissedSkillsGate();
    expect(misses.value).toEqual([]);
    expect(hasPending.value).toBe(false);
  });

  it('queueMiss adds a pending entry visible from a separate call', () => {
    const habit = useHabitStore().addHabit('Meditate', 'daily', 'medium', createRng());

    useMissedSkillsGate().queueMiss(habit, '2024-01-02');

    const { misses, hasPending } = useMissedSkillsGate();
    expect(hasPending.value).toBe(true);
    expect(misses.value).toEqual([{ habitId: habit.id, habitName: 'Meditate', periodKeyToStamp: '2024-01-02' }]);
  });

  it('acknowledge applies damage for each pending miss, stamps its deferred period key, and clears the queue', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    useBossStore(); // bootstraps the boss slice used internally by miss resolution

    const habit = habitStore.addHabit('Meditate', 'daily', 'medium', createRng());
    const healthBefore = characterStore.character.currentHealth;

    useMissedSkillsGate().queueMiss(habit, '2024-01-02');
    useMissedSkillsGate().acknowledge();

    const updatedHabit = habitStore.habits.find((h) => h.id === habit.id);
    expect(characterStore.character.currentHealth).toBeLessThan(healthBefore);
    expect(updatedHabit?.lastCheckedPeriodKey).toBe('2024-01-02');
    expect(useMissedSkillsGate().misses.value).toEqual([]);
  });
});
