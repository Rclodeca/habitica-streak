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
    /** Habits of the current list filtered by damage type, for feeding `computeDamageSplit`. */
    habitsOfType(state) {
      return (damageType: DamageType): Habit[] =>
        state.habits.filter((habit) => habit.damageType === damageType);
    },
  },
  actions: {
    /** Hydrates from a save slice, or bootstraps an empty habit list. */
    initFromSave(saved: Habit[] | null) {
      this.habits = saved ?? [];
    },

    /** Creates a new habit via the engine and adds it to the list. */
    addHabit(name: string, period: Period, difficulty: Difficulty, rng: Rng): Habit {
      const habit = createHabit(name, period, difficulty, rng);
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
