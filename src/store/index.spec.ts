// @vitest-environment jsdom
//
// Store/persistence smoke test (task-5-brief.md step 7). This is the only
// test file in this task that needs a DOM `localStorage` — everything else
// in the project runs under the default `node` environment, so this file
// overrides it via the docblock above.

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bossBaseHealth, createCharacter, createHabit, createRng, generateBoss } from '../game-engine';
import { TUNING } from '../game-engine/constants/tuning';
import { initializeStores } from './index';
import { CURRENT_SCHEMA_VERSION, STORAGE_KEY } from './plugins/saveState';

describe('store persistence smoke test', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hydrates fresh state and debounce-writes SaveStateV5 to localStorage on any store mutation', () => {
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
    expect(parsed.schemaVersion).toBe(5);
    expect(parsed.character.exp).toBe(characterStore.character.exp);
    expect(parsed.boss).toBeDefined();
    expect(parsed.habits).toEqual([]);
    expect(parsed.quests).toEqual([]);
  });

  it('persists a one-time hydration migration (applyDamagePoolRebalance) without requiring a later, unrelated mutation', () => {
    // Regression test for a real bug caught while verifying the migration
    // live: setupPersistence used to be wired up AFTER initFromSave, so the
    // migration's own mutation was invisible to the debounced writer until
    // some later, unrelated mutation happened. A player who loaded the app
    // and closed the tab immediately would never persist the migration,
    // and it would silently re-apply (re-cutting the stats again) next load.
    const rng = createRng(1);
    const character = { ...createCharacter(rng), damagePoolRebalanceApplied: undefined };
    const preRebalanceSave = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      character,
      boss: generateBoss(1, rng),
      habits: [],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preRebalanceSave));

    initializeStores();

    // No further mutation performed here — just the hydration itself.
    vi.advanceTimersByTime(300);

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    const factor = 1 - TUNING.ONE_TIME_DAMAGE_POOL_REBALANCE_PCT / 100;
    expect(parsed.character.starterStats.physicalDamage).toBeCloseTo(character.starterStats.physicalDamage * factor, 10);
    expect(parsed.character.starterStats.trueDamage).toBe(character.starterStats.trueDamage); // exempt, unchanged
    expect(parsed.character.damagePoolRebalanceApplied).toBe(true);
  });

  it('applies the rank rebalance once, persisted, and never again on a reload', () => {
    const rng = createRng(1);
    const character = { ...createCharacter(rng), rankRebalanceApplied: undefined };
    const boss = generateBoss(24, rng);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, character, boss, habits: [] }));

    initializeStores();
    vi.advanceTimersByTime(300);

    const factor = bossBaseHealth(24) / (TUNING.BASE_BOSS_HEALTH * Math.pow(TUNING.LEGACY_BOSS_HEALTH_GROWTH_RATE, 23));
    const first = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    expect(first.character.starterStats.physicalDamage).toBeCloseTo(character.starterStats.physicalDamage * 0.6, 10);
    expect(first.character.starterStats.trueDamage).toBeCloseTo(character.starterStats.trueDamage * 0.6, 10);
    expect(first.character.rankRebalanceApplied).toBe(true);
    expect(first.boss.maxHealth).toBeCloseTo(boss.maxHealth * factor, 6);

    setActivePinia(createPinia());
    initializeStores();
    vi.advanceTimersByTime(300);

    const second = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    expect(second.character.starterStats.physicalDamage).toBeCloseTo(first.character.starterStats.physicalDamage, 10);
    expect(second.boss.maxHealth).toBeCloseTo(first.boss.maxHealth, 6);
  });

  it('persists the quest and expGain-removal migrations on hydration, without a later mutation', () => {
    const rng = createRng(1);
    const base = createCharacter(rng);
    const character = {
      ...base,
      expGainRebalanceApplied: true,
      sideOnlyItemIds: ['godslayer-greatblade'],
      starterStats: { ...base.starterStats, expGain: 11 },
    };
    const oldQuest = { id: 'q', description: 'Old', difficulty: 'easy', dueDateKey: '2099-01-01', bossIndexAtOffer: 3 };
    const legacyHabit = { ...createHabit('Study', 'daily', 'medium', false, createRng(2)), damageType: 'expGain' };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, character, boss: generateBoss(1, rng), habits: [legacyHabit], quests: [oldQuest] }),
    );

    initializeStores();
    vi.advanceTimersByTime(300);

    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    expect('expGain' in parsed.character.starterStats).toBe(false);
    expect('expGainRebalanceApplied' in parsed.character).toBe(false);
    expect(parsed.habits).toHaveLength(1);
    expect(['physical', 'magic', 'healing', 'trueDamage']).toContain(parsed.habits[0].damageType);
    expect(parsed.habits[0].id).toBe(legacyHabit.id);
    expect('sideOnlyItemIds' in parsed.character).toBe(false);
    expect(parsed.quests).toEqual([{ id: 'q', kind: 'regular', description: 'Old', difficulty: 'easy', dueDateKey: '2099-01-01' }]);

    // Reloading keeps the migrated habit type (it is not re-rolled again).
    const migratedType = parsed.habits[0].damageType;
    setActivePinia(createPinia());
    const second = initializeStores();
    expect(second.habitStore.habits[0].damageType).toBe(migratedType);
    expect('expGain' in second.characterStore.character.starterStats).toBe(false);
  });

  it('seeds takenEventIds on a save that predates events, so slots/Special/Ult are not lost or re-offered', () => {
    const rng = createRng(1);
    const staleSave = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      character: { ...createCharacter(rng), level: 10, takenEventIds: undefined, pendingEventPicks: undefined },
      boss: generateBoss(1, rng),
      habits: [{ id: 'a', name: 'A', period: 'daily', difficulty: 'easy', damageType: 'physical', isBad: false, isSpecial: true, streakCount: 0, lastCompletedPeriodKey: null, lastCheckedPeriodKey: null }],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(staleSave));

    const { characterStore } = initializeStores();

    expect(characterStore.character.takenEventIds?.sort()).toEqual(['item-slots', 'special']);
    expect(characterStore.character.pendingEventPicks).toBe(0);
  });

  it('does not accumulate duplicate $subscribe listeners when initializeStores() is called again against the same active pinia', () => {
    const first = initializeStores();
    const second = initializeStores(); // same active pinia — setupPersistence should be a no-op the 2nd time
    expect(second.characterStore).toBe(first.characterStore); // same store instance, confirming same pinia

    // Installed only now (not around the initializeStores() calls above) —
    // those calls make their own one-time setItem writes (e.g.
    // highScoreStore.ensureRunStarted's first-run stamp), which aren't what
    // this test is checking. This spy isolates just the mutation below.
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    first.characterStore.character.exp += 5;
    vi.advanceTimersByTime(300);

    // If persistence had been wired twice, this single mutation would have
    // scheduled two independent debounce timers and produced two writes.
    expect(setItemSpy).toHaveBeenCalledTimes(1);

    setItemSpy.mockRestore();
  });
});
