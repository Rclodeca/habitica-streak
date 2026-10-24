import { ITEM_CATALOG } from './constants/itemCatalog';
import { TUNING } from './constants/tuning';
import { pickRandom, shuffle, type Rng } from './rng';
import type { Character, Quest } from './types';

export { ITEM_CATALOG };

export type BoostableStat =
  | 'physicalDamage'
  | 'magicDamage'
  | 'healing'
  | 'health'
  | 'trueDamage'
  | 'expGain'
  | 'critChance'
  | 'lifesteal'
  | 'armorPen' // percent only — reduces the boss's effective armor before its resist formula, see combat.ts
  | 'magicPen' // percent only — same, for magicResist
  | 'armor' // flat only — player mitigation stat, see combat.ts missHabit
  | 'magicResist' // flat only — player mitigation stat, see combat.ts missHabit
  | 'allDamage'; // percent only — adds to the physical, magic and true damage multipliers (see itemStatMultiplier)

// 'relic' items never drop: side quests pay them (see availableRelics).
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'relic';
/** The rarities the boss-drop tables weigh. */
export type DropRarity = Exclude<ItemRarity, 'relic'>;

/** A signature (epic) or relic effect — see itemEffects.ts for what each one does. */
export type ItemEffectId =
  | 'giantslayer'
  | 'void-crits'
  | 'bloodthorn'
  | 'spellweave'
  | 'wound-immune'
  | 'bloodbound'
  | 'dawnguard'
  | 'titans-mending'
  | 'sages-insight'
  | 'starfall'
  | 'worldbreaker'
  | 'ember-heart'
  | 'soul-lantern'
  | 'first-blood'
  | 'censer-of-wrath'
  | 'temperance'
  | 'quill-of-oaths'
  | 'magpie'
  | 'headsman'
  | 'hunters-eye'
  | 'moonwell'
  | 'dynamo'
  | 'banner'
  | 'null-mirror'
  | 'echoing-blade';

// A negative percent is a drawback (e.g. -10 max health); enchanting never doubles it.
export interface ItemBonus {
  stat: BoostableStat;
  percent?: number;
  flat?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  icon: string; // path segment relative to public/sprites/, passed straight to an <img>/Sprite
  type: 'equipment' | 'consumable'; // consumables still occupy an equip slot, but grant no passive bonus
  rarity: ItemRarity; // rare items are weighted much lower in rollItemDrops
  bonuses: ItemBonus[]; // empty for the pure-consumable Phoenix Feather
  // Gates this item out of rollItemDrops until the character's
  // rolled-for-this-run unlock tier (see assignNewItemUnlockTiers) is at or
  // below the character's level.
  levelGated?: true;
  // A fixed unlock level instead: the L30 wave, and every relic (where it
  // gates side-quest offers rather than drops).
  unlockLevel?: number;
  effect?: ItemEffectId;
  effectText?: string; // short plain line saying what the effect does, e.g. "+30% damage to bosses above 75% HP."
}

// Each tier is 5x rarer than the one above (common:uncommon:rare:epic ==
// 125:25:5:1), so a boss-1 roll is overwhelmingly common. Since each boss kill rolls up to
// ITEM_DROP_MAX_COUNT items without replacement, per-kill odds of at least
// one non-common item compound higher than that single-roll number — this
// keeps epic (the new +50%-damage tier) genuinely rare rather than
// something you stumble into quickly.
//
// By boss 20, rarity weights converge to equal (31 each), so all rarities
// become equally common in the late game as a progression reward.
const INITIAL_RARITY_WEIGHT: Record<DropRarity, number> = { common: 125, uncommon: 25, rare: 5, epic: 1 };
const RARITY_CONVERGENCE_BOSS = 20;
const EQUAL_RARITY_WEIGHT: Record<DropRarity, number> = { common: 31, uncommon: 31, rare: 31, epic: 31 };

function rarityWeightByBossIndex(bossIndex: number): Record<DropRarity, number> {
  if (bossIndex >= RARITY_CONVERGENCE_BOSS) {
    return EQUAL_RARITY_WEIGHT;
  }
  const progress = (bossIndex - 1) / (RARITY_CONVERGENCE_BOSS - 1);
  return {
    common: Math.round(INITIAL_RARITY_WEIGHT.common + (EQUAL_RARITY_WEIGHT.common - INITIAL_RARITY_WEIGHT.common) * progress),
    uncommon: Math.round(INITIAL_RARITY_WEIGHT.uncommon + (EQUAL_RARITY_WEIGHT.uncommon - INITIAL_RARITY_WEIGHT.uncommon) * progress),
    rare: Math.round(INITIAL_RARITY_WEIGHT.rare + (EQUAL_RARITY_WEIGHT.rare - INITIAL_RARITY_WEIGHT.rare) * progress),
    epic: Math.round(INITIAL_RARITY_WEIGHT.epic + (EQUAL_RARITY_WEIGHT.epic - INITIAL_RARITY_WEIGHT.epic) * progress),
  };
}

