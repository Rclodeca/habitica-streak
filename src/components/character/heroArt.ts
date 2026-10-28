import type { HeroClass } from '../../game-engine';

// Every hero's art file is stored facing right, toward the boss, so nothing
// turns it around in code.

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

// The hero on the new-hero screen's fire, in its 150px box: drawn width, then
// left and bottom offsets. There the bodies stand the same height instead:
// head to feet (the cleric's star left out) they are 169, 155 and 171 art px
// tall, so each is scaled to a 138px body, feet on the box floor and its
// center of mass in the middle.
export const HERO_PICK_PLACEMENT: Record<HeroClass, HeroPlacement> = {
  warrior: { width: 150, left: 14, bottom: -5 },
  cleric: { width: 178, left: -8, bottom: -7 },
  ranger: { width: 148, left: 4, bottom: -3 },
};
