// @vitest-environment jsdom
//
// Matches the jsdom convention used by other Pinia-store-touching specs in
// this project (characterStore.spec.ts, questStore.spec.ts).

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRng } from '../game-engine';
import { useHabitStore } from './habitStore';

describe('habitStore.setHabitDays', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('normalizes the days and keeps the streak', () => {
    const store = useHabitStore();
    const h = store.addHabit('Gym', 'daily', 'hard', false, createRng(1));
    store.updateHabit({ ...h, streakCount: 6 });
    store.setHabitDays(h.id, [5, 0, 2, 2]);
    expect(store.habits[0].days).toEqual([0, 2, 5]);
    expect(store.habits[0].streakCount).toBe(6);
  });

  it('all seven days makes it a plain daily again', () => {
    const store = useHabitStore();
    const h = store.addHabit('Gym', 'daily', 'hard', false, createRng(1), [0]);
    store.setHabitDays(h.id, [0, 1, 2, 3, 4, 5, 6]);
    expect('days' in store.habits[0]).toBe(false);
  });

  it('leaves a weekly alone', () => {
    const store = useHabitStore();
    const h = store.addHabit('Hike', 'weekly', 'hard', false, createRng(1));
    store.setHabitDays(h.id, [0]);
    expect('days' in store.habits[0]).toBe(false);
  });
});