/**
 * Weighted sample without replacement: each remaining item's chance is
 * proportional to rarityWeight[item.rarity], recomputed after every pick so
 * removing a common item doesn't skew the remaining rare-vs-common ratio.
 */
function weightedSampleWithoutReplacement(items: ItemDef[], count: number, rarityWeight: Record<DropRarity, number>, rng: Rng): ItemDef[] {
  const pool = [...items];
  const result: ItemDef[] = [];
  while (result.length < count && pool.length > 0) {
    const totalWeight = pool.reduce((sum, item) => sum + rarityWeight[item.rarity as DropRarity], 0);
    let roll = rng() * totalWeight;
    let pickedIndex = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      roll -= rarityWeight[pool[i].rarity as DropRarity];
      if (roll < 0) {
        pickedIndex = i;
        break;
      }
    }
    result.push(pool[pickedIndex]);
    pool.splice(pickedIndex, 1);
  }
  return result;
}

/** Whether any equipped item carries `effect` (see itemEffects.ts for what each one does). */
export function hasItemEffect(character: Pick<Character, 'equippedItemIds'>, effect: ItemEffectId): boolean {
  return character.equippedItemIds.some((id) => ITEM_CATALOG.find((item) => item.id === id)?.effect === effect);
}

/** TUNING.DOUBLED_ITEM_MULTIPLIER for the character's doubled item, 1 for every other item. */
export function itemDoubleFactor(character: Pick<Character, 'doubledItemId'>, itemId: string): number {
  return character.doubledItemId === itemId ? TUNING.DOUBLED_ITEM_MULTIPLIER : 1;
}

/** Equipped items the Double item event could pick: anything with stat bonuses (not consumables). */
export function doublableItems(character: Character): ItemDef[] {
  return ITEM_CATALOG.filter((item) => character.equippedItemIds.includes(item.id) && item.type !== 'consumable' && item.bonuses.length > 0);
}

/**
 * Sums bonus.percent across every equipped item's `bonuses` entries matching
 * `stat`. 0 if none equipped/matching. A drawback (negative percent) counts
 * as-is — an enchanted item doubles only its positive bonuses.
 */
export function itemBonusPercent(character: Character, stat: BoostableStat): number {
  let total = 0;
  for (const id of character.equippedItemIds) {
    const item = ITEM_CATALOG.find((candidate) => candidate.id === id);
    if (!item) continue;
    for (const bonus of item.bonuses) {
      if (bonus.stat === stat && bonus.percent) total += bonus.percent > 0 ? bonus.percent * itemDoubleFactor(character, id) : bonus.percent;
    }
  }
  return total;
}

/**
 * Sums bonus.flat across every equipped item's `bonuses` entries matching
 * `stat`. 0 if none equipped/matching. See combat.ts/leveling.ts for where
 * this is added into a stat's level-scaled base before any percent
 * multiplier applies.
 */
export function itemFlatBonus(character: Character, stat: BoostableStat): number {
  let total = 0;
  for (const id of character.equippedItemIds) {
    const item = ITEM_CATALOG.find((candidate) => candidate.id === id);
    if (!item) continue;
    for (const bonus of item.bonuses) {
      if (bonus.stat === stat && bonus.flat) total += bonus.flat > 0 ? bonus.flat * itemDoubleFactor(character, id) : bonus.flat;
    }
  }
  return total;
}

const STAT_SHORT_LABEL: Record<BoostableStat, string> = {
  physicalDamage: 'Physical',
  magicDamage: 'Magic',
  healing: 'Healing',
  health: 'Health',
  trueDamage: 'True',
  expGain: 'EXP',
  critChance: 'Crit',
  lifesteal: 'Lifesteal',
  armorPen: 'Armor pen',
  magicPen: 'Magic pen',
  armor: 'Armor',
  magicResist: 'Magic resist',
  allDamage: 'All damage',
};

