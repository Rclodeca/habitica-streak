import { applyResist, bossExpReward, generateBoss } from './boss';
import { createCharacter } from './character';
import { DIFFICULTY_WEIGHT } from './constants/difficulty';
import { TUNING } from './constants/tuning';
import { computeDamageSplit, rerollDamageType } from './habits';
import { addExpAndResolveLevelUps, effectiveStat } from './leveling';
import { rollItemDrops } from './items';
import type { ItemDef } from './items';
import type { Rng } from './rng';
import { completeHabitStreak, resetHabitStreak, streakMultiplier } from './streaks';
import type { Boss, Character, DamageType, Habit } from './types';

/** Maps a habit's damage type to the starter-stat field that drives it. */
export const DAMAGE_TYPE_STARTER_STAT: Record<DamageType, keyof Character['starterStats']> = {
  physical: 'physicalDamage',
  magic: 'magicDamage',
  healing: 'healing',
};

export type CombatResult = {
  character: Character;
  boss: Boss;
  updatedHabit: Habit;
  milestoneExp: number;
  damageDealt?: number;
};

/**
 * Resolves completing a habit: computes the habit's share of damage/healing
 * for its type, applies the streak multiplier, bumps the streak, and either
 * heals the character (healing type — boss untouched) or damages the boss
 * (physical/magic type — reduced by the boss's matching resist stat).
 */
export function completeHabit(
  character: Character,
  habit: Habit,
  allHabitsOfSameType: Habit[],
  boss: Boss,
): CombatResult {
  const statValue = effectiveStat(character, DAMAGE_TYPE_STARTER_STAT[habit.damageType]);
  const split = computeDamageSplit(allHabitsOfSameType, statValue);
  const baseDamage = split.get(habit.id) ?? 0;
  const { habit: updatedHabit, milestoneExp } = completeHabitStreak(habit);
  const multiplier = streakMultiplier(updatedHabit.streakCount);
  const amount = baseDamage * multiplier;

  if (habit.damageType === 'healing') {
    const healed = Math.min(character.currentHealth + amount, effectiveStat(character, 'health'));
    return { character: { ...character, currentHealth: healed }, boss, updatedHabit, milestoneExp };
  }

  const resistStat = habit.damageType === 'physical' ? boss.armor : boss.magicResist;
  const dealt = applyResist(amount, resistStat);
  const newBoss = { ...boss, health: Math.max(0, boss.health - dealt) };
  return { character, boss: newBoss, updatedHabit, milestoneExp, damageDealt: dealt };
}

/**
 * Resolves missing a habit: resets its streak and damages the character
 * based on the boss's average attack, scaled by the habit's difficulty.
 */
export function missHabit(
  character: Character,
  habit: Habit,
  boss: Boss,
): { character: Character; updatedHabit: Habit } {
  const updatedHabit = resetHabitStreak(habit);
  const avgAttack = (boss.physicalAttack + boss.magicAttack) / 2;
  const damage = avgAttack * TUNING.MISS_DAMAGE_FACTOR * (DIFFICULTY_WEIGHT[habit.difficulty] / 1.5);
  const newHealth = Math.max(0, character.currentHealth - damage);
  return { character: { ...character, currentHealth: newHealth }, updatedHabit };
}

/**
 * No-op unless the boss's health has reached 0. When it has, grants the
 * boss's EXP reward (resolving any resulting level-ups), rolls this
 * character's item drop for this kill, and spawns the next boss.
 */
export function resolveBossDefeatIfDead(
  character: Character,
  boss: Boss,
  rng: Rng,
): { character: Character; boss: Boss; defeated: boolean; levelsGained: number; itemsDropped: ItemDef[] } {
  if (boss.health > 0) return { character, boss, defeated: false, levelsGained: 0, itemsDropped: [] };
  const { character: leveled, levelsGained } = addExpAndResolveLevelUps(character, bossExpReward(boss.index));
  const itemsDropped = rollItemDrops(leveled, boss.index, rng);
  const withItems: Character = {
    ...leveled,
    ownedItemIds: [...leveled.ownedItemIds, ...itemsDropped.map((item) => item.id)],
  };
  return { character: withItems, boss: generateBoss(boss.index + 1, rng), defeated: true, levelsGained, itemsDropped };
}

/**
 * No-op unless the character's health has reached 0. When it has, resets
 * the run: a fresh character, the boss sequence restarted at index 1, and
 * the same habit definitions retained but with streaks reset and damage
 * types re-rolled.
 */
export function resolvePlayerDeathIfDead(
  character: Character,
  boss: Boss,
  habits: Habit[],
  rng: Rng,
): { character: Character; boss: Boss; habits: Habit[]; died: boolean } {
  if (character.currentHealth > 0) return { character, boss, habits, died: false };
  return {
    character: createCharacter(rng),
    boss: generateBoss(1, rng),
    habits: habits.map((h) => rerollDamageType(resetHabitStreak(h), rng)),
    died: true,
  };
}
