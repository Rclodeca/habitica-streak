// Persistence schema and localStorage read/write helpers. Pure serialization
// concerns only — no game logic lives here.

import type { Boss, Character, Habit } from '../../game-engine';

// Bumped 4 -> 5: Habit gained a required `isBad` field (Bad Habit support).
// No migration in MVP — a v4 save simply mismatches and the player starts
// fresh, per the existing pattern below.
export const CURRENT_SCHEMA_VERSION = 5;
export const STORAGE_KEY = 'habitica-streak:save:v5';

export interface SaveStateV5 {
  schemaVersion: 5;
  character: Character;
  boss: Boss;
  habits: Habit[];
}

export function serializeSaveState(state: Omit<SaveStateV5, 'schemaVersion'>): string {
  return JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, ...state });
}

export function deserializeSaveState(raw: string): SaveStateV5 | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.schemaVersion !== CURRENT_SCHEMA_VERSION) return null; // no migration in MVP — start fresh on mismatch
    return parsed as SaveStateV5;
  } catch {
    return null;
  }
}

export function loadSaveState(): SaveStateV5 | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? deserializeSaveState(raw) : null;
}

export function writeSaveState(state: Omit<SaveStateV5, 'schemaVersion'>): void {
  localStorage.setItem(STORAGE_KEY, serializeSaveState(state));
}
