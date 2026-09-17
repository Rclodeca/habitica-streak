// @vitest-environment jsdom
//
// Needs a real localStorage, matching the convention used by
// `store/index.spec.ts` for the same reason.

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useHighScoreStore } from './highScoreStore';

describe('highScoreStore', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('starts at 1 with no prior save', () => {
    const store = useHighScoreStore();
    expect(store.highestBossIndex).toBe(1);
  });

  it('records a new record and persists it', () => {
    const store = useHighScoreStore();
    store.recordBossIndex(5);
    expect(store.highestBossIndex).toBe(5);
    expect(localStorage.getItem('habitica-streak:highscore:v1')).toBe('5');
  });

  it('ignores an index that does not beat the current record', () => {
    const store = useHighScoreStore();
    store.recordBossIndex(5);
    store.recordBossIndex(3); // e.g. after a death resets boss.index back to 1..N
    expect(store.highestBossIndex).toBe(5);
  });

  it('loads a previously persisted record on a fresh store instance', () => {
    localStorage.setItem('habitica-streak:highscore:v1', '7');
    const store = useHighScoreStore();
    expect(store.highestBossIndex).toBe(7);
  });

  it('falls back to 1 for corrupt/non-numeric persisted data', () => {
    localStorage.setItem('habitica-streak:highscore:v1', 'not-a-number');
    const store = useHighScoreStore();
    expect(store.highestBossIndex).toBe(1);
  });
});
