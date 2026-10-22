import { TUNING } from './constants/tuning';
import { assignNewItemUnlockTiers, assignSideOnlyItems } from './items';
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
    takenEventIds: [],
    pendingEventPicks: 0,
    // Rolled after everything above so adding it never perturbs the rng()
    // sequence an existing seeded test depends on.
    sideOnlyItemIds: assignSideOnlyItems(rng),
    // Already at the post-rebalance baseline (BASE_STATS is already the
    // reduced value) — must be set here, not left undefined, or this fresh
    // character would get double-cut by applyDamagePoolRebalance the next
    // time it's saved and reloaded.
    damagePoolRebalanceApplied: true,
  };
}

/**
 * Backfills `starterStats.trueDamage` on a character saved before that stat
 * existed, so an old save continues its run instead of hitting NaN damage
 * everywhere it is read (the save's schemaVersion doesn't change for this —
 * the field is additive, not a shape break). Rolled the same way
 * `createCharacter` rolls every other stat; idempotent.
 *
 * Also backfills `newItemUnlockTiers` for a run that predates level-gated
 * items — without it none of the 19 gated items can ever drop for that run —
 * and drops the stray `starterStats.expGain` / `expGainRebalanceApplied` an
 * older save carries from before the expGain skill type was removed.
 */
export function migrateCharacter(character: Character, rng: Rng): Character {
  const { trueDamage } = character.starterStats as Partial<Character['starterStats']>;
  const hasLegacyExpGain =
    'expGain' in character.starterStats || 'expGainRebalanceApplied' in (character as unknown as Record<string, unknown>);
  const needsStats = trueDamage === undefined;
  const needsTiers = character.newItemUnlockTiers === undefined;
  // A run that predates side quests has no side-only items, so the side-quest
  // event could never be offered until the next death. Flag some now — only
  // from items not already owned, so nothing the player holds is affected.
  const needsSideOnly = character.sideOnlyItemIds === undefined;
  if (!needsStats && !needsTiers && !needsSideOnly && !hasLegacyExpGain) return character;
  const starterStats = {
    ...character.starterStats,
    trueDamage: trueDamage ?? randomizeStat(TUNING.BASE_STATS.trueDamage, rng),
  };
  const migrated = {
    ...character,
    starterStats,
    newItemUnlockTiers: character.newItemUnlockTiers ?? assignNewItemUnlockTiers(rng),
    sideOnlyItemIds: character.sideOnlyItemIds ?? assignSideOnlyItems(rng, character.ownedItemIds),
  };
  delete (starterStats as { expGain?: number }).expGain;
  delete (migrated as { expGainRebalanceApplied?: boolean }).expGainRebalanceApplied;
  return migrated;
}

/**
 * Items only exist while equipped: anything owned but not equipped is
 * discarded (and so returns to the drop pool). Covers saves from before that
 * rule, and drops still waiting in the in-memory popup queue when the page
 * was closed. Returns the same object when there is nothing to discard.
 */
export function discardUnequippedItems(character: Character): Character {
  if (character.ownedItemIds.every((id) => character.equippedItemIds.includes(id))) return character;
  return { ...character, ownedItemIds: character.ownedItemIds.filter((id) => character.equippedItemIds.includes(id)) };
}

/**
 * One-time migration for a run that predates the 2026-10-04 damage/healing
 * pool rebalance — see `damagePoolRebalanceApplied` on `Character`. Scales
 * only `physicalDamage`/`magicDamage`/`healing` down by
 * ONE_TIME_DAMAGE_POOL_REBALANCE_PCT; `health`/`trueDamage` are
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
