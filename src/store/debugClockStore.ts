// Testing-only clock override. All gameplay code that needs "now" for
// period-key math reads it from this store instead of calling `new Date()`
// directly, so a "skip to next day" debug control can move the app's
// effective clock forward without waiting on the real wall clock. Not
// wired into persistence — the offset is session-only and resets on reload.

import { defineStore } from 'pinia';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const useDebugClockStore = defineStore('debugClock', {
  state: () => ({ offsetMs: 0 }),
  actions: {
    /** The app's current effective time: real wall-clock time plus any debug offset. */
    now(): Date {
      return new Date(Date.now() + this.offsetMs);
    },

    /** Advances the effective clock by exactly one day. */
    skipToNextDay() {
      this.offsetMs += MS_PER_DAY;
    },
  },
});
