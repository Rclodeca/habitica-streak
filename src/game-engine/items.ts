import { TUNING } from './constants/tuning';
import type { Rng } from './rng';
import type { Character } from './types';

export type BoostableStat = 'physicalDamage' | 'magicDamage' | 'healing' | 'health' | 'expGain' | 'critChance' | 'lifesteal';

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic';

export interface ItemDef {
  id: string;
  name: string;
  icon: string; // path segment relative to public/sprites/, passed straight to an <img>/Sprite
  type: 'equipment' | 'consumable'; // consumables still occupy an equip slot, but grant no passive bonus
  rarity: ItemRarity; // rare items are weighted much lower in rollItemDrops
  stat?: BoostableStat; // primary stat bonus; absent for the pure-consumable Phoenix Feather
  bonusPercent?: number;
  extraStat?: BoostableStat; // second stat bonus, for hybrid/rare items
  extraBonusPercent?: number;
}

export const ITEM_CATALOG: ItemDef[] = [
  // --- Physical damage (common -> epic; the only stat-category with a 5-tier spread up to +50%) ---
  { id: 'rusty-blade', name: 'Rusty Blade', icon: 'items/rusty-blade', type: 'equipment', rarity: 'common', stat: 'physicalDamage', bonusPercent: 3 },
  { id: 'steel-sword', name: 'Steel Sword', icon: 'items/steel-sword', type: 'equipment', rarity: 'common', stat: 'physicalDamage', bonusPercent: 6 },
  {
    id: 'warlords-greatsword',
    name: "Warlord's Greatsword",
    icon: 'items/warlords-greatsword',
    type: 'equipment',
    rarity: 'uncommon',
    stat: 'physicalDamage',
    bonusPercent: 12,
  },
  {
    id: 'executioners-axe',
    name: "Executioner's Axe",
    icon: 'items/executioners-axe',
    type: 'equipment',
    rarity: 'rare',
    stat: 'physicalDamage',
    bonusPercent: 25,
  },
  {
    id: 'godslayer-greatblade',
    name: 'Godslayer Greatblade',
    icon: 'items/godslayer-greatblade',
    type: 'equipment',
    rarity: 'epic',
    stat: 'physicalDamage',
    bonusPercent: 50,
  },
  // --- Magic damage (common -> epic; mirrors the physical damage spread above) ---
  { id: 'apprentice-wand', name: 'Apprentice Wand', icon: 'items/apprentice-wand', type: 'equipment', rarity: 'common', stat: 'magicDamage', bonusPercent: 3 },
  { id: 'arcane-staff', name: 'Arcane Staff', icon: 'items/arcane-staff', type: 'equipment', rarity: 'common', stat: 'magicDamage', bonusPercent: 6 },
  { id: 'archmages-rod', name: "Archmage's Rod", icon: 'items/archmages-rod', type: 'equipment', rarity: 'uncommon', stat: 'magicDamage', bonusPercent: 12 },
  {
    id: 'stormcaller-staff',
    name: 'Stormcaller Staff',
    icon: 'items/stormcaller-staff',
    type: 'equipment',
    rarity: 'rare',
    stat: 'magicDamage',
    bonusPercent: 25,
  },
  {
    id: 'voidcallers-scepter',
    name: "Voidcaller's Scepter",
    icon: 'items/voidcallers-scepter',
    type: 'equipment',
    rarity: 'epic',
    stat: 'magicDamage',
    bonusPercent: 50,
  },
  // --- Healing (common) ---
  { id: 'novices-charm', name: "Novice's Charm", icon: 'items/novices-charm', type: 'equipment', rarity: 'common', stat: 'healing', bonusPercent: 3 },
  { id: 'blessed-censer', name: 'Blessed Censer', icon: 'items/blessed-censer', type: 'equipment', rarity: 'common', stat: 'healing', bonusPercent: 6 },
  { id: 'sacred-chalice', name: 'Sacred Chalice', icon: 'items/sacred-chalice', type: 'equipment', rarity: 'uncommon', stat: 'healing', bonusPercent: 10 },
  // --- Health (common) ---
  { id: 'padded-vest', name: 'Padded Vest', icon: 'items/padded-vest', type: 'equipment', rarity: 'common', stat: 'health', bonusPercent: 3 },
  { id: 'chainmail-hauberk', name: 'Chainmail Hauberk', icon: 'items/chainmail-hauberk', type: 'equipment', rarity: 'common', stat: 'health', bonusPercent: 6 },
  { id: 'plate-armor', name: 'Plate Armor', icon: 'items/plate-armor', type: 'equipment', rarity: 'uncommon', stat: 'health', bonusPercent: 10 },
  // --- Exp gain (common) ---
  { id: 'lucky-coin', name: 'Lucky Coin', icon: 'items/lucky-coin', type: 'equipment', rarity: 'common', stat: 'expGain', bonusPercent: 3 },
  { id: 'shining-star', name: 'Shining Star', icon: 'items/shining-star', type: 'equipment', rarity: 'common', stat: 'expGain', bonusPercent: 6 },
  { id: 'rebirth-orb', name: 'Rebirth Orb', icon: 'items/rebirth-orb', type: 'equipment', rarity: 'uncommon', stat: 'expGain', bonusPercent: 10 },
  // --- Crit chance (common) ---
  { id: 'lucky-dagger', name: 'Lucky Dagger', icon: 'items/lucky-dagger', type: 'equipment', rarity: 'common', stat: 'critChance', bonusPercent: 2 },
  { id: 'assassins-edge', name: "Assassin's Edge", icon: 'items/assassins-edge', type: 'equipment', rarity: 'common', stat: 'critChance', bonusPercent: 5 },
  { id: 'eagle-eye-lens', name: 'Eagle Eye Lens', icon: 'items/eagle-eye-lens', type: 'equipment', rarity: 'uncommon', stat: 'critChance', bonusPercent: 10 },
  // --- Hybrid physical + magic damage (common) ---
  {
    id: 'battlemage-gauntlets',
    name: 'Battlemage Gauntlets',
    icon: 'items/battlemage-gauntlets',
    type: 'equipment',
    rarity: 'common',
    stat: 'physicalDamage',
    bonusPercent: 4,
    extraStat: 'magicDamage',
    extraBonusPercent: 4,
  },
  {
    id: 'runed-warblade',
    name: 'Runed Warblade',
    icon: 'items/runed-warblade',
    type: 'equipment',
    rarity: 'uncommon',
    stat: 'physicalDamage',
    bonusPercent: 8,
    extraStat: 'magicDamage',
    extraBonusPercent: 8,
  },
  {
    id: 'chaos-blade',
    name: 'Chaos Blade',
    icon: 'items/chaos-blade',
    type: 'equipment',
    rarity: 'rare',
    stat: 'physicalDamage',
    bonusPercent: 15,
    extraStat: 'magicDamage',
    extraBonusPercent: 15,
  },
  // --- Rare multi-stat items (bigger swings, much rarer drops) ---
  {
    id: 'dragons-heart',
    name: "Dragon's Heart",
    icon: 'items/dragons-heart',
    type: 'equipment',
    rarity: 'rare',
    stat: 'health',
    bonusPercent: 20,
    extraStat: 'physicalDamage',
    extraBonusPercent: 10,
  },
  {
    id: 'void-crystal',
    name: 'Void Crystal',
    icon: 'items/void-crystal',
    type: 'equipment',
    rarity: 'rare',
    stat: 'magicDamage',
    bonusPercent: 15,
    extraStat: 'critChance',
    extraBonusPercent: 15,
  },
  {
    id: 'berserkers-fury',
    name: "Berserker's Fury",
    icon: 'items/berserkers-fury',
    type: 'equipment',
    rarity: 'rare',
    stat: 'physicalDamage',
    bonusPercent: 20,
    extraStat: 'critChance',
    extraBonusPercent: 15,
  },
  // --- Lifesteal (uncommon) ---
  {
    id: 'vampiric-fang',
    name: 'Vampiric Fang',
    icon: 'items/vampiric-fang',
    type: 'equipment',
    rarity: 'uncommon',
    stat: 'lifesteal',
    bonusPercent: 5,
  },
  // --- Consumable ---
  {
    id: 'phoenix-feather',
    name: 'Phoenix Feather',
    icon: 'items/phoenix-feather',
    type: 'consumable',
    rarity: 'rare',
  },
];

