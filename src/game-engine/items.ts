import { TUNING } from './constants/tuning';
import { shuffle, type Rng } from './rng';
import type { Character } from './types';

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
  | 'magicResist'; // flat only — player mitigation stat, see combat.ts missHabit

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic';

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
  // Present only on the 19 items introduced in the 2026-10-02 item overhaul;
  // absent/falsy on the original 30. Gates this item out of rollItemDrops
  // until the character's rolled-for-this-run unlock tier (see
  // assignNewItemUnlockTiers) is at or below the character's level.
  levelGated?: true;
}

export const ITEM_CATALOG: ItemDef[] = [
  // --- Physical damage (common -> epic; the only stat-category with a 5-tier spread up to +50%) ---
  { id: 'rusty-blade', name: 'Rusty Blade', icon: 'items/rusty-blade', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'physicalDamage', percent: 3 }] },
  { id: 'steel-sword', name: 'Steel Sword', icon: 'items/steel-sword', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'physicalDamage', percent: 6 }] },
  { id: 'warlords-greatsword', name: "Warlord's Greatsword", icon: 'items/warlords-greatsword', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'physicalDamage', percent: 12 }] },
  { id: 'executioners-axe', name: "Executioner's Axe", icon: 'items/executioners-axe', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'physicalDamage', percent: 25 }] },
  { id: 'godslayer-greatblade', name: 'Godslayer Greatblade', icon: 'items/godslayer-greatblade', type: 'equipment', rarity: 'epic', bonuses: [{ stat: 'physicalDamage', percent: 50 }] },
  // --- Magic damage (common -> epic; mirrors the physical damage spread above) ---
  { id: 'apprentice-wand', name: 'Apprentice Wand', icon: 'items/apprentice-wand', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'magicDamage', percent: 3 }] },
  { id: 'arcane-staff', name: 'Arcane Staff', icon: 'items/arcane-staff', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'magicDamage', percent: 6 }] },
  { id: 'archmages-rod', name: "Archmage's Rod", icon: 'items/archmages-rod', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'magicDamage', percent: 12 }] },
  { id: 'stormcaller-staff', name: 'Stormcaller Staff', icon: 'items/stormcaller-staff', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'magicDamage', percent: 25 }] },
  { id: 'voidcallers-scepter', name: "Voidcaller's Scepter", icon: 'items/voidcallers-scepter', type: 'equipment', rarity: 'epic', bonuses: [{ stat: 'magicDamage', percent: 50 }] },
  // --- Healing (common) ---
  { id: 'novices-charm', name: "Novice's Charm", icon: 'items/novices-charm', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'healing', percent: 3 }] },
  { id: 'blessed-censer', name: 'Blessed Censer', icon: 'items/blessed-censer', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'healing', percent: 6 }] },
  { id: 'sacred-chalice', name: 'Sacred Chalice', icon: 'items/sacred-chalice', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'healing', percent: 10 }] },
  // --- Health (common) ---
  { id: 'padded-vest', name: 'Padded Vest', icon: 'items/padded-vest', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'health', percent: 3 }] },
  { id: 'chainmail-hauberk', name: 'Chainmail Hauberk', icon: 'items/chainmail-hauberk', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'health', percent: 6 }] },
  { id: 'plate-armor', name: 'Plate Armor', icon: 'items/plate-armor', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'health', percent: 10 }] },
  // --- Exp gain (common) ---
  { id: 'lucky-coin', name: 'Lucky Coin', icon: 'items/lucky-coin', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'expGain', percent: 3 }] },
  { id: 'shining-star', name: 'Shining Star', icon: 'items/shining-star', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'expGain', percent: 6 }] },
  { id: 'rebirth-orb', name: 'Rebirth Orb', icon: 'items/rebirth-orb', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'expGain', percent: 10 }] },
  // --- Crit chance (common) ---
  { id: 'lucky-dagger', name: 'Lucky Dagger', icon: 'items/lucky-dagger', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'critChance', percent: 2 }] },
  { id: 'assassins-edge', name: "Assassin's Edge", icon: 'items/assassins-edge', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'critChance', percent: 5 }] },
  { id: 'eagle-eye-lens', name: 'Eagle Eye Lens', icon: 'items/eagle-eye-lens', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'critChance', percent: 10 }] },
  // --- Hybrid physical + magic damage (common) ---
  { id: 'battlemage-gauntlets', name: 'Battlemage Gauntlets', icon: 'items/battlemage-gauntlets', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'physicalDamage', percent: 4 }, { stat: 'magicDamage', percent: 4 }] },
  { id: 'runed-warblade', name: 'Runed Warblade', icon: 'items/runed-warblade', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'physicalDamage', percent: 8 }, { stat: 'magicDamage', percent: 8 }] },
  { id: 'chaos-blade', name: 'Chaos Blade', icon: 'items/chaos-blade', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'physicalDamage', percent: 15 }, { stat: 'magicDamage', percent: 15 }] },
  // --- Rare multi-stat items (bigger swings, much rarer drops) ---
  { id: 'dragons-heart', name: "Dragon's Heart", icon: 'items/dragons-heart', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'health', percent: 20 }, { stat: 'physicalDamage', percent: 10 }] },
  { id: 'void-crystal', name: 'Void Crystal', icon: 'items/void-crystal', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'magicDamage', percent: 15 }, { stat: 'critChance', percent: 15 }] },
  { id: 'berserkers-fury', name: "Berserker's Fury", icon: 'items/berserkers-fury', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'physicalDamage', percent: 20 }, { stat: 'critChance', percent: 15 }] },
  // --- Lifesteal (uncommon) ---
  { id: 'vampiric-fang', name: 'Vampiric Fang', icon: 'items/vampiric-fang', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'lifesteal', percent: 5 }] },
  // --- Consumable ---
  { id: 'phoenix-feather', name: 'Phoenix Feather', icon: 'items/phoenix-feather', type: 'consumable', rarity: 'rare', bonuses: [] },
  // --- Level-gated items (2026-10-02 item overhaul) — unlock tier per
  // character is randomized once per run by assignNewItemUnlockTiers, not
  // fixed here; levelGated just marks membership in that random pool. ---
  // Physical
  { id: 'berserkers-war-axe', name: "Berserker's War Axe", icon: 'items/berserkers-war-axe', type: 'equipment', rarity: 'rare', levelGated: true, bonuses: [{ stat: 'physicalDamage', flat: 200 }, { stat: 'lifesteal', percent: 5 }] },
  { id: 'serrated-ripper', name: 'Serrated Ripper', icon: 'items/serrated-ripper', type: 'equipment', rarity: 'rare', levelGated: true, bonuses: [{ stat: 'physicalDamage', flat: 150 }, { stat: 'armorPen', percent: 20 }] },
  { id: 'bloodthorn-blade', name: 'Bloodthorn Blade', icon: 'items/bloodthorn-blade', type: 'equipment', rarity: 'epic', levelGated: true, bonuses: [{ stat: 'physicalDamage', flat: 100 }, { stat: 'physicalDamage', percent: 10 }, { stat: 'lifesteal', percent: 2 }, { stat: 'armorPen', percent: 10 }] },
  { id: 'piercing-fang-gauntlets', name: 'Piercing Fang Gauntlets', icon: 'items/piercing-fang-gauntlets', type: 'equipment', rarity: 'epic', levelGated: true, bonuses: [{ stat: 'armorPen', percent: 30 }, { stat: 'physicalDamage', percent: 10 }, { stat: 'health', flat: 200 }] },
  // Magic
  { id: 'runeforged-spellblade', name: 'Runeforged Spellblade', icon: 'items/runeforged-spellblade', type: 'equipment', rarity: 'epic', levelGated: true, bonuses: [{ stat: 'magicDamage', flat: 400 }, { stat: 'magicResist', flat: 100 }] },
  { id: 'chaos-conduit', name: 'Chaos Conduit', icon: 'items/chaos-conduit', type: 'equipment', rarity: 'rare', levelGated: true, bonuses: [{ stat: 'magicDamage', percent: 30 }, { stat: 'magicPen', percent: 20 }] },
  { id: 'scholars-grimoire', name: "Scholar's Grimoire", icon: 'items/scholars-grimoire', type: 'equipment', rarity: 'uncommon', levelGated: true, bonuses: [{ stat: 'magicDamage', flat: 100 }, { stat: 'magicPen', percent: 5 }, { stat: 'expGain', percent: 10 }] },
  // Defense
  { id: 'bulwark-plate', name: 'Bulwark Plate', icon: 'items/bulwark-plate', type: 'equipment', rarity: 'rare', levelGated: true, bonuses: [{ stat: 'health', percent: 10 }, { stat: 'health', flat: 500 }] },
  { id: 'aegis-of-the-unbroken', name: 'Aegis of the Unbroken', icon: 'items/aegis-of-the-unbroken', type: 'equipment', rarity: 'epic', levelGated: true, bonuses: [{ stat: 'health', flat: 200 }, { stat: 'health', percent: 20 }, { stat: 'armor', flat: 50 }, { stat: 'magicResist', flat: 50 }] },
  { id: 'juggernaut-carapace', name: 'Juggernaut Carapace', icon: 'items/juggernaut-carapace', type: 'equipment', rarity: 'rare', levelGated: true, bonuses: [{ stat: 'armor', flat: 300 }, { stat: 'health', flat: 200 }] },
  { id: 'warding-sigil', name: 'Warding Sigil', icon: 'items/warding-sigil', type: 'equipment', rarity: 'uncommon', levelGated: true, bonuses: [{ stat: 'health', percent: 10 }, { stat: 'magicResist', flat: 150 }] },
  // Support
  { id: 'serene-lotus-charm', name: 'Serene Lotus Charm', icon: 'items/serene-lotus-charm', type: 'equipment', rarity: 'uncommon', levelGated: true, bonuses: [{ stat: 'healing', percent: 12 }, { stat: 'expGain', percent: 12 }] },
  { id: 'font-of-renewal', name: 'Font of Renewal', icon: 'items/font-of-renewal', type: 'equipment', rarity: 'rare', levelGated: true, bonuses: [{ stat: 'healing', flat: 200 }, { stat: 'expGain', percent: 5 }] },
  { id: 'pilgrims-blessing', name: "Pilgrim's Blessing", icon: 'items/pilgrims-blessing', type: 'equipment', rarity: 'uncommon', levelGated: true, bonuses: [{ stat: 'healing', flat: 100 }, { stat: 'health', percent: 5 }, { stat: 'expGain', percent: 5 }] },
  { id: 'adventurers-sigil', name: "Adventurer's Sigil", icon: 'items/adventurers-sigil', type: 'equipment', rarity: 'rare', levelGated: true, bonuses: [{ stat: 'expGain', percent: 10 }, { stat: 'health', percent: 10 }, { stat: 'lifesteal', percent: 2 }, { stat: 'armor', flat: 100 }] },
  // Balanced
  { id: 'duelists-signet', name: "Duelist's Signet", icon: 'items/duelists-signet', type: 'equipment', rarity: 'rare', levelGated: true, bonuses: [{ stat: 'health', flat: 100 }, { stat: 'physicalDamage', flat: 50 }, { stat: 'armorPen', percent: 20 }, { stat: 'lifesteal', percent: 2 }] },
  { id: 'warded-longsword', name: 'Warded Longsword', icon: 'items/warded-longsword', type: 'equipment', rarity: 'uncommon', levelGated: true, bonuses: [{ stat: 'armor', flat: 100 }, { stat: 'magicDamage', flat: 50 }] },
  { id: 'stalwart-sages-ring', name: "Stalwart Sage's Ring", icon: 'items/stalwart-sages-ring', type: 'equipment', rarity: 'uncommon', levelGated: true, bonuses: [{ stat: 'armor', flat: 50 }, { stat: 'magicResist', flat: 50 }, { stat: 'healing', percent: 5 }, { stat: 'health', percent: 5 }] },
  { id: 'titans-lifeblood', name: "Titan's Lifeblood", icon: 'items/titans-lifeblood', type: 'equipment', rarity: 'epic', levelGated: true, bonuses: [{ stat: 'health', flat: 1000 }, { stat: 'healing', percent: 5 }, { stat: 'lifesteal', percent: 5 }] },
];

