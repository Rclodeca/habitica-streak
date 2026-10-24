import { TUNING } from './constants/tuning';
import { assignNewItemUnlockTiers, backfillUnlockTiers, ITEM_CATALOG } from './items';
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
    questsUnlocked: false,
    // Already at the post-rebalance baseline (BASE_STATS is already the
    // reduced value) — must be set here, not left undefined, or this fresh
    // character would get double-cut by applyDamagePoolRebalance the next
    // time it's saved and reloaded.
    damagePoolRebalanceApplied: true,
  };
}

export type HeroClass = 'warrior' | 'cleric' | 'ranger';

// Physical share of the starting physical+magic pool past which a run reads
// as leaning one way. DAMAGE_SPLIT_RATIOS only rolls 50/50, 60/40 or 70/30
// (either way) before ±5% jitter, so these cut cleanly between the even
// split and the leaning ones.
const WARRIOR_MIN_PHYSICAL_SHARE = 0.55;
const CLERIC_MAX_PHYSICAL_SHARE = 0.45;

/** The hero art for a run, read off its rolled starting stats: physical-leaning is a warrior, magic-leaning a cleric, an even split a ranger. */
export function heroClassFor(character: Pick<Character, 'starterStats'>): HeroClass {
  const { physicalDamage, magicDamage } = character.starterStats;
  const physicalShare = physicalDamage / (physicalDamage + magicDamage);
  if (physicalShare >= WARRIOR_MIN_PHYSICAL_SHARE) return 'warrior';
  if (physicalShare <= CLERIC_MAX_PHYSICAL_SHARE) return 'cleric';
  return 'ranger';
}

export const MAX_HERO_NAME_LENGTH = 16;
export const DEFAULT_HERO_NAME = 'Nameless';

/** Names the hero: trimmed and capped at MAX_HERO_NAME_LENGTH, with a blank name becoming DEFAULT_HERO_NAME. */
export function nameCharacter(character: Character, rawName: string): Character {
  const name = rawName.trim().slice(0, MAX_HERO_NAME_LENGTH).trim() || DEFAULT_HERO_NAME;
  return { ...character, name };
}

/**
 * Backfills `starterStats.trueDamage` on a character saved before that stat
 * existed, so an old save continues its run instead of hitting NaN damage
 * everywhere it is read (the save's schemaVersion doesn't change for this —
 * the field is additive, not a shape break). Rolled the same way
 * `createCharacter` rolls every other stat; idempotent.
 *
 * Also backfills `newItemUnlockTiers` for a run that predates level-gated
 * items (or predates some of them) — without a tier a gated item can never
 * drop for that run —
 * and drops the stray `starterStats.expGain` / `expGainRebalanceApplied` an
 * older save carries from before the expGain skill type was removed, and the
 * `sideOnlyItemIds` pool from before relics.
 */
export function migrateCharacter(character: Character, rng: Rng): Character {
  const { trueDamage } = character.starterStats as Partial<Character['starterStats']>;
  const hasLegacyExpGain =
    'expGain' in character.starterStats || 'expGainRebalanceApplied' in (character as unknown as Record<string, unknown>);
  const needsStats = trueDamage === undefined;
  const needsTiers = character.newItemUnlockTiers === undefined;
  // Gated items added to the catalog after this run started need a tier too,
  // or they could never drop for it.
  const backfilledTiers = character.newItemUnlockTiers && backfillUnlockTiers(character.newItemUnlockTiers, rng);
  const needsTierBackfill = backfilledTiers !== character.newItemUnlockTiers;
  // The pre-relic side-only item pool is gone; drop the stray field (a pending
  // side quest that promised one of those items still pays it).
  const hasLegacySideOnly = 'sideOnlyItemIds' in (character as unknown as Record<string, unknown>);
  if (!needsStats && !needsTiers && !needsTierBackfill && !hasLegacySideOnly && !hasLegacyExpGain) return character;
  const starterStats = {
    ...character.starterStats,
    trueDamage: trueDamage ?? randomizeStat(TUNING.BASE_STATS.trueDamage, rng),
  };
  const migrated = {
    ...character,
    starterStats,
    newItemUnlockTiers: backfilledTiers ?? assignNewItemUnlockTiers(rng),
  };
  delete (starterStats as { expGain?: number }).expGain;
  delete (migrated as { expGainRebalanceApplied?: boolean }).expGainRebalanceApplied;
  delete (migrated as { sideOnlyItemIds?: string[] }).sideOnlyItemIds;
  return migrated;
}

const CATALOG_ITEM_IDS = new Set(ITEM_CATALOG.map((item) => item.id));

/**
 * Drops item ids the catalog no longer has (the retired Dev mode art-trial
 * items, or any item removed later) so they can't sit invisibly in a slot.
 * Returns the same object when every id is still known.
 */
export function discardUnknownItems(character: Character): Character {
  const known = (id: string) => CATALOG_ITEM_IDS.has(id);
  const doubledUnknown = character.doubledItemId !== undefined && !known(character.doubledItemId);
  if (character.ownedItemIds.every(known) && character.equippedItemIds.every(known) && !doubledUnknown) return character;
  return {
    ...character,
    ownedItemIds: character.ownedItemIds.filter(known),
    equippedItemIds: character.equippedItemIds.filter(known),
    doubledItemId: doubledUnknown ? undefined : character.doubledItemId,
  };
}

/**
 * Items only exist while equipped: anything owned but not equipped is
 * discarded (and so returns to the drop pool). Covers saves from before that
 * rule, and drops still waiting in the in-memory popup queue when the page
 * was closed — a relic among those is un-earned too, so it can be offered
 * again rather than lost to a reload (a relic the player chose to drop has
 * already left ownedItemIds and stays earned). Returns the same object when
 * there is nothing to discard.
 */
export function discardUnequippedItems(character: Character): Character {
  const unequipped = character.ownedItemIds.filter((id) => !character.equippedItemIds.includes(id));
  if (unequipped.length === 0) return character;
  return {
    ...character,
    ownedItemIds: character.ownedItemIds.filter((id) => character.equippedItemIds.includes(id)),
    ...(character.earnedRelicIds && { earnedRelicIds: character.earnedRelicIds.filter((id) => !unequipped.includes(id)) }),
  };
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
