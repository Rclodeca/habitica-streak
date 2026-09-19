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
  // Surfaced (rather than left as internal-only locals) purely so callers —
  // namely the activity log — can report these sub-effects separately,
  // without recomputing this function's formulas themselves.
  lifestealHealed?: number;
  reflectedDamage?: number;
};

/**
 * Resolves completing a habit: computes the habit's share of damage/healing
 * for its type, applies the streak multiplier, bumps the streak, and either
 * heals the character (healing type — boss untouched) or damages the boss
 * (physical/magic type — reduced by the boss's matching resist stat and, on
 * a crit roll, doubled). Healing habits never crit. A lifesteal item bonus
 * heals the character for a percent of the damage actually dealt, while the
 * boss's own reflect% (if any) damages the character back for a percent of
 * that same damage — both computed off the same `dealt` amount, then netted
 * into a single health change.
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
  const weeklyMultiplier = habit.period === 'weekly' ? TUNING.WEEKLY_REWARD_MULTIPLIER : 1;
  const amount = baseDamage * multiplier * weeklyMultiplier;

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
  const reflected = dealt * boss.reflectPct;
  const netHealthChange = healed - reflected;
  const newHealth = Math.min(
    Math.max(character.currentHealth + netHealthChange, 0),
    effectiveStat(character, 'health'),
  );
  const newCharacter = netHealthChange !== 0 ? { ...character, currentHealth: newHealth } : character;

  return {
    character: newCharacter,
    boss: newBoss,
    updatedHabit,
    milestoneExp,
    damageDealt: dealt,
    wasCrit,
    lifestealHealed: healed > 0 ? healed : undefined,
    reflectedDamage: reflected > 0 ? reflected : undefined,
  };
}

/**
 * Resolves missing a habit: resets its streak and damages the character
 * with a coin-flip between the boss's physical and magic attack (not their
 * average — the boss "attacks" with one or the other), scaled by the
 * habit's difficulty and, on a crit roll (using the boss's crit chance),
 * doubled. The boss's own lifesteal% (if any) heals it for a percent of
 * that same damage, capped at its max health.
 */
export function missHabit(
  character: Character,
  habit: Habit,
  boss: Boss,
  rng: Rng,
): {
  character: Character;
  boss: Boss;
  updatedHabit: Habit;
  wasCrit: boolean;
  // Capped at the boss's maxHealth, so this is the actual health gained,
  // not the raw `damage * lifestealPct` — surfaced for the activity log.
  bossLifestealHealed?: number;
} {
  const updatedHabit = resetHabitStreak(habit);
  const attack = rng() < 0.5 ? boss.physicalAttack : boss.magicAttack;
  const wasCrit = rng() < boss.critChance;
  const weeklyMultiplier = habit.period === 'weekly' ? TUNING.WEEKLY_MISS_MULTIPLIER : 1;
  const damage =
    attack * TUNING.MISS_DAMAGE_FACTOR * (DIFFICULTY_WEIGHT[habit.difficulty] / 1.5) *
    (wasCrit ? TUNING.CRIT_MULTIPLIER : 1) * weeklyMultiplier;
  const newHealth = Math.max(0, character.currentHealth - damage);
  const healedBoss = Math.min(boss.maxHealth, boss.health + damage * boss.lifestealPct);
  const bossLifestealHealed = healedBoss - boss.health;
  const newBoss = healedBoss !== boss.health ? { ...boss, health: healedBoss } : boss;
  return {
    character: { ...character, currentHealth: newHealth },
    boss: newBoss,
    updatedHabit,
    wasCrit,
    bossLifestealHealed: bossLifestealHealed > 0 ? bossLifestealHealed : undefined,
  };
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
