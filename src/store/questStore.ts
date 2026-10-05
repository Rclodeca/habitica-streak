// Thin Pinia wrapper around the quests slice of game state. No formulas or
// randomization live here — everything delegates into `game-engine`.

import { defineStore } from 'pinia';
import { createQuest } from '../game-engine';
import type { Difficulty, Quest } from '../game-engine';

export const useQuestStore = defineStore('quest', {
  state: () => ({
    quests: [] as Quest[],
  }),
  actions: {
    /** Hydrates from a save slice, or bootstraps an empty quest list. */
    initFromSave(saved: Quest[] | null) {
      this.quests = saved ?? [];
    },

    /** Creates a new quest via the engine and adds it to the list. */
    addQuest(description: string, difficulty: Difficulty, dueDateKey: string, bossIndexAtOffer: number): Quest {
      const quest = createQuest(description, difficulty, dueDateKey, bossIndexAtOffer);
      this.quests.push(quest);
      return quest;
    },

    /** Removes a quest by id, e.g. once it's been completed or failed. */
    removeQuest(id: string) {
      this.quests = this.quests.filter((quest) => quest.id !== id);
    },
  },
});