// Each tier is 5x rarer than the one above (common:uncommon:rare:epic ==
// 125:25:5:1). With the current 13 common/8 uncommon/7 rare/2 epic catalog,
// a single roll from the full pool lands on: common ~87%, uncommon ~11%,
// rare ~1.9%, epic ~0.1%. Since each boss kill rolls up to
// ITEM_DROP_MAX_COUNT items without replacement, per-kill odds of at least
// one non-common item compound higher than that single-roll number — this
// keeps epic (the new +50%-damage tier) genuinely rare rather than
// something you stumble into quickly.
const RARITY_WEIGHT: Record<ItemRarity, number> = { common: 125, uncommon: 25, rare: 5, epic: 1 };

/**
 * Weighted sample without replacement: each remaining item's chance is
 * proportional to RARITY_WEIGHT[item.rarity], recomputed after every pick so
 * removing a common item doesn't skew the remaining rare-vs-common ratio.
 */
function weightedSampleWithoutReplacement(items: ItemDef[], count: number, rng: Rng): ItemDef[] {
  const pool = [...items];
  const result: ItemDef[] = [];
  while (result.length < count && pool.length > 0) {
    const totalWeight = pool.reduce((sum, item) => sum + RARITY_WEIGHT[item.rarity], 0);
    let roll = rng() * totalWeight;
    let pickedIndex = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      roll -= RARITY_WEIGHT[pool[i].rarity];
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

/**
 * Sums bonusPercent (primary stat) and extraBonusPercent (secondary stat,
 * for hybrid/rare items) across the character's equipped items matching
 * `stat`. 0 if none equipped/matching.
 */
export function itemBonusPercent(character: Character, stat: BoostableStat): number {
  let total = 0;
  for (const id of character.equippedItemIds) {
    const item = ITEM_CATALOG.find((candidate) => candidate.id === id);
    if (!item) continue;
    if (item.stat === stat && item.bonusPercent) total += item.bonusPercent;
    if (item.extraStat === stat && item.extraBonusPercent) total += item.extraBonusPercent;
  }
  return total;
}

/** Human-readable summary of what an item grants, for popups/tooltips. */
export function describeItemBonus(item: ItemDef): string {
  if (item.type === 'consumable') return 'Consumable — grants one free revive on death, while equipped';
  const parts: string[] = [];
  if (item.stat && item.bonusPercent) parts.push(`+${item.bonusPercent}% ${item.stat}`);
  if (item.extraStat && item.extraBonusPercent) parts.push(`+${item.extraBonusPercent}% ${item.extraStat}`);
  return parts.join(', ');
}

/**
 * Rolls this character's item drop for defeating the boss at `bossIndex`.
 * Desired count follows a step curve (more items from later bosses, capped
 * at ITEM_DROP_MAX_COUNT), further capped by how many catalog items this
 * character doesn't already own — returns [] once every item is owned.
 * Rare items are weighted much lower than common ones (see RARITY_WEIGHT).
 */
export function rollItemDrops(character: Character, bossIndex: number, rng: Rng): ItemDef[] {
  const unowned = ITEM_CATALOG.filter((item) => !character.ownedItemIds.includes(item.id));
  const desiredCount = Math.min(
    1 + Math.floor((bossIndex - 1) / TUNING.ITEM_DROP_EVERY_N_BOSSES),
    TUNING.ITEM_DROP_MAX_COUNT,
  );
  const count = Math.min(desiredCount, unowned.length);
  return weightedSampleWithoutReplacement(unowned, count, rng);
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
 * and rare items (whose bonusPercent values don't land on exactly
 * 3/6/10) still map onto one of the 3 existing art tiers per slot instead
 * of silently losing their sprite layer.
 */
function tierForBonusPercent(bonusPercent: number): number | null {
  if (bonusPercent >= 10) return 3;
  if (bonusPercent >= 6) return 2;
  if (bonusPercent >= 3) return 1;
  return null;
}

/**
 * The body-worn sprite layer (a path segment relative to public/sprites/)
 * for an equipped item, or null if it has no visual slot (not equipped, a
 * consumable, or an expGain/critChance item).
 */
export function bodySpriteFor(item: ItemDef | null): string | null {
  if (!item || !item.stat || !item.bonusPercent) return null;
  const slot = BODY_SLOT_BY_STAT[item.stat];
  const tier = tierForBonusPercent(item.bonusPercent);
  if (!slot || !tier) return null;
  return `player/${slot}-${tier}`;
}
