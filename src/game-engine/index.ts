// Public API of the game engine. Consumers (Pinia stores, composables, UI)
// should import everything from this barrel rather than reaching into
// individual game-engine modules directly.

export type {
  Boss,
  Character,
  DamageType,
  Difficulty,
  Habit,
  Period,
  Personality,
  Quest,
  StatusEffect,
  WoundsAbility,
  CritBoostStatusEffect,
  HealBoostStatusEffect,
  WoundsStatusEffect,
} from './types';

export { applyDamagePoolRebalance, createCharacter, discardUnequippedItems, migrateCharacter, randomizeStat } from './character';

export {
  addExpAndResolveLevelUps,
  activeCritBoost,
  activeHealBoost,
  effectiveCritChance,
  effectiveStat,
  expToNextLevel,
  itemStatMultiplier,
  statAtLevel,
} from './leveling';

export { computeDamageSplit, createHabit, poolSizeMultiplier, rerollDamageType, resetLevelRewards } from './habits';

export { completeHabitStreak, resetHabitStreak, streakMultiplier } from './streaks';

export {
  applyResist,
  bossExpReward,
  bossBaseHealth,
  damageReductionPct,
  generateBoss,
  PERSONALITY_NAME,
  resistPctForIndex,
  rollRunDifficultyModifier,
} from './boss';

export { assignSpecialIfEligible, assignUltIfEligible, grantOverdrive } from './levelRewards';
export {
  applyCritBoostEvent,
  applyDoubleItemEvent,
  applyHealBoostEvent,
  applyHealEvent,
  applyOverdriveEvent,
  applyRerollSkillEvent,
  applySpecialEvent,
  applyUltEvent,
  consumeEventPick,
  eligibleEvents,
  EVENT_DEFS,
  EVENTS_PER_CHOICE,
  getEventDef,
  migrateEventState,
  rollEventChoices,
} from './events';
export type { EventDef, EventId } from './events';

export type { CombatResult, HabitDamageBreakdown } from './combat';
export {
  activeWoundsEffect,
  bossMissDamage,
  completeHabit,
  DAMAGE_TYPE_STARTER_STAT,
  effectiveResistAfterPen,
  expectedMediumDailyDamage,
  habitDamageBreakdown,
  healingMultiplier,
  levelRewardMultiplier,
  missHabit,
  overdriveDamagePreview,
  overdriveHabit,
  overdriveUsesRemaining,
  reviveWithFeatherIfEquipped,
  resolveBossDefeatIfDead,
  resolvePlayerDeathIfDead,
  weeklyBonusMultiplier,
} from './combat';

export type { BoostableStat, ItemBonus, ItemDef, ItemRarity } from './items';
export {
  assignNewItemUnlockTiers,
  bodySpriteFor,
  describeItemBonus,
  describeItemBonusParts,
  doublableItems,
  itemDoubleFactor,
  ITEM_CATALOG,
  itemBonusPercent,
  itemFlatBonus,
  maxEquipSlots,
  rollItemDrops,
} from './items';

export { createQuest, questExpReward, questMissDamage } from './quests';

export type { Rng } from './rng';
export { createRng, pickRandom, pickWeighted, shuffle } from './rng';

export { dailyPeriodKey, daysBetweenDayKeys, periodKeyFor, weeklyPeriodKey } from './time';
