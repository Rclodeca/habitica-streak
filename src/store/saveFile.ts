// Export/import of everything the app keeps in localStorage — the run, the
// high scores and the theme — as one JSON file, so a run can be backed up or
// moved to another install (an iPhone home-screen app has its own storage,
// apart from Safari's). Entries are stored by name rather than by storage
// key, so a file still imports after a key rename. Storage only: the share
// sheet and file picker live in composables/useSaveFileTransfer.

import { RUN_START_KEY, RUNS_KEY, STORAGE_KEY as HIGH_SCORE_KEY } from './highScoreStore';
import { suspendPersistence } from './plugins/localStoragePersistence';
import { deserializeSaveState, STORAGE_KEY as SAVE_KEY } from './plugins/saveState';
import { STORAGE_KEY as THEME_KEY } from './themeStore';

const APP_ID = 'streak-slayer';
const FORMAT = 1;

const ENTRY_KEYS = {
  save: SAVE_KEY,
  highScore: HIGH_SCORE_KEY,
  runs: RUNS_KEY,
  runStart: RUN_START_KEY,
  theme: THEME_KEY,
} as const;
type EntryName = keyof typeof ENTRY_KEYS;
const ENTRY_NAMES = Object.keys(ENTRY_KEYS) as EntryName[];

export interface SaveFile {
  app: typeof APP_ID;
  format: number;
  exportedAt: string; // ISO timestamp
  entries: Partial<Record<EntryName, string>>; // raw stored values; a missing entry wasn't stored
}

/** What the import confirm shows, so the player can tell they picked the right file. */
export interface SaveFileSummary {
  heroName?: string;
  level: number;
  bossIndex: number;
  exportedAt: string;
}

export function buildSaveFile(now: Date = new Date()): string {
  const entries: SaveFile['entries'] = {};
  for (const name of ENTRY_NAMES) {
    const value = localStorage.getItem(ENTRY_KEYS[name]);
    if (value !== null) entries[name] = value;
  }
  const file: SaveFile = { app: APP_ID, format: FORMAT, exportedAt: now.toISOString(), entries };
  return JSON.stringify(file);
}

/** e.g. `streak-slayer-2026-10-28.json`, dated in local time. */
export function saveFileName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${APP_ID}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/**
 * Parses an exported file. Null for anything this version can't load: not
 * JSON, another app's file, a newer format, or no run this version can read
 * (importing that would just start a fresh run).
 */
export function readSaveFile(text: string): { file: SaveFile; summary: SaveFileSummary } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isSaveFile(parsed)) return null;
  const save = parsed.entries.save ? deserializeSaveState(parsed.entries.save) : null;
  if (!save) return null;
  return {
    file: parsed,
    summary: {
      heroName: save.character.name,
      level: save.character.level,
      bossIndex: save.boss.index,
      exportedAt: parsed.exportedAt,
    },
  };
}

function isSaveFile(value: unknown): value is SaveFile {
  if (typeof value !== 'object' || value === null) return false;
  const file = value as Record<string, unknown>;
  if (file.app !== APP_ID || file.format !== FORMAT || typeof file.exportedAt !== 'string') return false;
  if (typeof file.entries !== 'object' || file.entries === null) return false;
  return Object.entries(file.entries).every(([name, entry]) => name in ENTRY_KEYS && typeof entry === 'string');
}

/**
 * Replaces every stored entry with the file's, removing any the file lacks.
 * The live stores still hold the old run, so the caller reloads the app
 * straight after; save writes stay suspended until then.
 */
export function applySaveFile(file: SaveFile): void {
  suspendPersistence();
  for (const name of ENTRY_NAMES) {
    const value = file.entries[name];
    if (value === undefined) localStorage.removeItem(ENTRY_KEYS[name]);
    else localStorage.setItem(ENTRY_KEYS[name], value);
  }
}
