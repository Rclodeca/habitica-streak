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

  it('starts with no pending misses or rewards', () => {
    const { misses, rewards, hasPending } = useMissedSkillsGate();
    expect(misses.value).toEqual([]);
    expect(rewards.value).toEqual([]);
    expect(hasPending.value).toBe(false);
  });

  it('queueMiss adds a pending penalty entry visible from a separate call', () => {
    const habit = useHabitStore().addHabit('Meditate', 'daily', 'medium', false, createRng());

    useMissedSkillsGate().queueMiss(habit, '2024-01-02');

    const { misses, rewards, hasPending } = useMissedSkillsGate();
    expect(hasPending.value).toBe(true);
    expect(misses.value).toEqual([
      { habitId: habit.id, habitName: 'Meditate', periodKeyToStamp: '2024-01-02', outcome: 'penalty' },
    ]);
    expect(rewards.value).toEqual([]);
  });

  it('queueReward adds a pending reward entry visible from a separate call', () => {
    const habit = useHabitStore().addHabit('Skip dessert', 'daily', 'medium', true, createRng());

    useMissedSkillsGate().queueReward(habit, '2024-01-02');

    const { misses, rewards, hasPending } = useMissedSkillsGate();
    expect(hasPending.value).toBe(true);
    expect(rewards.value).toEqual([
      { habitId: habit.id, habitName: 'Skip dessert', periodKeyToStamp: '2024-01-02', outcome: 'reward' },
    ]);
    expect(misses.value).toEqual([]);
  });

  it('acknowledge applies damage for each pending miss, stamps its deferred period key, and clears the queue', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    useBossStore(); // bootstraps the boss slice used internally by miss resolution

    const habit = habitStore.addHabit('Meditate', 'daily', 'medium', false, createRng());
    const healthBefore = characterStore.character.currentHealth;

    useMissedSkillsGate().queueMiss(habit, '2024-01-02');
    useMissedSkillsGate().acknowledge();

    const updatedHabit = habitStore.habits.find((h) => h.id === habit.id);
    expect(characterStore.character.currentHealth).toBeLessThan(healthBefore);
    expect(updatedHabit?.lastCheckedPeriodKey).toBe('2024-01-02');
    expect(useMissedSkillsGate().misses.value).toEqual([]);
  });

  it('acknowledge applies boss damage for each pending reward, stamps its deferred period key, and clears the queue', () => {
    const habitStore = useHabitStore();
    const bossStore = useBossStore();
    useCharacterStore();

    const habit = habitStore.addHabit('Skip dessert', 'daily', 'medium', true, createRng());
    habitStore.updateHabit({ ...habit, damageType: 'physical' }); // deterministic damage type
    // Comfortably above anything a single reward hit could deal, regardless
    // of the character's randomized physical/magic split (see
    // TUNING.DAMAGE_SPLIT_RATIOS) — otherwise an occasional one-shot defeats
    // boss 1 and respawns boss 2 at full (higher) health, which would read
    // as "boss.health increased" and break the assertion below.
    bossStore.setBoss({ ...bossStore.boss, health: 1_000_000 });
    const bossHealthBefore = bossStore.boss.health;

    useMissedSkillsGate().queueReward(habit, '2024-01-02');
    useMissedSkillsGate().acknowledge();

    const updatedHabit = habitStore.habits.find((h) => h.id === habit.id);
    expect(bossStore.boss.health).toBeLessThan(bossHealthBefore);
    expect(updatedHabit?.lastCheckedPeriodKey).toBe('2024-01-02');
    expect(updatedHabit?.streakCount).toBe(1); // avoidance streak incremented, like a good habit's completion
    expect(useMissedSkillsGate().rewards.value).toEqual([]);
  });
});
