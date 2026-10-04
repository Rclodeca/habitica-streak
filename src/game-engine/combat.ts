import { applyResist, bossExpReward, generateBoss } from './boss';
import { createCharacter } from './character';
import { DIFFICULTY_WEIGHT } from './constants/difficulty';
import { TUNING } from './constants/tuning';
import { computeDamageSplit, rerollDamageType, resetLevelRewards } from './habits';
import { addExpAndResolveLevelUps, effectiveCritChance, effectiveStat, itemStatMultiplier, statAtLevel } from './leveling';
import { itemBonusPercent, itemFlatBonus, rollItemDrops } from './items';
import type { ItemDef } from './items';
import type { Rng } from './rng';
import { completeHabitStreak, resetHabitStreak, streakMultiplier } from './streaks';
import { daysBetweenDayKeys } from './time';
import type { Boss, Character, DamageType, Habit, WoundsStatusEffect } from './types';

const REVIVE_ITEM_ID = 'phoenix-feather';
const REVIVE_HEALTH_FRACTION = 0.5;

/** Maps a habit's damage type to the starter-stat field that drives it. */
export const DAMAGE_TYPE_STARTER_STAT: Record<DamageType, keyof Character['starterStats']> = {
  physical: 'physicalDamage',
  magic: 'magicDamage',
  healing: 'healing',
  trueDamage: 'trueDamage',
  expGain: 'expGain',
};

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

/**
 * The player's active Wounds effect as of `currentDayKey`, or undefined if
 * none is active (never applied, or applied but its durationDays have
 * elapsed). Lazy — doesn't prune the stale entry from `character.statusEffects`
 * itself; it just gets overwritten the next time Wounds is (re-)applied (see
 * `missHabit`). Mirrors `overdriveUsesRemaining`'s "compare stored key to
 * current key" pattern above. `currentDayKey` must be `dailyPeriodKey(now)`,
 * never a weekly habit's period key — Wounds duration is always in days.
 */
export function activeWoundsEffect(character: Character, currentDayKey: string): WoundsStatusEffect | undefined {
  const wounds = character.statusEffects?.find((e): e is WoundsStatusEffect => e.type === 'wounds');
  if (!wounds) return undefined;
  return daysBetweenDayKeys(wounds.appliedDayKey, currentDayKey) < wounds.durationDays ? wounds : undefined;
}

/** Healing multiplier from any currently-active Wounds effect — 1 (no-op) if none. */
export function healingMultiplier(character: Character, currentDayKey: string): number {
  return activeWoundsEffect(character, currentDayKey)?.effectRate ?? 1;
}

