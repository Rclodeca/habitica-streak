// Persistence schema and localStorage read/write helpers. Pure serialization
// concerns only — no game logic lives here.

import type { Boss, Character, Habit } from '../../game-engine';

// Bumped 3 -> 4: Boss gained required `reflectPct`/`lifestealPct` fields
// (boss reflect/lifesteal rework) plus new personality variants. No
// migration in MVP — a v3 save simply mismatches and the player starts
// fresh, per the existing pattern below.
export const CURRENT_SCHEMA_VERSION = 4;
export const STORAGE_KEY = 'habitica-streak:save:v4';

export interface SaveStateV4 {
  schemaVersion: 4;
  character: Character;
  boss: Boss;
  habits: Habit[];
}

export function serializeSaveState(state: Omit<SaveStateV4, 'schemaVersion'>): string {
  return JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, ...state });
}

export function deserializeSaveState(raw: string): SaveStateV4 | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.schemaVersion !== CURRENT_SCHEMA_VERSION) return null; // no migration in MVP — start fresh on mismatch
    return parsed as SaveStateV4;
  } catch {
    return null;
  }
}

export function loadSaveState(): SaveStateV4 | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? deserializeSaveState(raw) : null;
}

export function writeSaveState(state: Omit<SaveStateV4, 'schemaVersion'>): void {
  localStorage.setItem(STORAGE_KEY, serializeSaveState(state));
}
