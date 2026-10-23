import { describe, expect, it } from 'vitest';
import { condenseLayout, FULL_LAYOUT } from './condenseLayout';
import type { CompactTargets } from './condenseLayout';

// A phone-width panel and a hero strip shaped like the real one.
const WIDTH = 334;
const NAME_WIDTH = 150;
const NAME_HEIGHT = 18;
const HP_HEIGHT = 8;
const HP_RISE = 16; // Ashen sets the HP numbers above the bar
const COMPACT: CompactTargets = {
  height: 80,
  portrait: { x: 15, y: 14, w: 52, h: 52 },
  name: { x: 78, y: 14, w: 240, h: 15 },
  hp: { x: 78, y: 46, w: 241, h: 7 },
  hpRise: HP_RISE,
  nameScale: 0.85,
  stats: { y: 60, h: 0 }, // too short for a row: the boss stats stay hidden
};
// Same strip, but tall enough (like the real two-bar hero strip) for two rows of stats.
const ROOMY: CompactTargets = { ...COMPACT, height: 150, stats: { y: 60, h: 32 } };
const STEPS = Array.from({ length: 81 }, (_, i) => i / 80);

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w - 0.5 && a.x + a.w > b.x + 0.5 && a.y < b.y + b.h - 0.5 && a.y + a.h > b.y + 0.5;

function rects(p: number) {
  const L = condenseLayout(p, WIDTH, NAME_WIDTH, COMPACT);
  return {
    L,
    name: { x: L.name.x, y: L.name.y, w: NAME_WIDTH * L.name.scale, h: NAME_HEIGHT * L.name.scale },
    // The bar with its numbers above it.
    hp: { x: L.hp.x, y: L.hp.y - HP_RISE, w: L.hp.w, h: HP_RISE + HP_HEIGHT },
    // How much of the panel is still on screen at this point of the collapse.
    visible: FULL_LAYOUT.height - (FULL_LAYOUT.height - COMPACT.height) * p,
  };
}

describe('condenseLayout', () => {
  it('starts as the full panel: wide stage, centered name, full-width HP bar', () => {
    const { L } = rects(0);
    expect(L.stage).toEqual({ x: 0, y: 0, w: WIDTH, h: FULL_LAYOUT.stageH });
    expect(L.sprite).toBe(FULL_LAYOUT.sprite);
    expect(L.name).toEqual({ x: (WIDTH - NAME_WIDTH) / 2, y: FULL_LAYOUT.stageH + FULL_LAYOUT.nameGap, scale: 1 });
    expect(L.hp.x).toBe(FULL_LAYOUT.pad);
    expect(L.hp.w).toBe(WIDTH - FULL_LAYOUT.pad * 2);
    expect(L.stats.opacity).toBe(1);
  });

  it('ends exactly on the hero strip layout', () => {
    const { L } = rects(1);
    expect(L.stage).toEqual(COMPACT.portrait);
    expect(L.name.x).toBeCloseTo(COMPACT.name.x, 6);
    expect(L.name.y).toBeCloseTo(COMPACT.name.y, 6);
    expect(L.name.scale).toBeCloseTo(COMPACT.nameScale, 6);
    expect(L.hp.x).toBeCloseTo(COMPACT.hp.x, 6);
    expect(L.hp.y).toBeCloseTo(COMPACT.hp.y, 6);
    expect(L.hp.w).toBeCloseTo(COMPACT.hp.w, 6);
    expect(L.stats.opacity).toBe(0);
  });

  it('shows the boss stats under the HP bar once condensed, clipped to the room there', () => {
    const early = condenseLayout(0.3, WIDTH, NAME_WIDTH, ROOMY).stats;
    expect(early.opacity).toBe(0);
    const L = condenseLayout(1, WIDTH, NAME_WIDTH, ROOMY);
    expect(L.stats.opacity).toBe(1);
    expect(L.stats.x).toBeCloseTo(ROOMY.hp.x, 6);
    expect(L.stats.y).toBeCloseTo(ROOMY.stats.y, 6);
    expect(L.stats.w).toBeCloseTo(ROOMY.hp.w, 6);
    expect(L.stats.h).toBe(ROOMY.stats.h);
    expect(L.stats.y + L.stats.h).toBeLessThanOrEqual(ROOMY.height);
  });

  it('never lets the name or HP bar cross the stage', () => {
    for (const p of STEPS) {
      const { L, name, hp } = rects(p);
      expect(overlaps(name, L.stage), `name at p=${p}`).toBe(false);
      expect(overlaps(hp, L.stage), `hp at p=${p}`).toBe(false);
    }
  });

  it('leaves the HP numbers room above the bar, clear of the name', () => {
    for (const p of STEPS) {
      const { name, hp } = rects(p);
      expect(overlaps(name, hp), `p=${p}`).toBe(false);
    }
  });

  it('keeps every piece inside the visible part of the frame', () => {
    for (const p of STEPS) {
      const { L, name, hp, visible } = rects(p);
      expect(L.stage.y + L.stage.h, `stage at p=${p}`).toBeLessThanOrEqual(visible);
      expect(name.y + name.h, `name at p=${p}`).toBeLessThanOrEqual(visible);
      expect(hp.y + hp.h, `hp at p=${p}`).toBeLessThanOrEqual(visible);
      expect(name.x + name.w, `name right edge at p=${p}`).toBeLessThanOrEqual(WIDTH);
      if (L.stats.opacity > 0) expect(L.stats.y + 20, `stats at p=${p}`).toBeLessThanOrEqual(visible);
    }
  });

  it('shrinks the boss steadily — never a sudden drop, always fitting the stage', () => {
    let previous: number = FULL_LAYOUT.sprite;
    for (const p of STEPS) {
      const { L } = rects(p);
      expect(L.sprite).toBeLessThanOrEqual(previous);
      expect(previous - L.sprite, `drop at p=${p}`).toBeLessThan(2);
      expect(L.sprite).toBeLessThanOrEqual(Math.min(L.stage.w, L.stage.h));
      previous = L.sprite;
    }
  });
});