export type HabitDamageBreakdown = {
  /** This habit's share of the character's stat pool (by difficulty weight, within its own daily-or-weekly pool) — before items, streak, or Special/Ult. */
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
  const rawStat = statAtLevel(character.starterStats[statField], character.level) + itemFlatBonus(character, statField);
  const baseDamage = computeDamageSplit(allHabitsOfSameType, rawStat).get(habit.id) ?? 0;
  // expGain's percent item bonus is applied once, later, inside
  // addExpAndResolveLevelUps (same path a boss kill's EXP goes through) —
  // applying it here too would double-count it. See completeHabit.
  const itemMultiplier = habit.damageType === 'expGain' ? 1 : itemStatMultiplier(character, statField);
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

/**
 * What a medium daily habit of `damageType` deals right now — a fixed
 * reference point analogous to a boss's own Effective attack stat
 * (`bossMissDamage`): no crit, no streak bonus, no Special/Ult. Computed as
 * a medium weight's share of `habitsOfType`'s total weight — NOT
 * medium-weight-on-top-of that total, since a real medium daily of this
 * type, if one already exists, is already counted inside `habitsOfType`;
 * treating it as an *additional* entrant would double-dilute the pool and
 * read as lower than that same real habit's own displayed damage (see
 * `habitDamageBreakdown`, which splits the actual pool the same way). Zero
 * existing habits of this type is treated as a 1:1 ratio (the whole pool),
 * since there's nothing yet to share it with.
 *
 * Callers must pass `habitsOfType` already scoped to the daily period
 * (e.g. `habitStore.habitsOfType(damageType, 'daily')`) — daily and weekly
 * are separate pools, so a weekly habit of this same damage type must NOT
 * be included here.
 */
export function expectedMediumDailyDamage(character: Character, damageType: DamageType, habitsOfType: Habit[]): number {
  const statField = DAMAGE_TYPE_STARTER_STAT[damageType];
  const rawStat = statAtLevel(character.starterStats[statField], character.level) + itemFlatBonus(character, statField);
  // expGain's item bonus is applied later via addExpAndResolveLevelUps, not
  // here — mirrors the same exclusion in completeHabit/habitDamageBreakdown.
  const itemMultiplier = damageType === 'expGain' ? 1 : itemStatMultiplier(character, statField);
  const existingWeight = habitsOfType.reduce((sum, h) => sum + DIFFICULTY_WEIGHT[h.difficulty], 0);
  const mediumShareRatio = existingWeight > 0 ? DIFFICULTY_WEIGHT.medium / existingWeight : 1;
  return rawStat * itemMultiplier * mediumShareRatio;
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
  // Set only for an 'expGain'-type habit — the raw EXP amount this
  // completion earned, for the caller to grant via addExpAndResolveLevelUps
  // (not granted internally, mirroring how milestoneExp is handled).
  expGained?: number;
};

/**
 * The boss resist stat actually used against an attack, after clamping the
 * character's armorPen/magicPen percent to TUNING.ARMOR_MAGIC_PEN_CAP_PCT
 * and reducing resistStat by that percent. Exported (and unit-tested)
 * separately from completeHabit because no current item combination in the
 * catalog sums past the cap, so an integration test alone could never
 * exercise the clamp actually engaging.
 */
export function effectiveResistAfterPen(resistStat: number, penPct: number): number {
  const cappedPenPct = Math.min(penPct, TUNING.ARMOR_MAGIC_PEN_CAP_PCT);
  return resistStat * (1 - cappedPenPct / 100);
}

/**
 * Resolves completing a habit: computes the habit's share of damage/healing
 * for its type, applies the streak multiplier, bumps the streak, and either
 * heals the character (healing type — boss untouched) or damages the boss
 * (physical/magic type — reduced by the boss's matching resist stat and, on
 * a crit roll, doubled). Healing habits never crit. A lifesteal item bonus
 * heals the character for a percent of the damage actually dealt, while the
 * boss's own reflect% (if any) damages the character back for a percent of
 * that same damage — both computed off the same `dealt` amount, then netted
 * into a single health change. `currentDayKey` must be `dailyPeriodKey(now)`
 * (never `periodKeyFor(habit.period, now)`) — it's only used to check for an
 * active Wounds effect (see `healingMultiplier`), which always runs in days
 * regardless of the habit's own period.
 */
export function completeHabit(
  character: Character,
  habit: Habit,
  allHabitsOfSameType: Habit[],
  boss: Boss,
  currentDayKey: string,
  rng: Rng,
  options: { isOverdriveUse?: boolean } = {},
): CombatResult {
  const isOverdriveUse = options.isOverdriveUse ?? false;
  const statField = DAMAGE_TYPE_STARTER_STAT[habit.damageType];
  const rawStat = statAtLevel(character.starterStats[statField], character.level) + itemFlatBonus(character, statField);
  const baseDamage = computeDamageSplit(allHabitsOfSameType, rawStat).get(habit.id) ?? 0;
  // expGain's percent item bonus is applied once, later, inside
  // addExpAndResolveLevelUps (same path a boss kill's EXP goes through) —
  // applying it here too would double-count it.
  const itemMultiplier = habit.damageType === 'expGain' ? 1 : itemStatMultiplier(character, statField);
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
    const woundedAmount = amount * healingMultiplier(character, currentDayKey);
    const healed = Math.min(character.currentHealth + woundedAmount, effectiveStat(character, 'health'));
    return { character: { ...character, currentHealth: healed }, boss, updatedHabit, milestoneExp };
  }

  // Granted by the caller via addExpAndResolveLevelUps, not here — mirrors
  // how milestoneExp is handed back unresolved above.
  if (habit.damageType === 'expGain') {
    return { character, boss, updatedHabit, milestoneExp, expGained: amount };
  }

  const wasCrit = rng() < effectiveCritChance(character);
  const critAmount = wasCrit ? amount * TUNING.CRIT_MULTIPLIER : amount;
  // True damage ignores armor/magicResist entirely — it's not physical or
  // magic, so neither mitigation stat (nor armorPen/magicPen) applies to it.
  let dealt = critAmount;
  if (habit.damageType !== 'trueDamage') {
    const resistStat = habit.damageType === 'physical' ? boss.armor : boss.magicResist;
    const penStat = habit.damageType === 'physical' ? 'armorPen' : 'magicPen';
    const effectiveResistStat = effectiveResistAfterPen(resistStat, itemBonusPercent(character, penStat));
    dealt = applyResist(critAmount, effectiveResistStat);
  }
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
 * `overdrivePeriodKey`. Callers are responsible for checking
 * `overdriveUsesRemaining` beforehand — this doesn't guard against over-use
 * itself. `currentDayKey` and `overdrivePeriodKey` are genuinely different
 * keys — the former is always daily (for Wounds, see `completeHabit`), the
 * latter matches the habit's own daily/weekly period (for the overdrive-use
 * counter) — so they're kept as distinctly-named params rather than one.
 */
export function overdriveHabit(
  character: Character,
  habit: Habit,
  allHabitsOfSameType: Habit[],
  boss: Boss,
  currentDayKey: string,
  overdrivePeriodKey: string,
  rng: Rng,
): CombatResult {
  const result = completeHabit(character, habit, allHabitsOfSameType, boss, currentDayKey, rng, { isOverdriveUse: true });
  return { ...result, updatedHabit: bumpOverdriveUse(result.updatedHabit, overdrivePeriodKey) };
}

