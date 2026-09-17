// Persistence schema and localStorage read/write helpers. Pure serialization
// concerns only — no game logic lives here.

import type { Boss, Character, Habit } from '../../game-engine';

// Bumped 2 -> 3: Character/Boss gained a required `critChance` field (crit
// chance + item rework). No migration in MVP — a v2 save simply mismatches
// and the player starts fresh, per the existing pattern below.
export const CURRENT_SCHEMA_VERSION = 3;
export const STORAGE_KEY = 'habitica-streak:save:v3';

export interface SaveStateV3 {
  schemaVersion: 3;
  character: Character;
  boss: Boss;
  habits: Habit[];
}

export function serializeSaveState(state: Omit<SaveStateV3, 'schemaVersion'>): string {
  return JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, ...state });
}

export function deserializeSaveState(raw: string): SaveStateV3 | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.schemaVersion !== CURRENT_SCHEMA_VERSION) return null; // no migration in MVP — start fresh on mismatch
    return parsed as SaveStateV3;
  } catch {
    return null;
  }
}

export function loadSaveState(): SaveStateV3 | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? deserializeSaveState(raw) : null;
}

export function writeSaveState(state: Omit<SaveStateV3, 'schemaVersion'>): void {
  localStorage.setItem(STORAGE_KEY, serializeSaveState(state));
}
