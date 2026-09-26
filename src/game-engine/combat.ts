import { applyResist, bossExpReward, generateBoss } from './boss';
import { createCharacter } from './character';
import { DIFFICULTY_WEIGHT } from './constants/difficulty';
import { TUNING } from './constants/tuning';
import { computeDamageSplit, rerollDamageType, resetLevelRewards } from './habits';
import { addExpAndResolveLevelUps, effectiveCritChance, effectiveStat, itemStatMultiplier, statAtLevel } from './leveling';
import { itemBonusPercent, rollItemDrops } from './items';
import type { ItemDef } from './items';
import type { Rng } from './rng';
import { completeHabitStreak, resetHabitStreak, streakMultiplier } from './streaks';
import type { Boss, Character, DamageType, Habit, Period } from './types';

const REVIVE_ITEM_ID = 'phoenix-feather';
const REVIVE_HEALTH_FRACTION = 0.5;

/** Maps a habit's damage type to the starter-stat field that drives it. */
export const DAMAGE_TYPE_STARTER_STAT: Record<DamageType, keyof Character['starterStats']> = {
  physical: 'physicalDamage',
  magic: 'magicDamage',
  healing: 'healing',
};

/** The flat reward multiplier from a habit's period alone — weeklies reward more per completion. */
export function periodRewardMultiplier(period: Period): number {
  return period === 'weekly' ? TUNING.WEEKLY_REWARD_MULTIPLIER : 1;
}

/** A habit's permanent Special/Ult bonus multiplier, applied only on a first (non-Overdrive) use. */
export function levelRewardMultiplier(habit: Habit): number {
  if (habit.isSpecial) return TUNING.SPECIAL_MULTIPLIER;
  if (habit.isUlt) return TUNING.ULT_MULTIPLIER;
  return 1;
}

/**
 * How many of a habit's up-to-OVERDRIVE_MAX_EXTRA_USES extra activations
 * remain for the current period — 0 if it isn't Overdrive-capable at all.
 * Lazily compares against the stored period key rather than actively
 * resetting it, mirroring how `lastCompletedPeriodKey`/`lastCheckedPeriodKey`
 * are compared elsewhere in this engine.
 */
export function overdriveUsesRemaining(habit: Habit, currentPeriodKey: string): number {
  if (!habit.isOverdrive) return 0;
  const usedSoFar = habit.overdrivePeriodKey === currentPeriodKey ? habit.overdriveUsesThisPeriod ?? 0 : 0;
  return Math.max(0, TUNING.OVERDRIVE_MAX_EXTRA_USES - usedSoFar);
}

/** Display helper: the damage an Overdrive activation deals given the pre-bonus amount a normal use would deal. */
export function overdriveDamagePreview(baseAmountBeforeBonus: number): number {
  return baseAmountBeforeBonus * TUNING.OVERDRIVE_DAMAGE_FACTOR;
}

/** Bumps a habit's Overdrive-use counter for the current period, lazily resetting if the period rolled over. */
function bumpOverdriveUse(habit: Habit, currentPeriodKey: string): Habit {
  const usedSoFar = habit.overdrivePeriodKey === currentPeriodKey ? habit.overdriveUsesThisPeriod ?? 0 : 0;
  return { ...habit, overdrivePeriodKey: currentPeriodKey, overdriveUsesThisPeriod: usedSoFar + 1 };
}

export type HabitDamageBreakdown = {
  /** This habit's share of the character's stat pool (by difficulty weight), with the period reward multiplier (weeklies ×3) folded in — before items, streak, or Special/Ult. */
  baseDamage: number;
  itemMultiplier: number;
  streakMultiplier: number;
  bonusMultiplier: number;
  /** baseDamage * itemMultiplier * streakMultiplier * bonusMultiplier. */
  effectiveDamage: number;
};

/**
 * A preview breakdown of what completing `habit` right now would deal,
 * decomposed into the same factors `completeHabit` multiplies together —
 * used by the UI to show each multiplier alongside the final number rather
 * than just the final number. Uses `habit.streakCount` as-is (this is a
 * preview of the *current* state, not a simulation of the streak bump that
 * completing it would cause).
 */
