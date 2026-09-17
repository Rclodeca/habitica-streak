// Public API of the game engine. Consumers (Pinia stores, composables, UI)
// should import everything from this barrel rather than reaching into
// individual game-engine modules directly.

export type { Boss, Character, DamageType, Difficulty, Habit, Period, Personality } from './types';

export { createCharacter, randomizeStat } from './character';

export { addExpAndResolveLevelUps, effectiveStat, expToNextLevel, statAtLevel } from './leveling';

export { computeDamageSplit, createHabit, rerollDamageType } from './habits';

export { completeHabitStreak, resetHabitStreak, streakMultiplier } from './streaks';

export { applyResist, bossExpReward, bossPowerBudget, damageReductionPct, generateBoss } from './boss';

export type { CombatResult } from './combat';
export {
  completeHabit,
  DAMAGE_TYPE_STARTER_STAT,
  missHabit,
  resolveBossDefeatIfDead,
  resolvePlayerDeathIfDead,
} from './combat';

export type { BoostableStat, ItemDef } from './items';
export { bodySpriteFor, ITEM_CATALOG, itemBonusPercent, rollItemDrops } from './items';

export type { Rng } from './rng';
export { createRng, pickWeighted, shuffle } from './rng';

export { dailyPeriodKey, periodKeyFor, weeklyPeriodKey } from './time';
