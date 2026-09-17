// @vitest-environment jsdom
//
// This composable reads/writes Pinia store state, which is fine under the
// project's default `node` test environment — but we still want a DOM
// present in case any transitive dependency expects one, matching the
// convention used by `store/index.spec.ts` and `useDailyRollover.spec.ts`.

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRng, periodKeyFor } from '../game-engine';
import { useBossStore } from '../store/bossStore';
import { useCharacterStore } from '../store/characterStore';
import { useHabitStore } from '../store/habitStore';
import { useCombatActions } from './useCombatActions';

describe('useCombatActions', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('checkOffHabit is a no-op when called a second time on a habit already completed this period', () => {
    const habitStore = useHabitStore();
    const characterStore = useCharacterStore();
    const bossStore = useBossStore();
    const { checkOffHabit } = useCombatActions();

    const habit = habitStore.addHabit('Meditate', 'daily', 'medium', createRng());

    // First call: applies combat effects and stamps the habit as completed
    // for the current period.
    checkOffHabit(habit.id);

    const habitAfterFirstCall = habitStore.habits.find((h) => h.id === habit.id);
    const currentPeriodKey = periodKeyFor(habit.period, new Date());
    expect(habitAfterFirstCall?.lastCompletedPeriodKey).toBe(currentPeriodKey);

    const characterSnapshot = { ...characterStore.character };
    const bossSnapshot = { ...bossStore.boss };
    const habitSnapshot = { ...habitAfterFirstCall };

    // Second call on the same, already-completed habit — engine-level guard
    // should return early with no further state changes (no double streak
    // increment, no double boss damage, no double milestone EXP), even
    // though nothing here relies on the UI's `:disabled` binding.
    checkOffHabit(habit.id);

    const habitAfterSecondCall = habitStore.habits.find((h) => h.id === habit.id);

    expect(characterStore.character).toEqual(characterSnapshot);
    expect(bossStore.boss).toEqual(bossSnapshot);
    expect(habitAfterSecondCall).toEqual(habitSnapshot);
  });
});
