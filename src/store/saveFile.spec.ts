// @vitest-environment jsdom

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCharacter, createRng, generateBoss } from '../game-engine';
import { RUNS_KEY, STORAGE_KEY as HIGH_SCORE_KEY } from './highScoreStore';
import { initializeStores } from './index';
import { serializeSaveState, STORAGE_KEY as SAVE_KEY } from './plugins/saveState';
import { applySaveFile, buildSaveFile, readSaveFile, saveFileName } from './saveFile';
import { STORAGE_KEY as THEME_KEY } from './themeStore';

function storeRun(name: string, level: number, bossIndex: number) {
  const rng = createRng(1);
  const character = { ...createCharacter(rng), name, level };
  localStorage.setItem(SAVE_KEY, serializeSaveState({ character, boss: generateBoss(bossIndex, rng), habits: [] }));
}

describe('save file', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips the run, high scores and theme, and summarizes the run', () => {
    storeRun('Aldric', 34, 23);
    localStorage.setItem(HIGH_SCORE_KEY, '23');
    localStorage.setItem(THEME_KEY, 'minimalist');
    const text = buildSaveFile(new Date('2026-10-28T12:00:00Z'));

    const result = readSaveFile(text);
    expect(result?.summary).toEqual({ heroName: 'Aldric', level: 34, bossIndex: 23, exportedAt: '2026-10-28T12:00:00.000Z' });
    expect(result?.file.entries).toEqual({
      save: localStorage.getItem(SAVE_KEY),
      highScore: '23',
      theme: 'minimalist',
    });
  });

  it('rejects anything that is not a loadable save', () => {
    storeRun('Aldric', 34, 23);
    const good = JSON.parse(buildSaveFile());
    expect(readSaveFile('not json')).toBeNull();
    expect(readSaveFile(JSON.stringify({ ...good, app: 'habitica' }))).toBeNull();
    expect(readSaveFile(JSON.stringify({ ...good, format: 2 }))).toBeNull();
    expect(readSaveFile(JSON.stringify({ ...good, entries: { ...good.entries, extra: 'x' } }))).toBeNull();
    expect(readSaveFile(JSON.stringify({ ...good, entries: { theme: 'ashen' } }))).toBeNull();
    expect(readSaveFile(JSON.stringify({ ...good, entries: { save: '{"schemaVersion":4}' } }))).toBeNull();
  });

  it('replaces every stored entry, removing ones the file lacks', () => {
    storeRun('Aldric', 34, 23);
    const file = readSaveFile(buildSaveFile())!.file;
    storeRun('Brin', 2, 1);
    localStorage.setItem(RUNS_KEY, '[]');

    applySaveFile(file);
    expect(readSaveFile(buildSaveFile())?.summary.heroName).toBe('Aldric');
    expect(localStorage.getItem(RUNS_KEY)).toBeNull();
  });

  it('names the file by local date', () => {
    expect(saveFileName(new Date(2026, 9, 8))).toBe('streak-slayer-2026-10-08.json');
  });
});

describe('importing over a live run', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps a save write pending from before the import from landing on top of it', () => {
    storeRun('Aldric', 34, 23);
    const file = readSaveFile(buildSaveFile())!.file;
    localStorage.clear();

    const { characterStore } = initializeStores();
    characterStore.character.exp += 10; // schedules a debounced write of the live run
    applySaveFile(file);
    vi.advanceTimersByTime(300);

    expect(readSaveFile(buildSaveFile())?.summary.heroName).toBe('Aldric');
  });
});
