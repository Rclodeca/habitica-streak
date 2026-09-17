// Thin Pinia wrapper around the character slice of game state. Every action
// here delegates straight into `game-engine` and assigns the result back —
// no formulas or randomization live in this file.

import { defineStore } from 'pinia';
import {
  addExpAndResolveLevelUps,
  completeHabit,
  createCharacter,
  createRng,
  missHabit,
  resolvePlayerDeathIfDead,
} from '../game-engine';
import type { Boss, Character, Habit, Rng } from '../game-engine';

export const useCharacterStore = defineStore('character', {
  state: () => ({
    character: createCharacter(createRng()) as Character,
  }),
  actions: {
    /** Hydrates from a save slice, or bootstraps a fresh character. */
    initFromSave(saved: Character | null, rng: Rng) {
      this.character = saved ?? createCharacter(rng);
    },

    /** Replaces the character wholesale, e.g. after combat resolution elsewhere. */
    setCharacter(character: Character) {
      this.character = character;
    },

    /** Grants EXP and resolves any resulting level-ups. Returns levels gained. */
    addExpAndResolveLevelUps(expGained: number): number {
      const { character, levelsGained } = addExpAndResolveLevelUps(this.character, expGained);
      this.character = character;
      return levelsGained;
    },

    /**
     * Character-side effect of completing a habit (healing habits update
     * `currentHealth`; damage habits leave the character untouched). Returns
     * the full combat result so callers can apply the boss/habit sides too.
     */
    completeHabit(habit: Habit, allHabitsOfSameType: Habit[], boss: Boss) {
      const result = completeHabit(this.character, habit, allHabitsOfSameType, boss);
      this.character = result.character;
      return result;
    },

    /** Character-side effect of missing a habit: applies boss-attack damage. */
    missHabit(habit: Habit, boss: Boss) {
      const result = missHabit(this.character, habit, boss);
      this.character = result.character;
      return result;
    },

    /** No-op unless dead; otherwise resets to a fresh character. */
    resolvePlayerDeathIfDead(boss: Boss, habits: Habit[], rng: Rng) {
      const result = resolvePlayerDeathIfDead(this.character, boss, habits, rng);
      this.character = result.character;
      return result;
    },
  },
});
