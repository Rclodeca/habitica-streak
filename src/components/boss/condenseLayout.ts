// Where each piece of the boss panel sits while it condenses on phones (see
// useCondensingBoss). Pure geometry, so the choreography is testable.
// Positions are px from the top of the panel's *visible* part, where the bar
// they sit on stays pinned while the panel scrolls up.
//
// The stage (the boss scene) shrinks in height evenly over the whole collapse,
// so the boss shrinks steadily, and narrows until it's square by SPLIT, then
// stays square down to the hero strip's portrait. Until SPLIT the name and HP
// bar sit under the stage, sliding toward the spot where they'll rise; after,
// they rise beside the stage, tracking its right edge — so text never crosses
// the stage and never leaves the frame. Mocked up and frame-audited in
// docs/mockups/boss-condense.html.

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The hero strip's geometry, which the fully condensed boss bar copies. */
export interface CompactTargets {
  height: number;
  portrait: Box;
  name: Box;
  hp: Box;
  /**
   * How far the theme sets the HP numbers above the bar (0 when they sit in
   * or under it); the full panel leaves them the same room under the name.
   */
  hpRise: number;
  /** Hero name font size over boss name font size. */
  nameScale: number;
  /**
   * The empty strip under the HP bar and its numbers where the boss's stat
   * line sits once condensed: top (from the strip's top) and the height that
   * fits whole rows (0 when nothing fits — the stats then stay hidden).
   */
  stats: { y: number; h: number };
}

/** The uncondensed boss panel on phones. */
export const FULL_LAYOUT = {
  height: 248,
  stageH: 150,
  sprite: 118,
  /** Name sits this far under the stage. */
  nameGap: 10,
  /** HP bar top, relative to the name's top (plus CompactTargets.hpRise). */
  hpGap: 26,
  /** Stat line top, relative to the name's top. */
  statsGap: 56,
  pad: 14,
} as const;

const SPLIT = 0.4;

export interface CondensedPieces {
  stage: Box;
  sprite: number;
  name: { x: number; y: number; scale: number };
  hp: { x: number; y: number; w: number };
  stats: { x: number; y: number; w: number; h: number; opacity: number };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Layout at collapse progress `p` (0 = full panel, 1 = compact bar) for a panel `width` px wide. */
export function condenseLayout(p: number, width: number, nameWidth: number, compact: CompactTargets): CondensedPieces {
  const F = FULL_LAYOUT;
  const P = compact.portrait;
  p = clamp01(p);
  const t = ease(p);
  const square = ease(clamp01(p / SPLIT));

  const sh = lerp(F.stageH, P.h, p);
  const sw = lerp(width, sh, square);
  const sx = lerp(0, P.x, square);
  const sy = lerp(0, P.y, p);

  const gap = compact.name.x - (P.x + P.w);
  const besideX = sx + sw + gap;
  const riseX = P.x + lerp(F.stageH, P.h, SPLIT) + gap;
  const belowY = lerp(0, P.y, SPLIT) + lerp(F.stageH, P.h, SPLIT) + F.nameGap;

  const below = p <= SPLIT;
  const slide = ease(p / SPLIT);
  const nameX = below ? lerp((width - nameWidth) / 2, riseX, slide) : besideX;
  const nameY = below ? lerp(F.stageH + F.nameGap, belowY, p / SPLIT) : lerp(belowY, compact.name.y, (p - SPLIT) / (1 - SPLIT));
  const hpX = below ? lerp(F.pad, riseX, slide) : besideX;
  const hpY = nameY + lerp(F.hpGap + compact.hpRise, compact.hp.y - compact.name.y, t);
  const hpRight = lerp(F.pad, width - (compact.hp.x + compact.hp.w), t);

  return {
    stage: { x: sx, y: sy, w: sw, h: sh },
    sprite: Math.min(F.sprite, sh - 8, sw - 6),
    name: { x: nameX, y: nameY, scale: lerp(1, compact.nameScale, t) },
    hp: { x: hpX, y: hpY, w: width - hpX - hpRight },
    // The full panel's stat line is gone within the first ~10% of the collapse,
    // before the frame reaches it; the condensed bar's own (clipped to whole
    // rows) fades in over the last stretch, once everything has settled.
    stats: {
      x: hpX,
      y: lerp(nameY + F.statsGap, hpY + compact.stats.y - compact.hp.y, t),
      w: width - hpX - hpRight,
      h: compact.stats.h,
      opacity: Math.max(1 - p / 0.1, compact.stats.h > 0 ? clamp01((p - 0.85) / 0.15) : 0, 0),
    },
  };
}