export function habitDamageBreakdown(character: Character, habit: Habit, allHabitsOfSameType: Habit[]): HabitDamageBreakdown {
  const statField = DAMAGE_TYPE_STARTER_STAT[habit.damageType];
  const rawStat = statAtLevel(character.starterStats[statField], character.level);
  const statShare = computeDamageSplit(allHabitsOfSameType, rawStat).get(habit.id) ?? 0;
  const baseDamage = statShare * periodRewardMultiplier(habit.period);
  const itemMultiplier = itemStatMultiplier(character, statField);
  const streakMult = streakMultiplier(habit.streakCount, habit.period);
  const bonusMultiplier = levelRewardMultiplier(habit);
  return {
    baseDamage,
    itemMultiplier,
    streakMultiplier: streakMult,
    bonusMultiplier,
    effectiveDamage: baseDamage * itemMultiplier * streakMult * bonusMultiplier,
  };
}

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
  options: { isOverdriveUse?: boolean } = {},
): CombatResult {
  const isOverdriveUse = options.isOverdriveUse ?? false;
  const statField = DAMAGE_TYPE_STARTER_STAT[habit.damageType];
  const rawStat = statAtLevel(character.starterStats[statField], character.level);
  const statShare = computeDamageSplit(allHabitsOfSameType, rawStat).get(habit.id) ?? 0;
  const baseDamage = statShare * periodRewardMultiplier(habit.period);
  const itemMultiplier = itemStatMultiplier(character, statField);
  // An Overdrive activation is an extra use of an already-checked-off habit:
  // it doesn't touch the streak or grant milestone EXP again, and never
  // gets the Special/Ult bonus — only OVERDRIVE_DAMAGE_FACTOR damage.
  const { habit: updatedHabit, milestoneExp } = isOverdriveUse
    ? { habit, milestoneExp: 0 }
    : completeHabitStreak(habit);
  const multiplier = streakMultiplier(updatedHabit.streakCount, habit.period);
  const bonusMultiplier = isOverdriveUse ? 1 : levelRewardMultiplier(habit);
  const overdriveFactor = isOverdriveUse ? TUNING.OVERDRIVE_DAMAGE_FACTOR : 1;
  const amount = baseDamage * itemMultiplier * multiplier * bonusMultiplier * overdriveFactor;

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
 * Resolves an Overdrive activation of a habit already checked off this
 * period: same combat resolution as `completeHabit` (crit/lifesteal/reflect
 * all still apply) but at OVERDRIVE_DAMAGE_FACTOR damage via its
 * `isOverdriveUse` option, then bumps the habit's Overdrive-use counter for
 * `currentPeriodKey`. Callers are responsible for checking
 * `overdriveUsesRemaining` beforehand — this doesn't guard against over-use
 * itself.
 */
export function overdriveHabit(
  character: Character,
  habit: Habit,
  allHabitsOfSameType: Habit[],
  boss: Boss,
  currentPeriodKey: string,
  rng: Rng,
): CombatResult {
  const result = completeHabit(character, habit, allHabitsOfSameType, boss, rng, { isOverdriveUse: true });
  return { ...result, updatedHabit: bumpOverdriveUse(result.updatedHabit, currentPeriodKey) };
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
  // Which of the boss's two attacks the coin-flip below picked — surfaced
  // for the activity log so a boss hit reads as physical or magic.
  attackType: 'physical' | 'magic';
  // Capped at the boss's maxHealth, so this is the actual health gained,
  // not the raw `damage * lifestealPct` — surfaced for the activity log.
  bossLifestealHealed?: number;
} {
  const updatedHabit = resetHabitStreak(habit);
  const attackType: 'physical' | 'magic' = rng() < 0.5 ? 'physical' : 'magic';
  const attack = attackType === 'physical' ? boss.physicalAttack : boss.magicAttack;
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
    attackType,
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
 * character's item drop for this kill, and spawns the next boss — carrying
 * this run's hidden difficulty modifier (`boss.difficultyModifier`) forward
 * onto it, so it stays constant for the whole run rather than re-rolling
 * every boss.
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
  const nextBoss = generateBoss(boss.index + 1, rng, boss.difficultyModifier);
  return { character: withItems, boss: nextBoss, defeated: true, levelsGained, itemsDropped };
}

/**
 * No-op unless the character's health has reached 0. When it has, resets
 * the run: a fresh character, the boss sequence restarted at index 1, and
 * the same habit definitions retained with damage types re-rolled and
 * Special/Ult/Overdrive flags cleared (they're re-earned by leveling up
 * again). Streaks are deliberately NOT reset here — a streak should only
 * break when its own period is actually missed (`missHabit` ->
 * `resetHabitStreak`), not merely because the character died.
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
    habits: habits.map((h) => resetLevelRewards(rerollDamageType(h, rng))),
    died: true,
  };
}
