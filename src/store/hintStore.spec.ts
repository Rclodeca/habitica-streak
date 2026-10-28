// @vitest-environment jsdom
//
// Needs a real localStorage, matching the convention used by
// `store/themeStore.spec.ts`.

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEY, useHintStore } from './hintStore';

describe('hintStore', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('a brand-new player starts with every hint unseen, and that sticks', () => {
    useHintStore().settle(false);
    expect(useHintStore().seen).toEqual({ checkGood: false, checkBad: false });

    // Reloading once they've added habits doesn't count them as an old player.
    setActivePinia(createPinia());
    useHintStore().settle(true);
    expect(useHintStore().seen).toEqual({ checkGood: false, checkBad: false });
  });

  it('a player who had habits before hints existed never sees them', () => {
    useHintStore().settle(true);
    expect(useHintStore().seen).toEqual({ checkGood: true, checkBad: true });
  });

  it('markSeen persists', () => {
    useHintStore().settle(false);
    useHintStore().markSeen('checkBad');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ checkGood: false, checkBad: true });
  });
});
