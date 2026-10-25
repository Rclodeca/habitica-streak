// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setHitPlayer, useHitFeed } from '../../composables/useHitFeed';
import type { Hit, StrikeType } from '../../composables/useHitFeed';
import {
  BOSS_STEAL_MS,
  createHitPlayer,
  HEAL_MS,
  HIT_GAP_MS,
  IMPACT_MS,
  REFLECT_MS,
  STEAL_AFTER_REFLECT_MS,
  STEAL_ALONE_MS,
  STEAL_FLIGHT_MS,
} from './hitFx';
import type { StageParts } from './hitFx';

const BOSS = 3;
const strike = (type: StrikeType, more: Partial<Extract<Hit, { kind: 'strike' }>> = {}): Hit => ({
  kind: 'strike', by: 'hero', type, amount: 96, crit: false, hp: -96, bossIndex: BOSS, ...more,
});

function stage(): StageParts {
  document.body.innerHTML = `<div class="stage-inner">
    <div class="boss-figure"><img class="sprite" /></div>
    <div class="hero-figure"><div class="player-sprite"></div></div>
    <div class="fx-layer"></div>
  </div>`;
  const q = (sel: string) => document.querySelector<HTMLElement>(sel)!;
  return {
    layer: q('.fx-layer'),
    stage: q('.stage-inner'),
    fighter: (who) => (who === 'boss' ? { figure: q('.boss-figure'), body: q('.sprite') } : { figure: q('.hero-figure'), body: q('.player-sprite') }),
  };
}

