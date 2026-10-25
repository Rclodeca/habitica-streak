import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRng, generateBoss } from '../game-engine';
import type { Boss } from '../game-engine';
import { useCelebration } from './useCelebration';

function bosses(): { slain: Boss; next: Boss } {
  const rng = createRng(7);
  return { slain: { ...generateBoss(1, rng), health: 0 }, next: generateBoss(2, rng) };
}

describe('useCelebration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  // Module-scope singleton by design — reset it so one test's beats can't
  // leak into the next.
  afterEach(() => {
    useCelebration().clear();
    vi.useRealTimers();
  });

  it('shows the slain boss while it dies, then the next one as it arrives, then hands back to the store', () => {
    const { slain, next } = bosses();
    const { phase, displayedBoss, celebrating, celebrateBossKill } = useCelebration();

    celebrateBossKill(slain, next);
    expect(phase.value).toBe('struck');
    expect(displayedBoss.value).toEqual(slain);
    expect(celebrating.value).toBe(true);

    vi.runOnlyPendingTimers();
    expect(phase.value).toBe('dying');
    expect(displayedBoss.value).toEqual(slain);

    vi.runOnlyPendingTimers();
    expect(phase.value).toBe('arriving');
    expect(displayedBoss.value).toEqual(next);

    vi.runOnlyPendingTimers();
    expect(phase.value).toBe('idle');
    expect(displayedBoss.value).toBeNull();
    expect(celebrating.value).toBe(false);
  });

  it('keeps the boss struck until the killing blow lands on the stage', () => {
    const { slain, next } = bosses();
    const { phase, celebrateBossKill } = useCelebration();

    // A bolt still 480ms out when the kill resolves.
    celebrateBossKill(slain, next, 480);
    vi.advanceTimersByTime(450);
    expect(phase.value).toBe('struck');
    vi.advanceTimersByTime(479);
    expect(phase.value).toBe('struck');
    vi.advanceTimersByTime(1);
    expect(phase.value).toBe('dying');
  });

  it('holds the old level until the level beat plays', async () => {
    const { phase, heldLevel, celebrating, celebrateLevelUp } = useCelebration();

    celebrateLevelUp(4);
    expect(heldLevel.value).toBe(4);
    expect(celebrating.value).toBe(true);

    await Promise.resolve();
    expect(phase.value).toBe('leveling');
    expect(heldLevel.value).toBeNull();

    vi.runOnlyPendingTimers();
    expect(phase.value).toBe('idle');
    expect(celebrating.value).toBe(false);
  });

  it('plays a kill before a level-up queued ahead of it in the same action', async () => {
    const { slain, next } = bosses();
    const { phase, heldLevel, celebrateBossKill, celebrateLevelUp } = useCelebration();

    celebrateLevelUp(4); // e.g. a streak milestone's EXP, resolved before the kill
    celebrateBossKill(slain, next);
    await Promise.resolve();
    expect(phase.value).toBe('struck');
    expect(heldLevel.value).toBe(4);

    vi.runOnlyPendingTimers(); // dying
    vi.runOnlyPendingTimers(); // arriving
    vi.runOnlyPendingTimers();
    expect(phase.value).toBe('leveling');
    expect(heldLevel.value).toBeNull();
  });

  it('merges level-ups queued before the beat plays into one, held at the lowest level', () => {
    const { slain, next } = bosses();
    const { heldLevel, celebrateBossKill, celebrateLevelUp } = useCelebration();

    celebrateBossKill(slain, next);
    celebrateLevelUp(4);
    celebrateLevelUp(5);
    expect(heldLevel.value).toBe(4);
  });

  it('clear drops every queued beat at once', () => {
    const { slain, next } = bosses();
    const { phase, displayedBoss, heldLevel, celebrating, celebrateBossKill, celebrateLevelUp, clear } = useCelebration();

    celebrateBossKill(slain, next);
    celebrateLevelUp(4);
    clear();

    expect(phase.value).toBe('idle');
    expect(displayedBoss.value).toBeNull();
    expect(heldLevel.value).toBeNull();
    expect(celebrating.value).toBe(false);
    vi.runAllTimers();
    expect(phase.value).toBe('idle');
  });
});
