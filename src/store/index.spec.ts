// @vitest-environment jsdom
//
// Store/persistence smoke test (task-5-brief.md step 7). This is the only
// test file in this task that needs a DOM `localStorage` — everything else
// in the project runs under the default `node` environment, so this file
// overrides it via the docblock above.

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeStores } from './index';
import { STORAGE_KEY } from './plugins/saveState';

describe('store persistence smoke test', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hydrates fresh state and debounce-writes SaveStateV1 to localStorage on any store mutation', () => {
    const { characterStore } = initializeStores();

    // Fresh bootstrap, no save yet — nothing written until a mutation happens.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    characterStore.character.exp += 10;

    // Debounced — not written synchronously.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    vi.advanceTimersByTime(300);

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw as string);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.character.exp).toBe(characterStore.character.exp);
    expect(parsed.boss).toBeDefined();
    expect(parsed.habits).toEqual([]);
    expect(parsed.meta.lastRolloverCheckedAt).toBeTypeOf('string');
  });
});