describe('createHitPlayer', () => {
  const { shownHp } = useHitFeed();
  // The store already has the hit; the stage shows these until it lands.
  const bossShown = () => shownHp(BOSS, 378, 620);
  const heroShown = () => shownHp('hero', 904, 1232);

  beforeEach(() => {
    vi.useFakeTimers();
    setHitPlayer(() => 0);
  });

  afterEach(() => {
    setHitPlayer(null);
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it.each(['physical', 'magic', 'trueDamage'] as const)('holds the boss HP until a %s blow lands, and says when', async (type) => {
    const play = createHitPlayer(stage());
    expect(play(strike(type))).toBe(IMPACT_MS[type]);
    await vi.advanceTimersByTimeAsync(IMPACT_MS[type] - 1);
    expect(bossShown()).toBe(474);
    await vi.advanceTimersByTimeAsync(1);
    expect(bossShown()).toBe(378);
  });

  it('lands a magic bolt after its cast and flight, a true-damage beam well before it', () => {
    expect(IMPACT_MS.magic).toBeGreaterThan(IMPACT_MS.trueDamage);
    expect(IMPACT_MS.trueDamage).toBeGreaterThan(IMPACT_MS.physical);
  });

  it('turns a reflect back on the hero first, then the stolen life arrives', async () => {
    const play = createHitPlayer(stage());
    // Before the hit: 900. The store has the net: −10 reflected, +14 stolen.
    play(strike('physical', { reflect: { amount: 10, hp: -10 }, lifesteal: { amount: 14, hp: 14 } }));
    const reflectLands = IMPACT_MS.physical + REFLECT_MS;
    const stealLands = IMPACT_MS.physical + STEAL_AFTER_REFLECT_MS + STEAL_FLIGHT_MS;

    await vi.advanceTimersByTimeAsync(reflectLands - 1);
    expect(heroShown()).toBe(900);
    await vi.advanceTimersByTimeAsync(1);
    expect(heroShown()).toBe(890);
    await vi.advanceTimersByTimeAsync(stealLands - reflectLands - 1);
    expect(heroShown()).toBe(890);
    await vi.advanceTimersByTimeAsync(1);
    expect(heroShown()).toBe(904);
  });

  it('sends stolen life sooner when nothing is reflected', async () => {
    const play = createHitPlayer(stage());
    play(strike('magic', { lifesteal: { amount: 4, hp: 4 } }));
    await vi.advanceTimersByTimeAsync(IMPACT_MS.magic + STEAL_ALONE_MS + STEAL_FLIGHT_MS - 1);
    expect(heroShown()).toBe(900);
    await vi.advanceTimersByTimeAsync(1);
    expect(heroShown()).toBe(904);
  });

  it("lets the boss's blow land on the hero, then the boss heal off it", async () => {
    const play = createHitPlayer(stage());
    play(strike('physical', { by: 'boss', amount: 63, hp: -63, lifesteal: { amount: 9, hp: 9 } }));
    await vi.advanceTimersByTimeAsync(IMPACT_MS.physical);
    expect(shownHp('hero', 837, 1232)).toBe(837);
    expect(bossShown()).toBe(369);
    await vi.advanceTimersByTimeAsync(BOSS_STEAL_MS + STEAL_FLIGHT_MS);
    expect(bossShown()).toBe(378);
  });

  it('lands a heal after its motes rise, and a quest miss at once', async () => {
    const play = createHitPlayer(stage());
    expect(play({ kind: 'heal', amount: 41, hp: 41 })).toBe(HEAL_MS);
    await vi.advanceTimersByTimeAsync(HEAL_MS - 1);
    expect(shownHp('hero', 941, 1232)).toBe(900);
    await vi.advanceTimersByTimeAsync(1);
    expect(shownHp('hero', 941, 1232)).toBe(941);

    vi.advanceTimersByTime(HIT_GAP_MS);
    expect(play({ kind: 'hurt', amount: 30, hp: -30 })).toBe(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(shownHp('hero', 911, 1232)).toBe(911);
  });

  it('plays back-to-back hits one after another', async () => {
    const play = createHitPlayer(stage());
    expect(play(strike('physical'))).toBe(IMPACT_MS.physical);
    expect(play(strike('physical', { amount: 50, hp: -50 }))).toBe(HIT_GAP_MS + IMPACT_MS.physical);
    await vi.advanceTimersByTimeAsync(HIT_GAP_MS + IMPACT_MS.physical - 1);
    expect(shownHp(BOSS, 328, 620)).toBe(378);
    await vi.advanceTimersByTimeAsync(1);
    expect(shownHp(BOSS, 328, 620)).toBe(328);
  });

  it('lands everything at once under reduced motion', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const play = createHitPlayer(stage());
    expect(play(strike('magic', { reflect: { amount: 10, hp: -10 }, lifesteal: { amount: 14, hp: 14 } }))).toBe(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(bossShown()).toBe(378);
    expect(heroShown()).toBe(904);
  });

  it('still lets go of the HP when the stage is gone', async () => {
    const parts = stage();
    const play = createHitPlayer({ ...parts, fighter: () => null });
    parts.layer.remove();
    play(strike('trueDamage', { reflect: { amount: 10, hp: -10 } }));
    await vi.advanceTimersByTimeAsync(1000);
    expect(bossShown()).toBe(378);
    expect(shownHp('hero', 890, 1232)).toBe(890);
  });

  describe('numbers', () => {
    beforeEach(() => {
      // jsdom has no Element.animate; the pieces only need it to exist.
      Element.prototype.animate = vi.fn(() => ({ onfinish: null }) as unknown as Animation);
    });

    afterEach(() => {
      delete (Element.prototype as Partial<Element>).animate;
    });

    const numbers = (parts: StageParts) => Array.from(parts.layer.querySelectorAll('.fx-pop')).map((el) => [el.textContent, el.className]);

    it('shows the hero blow bare, a crit with "!", in its damage colour', async () => {
      const parts = stage();
      const play = createHitPlayer(parts);
      play(strike('magic', { amount: 192.4, crit: true }));
      await vi.advanceTimersByTimeAsync(IMPACT_MS.magic);
      expect(numbers(parts)).toEqual([['192!', 'fx-pop crit']]);
      expect((parts.layer.querySelector('.fx-pop') as HTMLElement).style.getPropertyValue('--c')).toBe('var(--dmg-magic)');
    });

    it("carries a minus on the boss's blow, small steel and green numbers for reflect and lifesteal", async () => {
      const parts = stage();
      const play = createHitPlayer(parts);
      play(strike('physical', { by: 'boss', amount: 63, hp: -63 }));
      vi.advanceTimersByTime(HIT_GAP_MS);
      play(strike('physical', { reflect: { amount: 9.6, hp: -10 }, lifesteal: { amount: 14, hp: 14 } }));
      await vi.advanceTimersByTimeAsync(2000);
      expect(numbers(parts)).toEqual([
        ['−63', 'fx-pop'],
        ['96', 'fx-pop'],
        ['−10', 'fx-pop small'],
        ['+14', 'fx-pop small'],
      ]);
      const colours = Array.from(parts.layer.querySelectorAll<HTMLElement>('.fx-pop')).map((el) => el.style.getPropertyValue('--c'));
      expect(colours.slice(2)).toEqual(['var(--fx-reflect)', 'var(--dmg-healing)']);
    });

    it('skips a number that rounds to nothing', async () => {
      const parts = stage();
      createHitPlayer(parts)({ kind: 'heal', amount: 0.2, hp: 0.2 });
      await vi.advanceTimersByTimeAsync(HEAL_MS);
      expect(numbers(parts)).toEqual([]);
    });
  });
});
