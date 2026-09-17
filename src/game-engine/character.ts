import { TUNING } from './constants/tuning';
import type { Rng } from './rng';
import type { Character } from './types';

export function randomizeStat(base: number, rng: Rng): number {
  const jitter = (rng() * 2 - 1) * TUNING.STAT_RANDOMIZATION_PCT; // in [-0.05, 0.05]
  return base * (1 + jitter);
}

export function createCharacter(rng: Rng): Character {
  const starterStats = {
    physicalDamage: randomizeStat(TUNING.BASE_STATS.physicalDamage, rng),
    magicDamage: randomizeStat(TUNING.BASE_STATS.magicDamage, rng),
    healing: randomizeStat(TUNING.BASE_STATS.healing, rng),
    health: randomizeStat(TUNING.BASE_STATS.health, rng),
  };
  return {
    level: 1,
    exp: 0,
    starterStats,
    currentHealth: starterStats.health,
    ownedItemIds: [],
    equippedItemIds: [],
    critChance: TUNING.BASE_CRIT_CHANCE,
  };
}