// Each tier is 5x rarer than the one above (common:uncommon:rare:epic ==
// 125:25:5:1). With the current 13 common/8 uncommon/7 rare/2 epic catalog,
// a single roll from the full pool lands on: common ~87%, uncommon ~11%,
// rare ~1.9%, epic ~0.1%. Since each boss kill rolls up to
// ITEM_DROP_MAX_COUNT items without replacement, per-kill odds of at least
// one non-common item compound higher than that single-roll number — this
// keeps epic (the new +50%-damage tier) genuinely rare rather than
// something you stumble into quickly.
//
// By boss 20, rarity weights converge to equal (31 each), so all rarities
// become equally common in the late game as a progression reward.
const INITIAL_RARITY_WEIGHT: Record<ItemRarity, number> = { common: 125, uncommon: 25, rare: 5, epic: 1 };
const RARITY_CONVERGENCE_BOSS = 20;
const EQUAL_RARITY_WEIGHT: Record<ItemRarity, number> = { common: 31, uncommon: 31, rare: 31, epic: 31 };

function rarityWeightByBossIndex(bossIndex: number): Record<ItemRarity, number> {
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
function weightedSampleWithoutReplacement(items: ItemDef[], count: number, rarityWeight: Record<ItemRarity, number>, rng: Rng): ItemDef[] {
  const pool = [...items];
  const result: ItemDef[] = [];
  while (result.length < count && pool.length > 0) {
    const totalWeight = pool.reduce((sum, item) => sum + rarityWeight[item.rarity], 0);
    let roll = rng() * totalWeight;
    let pickedIndex = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      roll -= rarityWeight[pool[i].rarity];
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
 * Sums bonus.percent across every equipped item's `bonuses` entries matching
 * `stat`. 0 if none equipped/matching.
 */
export function itemBonusPercent(character: Character, stat: BoostableStat): number {
  let total = 0;
  for (const id of character.equippedItemIds) {
    const item = ITEM_CATALOG.find((candidate) => candidate.id === id);
    if (!item) continue;
    for (const bonus of item.bonuses) {
      if (bonus.stat === stat && bonus.percent) total += bonus.percent;
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
      if (bonus.stat === stat && bonus.flat) total += bonus.flat;
    }
  }
  return total;
}

/** Human-readable summary of what an item grants, for popups/tooltips. */
export function describeItemBonus(item: ItemDef): string {
  if (item.type === 'consumable') return 'Consumable — grants one free revive on death, while equipped';
  const parts: string[] = [];
  for (const bonus of item.bonuses) {
    if (bonus.percent) parts.push(`+${bonus.percent}% ${bonus.stat}`);
    if (bonus.flat) parts.push(`+${bonus.flat} ${bonus.stat}`);
  }
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
  const droppablePool = ITEM_CATALOG.filter((item) => {
    if (!item.levelGated) return true;
    const unlockLevel = character.newItemUnlockTiers?.[item.id];
    return unlockLevel !== undefined && character.level >= unlockLevel;
  });
  const unowned = droppablePool.filter((item) => !character.ownedItemIds.includes(item.id));
  const desiredCount = Math.min(
    1 + Math.floor((bossIndex - 1) / TUNING.ITEM_DROP_EVERY_N_BOSSES),
    TUNING.ITEM_DROP_MAX_COUNT,
  );
  const count = Math.min(desiredCount, unowned.length);
  const rarityWeight = rarityWeightByBossIndex(bossIndex);
  return weightedSampleWithoutReplacement(unowned, count, rarityWeight, rng);
}

// Computed once at module load from the catalog itself, so the level-gated
// set can never drift out of sync with which items actually carry `levelGated`.
const LEVEL_GATED_ITEM_IDS = ITEM_CATALOG.filter((item) => item.levelGated).map((item) => item.id);

/**
 * Rolls this run's random unlock-tier assignment for every level-gated
 * item: shuffles the 19 ids, then chunks them via Math.ceil(n/3) into three
 * groups (7/7/5 for today's count) mapped to levels 10/15/20. Called once
 * per run, from createCharacter — see Task 3.
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

/** 4 equip slots below level 10, 6 at level 10+. */
export function maxEquipSlots(level: number): number {
  return level >= 10 ? 6 : 4;
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
 * bonusPercent has no equivalent magnitude across stats to threshold against
 * for a flat-only bonus (a flat 200 physicalDamage item and a flat 200
 * health item aren't comparably "big"), so a flat-only body-relevant bonus
 * is tiered by the item's own rarity instead — a signal every item carries
 * uniformly regardless of which stat or flat/percent shape its bonus takes.
 */
function tierForItemRarity(item: ItemDef): number {
  if (item.rarity === 'epic') return 3;
  if (item.rarity === 'rare') return 2;
  return 1;
}

/**
 * The body-worn sprite layer (a path segment relative to public/sprites/)
 * for an equipped item, or null if it has no visual slot (not equipped, a
 * consumable, or a stat with no body-slot mapping). Prefers a percent-based
 * body-relevant bonus (tiered by tierForBonusPercent, unchanged from before
 * flat bonuses existed) if the item has one anywhere in its `bonuses`; only
 * falls back to a flat-only body-relevant bonus (tiered by rarity — see
 * tierForItemRarity) when no percent-based one exists at all.
 */
export function bodySpriteFor(item: ItemDef | null): string | null {
  if (!item) return null;
  const percentBonus = item.bonuses.find((bonus) => bonus.stat in BODY_SLOT_BY_STAT && bonus.percent);
  if (percentBonus && percentBonus.percent) {
    const slot = BODY_SLOT_BY_STAT[percentBonus.stat];
    const tier = tierForBonusPercent(percentBonus.percent);
    if (slot && tier) return `player/${slot}-${tier}`;
  }
  const flatBonus = item.bonuses.find((bonus) => bonus.stat in BODY_SLOT_BY_STAT && bonus.flat);
  if (!flatBonus) return null;
  const slot = BODY_SLOT_BY_STAT[flatBonus.stat];
  if (!slot) return null;
  return `player/${slot}-${tierForItemRarity(item)}`;
}