const STAT_LABEL: Record<BoostableStat, string> = {
  physicalDamage: 'Physical damage',
  magicDamage: 'Magic damage',
  healing: 'Healing',
  health: 'Max health',
  trueDamage: 'True damage (ignores armor and magic resist)',
  expGain: 'EXP gain',
  critChance: 'Crit chance',
  lifesteal: 'Lifesteal (heal from damage dealt)',
  armorPen: 'Armor penetration',
  magicPen: 'Magic penetration',
  armor: 'Armor',
  magicResist: 'Magic resist',
  allDamage: 'All damage',
};

/** "+5" / "−5" (U+2212 for drawbacks), with `unit` appended. */
function signedAmount(amount: number, unit: string): string {
  return `${amount < 0 ? '\u2212' : '+'}${Math.abs(amount)}${unit}`;
}

/** One entry per stat bonus on `item`: the stat, its short amount text (e.g. "+25%", "−10%"), and a plain-English label for the stat. Enchanting (`factor`) scales positive bonuses only. */
export function describeItemBonusParts(
  item: ItemDef,
  factor = 1,
): { stat: BoostableStat; text: string; label: string }[] {
  if (item.type === 'consumable') return [];
  const parts: { stat: BoostableStat; text: string; label: string }[] = [];
  for (const bonus of item.bonuses) {
    const label = STAT_LABEL[bonus.stat];
    if (bonus.percent) parts.push({ stat: bonus.stat, text: signedAmount(bonus.percent > 0 ? bonus.percent * factor : bonus.percent, '%'), label });
    if (bonus.flat) parts.push({ stat: bonus.stat, text: signedAmount(bonus.flat > 0 ? bonus.flat * factor : bonus.flat, ''), label });
  }
  return parts;
}

/** Condensed plain-text summary of what an item grants (e.g. "Physical +25%"), plus its effect text, for popups/tooltips. */
export function describeItemBonus(item: ItemDef, factor = 1): string {
  if (item.type === 'consumable') return 'Consumable — grants one free revive on death, while equipped';
  const stats = describeItemBonusParts(item, factor)
    .map((part) => `${STAT_SHORT_LABEL[part.stat]} ${part.text}`)
    .join(', ');
  return item.effectText ? `${stats} \u00b7 ${item.effectText}` : stats;
}

/**
 * Catalog items the character doesn't own yet and can currently drop: never a
 * relic, L30-wave items only from their unlockLevel, level-gated ones only once unlocked.
 */
export function unownedDroppableItems(character: Character): ItemDef[] {
  return ITEM_CATALOG.filter((item) => {
    if (item.rarity === 'relic') return false;
    if (character.ownedItemIds.includes(item.id)) return false;
    if (item.unlockLevel !== undefined && character.level < item.unlockLevel) return false;
    if (!item.levelGated) return true;
    const unlockLevel = character.newItemUnlockTiers?.[item.id];
    return unlockLevel !== undefined && character.level >= unlockLevel;
  });
}

/**
 * Relics a new side quest could offer: unlocked at the character's level, not
 * yet earned this run (earned is earned, even if later dropped), not owned,
 * and not already promised to a pending side quest. A missed side quest
 * leaves the quest list, which returns its relic here.
 */
export function availableRelics(character: Character, quests: readonly Quest[]): ItemDef[] {
  const earned = character.earnedRelicIds ?? [];
  const promised = quests.filter((q) => q.kind === 'side' && q.rewardItemId).map((q) => q.rewardItemId);
  return ITEM_CATALOG.filter(
    (item) =>
      item.rarity === 'relic' &&
      (item.unlockLevel ?? 1) <= character.level &&
      !earned.includes(item.id) &&
      !character.ownedItemIds.includes(item.id) &&
      !promised.includes(item.id),
  );
}

/** Marks a relic earned for the run; the same character back for anything else or a relic already recorded. */
export function recordRelicEarned(character: Character, itemId: string): Character {
  const item = ITEM_CATALOG.find((candidate) => candidate.id === itemId);
  const earned = character.earnedRelicIds ?? [];
  if (item?.rarity !== 'relic' || earned.includes(itemId)) return character;
  return { ...character, earnedRelicIds: [...earned, itemId] };
}

/**
 * Rolls this character's item drop for defeating the boss at `bossIndex`
 * (`maxCount` further caps how many items drop, e.g. 1 for a single-item reward).
 * Desired count follows a step curve (more items from later bosses, capped
 * at ITEM_DROP_MAX_COUNT), further capped by how many catalog items this
 * character doesn't already own — returns [] once every item is owned.
 * Rare items are weighted much lower than common ones (see RARITY_WEIGHT).
 */
