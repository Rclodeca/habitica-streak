// Thin Pinia store tracking the last 10 combat/leveling events for display in
// `ActivityLog.vue`. Purely a UI-facing record of what already happened — no
// game logic lives here; entries are written by `useCombatActions` right
// after each engine call resolves.

import { defineStore } from 'pinia';
import type { BossSkillId, BossStat } from '../game-engine';

export type ActivityLogEntry =
  // isTrueDamage is set only for a 'trueDamage'-type habit, so ActivityLog
  // can render it in its own color — see HabitListItem's damageTypeColor
  // for the same physical/magic/healing/trueDamage color scheme.
  // milestoneExp is the streak-milestone EXP bonus granted alongside this
  // action (see useCombatActions/applyReward) — undefined/0 when none fired.
  // crit/lifesteal/reflected ride on the blow's own entry and render as chips
  // under it; lifesteal is what the hero healed, reflected what bounced back.
  | { id: string; kind: 'skill-damage'; habitName: string; amount: number; isTrueDamage?: boolean; milestoneExp?: number; crit?: boolean; lifesteal?: number; reflected?: number }
  | { id: string; kind: 'heal'; habitName: string; amount: number; milestoneExp?: number }
  // crit/lifesteal here are the boss's: its crit, and what it healed off the blow.
  | { id: string; kind: 'hit'; habitName: string; amount: number; attackType: 'physical' | 'magic'; crit?: boolean; lifesteal?: number }
  | {
      id: string;
      kind: 'level-up';
      newLevel: number;
      healthRestored: number;
      statDeltas: {
        physicalDamage: number;
        magicDamage: number;
        healing: number;
        health: number;
        trueDamage: number;
      };
    }
  // Legacy: crit/lifesteal/reflect are now folded into their blow's entry;
  // these kinds stay only so entries in older saves still render.
  | { id: string; kind: 'crit'; by: 'player' | 'boss' }
  | { id: string; kind: 'lifesteal'; amount: number; healedWho: 'player' | 'boss' }
  | { id: string; kind: 'reflect'; amount: number }
  | { id: string; kind: 'boss-defeated'; bossIndex: number; amount?: number }
  | { id: string; kind: 'special-assigned'; habitName: string }
  | { id: string; kind: 'ult-assigned'; habitName: string }
  | { id: string; kind: 'overdrive-granted'; habitName: string }
  | { id: string; kind: 'rank-up'; habitName: string; rank: number }
  | { id: string; kind: 'item-slots-gained'; slots?: number } // slots: the new cap; undefined on entries logged before 8 slots existed (they meant 6)
  | { id: string; kind: 'event-heal'; amount: number }
  | { id: string; kind: 'item-heal'; itemName: string; amount: number }
  | { id: string; kind: 'heal-boost-gained'; days: number }
  | { id: string; kind: 'item-doubled'; itemName: string }
  | { id: string; kind: 'crit-boost-gained'; days: number }
  | { id: string; kind: 'skill-rerolled'; habitName: string; damageType: string }
  | { id: string; kind: 'wounds-applied'; durationDays: number; effectRate: number }
  | { id: string; kind: 'quest-completed'; description: string; amount: number; itemName?: string }
  | { id: string; kind: 'quest-failed'; description: string; amount: number }
  | { id: string; kind: 'doom-landed'; amount: number }
  // A boss skill a blow made fire (a landed Wounds logs 'wounds-applied' instead); amount is HP taken or, for Mend, healed; pct is the share of HP a Doom will take; stat is the one an Empower doubled.
  | { id: string; kind: 'boss-skill'; skill: BossSkillId; outcome: 'landed' | 'failed' | 'resisted'; amount?: number; pct?: number; stat?: BossStat };

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
      // Drops entries from the removed expGain skill type.
      this.entries = (saved ?? []).filter((entry) => (entry.kind as string) !== 'exp-skill');
    },

    /** Prepends a new entry (newest-first) and caps the list at the most recent 10. */
    addEntry(entry: DistributiveOmit<ActivityLogEntry, 'id'>) {
      const withId = { ...entry, id: crypto.randomUUID() } as ActivityLogEntry;
      this.entries = [withId, ...this.entries].slice(0, MAX_ENTRIES);
    },
  },
});
