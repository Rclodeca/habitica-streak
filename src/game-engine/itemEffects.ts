// Epic signature and relic effects: lookups plus the per-effect math, called
// from the seams that own each mechanic (completeHabit/missHabit in combat.ts,
// level-ups in leveling.ts, quest rewards, the daily rollover). Which item
// carries which effect lives in constants/itemCatalog.ts; the numbers live in
// TUNING.ITEM_EFFECTS.

import { TUNING } from './constants/tuning';
import { hasItemEffect } from './items';
import { effectiveStat } from './leveling';
import type { Boss, Character, Habit } from './types';

export { hasItemEffect };

const E = TUNING.ITEM_EFFECTS;

type DailyEffect = keyof NonNullable<Character['effectDayKeys']>;

/** Whether a once-a-day effect has already fired on `currentDayKey`. */
export function effectUsedToday(character: Character, effect: DailyEffect, currentDayKey: string): boolean {
  return character.effectDayKeys?.[effect] === currentDayKey;
}

/** Stamps a once-a-day effect as fired on `currentDayKey`. */
export function stampEffectDay(character: Character, effect: DailyEffect, currentDayKey: string): Character {
  return { ...character, effectDayKeys: { ...character.effectDayKeys, [effect]: currentDayKey } };
}

/** Spellweave stacks for a skill used now: skills already used today, capped. */
export function spellweaveStacks(character: Character, currentDayKey: string): number {
  const weave = character.spellweave;
  return weave && weave.dayKey === currentDayKey ? Math.min(weave.count, E.SPELLWEAVE_MAX_STACKS) : 0;
}

/** Counts one more skill used today for Spellweave; the same character when it isn't equipped. */
export function bumpSpellweave(character: Character, currentDayKey: string): Character {
  if (!hasItemEffect(character, 'spellweave')) return character;
  const count = character.spellweave?.dayKey === currentDayKey ? character.spellweave.count : 0;
  return { ...character, spellweave: { dayKey: currentDayKey, count: count + 1 } };
}

/**
 * Product of the conditional damage/healing effects for this use of `habit`:
 * Giantslayer and Headsman's Mark (damage skills, by boss health), Moonwell
 * (weekly skills of any type), Spellweave (magic, by skills used today) and
 * Temperance Seal (a resisted bad skill). 1 when none apply.
 */
export function effectDamageMultiplier(character: Character, habit: Habit, boss: Boss, currentDayKey: string): number {
  const isDamage = habit.damageType !== 'healing';
  const bossHealthRatio = boss.maxHealth > 0 ? boss.health / boss.maxHealth : 0;
  let multiplier = 1;
  if (isDamage && bossHealthRatio > E.GIANTSLAYER_ABOVE_PCT && hasItemEffect(character, 'giantslayer')) multiplier *= E.GIANTSLAYER_MULTIPLIER;
  if (isDamage && bossHealthRatio < E.HEADSMAN_BELOW_PCT && hasItemEffect(character, 'headsman')) multiplier *= E.HEADSMAN_MULTIPLIER;
  if (habit.period === 'weekly' && hasItemEffect(character, 'moonwell')) multiplier *= E.MOONWELL_MULTIPLIER;
  if (habit.damageType === 'magic' && hasItemEffect(character, 'spellweave')) {
    multiplier *= 1 + E.SPELLWEAVE_PER_SKILL * spellweaveStacks(character, currentDayKey);
  }
  if (habit.isBad && hasItemEffect(character, 'temperance')) multiplier *= E.TEMPERANCE_MULTIPLIER;
  return multiplier;
}

/** Whether Starfall will force this use's crit: the day's first magic skill. */
export function starfallReady(character: Character, habit: Habit, currentDayKey: string): boolean {
  return habit.damageType === 'magic' && !effectUsedToday(character, 'starfall', currentDayKey) && hasItemEffect(character, 'starfall');
}

/** First Blood (first hit on a boss) or Starfall (first magic skill of the day) forces a crit. */
export function isForcedCrit(character: Character, habit: Habit, boss: Boss, currentDayKey: string): boolean {
  if (habit.damageType === 'healing') return false;
  if (!boss.playerHasHit && hasItemEffect(character, 'first-blood')) return true;
  return starfallReady(character, habit, currentDayKey);
}

/** A crit's damage multiplier: ×3 for magic with Voidcaller's Scepter, TUNING.CRIT_MULTIPLIER otherwise. */
export function critMultiplierFor(character: Character, habit: Habit): number {
  return habit.damageType === 'magic' && hasItemEffect(character, 'void-crits') ? E.VOID_CRIT_MULTIPLIER : TUNING.CRIT_MULTIPLIER;
}

/**
 * Ember Heart: heals EMBER_HEART_HEAL_PCT% of max health once per day key
 * (run from the daily rollover). The same character and 0 when it isn't
 * equipped or has already fired today.
 */
export function applyDailyRegen(character: Character, currentDayKey: string): { character: Character; healed: number } {
  if (!hasItemEffect(character, 'ember-heart') || effectUsedToday(character, 'emberHeart', currentDayKey)) return { character, healed: 0 };
  const maxHealth = effectiveStat(character, 'health');
  const currentHealth = Math.min(character.currentHealth + maxHealth * (E.EMBER_HEART_HEAL_PCT / 100), maxHealth);
  return {
    character: { ...stampEffectDay(character, 'emberHeart', currentDayKey), currentHealth },
    healed: currentHealth - character.currentHealth,
  };
}
