// Persistence schema and localStorage read/write helpers. Pure serialization
// concerns only — no game logic lives here.

import type { Boss, Character, Habit } from '../../game-engine';

export const CURRENT_SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'habitica-streak:save:v1';

export interface SaveStateV1 {
  schemaVersion: 1;
  character: Character;
  boss: Boss;
  habits: Habit[];
}

export function serializeSaveState(state: Omit<SaveStateV1, 'schemaVersion'>): string {
  return JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, ...state });
}

export function deserializeSaveState(raw: string): SaveStateV1 | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.schemaVersion !== CURRENT_SCHEMA_VERSION) return null; // no migration in MVP — start fresh on mismatch
    return parsed as SaveStateV1;
  } catch {
    return null;
  }
}

export function loadSaveState(): SaveStateV1 | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? deserializeSaveState(raw) : null;
}

export function writeSaveState(state: Omit<SaveStateV1, 'schemaVersion'>): void {
  localStorage.setItem(STORAGE_KEY, serializeSaveState(state));
}
