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
  QuestKind,
  QuestWeek,
  StatusEffect,
  CritBoostStatusEffect,
  HealBoostStatusEffect,
  WoundsStatusEffect,
} from './types';

export {
  applyDamagePoolRebalance,
  applyHealingRebalance,
  createCharacter,
  DEFAULT_HERO_NAME,
  discardUnequippedItems,
  discardUnknownItems,
  heroClassFor,
  MAX_HERO_NAME_LENGTH,
  migrateCharacter,
  nameCharacter,
  randomizeStat,
} from './character';
export type { HeroClass } from './character';

export {
  addExpAndResolveLevelUps,
  clampHealthToMax,
  activeCritBoost,
  activeHealBoost,
  effectiveCritChance,
  effectiveStat,
  expToNextLevel,
  itemStatMultiplier,
  statAtLevel,
} from './leveling';

export {
  computeDamageSplit,
  createHabit,
  dueFraction,
  isDueOn,
  migrateHabitDamageType,
  nextDueDay,
  normalizeDays,
  poolSizeMultiplier,
  rerollDamageType,
  resetLevelRewards,
} from './habits';

export { completeHabitStreak, resetHabitStreak, streakMultiplier } from './streaks';

export {
  applyResist,
  bossAttackAnchorHealth,
  bossExpReward,
  bossBaseHealth,
  damageReductionPct,
  expectedLevelForBossIndex,
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
  recordSideQuestOffer,
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

export {
  applyDailyRegen,
  bumpSpellweave,
  critMultiplierFor,
  effectDamageMultiplier,
  hasItemEffect,
  isForcedCrit,
  spellweaveStacks,
} from './itemEffects';

export type { BoostableStat, DropRarity, ItemBonus, ItemDef, ItemEffectId, ItemRarity } from './items';
export {
  assignNewItemUnlockTiers,
  availableRelics,
  backfillUnlockTiers,
  describeItemBonus,
  describeItemBonusParts,
  doublableItems,
  itemDoubleFactor,
  ITEM_CATALOG,
  itemBonusPercent,
  itemFlatBonus,
  MAX_EQUIP_SLOTS,
  maxEquipSlots,
  recordRelicEarned,
  rollItemDrops,
} from './items';

export {
  createQuest,
  cumulativeSlotWeight,
  migrateQuest,
  migrateQuestUnlock,
  questMissDamage,
  questRewardExp,
  questRewardTier,
  questsOpen,
  questSlotExp,
  questUnlockPending,
  questWeekFor,
  questWeeklyTargetExp,
  QUESTS_UNLOCK_LEVEL,
  recordQuestCompletion,
  unlockQuests,
} from './quests';

export type { Rng } from './rng';
export { createRng, pickRandom, pickWeighted, shuffle } from './rng';

export { dailyPeriodKey, dayOfWeekIndex, daysBetweenDayKeys, periodKeyFor, weeklyPeriodKey } from './time';
