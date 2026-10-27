import type { ItemDef } from '../items';

// The full item catalog — see docs/superpowers/specs/2026-10-23-item-rework-design.md
// for the design rules every entry follows (percent-only scaling stats, magic
// glass cannon vs. physical sustain, one main theme, few hybrids, most epics
// carry a signature effect, relics are side-quest only).
//
// Every non-relic item can drop from level 1, as often as its rarity's share
// at the player's level allows (see dropRarityShares). Relics never drop;
// side quests pay them.
export const ITEM_CATALOG: ItemDef[] = [
  // --- Physical (less damage than magic, carries survivability from uncommon up) ---
  { id: 'rusty-blade', name: 'Rusty Hatchet', icon: 'items/rusty-blade', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'physicalDamage', percent: 3 }] },
  { id: 'steel-sword', name: 'Steel Sword', icon: 'items/steel-sword', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'physicalDamage', percent: 5 }] },
  { id: 'warlords-greatsword', name: "Warlord's Broadsword", icon: 'items/warlords-greatsword', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'physicalDamage', percent: 10 }, { stat: 'health', percent: 5 }] },
  { id: 'runed-warblade', name: 'Frostguard Blade', icon: 'items/runed-warblade', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'physicalDamage', percent: 10 }, { stat: 'armor', flat: 75 }] },
  { id: 'vampiric-fang', name: 'Vampiric Fang', icon: 'items/vampiric-fang', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'physicalDamage', percent: 6 }, { stat: 'lifesteal', percent: 3 }] },
  { id: 'executioners-axe', name: "Executioner's Axe", icon: 'items/executioners-axe', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'physicalDamage', percent: 22 }, { stat: 'armor', flat: 150 }] },
  // Exception: reckless physical, trades health for damage.
  { id: 'berserkers-fury', name: 'Molten Fury', icon: 'items/berserkers-fury', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'physicalDamage', percent: 28 }, { stat: 'critChance', percent: 15 }, { stat: 'health', percent: -10 }] },
  { id: 'godslayer-greatblade', name: 'Godslayer Greatblade', icon: 'items/godslayer-greatblade', type: 'equipment', rarity: 'epic', bonuses: [{ stat: 'physicalDamage', percent: 42 }, { stat: 'health', percent: 10 }, { stat: 'lifesteal', percent: 3 }], effect: 'giantslayer', effectText: '+30% damage to bosses above 75% HP.' },
  // --- Magic (more damage, no survivability, sometimes a drawback) ---
  { id: 'apprentice-wand', name: 'Apprentice Wand', icon: 'items/apprentice-wand', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'magicDamage', percent: 4 }] },
  { id: 'arcane-staff', name: 'Opal Staff', icon: 'items/arcane-staff', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'magicDamage', percent: 6 }] },
  { id: 'archmages-rod', name: "Archmage's Rod", icon: 'items/archmages-rod', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'magicDamage', percent: 13 }] },
  { id: 'stormcaller-staff', name: 'Stormcaller Staff', icon: 'items/stormcaller-staff', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'magicDamage', percent: 30 }, { stat: 'critChance', percent: 6 }] },
  { id: 'void-crystal', name: 'Void Orb', icon: 'items/void-crystal', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'magicDamage', percent: 38 }, { stat: 'health', percent: -10 }] },
  { id: 'wyrmsage-staff', name: 'Wyrmsage Staff', icon: 'items/wyrmsage-staff', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'magicDamage', percent: 32 }, { stat: 'expGain', percent: 10 }] },
  { id: 'galewind-staff', name: 'Galewind Staff', icon: 'items/galewind-staff', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'magicDamage', percent: 28 }, { stat: 'magicPen', percent: 12 }, { stat: 'critChance', percent: 8 }] },
  // Exception: magic with true damage on the side.
  { id: 'azure-staff', name: 'Azure Staff', icon: 'items/azure-staff', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'magicDamage', percent: 28 }, { stat: 'trueDamage', percent: 12 }] },
  { id: 'voidcallers-scepter', name: "Voidcaller's Scepter", icon: 'items/voidcallers-scepter', type: 'equipment', rarity: 'epic', bonuses: [{ stat: 'magicDamage', percent: 55 }, { stat: 'critChance', percent: 8 }], effect: 'void-crits', effectText: 'Magic crits deal 3× damage.' },
  // --- True damage and crit ---
  { id: 'bone-needle', name: 'Crystal Needle', icon: 'items/bone-needle', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'trueDamage', percent: 5 }] },
  { id: 'silver-stiletto', name: 'Frost Stiletto', icon: 'items/silver-stiletto', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'trueDamage', percent: 12 }] },
  { id: 'truthseekers-bow', name: "Truthseeker's Bow", icon: 'items/truthseekers-bow', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'trueDamage', percent: 25 }, { stat: 'critChance', percent: 8 }] },
  { id: 'lucky-dagger', name: 'Lucky Dagger', icon: 'items/lucky-dagger', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'critChance', percent: 2 }] },
  { id: 'assassins-edge', name: "Assassin's Edge", icon: 'items/assassins-edge', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'critChance', percent: 5 }] },
  { id: 'eagle-eye-lens', name: "Seeker's Compass", icon: 'items/eagle-eye-lens', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'critChance', percent: 10 }] },
  // --- The only two physical+magic hybrids that drop (Echoing Blade is the third, a relic) ---
  { id: 'battlemage-gauntlets', name: 'Battlemage Gauntlets', icon: 'items/battlemage-gauntlets', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'physicalDamage', percent: 4 }, { stat: 'magicDamage', percent: 4 }] },
  { id: 'chaos-blade', name: 'Chaos Blade', icon: 'items/chaos-blade', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'physicalDamage', percent: 15 }, { stat: 'magicDamage', percent: 15 }] },
  // --- Tank ---
  { id: 'padded-vest', name: 'Leather Vest', icon: 'items/padded-vest', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'health', percent: 3 }] },
  { id: 'chainmail-hauberk', name: 'Chainmail Hauberk', icon: 'items/chainmail-hauberk', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'health', percent: 6 }] },
  { id: 'iron-buckler', name: 'Crusader Shield', icon: 'items/iron-buckler', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'armor', flat: 75 }] },
  { id: 'ward-cloak', name: 'Warding Robe', icon: 'items/ward-cloak', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'magicResist', flat: 75 }] },
  { id: 'plate-armor', name: 'Plate Armor', icon: 'items/plate-armor', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'health', percent: 10 }] },
  { id: 'ironstride-greaves', name: 'Ironstride Greaves', icon: 'items/ironstride-greaves', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'armor', flat: 150 }, { stat: 'health', percent: 5 }] },
  { id: 'dragons-heart', name: "Dragon's Heart", icon: 'items/dragons-heart', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'health', percent: 20 }, { stat: 'physicalDamage', percent: 10 }] },
  // --- Support and consumable ---
  { id: 'novices-charm', name: "Novice's Rose", icon: 'items/novices-charm', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'healing', percent: 3 }] },
  { id: 'blessed-censer', name: 'Sunstaff', icon: 'items/blessed-censer', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'healing', percent: 6 }] },
  { id: 'sacred-chalice', name: 'Sacred Cauldron', icon: 'items/sacred-chalice', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'healing', percent: 10 }] },
  { id: 'lucky-coin', name: 'Lucky Coffer', icon: 'items/lucky-coin', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'expGain', percent: 3 }] },
  { id: 'shining-star', name: 'Star Wand', icon: 'items/shining-star', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'expGain', percent: 6 }] },
  { id: 'rebirth-orb', name: 'Rebirth Orb', icon: 'items/rebirth-orb', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'expGain', percent: 10 }] },
  { id: 'firebird-staff', name: 'Firebird Staff', icon: 'items/firebird-staff', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'healing', percent: 28 }, { stat: 'lifesteal', percent: 4 }] },
  { id: 'crescent-crook', name: 'Crescent Crook', icon: 'items/crescent-crook', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'healing', percent: 30 }, { stat: 'magicResist', flat: 150 }] },
  { id: 'tome-of-insight', name: 'Tome of Insight', icon: 'items/tome-of-insight', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'expGain', percent: 16 }, { stat: 'critChance', percent: 8 }] },
  { id: 'phoenix-feather', name: 'Phoenix Feather', icon: 'items/phoenix-feather', type: 'consumable', rarity: 'rare', bonuses: [] },

  // --- Second set (stronger for their rarity): physical ---
  { id: 'warded-longsword', name: 'Warded Longsword', icon: 'items/warded-longsword', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'physicalDamage', percent: 10 }, { stat: 'magicResist', flat: 100 }] },
  { id: 'berserkers-war-axe', name: "Berserker's War Axe", icon: 'items/berserkers-war-axe', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'physicalDamage', percent: 24 }, { stat: 'lifesteal', percent: 4 }] },
  { id: 'serrated-ripper', name: 'Crystal Ripper', icon: 'items/serrated-ripper', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'physicalDamage', percent: 24 }, { stat: 'armorPen', percent: 20 }, { stat: 'health', percent: 10 }] },
  { id: 'piercing-fang-gauntlets', name: 'Piercing Fang Gauntlets', icon: 'items/piercing-fang-gauntlets', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'physicalDamage', percent: 20 }, { stat: 'armorPen', percent: 35 }, { stat: 'armor', flat: 150 }] },
  { id: 'duelists-signet', name: "Duelist's Signet", icon: 'items/duelists-signet', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'physicalDamage', percent: 18 }, { stat: 'critChance', percent: 10 }, { stat: 'lifesteal', percent: 2 }] },
  { id: 'bloodthorn-blade', name: 'Bloodcrystal Blade', icon: 'items/bloodthorn-blade', type: 'equipment', rarity: 'epic', bonuses: [{ stat: 'physicalDamage', percent: 45 }, { stat: 'health', percent: 10 }, { stat: 'lifesteal', percent: 3 }], effect: 'bloodthorn', effectText: 'Crits heal 5% of max HP.' },
  // --- Second set: magic ---
  { id: 'scholars-grimoire', name: "Scholar's Grimoire", icon: 'items/scholars-grimoire', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'magicDamage', percent: 10 }, { stat: 'magicPen', percent: 5 }, { stat: 'expGain', percent: 10 }] },
  { id: 'hexed-ring', name: 'Hexed Ring', icon: 'items/hexed-ring', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'magicDamage', percent: 16 }, { stat: 'health', percent: -5 }] },
  { id: 'chaos-conduit', name: 'Chaos Conduit', icon: 'items/chaos-conduit', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'magicDamage', percent: 34 }, { stat: 'magicPen', percent: 20 }] },
  { id: 'cinder-crown', name: 'Cinder Hat', icon: 'items/cinder-crown', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'magicDamage', percent: 42 }, { stat: 'healing', percent: -20 }] },
  { id: 'runeforged-spellblade', name: 'Runeforged Spellblade', icon: 'items/runeforged-spellblade', type: 'equipment', rarity: 'epic', bonuses: [{ stat: 'magicDamage', percent: 55 }, { stat: 'magicPen', percent: 15 }], effect: 'spellweave', effectText: '+5% magic damage per skill used today (max +25%).' },
  // --- Second set: tank ---
  { id: 'warding-sigil', name: 'Warding Pendant', icon: 'items/warding-sigil', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'health', percent: 10 }, { stat: 'magicResist', flat: 150 }] },
  { id: 'bulwark-plate', name: 'Bulwark Plate', icon: 'items/bulwark-plate', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'health', percent: 25 }, { stat: 'healing', percent: 10 }] },
  { id: 'juggernaut-carapace', name: 'Juggernaut Carapace', icon: 'items/juggernaut-carapace', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'armor', flat: 450 }, { stat: 'health', percent: 15 }, { stat: 'physicalDamage', percent: -10 }] },
  { id: 'penitents-hauberk', name: "Penitent's Cuirass", icon: 'items/penitents-hauberk', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'armor', flat: 150 }, { stat: 'healing', percent: 25 }] },
  // Exception: armor + magic resist together.
  { id: 'ascetics-beads', name: "Ascetic's Staff", icon: 'items/ascetics-beads', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'armor', flat: 150 }, { stat: 'magicResist', flat: 150 }, { stat: 'trueDamage', percent: 15 }] },
  { id: 'brawlers-ironhide', name: "Brawler's Harness", icon: 'items/brawlers-ironhide', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'armor', flat: 250 }, { stat: 'physicalDamage', percent: 10 }, { stat: 'critChance', percent: 8 }] },
  // Exception: magic with defense.
  { id: 'spellturner-mantle', name: 'Spellturner Mantle', icon: 'items/spellturner-mantle', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'magicResist', flat: 300 }, { stat: 'magicDamage', percent: 15 }] },
  // Exception: armor + magic resist together.
  { id: 'aegis-of-the-unbroken', name: 'Aegis of the Unbroken', icon: 'items/aegis-of-the-unbroken', type: 'equipment', rarity: 'epic', bonuses: [{ stat: 'health', percent: 35 }, { stat: 'armor', flat: 50 }, { stat: 'magicResist', flat: 50 }], effect: 'wound-immune', effectText: 'Immune to Wounds.' },
  { id: 'bloodbound-carapace', name: 'Bloodbound Carapace', icon: 'items/bloodbound-carapace', type: 'equipment', rarity: 'epic', bonuses: [{ stat: 'health', percent: 30 }, { stat: 'lifesteal', percent: 3 }], effect: 'bloodbound', effectText: 'Bosses can\'t lifesteal from you.' },
  { id: 'dawnguard-helm', name: 'Dawnguard Helm', icon: 'items/dawnguard-helm', type: 'equipment', rarity: 'epic', bonuses: [{ stat: 'health', percent: 20 }, { stat: 'armor', flat: 300 }], effect: 'dawnguard', effectText: 'First hit each day deals half damage.' },
  // --- Second set: support ---
  { id: 'serene-lotus-charm', name: 'Serene Glowcap', icon: 'items/serene-lotus-charm', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'healing', percent: 12 }, { stat: 'expGain', percent: 12 }] },
  { id: 'pilgrims-blessing', name: "Pilgrim's Staff", icon: 'items/pilgrims-blessing', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'healing', percent: 15 }, { stat: 'health', percent: 5 }, { stat: 'expGain', percent: 5 }] },
  { id: 'stalwart-sages-ring', name: "Stalwart Sage's Ring", icon: 'items/stalwart-sages-ring', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'magicResist', flat: 100 }, { stat: 'healing', percent: 8 }] },
  { id: 'font-of-renewal', name: 'Staff of Renewal', icon: 'items/font-of-renewal', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'healing', percent: 30 }, { stat: 'expGain', percent: 5 }] },
  { id: 'adventurers-sigil', name: "Adventurer's Crest", icon: 'items/adventurers-sigil', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'expGain', percent: 15 }, { stat: 'health', percent: 10 }] },
  { id: 'titans-lifeblood', name: "Titan's Lifeblood", icon: 'items/titans-lifeblood', type: 'equipment', rarity: 'epic', bonuses: [{ stat: 'healing', percent: 30 }, { stat: 'health', percent: 20 }], effect: 'titans-mending', effectText: 'Heals 50% more while below half HP.' },
  { id: 'sages-codex', name: "Sage's Codex", icon: 'items/sages-codex', type: 'equipment', rarity: 'epic', bonuses: [{ stat: 'expGain', percent: 15 }, { stat: 'healing', percent: 15 }], effect: 'sages-insight', effectText: 'Level-ups heal 40% of max HP instead of 20%.' },

  // --- Endgame epics: the two strongest, and three stat-only ---
  { id: 'starfall-staff', name: 'Moonstar Staff', icon: 'items/starfall-staff', type: 'equipment', rarity: 'epic', bonuses: [{ stat: 'magicDamage', percent: 75 }, { stat: 'health', percent: -20 }], effect: 'starfall', effectText: 'First magic skill each day always crits.' },
  { id: 'worldbreaker-maul', name: 'Worldbreaker Maul', icon: 'items/worldbreaker-maul', type: 'equipment', rarity: 'epic', bonuses: [{ stat: 'physicalDamage', percent: 55 }, { stat: 'health', percent: 20 }, { stat: 'lifesteal', percent: 3 }], effect: 'worldbreaker', effectText: 'Physical hits ignore the extra armor of armored bosses.' },
  { id: 'colossus-plate', name: 'Colossus Plate', icon: 'items/colossus-plate', type: 'equipment', rarity: 'epic', bonuses: [{ stat: 'health', percent: 45 }, { stat: 'armor', flat: 350 }] },
  { id: 'archons-halo', name: "Archon's Crown", icon: 'items/archons-halo', type: 'equipment', rarity: 'epic', bonuses: [{ stat: 'healing', percent: 40 }, { stat: 'expGain', percent: 15 }] },
  { id: 'sunpiercer-bow', name: 'Frostpiercer Crossbow', icon: 'items/sunpiercer-bow', type: 'equipment', rarity: 'epic', bonuses: [{ stat: 'trueDamage', percent: 40 }, { stat: 'critChance', percent: 12 }] },

  // --- Relics: side quests only, effect-first ---
  { id: 'ember-heart', name: 'Ember Heart', icon: 'items/ember-heart', type: 'equipment', rarity: 'relic', bonuses: [{ stat: 'health', percent: 10 }, { stat: 'healing', percent: 10 }], effect: 'ember-heart', effectText: 'Heal 5% of max HP each day.' },
  { id: 'soul-lantern', name: 'Soul Lantern', icon: 'items/soul-lantern', type: 'equipment', rarity: 'relic', bonuses: [{ stat: 'healing', percent: 12 }, { stat: 'expGain', percent: 5 }], effect: 'soul-lantern', effectText: 'Heal 15% of max HP when a boss falls.' },
  { id: 'first-blood', name: 'First Blood', icon: 'items/first-blood', type: 'equipment', rarity: 'relic', bonuses: [{ stat: 'physicalDamage', percent: 15 }, { stat: 'lifesteal', percent: 3 }], effect: 'first-blood', effectText: 'First hit on each boss always crits.' },
  { id: 'censer-of-wrath', name: 'Torch of Wrath', icon: 'items/censer-of-wrath', type: 'equipment', rarity: 'relic', bonuses: [{ stat: 'healing', percent: 20 }, { stat: 'armor', flat: 100 }], effect: 'censer-of-wrath', effectText: 'Healing skills also hit the boss for half the amount.' },
  { id: 'temperance-seal', name: 'Temperance Seal', icon: 'items/temperance-seal', type: 'equipment', rarity: 'relic', bonuses: [{ stat: 'trueDamage', percent: 20 }, { stat: 'health', percent: 15 }], effect: 'temperance', effectText: 'Resisted bad skills hit 50% harder.' },
  { id: 'quill-of-oaths', name: 'Scroll of Oaths', icon: 'items/quill-of-oaths', type: 'equipment', rarity: 'relic', bonuses: [{ stat: 'expGain', percent: 10 }, { stat: 'magicDamage', percent: 10 }], effect: 'quill-of-oaths', effectText: 'Quests give 50% more EXP.' },
  { id: 'magpie-charm', name: "Magpie's Diamond", icon: 'items/magpie-charm', type: 'equipment', rarity: 'relic', bonuses: [{ stat: 'critChance', percent: 8 }, { stat: 'lifesteal', percent: 3 }], effect: 'magpie', effectText: 'Rare and epic items drop twice as often.' },
  { id: 'headsmans-mark', name: "Headsman's Axe", icon: 'items/headsmans-mark', type: 'equipment', rarity: 'relic', bonuses: [{ stat: 'physicalDamage', percent: 15 }, { stat: 'armorPen', percent: 20 }, { stat: 'health', percent: 10 }], effect: 'headsman', effectText: '+50% damage to bosses below 25% HP.' },
  { id: 'hunters-eye', name: "Hunter's Eye", icon: 'items/hunters-eye', type: 'equipment', rarity: 'relic', bonuses: [{ stat: 'critChance', percent: 12 }, { stat: 'trueDamage', percent: 15 }], effect: 'hunters-eye', effectText: 'Crits ignore armor and magic resist.' },
  { id: 'moonwell', name: 'Moonwell Staff', icon: 'items/moonwell', type: 'equipment', rarity: 'relic', bonuses: [{ stat: 'healing', percent: 20 }, { stat: 'magicDamage', percent: 15 }], effect: 'moonwell', effectText: 'Weekly skills are 50% stronger.' },
  { id: 'dynamo-core', name: 'Dynamo Rod', icon: 'items/dynamo-core', type: 'equipment', rarity: 'relic', bonuses: [{ stat: 'magicDamage', percent: 20 }, { stat: 'critChance', percent: 10 }], effect: 'dynamo', effectText: 'Overdrive uses deal full damage.' },
  { id: 'banner-of-endurance', name: 'Banner of Endurance', icon: 'items/banner-of-endurance', type: 'equipment', rarity: 'relic', bonuses: [{ stat: 'physicalDamage', percent: 12 }, { stat: 'health', percent: 15 }], effect: 'banner', effectText: 'Streak milestones give double EXP.' },
  { id: 'null-mirror', name: 'Null Mirror', icon: 'items/null-mirror', type: 'equipment', rarity: 'relic', bonuses: [{ stat: 'magicResist', flat: 300 }, { stat: 'health', percent: 25 }], effect: 'null-mirror', effectText: 'Boss reflect can\'t hurt you.' },
  // Exception: physical + magic hybrid.
  { id: 'echoing-blade', name: 'Echoing Blade', icon: 'items/echoing-blade', type: 'equipment', rarity: 'relic', bonuses: [{ stat: 'physicalDamage', percent: 20 }, { stat: 'magicDamage', percent: 20 }], effect: 'echoing-blade', effectText: 'Overkill damage carries into the next boss.' },
  // Exception: all damage types, paid for in health.
  { id: 'glass-crown', name: 'Glass Crown', icon: 'items/glass-crown', type: 'equipment', rarity: 'relic', bonuses: [{ stat: 'allDamage', percent: 40 }, { stat: 'health', percent: -30 }] },
];
