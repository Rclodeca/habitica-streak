// Which one-time spotlight hints the player has seen (see SpotlightHint.vue).
// A UI setting, not game state: it lives in its own localStorage key (like
// themeStore's) so a death reset or a SaveState schema bump never shows a
// hint twice.

import { defineStore } from 'pinia';

/** The check-off hints: one for the first good habit due, one for the first bad habit. */
export type HintId = 'checkGood' | 'checkBad';

export const STORAGE_KEY = 'streak-slayer:hints:v1';

type Seen = Record<HintId, boolean>;

function loadSeen(): Seen | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return saved && typeof saved === 'object' ? { checkGood: saved.checkGood === true, checkBad: saved.checkBad === true } : null;
  } catch {
    return null;
  }
}

export const useHintStore = defineStore('hint', {
  state: () => ({ seen: loadSeen() ?? { checkGood: false, checkBad: false } }),
  actions: {
    /**
     * Called once on load. With nothing saved yet, a save that already has
     * habits belongs to a player from before these hints, who doesn't need
     * them; a brand-new player starts with every hint unseen.
     */
    settle(hasHabits: boolean) {
      if (loadSeen()) return;
      this.seen = { checkGood: hasHabits, checkBad: hasHabits };
      this.persist();
    },
    markSeen(id: HintId) {
      this.seen[id] = true;
      this.persist();
    },
    persist() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.seen));
    },
  },
});
