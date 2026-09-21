// Public API of the game engine. Consumers (Pinia stores, composables, UI)
// should import everything from this barrel rather than reaching into
// individual game-engine modules directly.

export type { Boss, Character, DamageType, Difficulty, Habit, Period, Personality } from './types';

export { createCharacter, randomizeStat } from './character';

export { addExpAndResolveLevelUps, effectiveCritChance, effectiveStat, expToNextLevel, statAtLevel } from './leveling';

export { computeDamageSplit, createHabit, rerollDamageType, resetLevelRewards } from './habits';

export { completeHabitStreak, resetHabitStreak, streakMultiplier } from './streaks';

export { applyResist, bossExpReward, bossPowerBudget, damageReductionPct, generateBoss, rollRunDifficultyModifier } from './boss';

export { assignSpecialIfEligible, assignUltIfEligible, rollOverdriveForLevelUps } from './levelRewards';

export type { CombatResult } from './combat';
export {
  completeHabit,
  DAMAGE_TYPE_STARTER_STAT,
  levelRewardMultiplier,
  missHabit,
  overdriveDamagePreview,
  overdriveHabit,
  overdriveUsesRemaining,
  periodRewardMultiplier,
  reviveWithFeatherIfEquipped,
  resolveBossDefeatIfDead,
  resolvePlayerDeathIfDead,
} from './combat';

export type { BoostableStat, ItemDef, ItemRarity } from './items';
export { bodySpriteFor, describeItemBonus, ITEM_CATALOG, itemBonusPercent, rollItemDrops } from './items';

export type { Rng } from './rng';
export { createRng, pickRandom, pickWeighted, shuffle } from './rng';

export { dailyPeriodKey, periodKeyFor, weeklyPeriodKey } from './time';
