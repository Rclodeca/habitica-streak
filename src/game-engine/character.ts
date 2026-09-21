import { TUNING } from './constants/tuning';
import { pickRandom, type Rng } from './rng';
import type { Character } from './types';

export function randomizeStat(base: number, rng: Rng): number {
  const jitter = (rng() * 2 - 1) * TUNING.STAT_RANDOMIZATION_PCT; // in [-0.05, 0.05]
  return base * (1 + jitter);
}

export function createCharacter(rng: Rng): Character {
  // Randomizes how the combined physical+magic pool is split so some runs
  // are balanced and others lean hard into one damage type — see
  // TUNING.DAMAGE_SPLIT_RATIOS.
  const [physicalShare, magicShare] = pickRandom(TUNING.DAMAGE_SPLIT_RATIOS, rng);
  const damagePool = TUNING.BASE_STATS.physicalDamage + TUNING.BASE_STATS.magicDamage;
  const starterStats = {
    physicalDamage: randomizeStat(damagePool * physicalShare, rng),
    magicDamage: randomizeStat(damagePool * magicShare, rng),
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
