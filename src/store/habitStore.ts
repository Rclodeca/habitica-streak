// Thin Pinia wrapper around the habits slice of game state. No formulas or
// randomization live here — everything delegates into `game-engine`.

import { defineStore } from 'pinia';
import { createHabit, migrateHabitDamageType, migrateHabitRank, normalizeDays } from '../game-engine';
import type { DamageType, Difficulty, Habit, Period, Rng } from '../game-engine';

export const useHabitStore = defineStore('habit', {
  state: () => ({
    habits: [] as Habit[],
  }),
  getters: {
    /**
     * Habits of the current list filtered by damage type AND period, for
     * feeding `computeDamageSplit` — one shared pool per (damage type,
     * period) pair across good and bad habits alike. Daily and weekly are
     * deliberately separate pools: each gets the full stat pool on its own
     * schedule (a daily habit can collect its share every day, a weekly
     * habit once a week), so folding a weekly into the same pool as
     * same-type dailies would dilute every daily completion all week for
     * no corresponding gain — a bad trade the player never asked for.
     * Good/bad sharing one pool per period is still deliberate: a separate
     * pool per good/bad would let adding more habits grow a player's total
     * reward instead of just diluting the existing pool.
     */
    habitsOfType(state) {
      return (damageType: DamageType, period: Period): Habit[] =>
        state.habits.filter((habit) => habit.damageType === damageType && habit.period === period);
    },
  },
  actions: {
    /**
     * Hydrates from a save slice (re-rolling any habit whose damage type was
     * removed, and ranking a habit from before ranks by its streak), or
     * bootstraps an empty habit list.
     */
    initFromSave(saved: Habit[] | null, rng: Rng) {
      this.habits = (saved ?? []).map((habit) => migrateHabitRank(migrateHabitDamageType(habit, rng)));
    },

    /**
     * Creates a new habit via the engine and adds it to the list. `days` only
     * applies to a daily. With no habits yet, the engine keeps its damage type
     * to physical or magic.
     */
    addHabit(name: string, period: Period, difficulty: Difficulty, isBad: boolean, rng: Rng, days?: number[]): Habit {
      const habit = createHabit(name, period, difficulty, isBad, rng, days, this.habits.length === 0);
      this.habits.push(habit);
      return habit;
    },

    removeHabit(id: string) {
      this.habits = this.habits.filter((habit) => habit.id !== id);
    },

    /** Replaces a single habit by id, e.g. with the `updatedHabit` from a combat result. */
    updateHabit(updatedHabit: Habit) {
      const index = this.habits.findIndex((habit) => habit.id === updatedHabit.id);
      if (index !== -1) this.habits.splice(index, 1, updatedHabit);
    },

    /**
     * Sets a daily's due days (normalized — all seven makes it a plain daily
     * again), keeping everything else. No-op for a weekly or an unknown id.
     */
    setHabitDays(id: string, days: number[] | undefined) {
      const habit = this.habits.find((h) => h.id === id);
      if (!habit || habit.period !== 'daily') return;
      const updated: Habit = { ...habit, days: normalizeDays(days) };
      if (!updated.days) delete updated.days;
      this.updateHabit(updated);
    },

    /**
     * Temporary repair: clears the "done" check on every daily completed in
     * `dayKey`, leaving streaks and every other field alone. Returns how many
     * it cleared.
     */
    uncheckDailiesCompletedIn(dayKey: string): number {
      let cleared = 0;
      this.habits = this.habits.map((habit) => {
        if (habit.period !== 'daily' || habit.lastCompletedPeriodKey !== dayKey) return habit;
        cleared++;
        return { ...habit, lastCompletedPeriodKey: null };
      });
      return cleared;
    },

    /** Replaces the whole habit list wholesale, e.g. after player-death resolution. */
    setHabits(habits: Habit[]) {
      this.habits = habits;
    },
  },
});
