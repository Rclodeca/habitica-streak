import { TUNING } from './constants/tuning';
import { shuffle } from './rng';
import type { Rng } from './rng';
import type { Character } from './types';

export type BoostableStat = 'physicalDamage' | 'magicDamage' | 'healing' | 'health' | 'expGain';

export interface ItemDef {
  id: string;
  name: string;
  icon: string; // path segment relative to public/sprites/, passed straight to an <img>/Sprite
  stat: BoostableStat;
  bonusPercent: number;
}

export const ITEM_CATALOG: ItemDef[] = [
  { id: 'rusty-blade', name: 'Rusty Blade', icon: 'items/rusty-blade', stat: 'physicalDamage', bonusPercent: 3 },
  { id: 'steel-sword', name: 'Steel Sword', icon: 'items/steel-sword', stat: 'physicalDamage', bonusPercent: 6 },
  {
    id: 'warlords-greatsword',
    name: "Warlord's Greatsword",
    icon: 'items/warlords-greatsword',
    stat: 'physicalDamage',
    bonusPercent: 10,
  },
  { id: 'apprentice-wand', name: 'Apprentice Wand', icon: 'items/apprentice-wand', stat: 'magicDamage', bonusPercent: 3 },
  { id: 'arcane-staff', name: 'Arcane Staff', icon: 'items/arcane-staff', stat: 'magicDamage', bonusPercent: 6 },
  { id: 'archmages-rod', name: "Archmage's Rod", icon: 'items/archmages-rod', stat: 'magicDamage', bonusPercent: 10 },
  { id: 'novices-charm', name: "Novice's Charm", icon: 'items/novices-charm', stat: 'healing', bonusPercent: 3 },
  { id: 'blessed-censer', name: 'Blessed Censer', icon: 'items/blessed-censer', stat: 'healing', bonusPercent: 6 },
  { id: 'sacred-chalice', name: 'Sacred Chalice', icon: 'items/sacred-chalice', stat: 'healing', bonusPercent: 10 },
  { id: 'padded-vest', name: 'Padded Vest', icon: 'items/padded-vest', stat: 'health', bonusPercent: 3 },
  { id: 'chainmail-hauberk', name: 'Chainmail Hauberk', icon: 'items/chainmail-hauberk', stat: 'health', bonusPercent: 6 },
  { id: 'plate-armor', name: 'Plate Armor', icon: 'items/plate-armor', stat: 'health', bonusPercent: 10 },
  { id: 'lucky-coin', name: 'Lucky Coin', icon: 'items/lucky-coin', stat: 'expGain', bonusPercent: 3 },
  { id: 'shining-star', name: 'Shining Star', icon: 'items/shining-star', stat: 'expGain', bonusPercent: 6 },
  { id: 'rebirth-orb', name: 'Rebirth Orb', icon: 'items/rebirth-orb', stat: 'expGain', bonusPercent: 10 },
];

/** Sums bonusPercent across the character's equipped items matching `stat`. 0 if none equipped/matching. */
export function itemBonusPercent(character: Character, stat: BoostableStat): number {
  let total = 0;
  for (const id of character.equippedItemIds) {
    const item = ITEM_CATALOG.find((candidate) => candidate.id === id);
    if (item && item.stat === stat) total += item.bonusPercent;
  }
  return total;
}

/**
 * Rolls this character's item drop for defeating the boss at `bossIndex`.
 * Desired count follows a step curve (more items from later bosses, capped
 * at ITEM_DROP_MAX_COUNT), further capped by how many catalog items this
 * character doesn't already own — returns [] once every item is owned.
 */
export function rollItemDrops(character: Character, bossIndex: number, rng: Rng): ItemDef[] {
  const unowned = ITEM_CATALOG.filter((item) => !character.ownedItemIds.includes(item.id));
  const desiredCount = Math.min(
    1 + Math.floor((bossIndex - 1) / TUNING.ITEM_DROP_EVERY_N_BOSSES),
    TUNING.ITEM_DROP_MAX_COUNT,
  );
  const count = Math.min(desiredCount, unowned.length);
  return shuffle(unowned, rng).slice(0, count);
}

// Which body-worn sprite slot each stat category renders as on the player
// sprite. expGain has no entry — those items (coins/stars/orbs) have no
// natural body slot and stay icon-grid-only.
const BODY_SLOT_BY_STAT: Partial<Record<BoostableStat, string>> = {
  physicalDamage: 'weapon-physical',
  magicDamage: 'weapon-magic',
  health: 'armor',
  healing: 'shield',
};

// bonusPercent -> art tier. The catalog's 3 tiers per stat (3%/6%/10%) map
// directly to the 3 body-sprite tiers sourced for each slot.
const TIER_BY_BONUS_PERCENT: Record<number, number> = { 3: 1, 6: 2, 10: 3 };

/**
 * The body-worn sprite layer (a path segment relative to public/sprites/)
 * for an equipped item, or null if it has no visual slot (not equipped, or
 * an expGain item). Pure derivation from the item's own stat/bonusPercent —
 * no new catalog field needed.
 */
export function bodySpriteFor(item: ItemDef | null): string | null {
  if (!item) return null;
  const slot = BODY_SLOT_BY_STAT[item.stat];
  const tier = TIER_BY_BONUS_PERCENT[item.bonusPercent];
  if (!slot || !tier) return null;
  return `player/${slot}-${tier}`;
}
