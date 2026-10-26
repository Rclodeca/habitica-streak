// @vitest-environment jsdom
//
// Matches the jsdom convention used by other Pinia-store-touching specs in
// this project (characterStore.spec.ts, questStore.spec.ts).

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRng } from '../game-engine';
import { useHabitStore } from './habitStore';

describe('habitStore.addHabit damage type', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('makes the first habit physical or magic, whatever the roll', () => {
    for (let seed = 1; seed <= 200; seed++) {
      setActivePinia(createPinia());
      const store = useHabitStore();
      expect(['physical', 'magic']).toContain(store.addHabit('First', 'daily', 'easy', false, createRng(seed)).damageType);
    }
  });

  it('rolls any type once there is already a habit', () => {
    const store = useHabitStore();
    store.addHabit('First', 'daily', 'easy', false, createRng(1));
    const later = Array.from({ length: 200 }, (_, i) =>
      store.addHabit(`Later ${i}`, 'daily', 'easy', false, createRng(i + 1)).damageType,
    );
    expect(later).toContain('healing');
    expect(later).toContain('trueDamage');
  });

  it('treats the list as empty again once every habit is removed', () => {
    for (let seed = 1; seed <= 200; seed++) {
      setActivePinia(createPinia());
      const store = useHabitStore();
      store.removeHabit(store.addHabit('Gone', 'daily', 'easy', false, createRng(seed)).id);
      expect(['physical', 'magic']).toContain(store.addHabit('Again', 'daily', 'easy', false, createRng(seed)).damageType);
    }
  });
});

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

describe('habitStore.uncheckDailiesCompletedIn', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("clears only the daily checks for that day and leaves everything else as it was", () => {
    const store = useHabitStore();
    const done = store.addHabit('Gym', 'daily', 'hard', false, createRng(1));
    const earlier = store.addHabit('Read', 'daily', 'easy', false, createRng(2));
    const weekly = store.addHabit('Hike', 'weekly', 'hard', false, createRng(3));
    store.updateHabit({ ...done, streakCount: 6, lastCompletedPeriodKey: '2026-10-25', lastCheckedPeriodKey: '2026-10-25' });
    store.updateHabit({ ...earlier, streakCount: 2, lastCompletedPeriodKey: '2026-10-24', lastCheckedPeriodKey: '2026-10-24' });
    store.updateHabit({ ...weekly, streakCount: 4, lastCompletedPeriodKey: '2026-10-25', lastCheckedPeriodKey: '2026-10-25' });
    const [doneBefore, earlierBefore, weeklyBefore] = store.habits;

    const cleared = store.uncheckDailiesCompletedIn('2026-10-25');

    expect(cleared).toBe(1);
    expect(store.habits[0]).toEqual({ ...doneBefore, lastCompletedPeriodKey: null });
    expect(store.habits[1]).toEqual(earlierBefore);
    expect(store.habits[2]).toEqual(weeklyBefore);
  });

  it('does nothing when no daily was checked that day', () => {
    const store = useHabitStore();
    store.addHabit('Gym', 'daily', 'hard', false, createRng(1));
    const before = store.habits;

    expect(store.uncheckDailiesCompletedIn('2026-10-25')).toBe(0);
    expect(store.habits).toEqual(before);
  });
});
