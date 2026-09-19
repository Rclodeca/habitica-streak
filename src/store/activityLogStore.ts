// Thin Pinia store tracking the last 10 combat/leveling events for display in
// `ActivityLog.vue`. Purely a UI-facing record of what already happened — no
// game logic lives here; entries are written by `useCombatActions` right
// after each engine call resolves.

import { defineStore } from 'pinia';

export type ActivityLogEntry =
  | { id: string; kind: 'skill-damage'; habitName: string; amount: number }
  | { id: string; kind: 'heal'; habitName: string; amount: number }
  | { id: string; kind: 'hit'; habitName: string; amount: number }
  | {
      id: string;
      kind: 'level-up';
      newLevel: number;
      statDeltas: { physicalDamage: number; magicDamage: number; healing: number; health: number };
    }
  | { id: string; kind: 'crit'; by: 'player' | 'boss' }
  | { id: string; kind: 'lifesteal'; amount: number; healedWho: 'player' | 'boss' }
  | { id: string; kind: 'reflect'; amount: number }
  | { id: string; kind: 'boss-defeated'; bossIndex: number };

// Plain `Omit<ActivityLogEntry, 'id'>` collapses the discriminated union
// down to its common properties (losing the per-`kind` fields) since `Omit`
// doesn't distribute over unions on its own — this variant re-distributes
// it member-by-member so `addEntry`'s parameter still discriminates on `kind`.
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

const MAX_ENTRIES = 10;

export const useActivityLogStore = defineStore('activityLog', {
  state: () => ({
    entries: [] as ActivityLogEntry[],
  }),
  actions: {
    /** Hydrates from a save slice, or starts empty if there isn't one. */
    initFromSave(saved: ActivityLogEntry[] | null) {
      this.entries = saved ?? [];
    },

    /** Prepends a new entry (newest-first) and caps the list at the most recent 10. */
    addEntry(entry: DistributiveOmit<ActivityLogEntry, 'id'>) {
      const withId = { ...entry, id: crypto.randomUUID() } as ActivityLogEntry;
      this.entries = [withId, ...this.entries].slice(0, MAX_ENTRIES);
    },
  },
});
