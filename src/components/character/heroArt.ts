import type { HeroClass } from '../../game-engine';

// The warrior and cleric art faces left; turned around, they face the boss.
// The ranger is drawn facing right already.
export const DRAWN_FACING_LEFT: Record<HeroClass, boolean> = { warrior: true, cleric: true, ranger: false };

// Where each hero stands on the fight stage, in px on its 390px-wide phone
// design: drawn width, then left and bottom offsets. Every hero draws at 0.87x
// its art file's width so their art pixels match, and is placed by its visual
// center of mass rather than its box, so the three stand in the same spot.
export interface HeroPlacement {
  width: number;
  left: number;
  bottom: number;
}

export const HERO_PLACEMENT: Record<HeroClass, HeroPlacement> = {
  warrior: { width: 160, left: 23, bottom: 8 },
  cleric: { width: 174, left: 6, bottom: 6 },
  ranger: { width: 160, left: 12, bottom: 10 },
};
