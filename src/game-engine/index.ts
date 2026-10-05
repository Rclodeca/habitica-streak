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
  WoundsStatusEffect,
} from './types';

export { applyDamagePoolRebalance, createCharacter, migrateCharacter, randomizeStat } from './character';

export {
  addExpAndResolveLevelUps,
  effectiveCritChance,
  effectiveStat,
  expToNextLevel,
  itemStatMultiplier,
  statAtLevel,
} from './leveling';

export { computeDamageSplit, createHabit, rerollDamageType, resetLevelRewards } from './habits';

export { completeHabitStreak, resetHabitStreak, streakMultiplier } from './streaks';

export {
  applyResist,
  bossExpReward,
  bossPowerBudget,
  damageReductionPct,
  generateBoss,
  PERSONALITY_NAME,
  rollRunDifficultyModifier,
} from './boss';

export { assignSpecialIfEligible, assignUltIfEligible, rollOverdriveForLevelUps } from './levelRewards';

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
  ITEM_CATALOG,
  itemBonusPercent,
  itemFlatBonus,
  maxEquipSlots,
  rollItemDrops,
} from './items';

export { createQuest, questExpReward, questMissDamage, rollQuestOffer } from './quests';

export type { Rng } from './rng';
export { createRng, pickRandom, pickWeighted, shuffle } from './rng';

export { dailyPeriodKey, daysBetweenDayKeys, periodKeyFor, weeklyPeriodKey } from './time';
