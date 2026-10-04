// Thin Pinia wrapper around the habits slice of game state. No formulas or
// randomization live here — everything delegates into `game-engine`.

import { defineStore } from 'pinia';
import { createHabit } from '../game-engine';
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
    /** Hydrates from a save slice, or bootstraps an empty habit list. */
    initFromSave(saved: Habit[] | null) {
      this.habits = saved ?? [];
    },

    /** Creates a new habit via the engine and adds it to the list. */
    addHabit(name: string, period: Period, difficulty: Difficulty, isBad: boolean, rng: Rng): Habit {
      const habit = createHabit(name, period, difficulty, isBad, rng);
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

    /** Replaces the whole habit list wholesale, e.g. after player-death resolution. */
    setHabits(habits: Habit[]) {
      this.habits = habits;
    },
  },
});