export function rollItemDrops(character: Character, bossIndex: number, rng: Rng, maxCount: number = TUNING.ITEM_DROP_MAX_COUNT): ItemDef[] {
  const unowned = unownedDroppableItems(character);
  const desiredCount = Math.min(
    1 + Math.floor((bossIndex - 1) / TUNING.ITEM_DROP_EVERY_N_BOSSES),
    TUNING.ITEM_DROP_MAX_COUNT,
    maxCount,
  );
  const count = Math.min(desiredCount, unowned.length);
  // Magpie Charm: rarity rolls as if from a boss MAGPIE_BOSS_INDEX_BONUS indexes later.
  const rarityIndex = hasItemEffect(character, 'magpie') ? bossIndex + TUNING.ITEM_EFFECTS.MAGPIE_BOSS_INDEX_BONUS : bossIndex;
  const rarityWeight = rarityWeightByBossIndex(rarityIndex);
  return weightedSampleWithoutReplacement(unowned, count, rarityWeight, rng);
}

// Computed once at module load from the catalog itself, so the level-gated
// set can never drift out of sync with which items actually carry `levelGated`.
const LEVEL_GATED_ITEM_IDS = ITEM_CATALOG.filter((item) => item.levelGated).map((item) => item.id);

/**
 * Rolls this run's random unlock-tier assignment for every level-gated
 * item: shuffles the ids, then chunks them via Math.ceil(n/3) into three
 * groups (10/10/8 for today's 28) mapped to levels 10/15/20. Called once
 * per run, from createCharacter.
 */
export function assignNewItemUnlockTiers(rng: Rng): Record<string, 10 | 15 | 20> {
  const shuffled = shuffle(LEVEL_GATED_ITEM_IDS, rng);
  const chunkSize = Math.ceil(shuffled.length / 3);
  const tiers: Record<string, 10 | 15 | 20> = {};
  shuffled.forEach((id, i) => {
    tiers[id] = i < chunkSize ? 10 : i < chunkSize * 2 ? 15 : 20;
  });
  return tiers;
}

/**
 * An in-progress run's tiers plus a random 10/15/20 for any level-gated item
 * added to the catalog since the run started; existing assignments are kept.
 * Returns the same object when nothing is missing.
 */
export function backfillUnlockTiers(tiers: Record<string, 10 | 15 | 20>, rng: Rng): Record<string, 10 | 15 | 20> {
  const missing = LEVEL_GATED_ITEM_IDS.filter((id) => tiers[id] === undefined);
  if (missing.length === 0) return tiers;
  const backfilled = { ...tiers };
  for (const id of missing) backfilled[id] = pickRandom([10, 15, 20] as const, rng);
  return backfilled;
}

/** The most equip slots a character can ever have (the item grid always shows this many, locked or not). */
export const MAX_EQUIP_SLOTS = 8;

/** 4 equip slots, 6 after the one-time `item-slots` event, 8 after `item-slots-2`. */
export function maxEquipSlots(character: Pick<Character, 'takenEventIds'>): number {
  if (character.takenEventIds?.includes('item-slots-2')) return MAX_EQUIP_SLOTS;
  return character.takenEventIds?.includes('item-slots') ? 6 : 4;
}

// Which body-worn sprite slot each stat category renders as on the player
// sprite. expGain, critChance, and lifesteal have no entry — those items
// have no natural body slot and stay icon-grid-only.
const BODY_SLOT_BY_STAT: Partial<Record<BoostableStat, string>> = {
  physicalDamage: 'weapon-physical',
  magicDamage: 'weapon-magic',
  health: 'armor',
  healing: 'shield',
};

/**
 * bonusPercent -> art tier, by threshold rather than exact match so hybrid
 * and rare items still map onto one of the 3 existing art tiers per slot.
 */
function tierForBonusPercent(bonusPercent: number): number | null {
  if (bonusPercent >= 10) return 3;
  if (bonusPercent >= 5) return 2;
  if (bonusPercent >= 3) return 1;
  return null;
}

/**
 * The body-worn sprite layer (a path segment relative to public/sprites/)
 * for an equipped item, or null if it has no visual slot (not equipped, a
 * consumable, or a stat with no body-slot mapping). Uses the item's first
 * positive percent bonus on a body-relevant stat — a drawback never draws.
 */
export function bodySpriteFor(item: ItemDef | null): string | null {
  if (!item) return null;
  const bonus = item.bonuses.find((b) => b.stat in BODY_SLOT_BY_STAT && (b.percent ?? 0) > 0);
  if (!bonus?.percent) return null;
  const slot = BODY_SLOT_BY_STAT[bonus.stat];
  const tier = tierForBonusPercent(bonus.percent);
  return slot && tier ? `player/${slot}-${tier}` : null;
}
