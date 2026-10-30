import { ITEM_CATALOG } from './constants/itemCatalog';
import { TUNING } from './constants/tuning';
import { formatCompact } from './format';
import { pickRandom, pickWeighted, type Rng } from './rng';
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
  | 'echoing-blade'
  | 'hushing-bell'
  | 'omen-hourglass'
  | 'wellspring';

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
  rarity: ItemRarity; // its share of drops at the player's level is set by dropRarityShares
  bonuses: ItemBonus[]; // empty for the pure-consumable Phoenix Feather
  effect?: ItemEffectId;
  effectText?: string; // short plain line saying what the effect does, e.g. "+30% damage to bosses above 75% HP."
}

const DROP_RARITIES: DropRarity[] = ['common', 'uncommon', 'rare', 'epic'];

/**
 * Each rarity's share of drops at `level`, as fractions summing to 1:
 * TUNING.DROP_RARITY_SHARES_BY_LEVEL blended linearly between rows. With
 * `magpie` (Magpie's Diamond), the rare and epic shares are multiplied by
 * MAGPIE_RARE_EPIC_MULTIPLIER before everything is scaled back to 1.
 */
export function dropRarityShares(level: number, magpie = false): Record<DropRarity, number> {
  const rows = TUNING.DROP_RARITY_SHARES_BY_LEVEL;
  const at = Math.min(Math.max(level, rows[0][0]), rows[rows.length - 1][0]);
  const upper = Math.max(1, rows.findIndex(([rowLevel]) => rowLevel >= at));
  const [[fromLevel, from], [toLevel, to]] = [rows[upper - 1], rows[upper]];
  const t = (at - fromLevel) / (toLevel - fromLevel);
  const boost = (rarity: DropRarity) => (magpie && (rarity === 'rare' || rarity === 'epic') ? TUNING.ITEM_EFFECTS.MAGPIE_RARE_EPIC_MULTIPLIER : 1);
  const percent = (rarity: DropRarity) => (from[rarity] + (to[rarity] - from[rarity]) * t) * boost(rarity);
  const total = DROP_RARITIES.reduce((sum, rarity) => sum + percent(rarity), 0);
  return { common: percent('common') / total, uncommon: percent('uncommon') / total, rare: percent('rare') / total, epic: percent('epic') / total };
}

/**
 * Picks up to `count` distinct items from `items`: each pick rolls a rarity
 * from `shares`, skipping rarities with nothing left (the rest scale back
 * up), then one item of that rarity, all equally likely. So a rarity's share
 * of drops doesn't depend on how many items it has.
 */
function pickDrops(items: ItemDef[], count: number, shares: Record<DropRarity, number>, rng: Rng): ItemDef[] {
  const pool = [...items];
  const result: ItemDef[] = [];
  while (result.length < count) {
    const left = DROP_RARITIES.filter((rarity) => shares[rarity] > 0 && pool.some((item) => item.rarity === rarity));
    if (left.length === 0) break;
    const rarity = pickWeighted<DropRarity>(Object.fromEntries(left.map((r) => [r, shares[r]])), rng);
    const picked = pickRandom(pool.filter((item) => item.rarity === rarity), rng);
    result.push(picked);
    pool.splice(pool.indexOf(picked), 1);
  }
  return result;
}

/** Whether any equipped item carries `effect` (see itemEffects.ts for what each one does). */
export function hasItemEffect(character: Pick<Character, 'equippedItemIds'>, effect: ItemEffectId): boolean {
  return character.equippedItemIds.some((id) => ITEM_CATALOG.find((item) => item.id === id)?.effect === effect);
}

/** TUNING.DOUBLED_ITEM_MULTIPLIER for each of the character's doubled items, 1 for every other item. */
export function itemDoubleFactor(character: Pick<Character, 'doubledItemIds'>, itemId: string): number {
  return character.doubledItemIds?.includes(itemId) ? TUNING.DOUBLED_ITEM_MULTIPLIER : 1;
}

/** The character's doubled items that are still equipped (a stale id left by an older save doesn't count). */
export function equippedDoubledItemIds(character: Pick<Character, 'doubledItemIds' | 'equippedItemIds'>): string[] {
  return (character.doubledItemIds ?? []).filter((id) => character.equippedItemIds.includes(id));
}

/** Equipped items the Double item event could pick: anything with stat bonuses (not consumables) that isn't already doubled. */
export function doublableItems(character: Character): ItemDef[] {
  return ITEM_CATALOG.filter(
    (item) =>
      character.equippedItemIds.includes(item.id) &&
      item.type !== 'consumable' &&
      item.bonuses.length > 0 &&
      !character.doubledItemIds?.includes(item.id),
  );
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
  trueDamage: 'True damage',
  expGain: 'EXP gain',
  critChance: 'Crit chance',
  lifesteal: 'Lifesteal',
  armorPen: 'Armor penetration',
  magicPen: 'Magic penetration',
  armor: 'Armor',
  magicResist: 'Magic resist',
  allDamage: 'All damage',
};

/** "+5" / "−5" (U+2212 for drawbacks), with `unit` appended. From 1000 up it reads "+1.3K". */
function signedAmount(amount: number, unit: string): string {
  const size = Math.abs(amount);
  return `${amount < 0 ? '−' : '+'}${size >= 1000 ? formatCompact(size) : size}${unit}`;
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
 * relic, and never one whose rarity has a 0% share at the character's level.
 */
export function unownedDroppableItems(character: Character): ItemDef[] {
  const shares = dropRarityShares(character.level);
  return ITEM_CATALOG.filter((item) => item.rarity !== 'relic' && !character.ownedItemIds.includes(item.id) && shares[item.rarity] > 0);
}

/**
 * Relics a new side quest could offer: not yet earned this run (earned is
 * earned, even if later dropped), not owned, and not already promised to a
 * pending side quest. A missed side quest leaves the quest list, which
 * returns its relic here.
 */
export function availableRelics(character: Character, quests: readonly Quest[]): ItemDef[] {
  const earned = character.earnedRelicIds ?? [];
  const promised = quests.filter((q) => q.kind === 'side' && q.rewardItemId).map((q) => q.rewardItemId);
  return ITEM_CATALOG.filter(
    (item) =>
      item.rarity === 'relic' &&
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
 * Rarity odds follow the character's level (see dropRarityShares).
 */
export function rollItemDrops(character: Character, bossIndex: number, rng: Rng, maxCount: number = TUNING.ITEM_DROP_MAX_COUNT): ItemDef[] {
  const unowned = unownedDroppableItems(character);
  const desiredCount = Math.min(
    1 + Math.floor((bossIndex - 1) / TUNING.ITEM_DROP_EVERY_N_BOSSES),
    TUNING.ITEM_DROP_MAX_COUNT,
    maxCount,
  );
  const count = Math.min(desiredCount, unowned.length);
  return pickDrops(unowned, count, dropRarityShares(character.level, hasItemEffect(character, 'magpie')), rng);
}

/** The most equip slots a character can ever have (the item grid always shows this many, locked or not). */
export const MAX_EQUIP_SLOTS = 8;

/** 4 equip slots, 6 after the one-time `item-slots` event, 8 after `item-slots-2`. */
export function maxEquipSlots(character: Pick<Character, 'takenEventIds'>): number {
  if (character.takenEventIds?.includes('item-slots-2')) return MAX_EQUIP_SLOTS;
  return character.takenEventIds?.includes('item-slots') ? 6 : 4;
}
