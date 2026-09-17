// @vitest-environment jsdom
//
// This composable reads/writes Pinia store state, which is fine under the
// project's default `node` test environment — but we still want a DOM
// present in case any transitive dependency expects one, matching the
// convention used by `store/index.spec.ts`.

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRng, periodKeyFor } from '../game-engine';
import { useBossStore } from '../store/bossStore';
import { useCharacterStore } from '../store/characterStore';
import { useHabitStore } from '../store/habitStore';
import { useDailyRollover } from './useDailyRollover';
import { useMissedSkillsGate } from './useMissedSkillsGate';

describe('useDailyRollover', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    // `pending` in useMissedSkillsGate is a module-scope singleton — clear
    // it so a miss queued in one test doesn't leak into the next.
    useMissedSkillsGate().acknowledge();
  });

  it('queues a miss (without applying damage) for a daily habit not completed in the preceding period', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    useBossStore(); // bootstraps the boss slice used internally by miss resolution

    const habit = habitStore.addHabit('Meditate', 'daily', 'medium', false, createRng());

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayKey = periodKeyFor('daily', yesterday);

    // Simulate "last app-open was yesterday, and yesterday's occurrence was
    // never checked off": streak was already built up, last-checked stamp
    // is yesterday's period key, and it was never completed in that period.
    habitStore.updateHabit({
      ...habit,
      streakCount: 3,
      lastCheckedPeriodKey: yesterdayKey,
      lastCompletedPeriodKey: null,
    });

    const healthBefore = characterStore.character.currentHealth;

    useDailyRollover(now);

    const currentPeriodKey = periodKeyFor('daily', now);
    const updatedHabit = habitStore.habits.find((h) => h.id === habit.id);

    // Detection queues the miss but doesn't resolve it yet — that waits for
    // the popup to be acknowledged.
    expect(characterStore.character.currentHealth).toBe(healthBefore);
    expect(updatedHabit?.streakCount).toBe(3);
    expect(updatedHabit?.lastCheckedPeriodKey).toBe(yesterdayKey);
    expect(useMissedSkillsGate().misses.value).toEqual([
      { habitId: habit.id, habitName: 'Meditate', periodKeyToStamp: currentPeriodKey, outcome: 'penalty' },
    ]);
  });

  it('applies the queued miss (damage, streak reset, stamp) once acknowledged', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    useBossStore();

    const habit = habitStore.addHabit('Meditate', 'daily', 'medium', false, createRng());

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayKey = periodKeyFor('daily', yesterday);

    habitStore.updateHabit({
      ...habit,
      streakCount: 3,
      lastCheckedPeriodKey: yesterdayKey,
      lastCompletedPeriodKey: null,
    });

    const healthBefore = characterStore.character.currentHealth;

    useDailyRollover(now);
    useMissedSkillsGate().acknowledge();

    const currentPeriodKey = periodKeyFor('daily', now);
    const updatedHabit = habitStore.habits.find((h) => h.id === habit.id);

    expect(characterStore.character.currentHealth).toBeLessThan(healthBefore);
    expect(updatedHabit?.streakCount).toBe(0);
    expect(updatedHabit?.lastCheckedPeriodKey).toBe(currentPeriodKey);
    expect(useMissedSkillsGate().misses.value).toEqual([]);
  });

  it('does not record a miss for a habit already completed in the preceding period', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    useBossStore();

    const habit = habitStore.addHabit('Stretch', 'daily', 'easy', false, createRng());

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayKey = periodKeyFor('daily', yesterday);

    habitStore.updateHabit({
      ...habit,
      streakCount: 5,
      lastCheckedPeriodKey: yesterdayKey,
      lastCompletedPeriodKey: yesterdayKey, // completed yesterday, the immediately-preceding period
    });

    const healthBefore = characterStore.character.currentHealth;

    useDailyRollover(now);

    const currentPeriodKey = periodKeyFor('daily', now);
    const updatedHabit = habitStore.habits.find((h) => h.id === habit.id);

    expect(characterStore.character.currentHealth).toBe(healthBefore);
    expect(updatedHabit?.streakCount).toBe(5); // untouched — no miss recorded
    expect(updatedHabit?.lastCheckedPeriodKey).toBe(currentPeriodKey);
    expect(useMissedSkillsGate().misses.value).toEqual([]);
  });

  it('does not re-check a habit already stamped for the current period (no double-processing)', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    useBossStore();

    const habit = habitStore.addHabit('Journal', 'daily', 'hard', false, createRng());
    const now = new Date();
    const currentPeriodKey = periodKeyFor('daily', now);

    habitStore.updateHabit({
      ...habit,
      streakCount: 2,
      lastCheckedPeriodKey: currentPeriodKey, // already checked this period
      lastCompletedPeriodKey: null,
    });

    const healthBefore = characterStore.character.currentHealth;

    useDailyRollover(now);

    const updatedHabit = habitStore.habits.find((h) => h.id === habit.id);
    expect(characterStore.character.currentHealth).toBe(healthBefore);
    expect(updatedHabit?.streakCount).toBe(2);
    expect(useMissedSkillsGate().misses.value).toEqual([]);
  });

  it('queues a reward (without applying boss damage) for a bad habit not checked in the preceding period', () => {
    const habitStore = useHabitStore();
    const bossStore = useBossStore();
    useCharacterStore();

    const habit = habitStore.addHabit('Skip dessert', 'daily', 'medium', true, createRng());

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayKey = periodKeyFor('daily', yesterday);

    // Simulate "last app-open was yesterday, and the bad habit was never
    // tapped yesterday" — i.e. it was avoided.
    habitStore.updateHabit({
      ...habit,
      streakCount: 3,
      lastCheckedPeriodKey: yesterdayKey,
      lastCompletedPeriodKey: null,
    });

    const bossHealthBefore = bossStore.boss.health;

    useDailyRollover(now);

    const currentPeriodKey = periodKeyFor('daily', now);
    const updatedHabit = habitStore.habits.find((h) => h.id === habit.id);

    // Detection queues the reward but doesn't resolve it yet — that waits
    // for the popup to be acknowledged.
    expect(bossStore.boss.health).toBe(bossHealthBefore);
    expect(updatedHabit?.streakCount).toBe(3);
    expect(updatedHabit?.lastCheckedPeriodKey).toBe(yesterdayKey);
    expect(useMissedSkillsGate().rewards.value).toEqual([
      { habitId: habit.id, habitName: 'Skip dessert', periodKeyToStamp: currentPeriodKey, outcome: 'reward' },
    ]);
  });

  it('does not record a reward for a bad habit that was checked (done) in the preceding period', () => {
    const habitStore = useHabitStore();
    const bossStore = useBossStore();
    useCharacterStore();

    const habit = habitStore.addHabit('Skip dessert', 'daily', 'medium', true, createRng());

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayKey = periodKeyFor('daily', yesterday);

    habitStore.updateHabit({
      ...habit,
      streakCount: 0,
      lastCheckedPeriodKey: yesterdayKey,
      lastCompletedPeriodKey: yesterdayKey, // the bad habit was done yesterday — already penalized at tap time
    });

    const bossHealthBefore = bossStore.boss.health;

    useDailyRollover(now);

    const currentPeriodKey = periodKeyFor('daily', now);
    const updatedHabit = habitStore.habits.find((h) => h.id === habit.id);

    expect(bossStore.boss.health).toBe(bossHealthBefore);
    expect(updatedHabit?.lastCheckedPeriodKey).toBe(currentPeriodKey);
    expect(useMissedSkillsGate().rewards.value).toEqual([]);
  });
});
