// Thin Pinia wrapper around the boss slice of game state. No formulas or
// randomization live here — everything delegates into `game-engine`.

import { defineStore } from 'pinia';
import { createRng, generateBoss, resolveBossDefeatIfDead } from '../game-engine';
import type { Boss, Character, Rng } from '../game-engine';

export const useBossStore = defineStore('boss', {
  state: () => ({
    boss: generateBoss(1, createRng()) as Boss,
  }),
  actions: {
    /** Hydrates from a save slice, or bootstraps the index-1 boss. */
    initFromSave(saved: Boss | null, rng: Rng) {
      this.boss = saved ?? generateBoss(1, rng);
    },

    /** Replaces the boss wholesale, e.g. after combat/defeat resolution elsewhere. */
    setBoss(boss: Boss) {
      this.boss = boss;
    },

    /** No-op unless the boss is dead; otherwise spawns the next boss. */
    resolveBossDefeatIfDead(character: Character, rng: Rng) {
      const result = resolveBossDefeatIfDead(character, this.boss, rng);
      this.boss = result.boss;
      return result;
    },
  },
});
