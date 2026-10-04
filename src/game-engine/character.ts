import { TUNING } from './constants/tuning';
import { assignNewItemUnlockTiers } from './items';
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
    trueDamage: randomizeStat(TUNING.BASE_STATS.trueDamage, rng),
    expGain: randomizeStat(TUNING.BASE_STATS.expGain, rng),
  };
  return {
    level: 1,
    exp: 0,
    starterStats,
    currentHealth: starterStats.health,
    ownedItemIds: [],
    equippedItemIds: [],
    critChance: TUNING.BASE_CRIT_CHANCE,
    newItemUnlockTiers: assignNewItemUnlockTiers(rng),
    // Already at the post-rebalance baseline (BASE_STATS is already the
    // reduced value) — must be set here, not left undefined, or this fresh
    // character would get double-cut by applyDamagePoolRebalance the next
    // time it's saved and reloaded.
    damagePoolRebalanceApplied: true,
  };
}

/**
 * Backfills `starterStats.trueDamage`/`expGain` on a character saved before
 * those stats existed, so an old save continues its run instead of hitting
 * NaN damage/EXP everywhere those stats are read (the save's schemaVersion
 * doesn't change for this — both fields are additive, not a shape break).
 * Rolled the same way `createCharacter` rolls every other stat; idempotent —
 * a character that already has both fields passes through untouched.
 */
export function migrateCharacter(character: Character, rng: Rng): Character {
  const { trueDamage, expGain } = character.starterStats as Partial<Character['starterStats']>;
  if (trueDamage !== undefined && expGain !== undefined) return character;
  return {
    ...character,
    starterStats: {
      ...character.starterStats,
      trueDamage: trueDamage ?? randomizeStat(TUNING.BASE_STATS.trueDamage, rng),
      expGain: expGain ?? randomizeStat(TUNING.BASE_STATS.expGain, rng),
    },
  };
}

/**
 * One-time migration for a run that predates the 2026-10-04 damage/healing
 * pool rebalance — see `damagePoolRebalanceApplied` on `Character`. Scales
 * only `physicalDamage`/`magicDamage`/`healing` down by
 * ONE_TIME_DAMAGE_POOL_REBALANCE_PCT; `health`/`trueDamage`/`expGain` are
 * deliberately left untouched. Idempotent via the flag, not via re-deriving
 * from `TUNING.BASE_STATS` — this must apply to whatever value is already
 * on the character (including its character-creation jitter and any level
 * growth since), not reset it to a fresh roll.
 */
export function applyDamagePoolRebalance(character: Character): Character {
  if (character.damagePoolRebalanceApplied) return character;
  const factor = 1 - TUNING.ONE_TIME_DAMAGE_POOL_REBALANCE_PCT / 100;
  return {
    ...character,
    starterStats: {
      ...character.starterStats,
      physicalDamage: character.starterStats.physicalDamage * factor,
      magicDamage: character.starterStats.magicDamage * factor,
      healing: character.starterStats.healing * factor,
    },
    damagePoolRebalanceApplied: true,
  };
}