/**
 * The actual damage a boss's raw physicalAttack/magicAttack stat deals on a
 * missed *medium* daily habit — MISS_DAMAGE_FACTOR baked in, with the
 * difficulty weight canceling out to 1 (medium's weight/1.5 == 1). The raw
 * stat alone overstates what actually lands (see `missHabit` for the full
 * formula), so the UI shows this instead: an easy miss deals ~0.67x this,
 * a hard miss ~1.33x, and any crit or missed weekly doubles it.
 */
export function bossMissDamage(attackStat: number): number {
  return attackStat * TUNING.MISS_DAMAGE_FACTOR;
}

/**
 * Resolves missing a habit: resets its streak and damages the character
 * with a coin-flip between the boss's physical and magic attack (not their
 * average — the boss "attacks" with one or the other), scaled by the
 * habit's difficulty and, on a crit roll (using the boss's crit chance),
 * doubled. The boss's own lifesteal% (if any) heals it for a percent of
 * that same damage, capped at its max health.
 *
 * If the boss has a Wounds ability, every hit rolls against its hitChance —
 * unconditionally, regardless of whether the player is already Wounded
 * (mirrors `wasCrit`/`attackType` above, which are also rolled regardless
 * of whether they end up mattering, keeping rng() consumption deterministic
 * and independent of player state). On success, Wounds is only actually
 * applied if the player doesn't already have an active one — no
 * stacking, no duration refresh (see `activeWoundsEffect`). `currentDayKey`
 * must be `dailyPeriodKey(now)`.
 */
export function missHabit(
  character: Character,
  habit: Habit,
  boss: Boss,
  currentDayKey: string,
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
  // Set only when Wounds was newly applied THIS call (not when the roll
  // succeeds but an effect was already active) — surfaced for the activity log.
  woundsApplied?: WoundsStatusEffect;
} {
  const updatedHabit = resetHabitStreak(habit);
  const attackType: 'physical' | 'magic' = rng() < 0.5 ? 'physical' : 'magic';
  const attack = attackType === 'physical' ? boss.physicalAttack : boss.magicAttack;
  const wasCrit = rng() < boss.critChance;
  const woundsRollSucceeded = boss.woundsAbility ? rng() < boss.woundsAbility.hitChance : false;
  const weeklyMultiplier = habit.period === 'weekly' ? TUNING.WEEKLY_MISS_MULTIPLIER : 1;
  const damage =
    attack * TUNING.MISS_DAMAGE_FACTOR * (DIFFICULTY_WEIGHT[habit.difficulty] / 1.5) *
    (wasCrit ? TUNING.CRIT_MULTIPLIER : 1) * weeklyMultiplier;
  const playerResistStat = attackType === 'physical' ? itemFlatBonus(character, 'armor') : itemFlatBonus(character, 'magicResist');
  const mitigatedDamage = applyResist(damage, playerResistStat);
  const newHealth = Math.max(0, character.currentHealth - mitigatedDamage);
  const healedBoss = Math.min(boss.maxHealth, boss.health + mitigatedDamage * boss.lifestealPct);
  const bossLifestealHealed = healedBoss - boss.health;
  const newBoss = healedBoss !== boss.health ? { ...boss, health: healedBoss } : boss;

  let woundsApplied: WoundsStatusEffect | undefined;
  let newCharacter: Character = { ...character, currentHealth: newHealth };
  if (woundsRollSucceeded && boss.woundsAbility && !activeWoundsEffect(character, currentDayKey)) {
    woundsApplied = {
      type: 'wounds',
      appliedDayKey: currentDayKey,
      durationDays: boss.woundsAbility.durationDays,
      effectRate: boss.woundsAbility.effectRate,
    };
    newCharacter = {
      ...newCharacter,
      statusEffects: [...(character.statusEffects?.filter((e) => e.type !== 'wounds') ?? []), woundsApplied],
    };
  }

  return {
    character: newCharacter,
    boss: newBoss,
    updatedHabit,
    wasCrit,
    attackType,
    bossLifestealHealed: bossLifestealHealed > 0 ? bossLifestealHealed : undefined,
    woundsApplied,
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
  // Base (pre-item) health anchors the next boss's attack soft cap — see
  // generateBoss's baseMaxHealth param — so equipping health items doesn't
  // just chase the cap upward and cancel itself out.
  const baseMaxHealth = statAtLevel(withItems.starterStats.health, withItems.level);
  const nextBoss = generateBoss(boss.index + 1, rng, boss.difficultyModifier, baseMaxHealth);
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
  const freshCharacter = createCharacter(rng);
  return {
    character: freshCharacter,
    boss: generateBoss(1, rng, undefined, statAtLevel(freshCharacter.starterStats.health, freshCharacter.level)),
    habits: habits.map((h) => resetLevelRewards(rerollDamageType(h, rng))),
    died: true,
  };
}
