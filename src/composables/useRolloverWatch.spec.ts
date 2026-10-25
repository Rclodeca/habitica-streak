// @vitest-environment jsdom
//
// The rollover itself is covered in `useDailyRollover.spec.ts`; this covers
// only when it gets re-run while the app stays open past the 3am turnover.

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRng } from '../game-engine';
import { useBossStore } from '../store/bossStore';
import { useHabitStore } from '../store/habitStore';
import { useMissedSkillsGate } from './useMissedSkillsGate';
import { useRolloverWatch } from './useRolloverWatch';

const BEFORE_3AM_PDT = new Date('2026-10-25T09:50:00Z'); // 2:50am — still the 24th
const AFTER_3AM_PDT = new Date('2026-10-25T10:05:00Z'); // 3:05am — the 25th

describe('useRolloverWatch', () => {
  let stop: () => void;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.setSystemTime(BEFORE_3AM_PDT);
    useBossStore(); // bootstraps the boss slice used internally by miss resolution
    const habitStore = useHabitStore();
    const habit = habitStore.addHabit('Meditate', 'daily', 'medium', false, createRng());
    // Opened before 3am: stamped for the 24th, not done on it.
    habitStore.updateHabit({ ...habit, lastCheckedPeriodKey: '2026-10-24', lastCompletedPeriodKey: null });
    stop = useRolloverWatch(() => new Date());
  });

  afterEach(() => {
    stop();
    useMissedSkillsGate().acknowledge();
    vi.useRealTimers();
  });

  it('queues the miss when the clock passes 3am while the app stays open', () => {
    vi.setSystemTime(AFTER_3AM_PDT);
    vi.advanceTimersByTime(60_000);

    expect(useMissedSkillsGate().misses.value).toHaveLength(1);
  });

  it('queues the miss when the app comes back to the foreground after 3am', () => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    vi.setSystemTime(AFTER_3AM_PDT);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(useMissedSkillsGate().misses.value).toHaveLength(1);
  });

  it('does nothing before the turnover', () => {
    vi.advanceTimersByTime(5 * 60_000);

    expect(useMissedSkillsGate().misses.value).toHaveLength(0);
  });

  it('stops watching once stopped', () => {
    stop();
    vi.setSystemTime(AFTER_3AM_PDT);
    vi.advanceTimersByTime(60_000);

    expect(useMissedSkillsGate().misses.value).toHaveLength(0);
  });
});
