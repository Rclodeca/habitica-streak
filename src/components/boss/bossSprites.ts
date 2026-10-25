import type { Personality } from '../../game-engine';

// Boss art from FreePixel (see CREDITS.md), picked to match each
// personality's emphasized stat and escalate within its family as
// PERSONALITY_NAME's flavor names climb in intensity (boss.ts) — every one
// of the 18 personalities has its own distinct sprite.
export const PERSONALITY_SPRITE: Record<Personality, string> = {
  balanced: 'bosses/balanced',
  tank: 'bosses/tank',
  armored: 'bosses/armored',
  armored3x: 'bosses/armored3x',
  armored4x: 'bosses/armored4x',
  armored5x: 'bosses/armored5x',
  warded: 'bosses/warded',
  warded3x: 'bosses/warded3x',
  warded4x: 'bosses/warded4x',
  warded5x: 'bosses/warded5x',
  brute: 'bosses/brute',
  brute3x: 'bosses/brute3x',
  brute4x: 'bosses/brute4x',
  brute5x: 'bosses/brute5x',
  arcane: 'bosses/arcane',
  arcane3x: 'bosses/arcane3x',
  arcane4x: 'bosses/arcane4x',
  arcane5x: 'bosses/arcane5x',
};
