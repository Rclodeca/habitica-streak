import { afterEach, describe, expect, it, vi } from 'vitest';
import { holdHp, playHit, setHitPlayer, useHitFeed } from './useHitFeed';
import type { Hit } from './useHitFeed';

const strike: Hit = { kind: 'strike', by: 'hero', type: 'physical', amount: 96, crit: false, hp: -96, bossIndex: 1 };

describe('useHitFeed', () => {
  // Module-scope singleton by design — let go of any player and holds.
  afterEach(() => setHitPlayer(null));

  it('lands at once and holds nothing back with no stage showing', () => {
    const { shownHp } = useHitFeed();
    expect(playHit(strike)).toBe(0);
    expect(shownHp(1, 378, 620)).toBe(378);
  });

  it('hands each hit to the stage and passes back when it lands', () => {
    const player = vi.fn(() => 480);
    setHitPlayer(player);
    expect(playHit(strike)).toBe(480);
    expect(player).toHaveBeenCalledWith(strike);
  });

  it('shows the HP from before a held change until it is let go, once', () => {
    const { shownHp } = useHitFeed();
    setHitPlayer(() => 0);
    const release = holdHp(1, -96);
    expect(shownHp(1, 378, 620)).toBe(474);
    // Other fighters are untouched, the next boss included.
    expect(shownHp(2, 500, 620)).toBe(500);
    expect(shownHp('hero', 900, 1232)).toBe(900);
    release();
    release();
    expect(shownHp(1, 378, 620)).toBe(378);
  });

  it('keeps the shown HP within the bar', () => {
    const { shownHp } = useHitFeed();
    holdHp('hero', 50);
    expect(shownHp('hero', 30, 1232)).toBe(0);
    holdHp('hero', -500);
    expect(shownHp('hero', 1200, 1232)).toBe(1232);
  });

  it('lets go of everything when the stage goes, and an old release then does nothing', () => {
    const { shownHp } = useHitFeed();
    setHitPlayer(() => 0);
    const stale = holdHp(1, -96);
    setHitPlayer(null);
    expect(shownHp(1, 378, 620)).toBe(378);
    stale();
    expect(shownHp(1, 378, 620)).toBe(378);
  });
});
