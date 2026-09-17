// @vitest-environment jsdom
//
// This composable reads/writes Pinia store state, which is fine under the
// project's default `node` test environment — but we still want a DOM
// present in case any transitive dependency expects one, matching the
// convention used by `store/index.spec.ts`.

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRng, periodKeyFor } from '../game-engine';
import { useBossStore } from '../store/bossStore';
import { useCharacterStore } from '../store/characterStore';
import { useHabitStore } from '../store/habitStore';
import { useDailyRollover } from './useDailyRollover';

describe('useDailyRollover', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('applies miss damage and resets the streak for a daily habit not completed in the preceding period', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    useBossStore(); // bootstraps the boss slice used internally by the rollover's miss resolution

    const habit = habitStore.addHabit('Meditate', 'daily', 'medium', createRng());

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

    expect(characterStore.character.currentHealth).toBeLessThan(healthBefore);
    expect(updatedHabit?.streakCount).toBe(0);
    expect(updatedHabit?.lastCheckedPeriodKey).toBe(currentPeriodKey);
  });

  it('does not record a miss for a habit already completed in the preceding period', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    useBossStore();

    const habit = habitStore.addHabit('Stretch', 'daily', 'easy', createRng());

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
  });

  it('does not re-check a habit already stamped for the current period (no double-processing)', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    useBossStore();

    const habit = habitStore.addHabit('Journal', 'daily', 'hard', createRng());
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
  });
});
