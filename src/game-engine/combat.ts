import { applyResist, bossExpReward, generateBoss } from './boss';
import { createCharacter } from './character';
import { DIFFICULTY_WEIGHT } from './constants/difficulty';
import { TUNING } from './constants/tuning';
import { computeDamageSplit, rerollDamageType } from './habits';
import { addExpAndResolveLevelUps, effectiveCritChance, effectiveStat } from './leveling';
import { itemBonusPercent, rollItemDrops } from './items';
import type { ItemDef } from './items';
import type { Rng } from './rng';
import { completeHabitStreak, resetHabitStreak, streakMultiplier } from './streaks';
import type { Boss, Character, DamageType, Habit } from './types';

const REVIVE_ITEM_ID = 'phoenix-feather';
const REVIVE_HEALTH_FRACTION = 0.5;

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
  wasCrit?: boolean;
};

/**
 * Resolves completing a habit: computes the habit's share of damage/healing
 * for its type, applies the streak multiplier, bumps the streak, and either
 * heals the character (healing type — boss untouched) or damages the boss
 * (physical/magic type — reduced by the boss's matching resist stat and, on
 * a crit roll, doubled). Healing habits never crit. A lifesteal item bonus
 * heals the character for a percent of the damage actually dealt.
 */
export function completeHabit(
  character: Character,
  habit: Habit,
  allHabitsOfSameType: Habit[],
  boss: Boss,
  rng: Rng,
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

  const wasCrit = rng() < effectiveCritChance(character);
  const critAmount = wasCrit ? amount * TUNING.CRIT_MULTIPLIER : amount;
  const resistStat = habit.damageType === 'physical' ? boss.armor : boss.magicResist;
  const dealt = applyResist(critAmount, resistStat);
  const newBoss = { ...boss, health: Math.max(0, boss.health - dealt) };

  const lifestealPct = itemBonusPercent(character, 'lifesteal');
  const healed = dealt * (lifestealPct / 100);
  const newHealth = Math.min(character.currentHealth + healed, effectiveStat(character, 'health'));
  const newCharacter = healed > 0 ? { ...character, currentHealth: newHealth } : character;

  return { character: newCharacter, boss: newBoss, updatedHabit, milestoneExp, damageDealt: dealt, wasCrit };
}

/**
 * Resolves missing a habit: resets its streak and damages the character
 * with a coin-flip between the boss's physical and magic attack (not their
 * average — the boss "attacks" with one or the other), scaled by the
 * habit's difficulty and, on a crit roll (using the boss's crit chance),
 * doubled.
 */
export function missHabit(
  character: Character,
  habit: Habit,
  boss: Boss,
  rng: Rng,
): { character: Character; updatedHabit: Habit; wasCrit: boolean } {
  const updatedHabit = resetHabitStreak(habit);
  const attack = rng() < 0.5 ? boss.physicalAttack : boss.magicAttack;
  const wasCrit = rng() < boss.critChance;
  const damage =
    attack * TUNING.MISS_DAMAGE_FACTOR * (DIFFICULTY_WEIGHT[habit.difficulty] / 1.5) *
    (wasCrit ? TUNING.CRIT_MULTIPLIER : 1);
  const newHealth = Math.max(0, character.currentHealth - damage);
  return { character: { ...character, currentHealth: newHealth }, updatedHabit, wasCrit };
}

/**
 * No-op unless the character is dead AND has a Phoenix Feather equipped.
 * When both hold, consumes the feather (removes it from both equipped and
 * owned items — it can't be re-equipped without a fresh drop) and revives
 * the character at half max health, keeping level/exp/streaks/boss progress
 * intact. This is checked before `resolvePlayerDeathIfDead` so a held
 * feather pre-empts the normal full-run reset.
 */
export function reviveWithFeatherIfEquipped(character: Character): { character: Character; revived: boolean } {
  // Rounded, matching the caller's rounded "is dead" check (see
  // useCombatActions.ts) — otherwise a tiny positive health remainder that
  // displays as 0 HP would fail this literal check and skip the revive.
  if (Math.round(character.currentHealth) > 0) return { character, revived: false };
  if (!character.equippedItemIds.includes(REVIVE_ITEM_ID)) return { character, revived: false };

  const maxHealth = effectiveStat(character, 'health');
  return {
    character: {
      ...character,
      currentHealth: maxHealth * REVIVE_HEALTH_FRACTION,
      equippedItemIds: character.equippedItemIds.filter((id) => id !== REVIVE_ITEM_ID),
      ownedItemIds: character.ownedItemIds.filter((id) => id !== REVIVE_ITEM_ID),
    },
    revived: true,
  };
}

/**
 * No-op unless the boss's health has reached 0. When it has, grants the
 * boss's EXP reward (resolving any resulting level-ups), rolls this
 * character's item drop for this kill, and spawns the next boss.
 *
 * Checks the *rounded* health, not the raw float: damage math can leave a
 * tiny positive remainder (e.g. 0.3) that the health bar already displays
 * rounded down to 0 — without this, the boss would visually read "dead"
 * but not actually be defeated until one more hit.
 */
export function resolveBossDefeatIfDead(
  character: Character,
  boss: Boss,
  rng: Rng,
): { character: Character; boss: Boss; defeated: boolean; levelsGained: number; itemsDropped: ItemDef[] } {
  if (Math.round(boss.health) > 0) return { character, boss, defeated: false, levelsGained: 0, itemsDropped: [] };
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
  // Rounded, matching the rounded "is dead" check that triggered the death
  // screen in the first place (see useCombatActions.ts) — otherwise a tiny
  // positive health remainder would make `restart()` dismiss the death
  // screen without actually resetting the run.
  if (Math.round(character.currentHealth) > 0) return { character, boss, habits, died: false };
  return {
    character: createCharacter(rng),
    boss: generateBoss(1, rng),
    habits: habits.map((h) => rerollDamageType(resetHabitStreak(h), rng)),
    died: true,
  };
}
