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

  const SAMPLE_RUN = {
    bossIndex: 5,
    level: 10,
    stats: { physicalDamage: 1, magicDamage: 2, healing: 3, health: 4, trueDamage: 5, expGain: 6, critChance: 0.1 },
    habits: [{ name: 'Run', period: 'daily' as const, damageType: 'physical' as const, isBad: false, streakCount: 3 }],
    items: [{ id: 'rusty-blade', name: 'Rusty Blade', icon: 'items/rusty-blade', equipped: true }],
  };

  it('ensureRunStarted only sets the start day once', () => {
    const store = useHighScoreStore();
    store.ensureRunStarted('2026-01-01');
    store.ensureRunStarted('2026-06-15'); // later call should be a no-op
    expect(store.currentRunStartedDayKey).toBe('2026-01-01');
  });

  it('recordRunEnd computes daysLived from the run-start day and starts the next run from the end day', () => {
    const store = useHighScoreStore();
    store.ensureRunStarted('2026-01-01');

    store.recordRunEnd({ ...SAMPLE_RUN, endedDayKey: '2026-01-05' });

    expect(store.topRuns).toHaveLength(1);
    expect(store.topRuns[0].startedDayKey).toBe('2026-01-01');
    expect(store.topRuns[0].endedDayKey).toBe('2026-01-05');
    expect(store.topRuns[0].daysLived).toBe(5); // inclusive of both the start and end day
    expect(store.currentRunStartedDayKey).toBe('2026-01-05'); // next run starts today
  });

  it('recordRunEnd persists the leaderboard and keeps only the top 10, ranked by boss index', () => {
    const store = useHighScoreStore();
    store.ensureRunStarted('2026-01-01');

    for (let i = 1; i <= 11; i++) {
      store.recordRunEnd({ ...SAMPLE_RUN, bossIndex: i, endedDayKey: '2026-01-02' });
    }

    expect(store.topRuns).toHaveLength(10);
    expect(store.topRuns[0].bossIndex).toBe(11); // highest first
    expect(store.topRuns.at(-1)?.bossIndex).toBe(2); // bossIndex 1 dropped off the bottom

    const persisted = JSON.parse(localStorage.getItem('habitica-streak:highscore:runs:v1') as string);
    expect(persisted).toHaveLength(10);
  });

  it('reloads topRuns and currentRunStartedDayKey from localStorage on a fresh store instance', () => {
    const store = useHighScoreStore();
    store.ensureRunStarted('2026-01-01');
    store.recordRunEnd({ ...SAMPLE_RUN, endedDayKey: '2026-01-03' });

    const reloaded = useHighScoreStore(createPinia());
    expect(reloaded.topRuns).toHaveLength(1);
    expect(reloaded.topRuns[0].bossIndex).toBe(SAMPLE_RUN.bossIndex);
    expect(reloaded.currentRunStartedDayKey).toBe('2026-01-03');
  });
});
