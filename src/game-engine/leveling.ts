import { activeBlind } from './bossSkills';
import { TUNING } from './constants/tuning';
import { isDueOn } from './habits';
import { hasItemEffect, itemBonusPercent, itemFlatBonus } from './items';
import { daysBetweenDayKeys } from './time';
import type { Character, CritBoostStatusEffect, Habit, HealBoostStatusEffect } from './types';

export function expToNextLevel(level: number): number {
  if (level < 5) return 25 * level;
  if (level === 5) return 150;
  return Math.round((level ** 2 * 0.25 + 10 * level + 139.75) / 10) * 10;
}

// Safety valve for the level-up loop below. Kill EXP now follows the
// player's level (see bossExpReward), so no single grant should ever buy
// more than a level or two; the cap is only defense in depth against a
// runaway grant walking the loop one level at a time forever.
const MAX_LEVEL_UPS_PER_GRANT = 2000;

/**
 * Grants EXP (scaled by an equipped expGain bonus) and resolves any
 * resulting level-ups. Each level gained also heals the character
 * TUNING.LEVEL_UP_HEAL_PCT% of max health (at the new level) — lifesteal is
 * deliberately NOT a factor here: it only heals off damage actually dealt to
 * a boss (see `completeHabit`), and a level-up isn't damage dealt. A
 * lifesteal-equipped boss kill still heals you, via that same completeHabit
 * path, for the hit that brought the boss to 0 — this heal is independent of
 * that.
 */
export function addExpAndResolveLevelUps(
  character: Character,
  expGained: number,
): { character: Character; levelsGained: number } {
  let { level, exp } = character;
  exp += expGained * (1 + itemBonusPercent(character, 'expGain') / 100);
  let levelsGained = 0;
  while (exp >= expToNextLevel(level) && levelsGained < MAX_LEVEL_UPS_PER_GRANT) {
    exp -= expToNextLevel(level);
    level += 1;
    levelsGained += 1;
  }

  let currentHealth = character.currentHealth;
  if (levelsGained > 0) {
    const maxHealth = effectiveStat({ ...character, level }, 'health');
    // Sage's Codex raises the per-level heal.
    const healPct = hasItemEffect(character, 'sages-insight') ? TUNING.ITEM_EFFECTS.SAGES_INSIGHT_LEVEL_UP_HEAL_PCT : TUNING.LEVEL_UP_HEAL_PCT;
    currentHealth = Math.min(currentHealth + maxHealth * (healPct / 100) * levelsGained, maxHealth);
  }

  return { character: { ...character, level, exp, currentHealth }, levelsGained };
}

/**
 * EXP for completing a skill: a weekly takes its share of WEEKLY_SKILL_LEVEL_SHARE
 * of a level, split across every weekly; a daily its share of
 * DAILY_SKILL_LEVEL_SHARE, split across the dailies due on `date` plus itself
 * (so a skill resolved on a rest day never divides by zero). Good and bad
 * skills count alike.
 */
export function skillCompletionExp(level: number, habit: Habit, habits: Habit[], date: Date): number {
  if (habit.period === 'weekly') {
    const weeklies = habits.filter((h) => h.period === 'weekly').length;
    return (expToNextLevel(level) * TUNING.WEEKLY_SKILL_LEVEL_SHARE) / Math.max(1, weeklies);
  }
  const dailies = habits.filter((h) => h.period === 'daily' && (isDueOn(h, date) || h.id === habit.id)).length;
  return (expToNextLevel(level) * TUNING.DAILY_SKILL_LEVEL_SHARE) / Math.max(1, dailies);
}

/** A starter stat grown to `level`: health and healing at LEVEL_HEALTH_HEALING_GROWTH_RATE, the damage stats at LEVEL_STAT_GROWTH_RATE. */
export function statAtLevel(starterStatValue: number, level: number, stat: keyof Character['starterStats']): number {
  const rate = stat === 'health' || stat === 'healing' ? TUNING.LEVEL_HEALTH_HEALING_GROWTH_RATE : TUNING.LEVEL_STAT_GROWTH_RATE;
  return starterStatValue * Math.pow(1 + rate, level - 1);
}

/**
 * The character's equipped-item bonus for `stat`, expressed as a multiplier
 * (e.g. 1.06 for a +6% item). The three damage stats also get any
 * `allDamage` bonus; drawbacks (negative percents) pull it below 1.
 */
export function itemStatMultiplier(
  character: Character,
  stat: 'physicalDamage' | 'magicDamage' | 'healing' | 'health' | 'trueDamage',
): number {
  const allDamage = stat === 'healing' || stat === 'health' ? 0 : itemBonusPercent(character, 'allDamage');
  return 1 + (itemBonusPercent(character, stat) + allDamage) / 100;
}

/** statAtLevel(...) scaled by the character's equipped-item bonus for `stat`. */
export function effectiveStat(
  character: Character,
  stat: 'physicalDamage' | 'magicDamage' | 'healing' | 'health' | 'trueDamage',
): number {
  const baseWithFlat = statAtLevel(character.starterStats[stat], character.level, stat) + itemFlatBonus(character, stat);
  return baseWithFlat * itemStatMultiplier(character, stat);
}

/**
 * The character with currentHealth capped at its (item-adjusted) max health —
 * equipping a drawback, dropping a health item, or a catalog rebalance can
 * leave it above. The same character when it's already within max.
 */
export function clampHealthToMax(character: Character): Character {
  const maxHealth = effectiveStat(character, 'health');
  return character.currentHealth > maxHealth ? { ...character, currentHealth: maxHealth } : character;
}

/**
 * The character's crit chance (0-1) after equipped-item bonuses, capped at
 * TUNING.CRIT_CHANCE_CAP so a hit is never guaranteed no matter how many
 * crit items are stacked. Pass `currentDayKey` to include an active Crit boost.
 */
export function effectiveCritChance(character: Character, currentDayKey?: string): number {
  // Blind (a boss skill) stops rolled crits; forced ones (isForcedCrit) still land.
  if (currentDayKey && activeBlind(character, currentDayKey)) return 0;
  const boost = currentDayKey ? (activeCritBoost(character, currentDayKey)?.bonus ?? 0) : 0;
  const raw = character.critChance + itemBonusPercent(character, 'critChance') / 100 + boost;
  return Math.min(raw, TUNING.CRIT_CHANCE_CAP);
}

/**
 * The character's active Crit boost as of `currentDayKey` (`dailyPeriodKey(now)`),
 * or undefined once it has expired. Lazy like activeWoundsEffect — the stale
 * entry stays in `statusEffects` until it's overwritten.
 */
export function activeCritBoost(character: Character, currentDayKey: string): CritBoostStatusEffect | undefined {
  return activeTimedBoost<CritBoostStatusEffect>(character, 'critBoost', currentDayKey);
}

/** The character's active Healing boost as of `currentDayKey`, or undefined once expired. */
export function activeHealBoost(character: Character, currentDayKey: string): HealBoostStatusEffect | undefined {
  return activeTimedBoost<HealBoostStatusEffect>(character, 'healBoost', currentDayKey);
}

function activeTimedBoost<T extends CritBoostStatusEffect | HealBoostStatusEffect>(
  character: Character,
  type: T['type'],
  currentDayKey: string,
): T | undefined {
  const boost = character.statusEffects?.find((e): e is T => e.type === type);
  if (!boost) return undefined;
  return daysBetweenDayKeys(boost.appliedDayKey, currentDayKey) < boost.durationDays ? boost : undefined;
}
