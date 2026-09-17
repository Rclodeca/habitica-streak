// Tracks the highest boss index ever reached, independent of the main save
// (its own localStorage key, no schema version) so it survives both death
// resets (which put boss.index back to 1) and any future SaveState schema
// bump (which starts the main save fresh on mismatch).

import { defineStore } from 'pinia';

const STORAGE_KEY = 'habitica-streak:highscore:v1';

function loadHighestBossIndex(): number {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw === null ? NaN : Number(raw);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

export const useHighScoreStore = defineStore('highScore', {
  state: () => ({
    highestBossIndex: loadHighestBossIndex(),
  }),
  actions: {
    /** No-op unless `index` beats the current record; persists immediately when it does. */
    recordBossIndex(index: number) {
      if (index <= this.highestBossIndex) return;
      this.highestBossIndex = index;
      localStorage.setItem(STORAGE_KEY, String(index));
    },
  },
});
