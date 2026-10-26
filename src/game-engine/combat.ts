import { applyResist, baseResistStatForIndex, bossAttackAnchorHealth, bossExpReward, generateBoss } from './boss';
import { activeSunder, bloodlustActive, reflectActive, resolveBreakpoints, spendPassedBreakpoints } from './bossSkills';
import type { FiredBossSkill } from './bossSkills';
import { createCharacter } from './character';
import { DIFFICULTY_WEIGHT } from './constants/difficulty';
import { TUNING } from './constants/tuning';
import { crowdingFactor, rerollDamageType, resetLevelRewards, skillBaseDamage } from './habits';
import { activeHealBoost, addExpAndResolveLevelUps, effectiveCritChance, effectiveStat, itemStatMultiplier, statAtLevel } from './leveling';
import { bumpSpellweave, critMultiplierFor, effectDamageMultiplier, effectUsedToday, hasItemEffect, isForcedCrit, stampEffectDay, starfallReady } from './itemEffects';
import { itemBonusPercent, itemFlatBonus, rollItemDrops } from './items';
import type { ItemDef } from './items';
import type { Rng } from './rng';
import { completeHabitStreak, resetHabitStreak, streakMultiplier } from './streaks';
import { daysBetweenDayKeys } from './time';
import type { Boss, Character, DamageType, Habit, Period, WoundsStatusEffect } from './types';

const REVIVE_ITEM_ID = 'phoenix-feather';
const REVIVE_HEALTH_FRACTION = 0.5;

/** Maps a habit's damage type to the starter-stat field that drives it. */
export const DAMAGE_TYPE_STARTER_STAT: Record<DamageType, keyof Character['starterStats']> = {
  physical: 'physicalDamage',
  magic: 'magicDamage',
  healing: 'healing',
  trueDamage: 'trueDamage',
};

/**
 * A flat bonus multiplier for weekly habits — separate from (never folded
 * into) `baseDamage`, unlike the old periodRewardMultiplier it replaces, so
 * it can be surfaced to the player as its own line in the stats modal
 * rather than hidden inside the base number. Purely a reward bump for
 * weeklies, which are used a seventh as often.
 */
export function weeklyBonusMultiplier(period: Period): number {
  return period === 'weekly' ? TUNING.WEEKLY_BONUS_MULTIPLIER : 1;
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

/** Healing multiplier from any active Wounds effect and Healing boost — 1 (no-op) if neither. */
export function healingMultiplier(character: Character, currentDayKey: string): number {
  const wounds = activeWoundsEffect(character, currentDayKey)?.effectRate ?? 1;
  const boost = 1 + (activeHealBoost(character, currentDayKey)?.bonus ?? 0);
  return wounds * boost;
}

export type HabitDamageBreakdown = {
  /** The type's full stat × difficulty × crowding (see skillBaseDamage) — before items, streak, weekly bonus, or Special/Ult. */
  baseDamage: number;
  /** True when the skill is past the FULL_POWER_SKILLS oldest, so its base is cut. */
  crowded: boolean;
  itemMultiplier: number;
  streakMultiplier: number;
  /** WEEKLY_BONUS_MULTIPLIER for a weekly habit, 1 (no-op) for a daily one — see `weeklyBonusMultiplier`. */
  weeklyMultiplier: number;
  bonusMultiplier: number;
  /** Conditional item effects right now (see effectDamageMultiplier) — 1 when none apply, or without a boss. */
  effectMultiplier: number;
  /** baseDamage * itemMultiplier * streakMultiplier * weeklyMultiplier * bonusMultiplier * effectMultiplier. */
  effectiveDamage: number;
};

/**
 * A preview breakdown of what completing `habit` right now would deal,
 * decomposed into the same factors `completeHabit` multiplies together —
 * used by the UI to show each multiplier alongside the final number rather
 * than just the final number. Uses `habit.streakCount` as-is (this is a
 * preview of the *current* state, not a simulation of the streak bump that
 * completing it would cause). Pass the boss and today's key to include
 * conditional item effects (Giantslayer, Moonwell, ...); without them the
 * effect multiplier is 1.
 */
export function habitDamageBreakdown(
  character: Character,
  habit: Habit,
  allHabits: Habit[],
  boss?: Boss,
  currentDayKey?: string,
): HabitDamageBreakdown {
  const statField = DAMAGE_TYPE_STARTER_STAT[habit.damageType];
  const rawStat = statAtLevel(character.starterStats[statField], character.level) + itemFlatBonus(character, statField);
  const baseDamage = skillBaseDamage(habit, allHabits, rawStat);
  const itemMultiplier = itemStatMultiplier(character, statField);
  const streakMult = streakMultiplier(habit.streakCount, habit.period);
  const weeklyMult = weeklyBonusMultiplier(habit.period);
  const bonusMultiplier = levelRewardMultiplier(habit);
  const effectMultiplier = boss && currentDayKey ? effectDamageMultiplier(character, habit, boss, currentDayKey) : 1;
  return {
    baseDamage,
    crowded: crowdingFactor(habit, allHabits) < 1,
    itemMultiplier,
    streakMultiplier: streakMult,
    weeklyMultiplier: weeklyMult,
    bonusMultiplier,
    effectMultiplier,
    effectiveDamage: baseDamage * itemMultiplier * streakMult * weeklyMult * bonusMultiplier * effectMultiplier,
  };
}

/**
 * What a medium rank-0, streak-0 skill of `damageType` hits for right now:
 * the raw stat (level and flat items) × the item multiplier. No crit, no
 * Special/Ult, no crowding.
 */
export function expectedMediumDailyDamage(character: Character, damageType: DamageType): number {
  const statField = DAMAGE_TYPE_STARTER_STAT[damageType];
  const rawStat = statAtLevel(character.starterStats[statField], character.level) + itemFlatBonus(character, statField);
  return rawStat * itemStatMultiplier(character, statField);
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
  // A boss skill this hit made fire (see resolveBreakpoints in bossSkills.ts).
  bossSkill?: FiredBossSkill;
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
 * Resolves completing a habit: computes the habit's base damage/healing
 * (its type's full stat, see skillBaseDamage; `allHabits` is every owned
 * habit in store order, for crowding), applies the streak multiplier, bumps
 * the streak, and either heals the character (healing type — boss untouched) or damages the boss
 * (physical/magic type — reduced by the boss's matching resist stat and, on
 * a crit roll, doubled). Healing habits never crit. A lifesteal item bonus
 * heals the character for a percent of the damage actually dealt, while the
 * boss's Reflect skill (while it runs) damages the character back for a percent
 * of that same damage — both computed off the same `dealt` amount, then netted
 * into a single health change. Any boss skill the hit knocks loose fires
 * afterward (see `resolveBreakpoints`) and comes back as `bossSkill`.
 * `currentDayKey` must be `dailyPeriodKey(now)` (never
 * `periodKeyFor(habit.period, now)`) — day-based effects (Wounds, Blind, the
 * boss skills) always run in days regardless of the habit's own period.
 */
export function completeHabit(
  character: Character,
  habit: Habit,
  allHabits: Habit[],
  boss: Boss,
  currentDayKey: string,
  rng: Rng,
  options: { isOverdriveUse?: boolean } = {},
): CombatResult {
  const result = resolveCompletion(character, habit, allHabits, boss, currentDayKey, rng, options);
  const skill = resolveBreakpoints(boss.health, result.boss, result.character, currentDayKey, rng);
  return { ...result, boss: skill.boss, character: skill.character, ...(skill.fired && { bossSkill: skill.fired }) };
}

/** completeHabit's hit itself, before any boss skill fires. */
function resolveCompletion(
  character: Character,
  habit: Habit,
  allHabits: Habit[],
  boss: Boss,
  currentDayKey: string,
  rng: Rng,
  options: { isOverdriveUse?: boolean },
): CombatResult {
  const isOverdriveUse = options.isOverdriveUse ?? false;
  const statField = DAMAGE_TYPE_STARTER_STAT[habit.damageType];
  const rawStat = statAtLevel(character.starterStats[statField], character.level) + itemFlatBonus(character, statField);
  const baseDamage = skillBaseDamage(habit, allHabits, rawStat);
  const itemMultiplier = itemStatMultiplier(character, statField);
  // An Overdrive activation is an extra use of an already-checked-off habit:
  // it doesn't touch the streak or grant milestone EXP again, and never
  // gets the Special/Ult bonus — only OVERDRIVE_DAMAGE_FACTOR damage
  // (full damage with Dynamo Core).
  const streakResult = isOverdriveUse ? { habit, milestoneExp: 0 } : completeHabitStreak(habit);
  const updatedHabit = streakResult.habit;
  const milestoneExp = hasItemEffect(character, 'banner')
    ? streakResult.milestoneExp * TUNING.ITEM_EFFECTS.BANNER_MILESTONE_MULTIPLIER
    : streakResult.milestoneExp;
  const multiplier = streakMultiplier(habit.streakCount, habit.period);
  const weeklyMult = weeklyBonusMultiplier(habit.period);
  const bonusMultiplier = isOverdriveUse ? 1 : levelRewardMultiplier(habit);
  const overdriveFactor = isOverdriveUse && !hasItemEffect(character, 'dynamo') ? TUNING.OVERDRIVE_DAMAGE_FACTOR : 1;
  const effectMultiplier = effectDamageMultiplier(character, habit, boss, currentDayKey);
  const amount = baseDamage * itemMultiplier * multiplier * weeklyMult * bonusMultiplier * overdriveFactor * effectMultiplier;
  // Counts this use toward Spellweave's stacks for the rest of today (no-op without it).
  const wovenCharacter = bumpSpellweave(character, currentDayKey);

  if (habit.damageType === 'healing') {
    const maxHealth = effectiveStat(character, 'health');
    const mending =
      hasItemEffect(character, 'titans-mending') && character.currentHealth < maxHealth * TUNING.ITEM_EFFECTS.TITANS_MENDING_BELOW_PCT
        ? TUNING.ITEM_EFFECTS.TITANS_MENDING_MULTIPLIER
        : 1;
    const woundedAmount = amount * healingMultiplier(character, currentDayKey) * mending;
    const healed = Math.min(character.currentHealth + woundedAmount, maxHealth);
    // Censer of Wrath: the heal (before the max-health cap, so it works at
    // full health) also hits the boss, as true damage — no crit, no resist.
    const censerDamage = hasItemEffect(character, 'censer-of-wrath') ? woundedAmount * TUNING.ITEM_EFFECTS.CENSER_DAMAGE_FRACTION : 0;
    const newBoss = censerDamage > 0 ? { ...boss, health: Math.max(0, boss.health - censerDamage) } : boss;
    return {
      character: { ...wovenCharacter, currentHealth: healed },
      boss: newBoss,
      updatedHabit,
      milestoneExp,
      damageDealt: censerDamage > 0 ? censerDamage : undefined,
    };
  }

  // Rolled unconditionally (before any forced crit) so rng() consumption stays
  // independent of which effects are equipped.
  const rolledCrit = rng() < effectiveCritChance(character, currentDayKey);
  const starfall = starfallReady(character, habit, currentDayKey);
  const wasCrit = rolledCrit || isForcedCrit(character, habit, boss, currentDayKey);
  const critAmount = wasCrit ? amount * critMultiplierFor(character, habit) : amount;
  // True damage ignores armor/magicResist entirely — it's not physical or
  // magic, so neither mitigation stat (nor armorPen/magicPen) applies to it.
  // Hunter's Eye crits ignore them too.
  let dealt = critAmount;
  if (habit.damageType !== 'trueDamage' && !(wasCrit && hasItemEffect(character, 'hunters-eye'))) {
    const bossResist = habit.damageType === 'physical' ? boss.armor : boss.magicResist;
    // Worldbreaker: an armored boss's extra armor doesn't count against physical hits.
    const resistStat =
      habit.damageType === 'physical' && hasItemEffect(character, 'worldbreaker') ? Math.min(bossResist, baseResistStatForIndex(boss.index)) : bossResist;
    const penStat = habit.damageType === 'physical' ? 'armorPen' : 'magicPen';
    const effectiveResistStat = effectiveResistAfterPen(resistStat, itemBonusPercent(character, penStat));
    dealt = applyResist(critAmount, effectiveResistStat);
  }
  const newBoss: Boss = {
    ...boss,
    health: Math.max(0, boss.health - dealt),
    playerHasHit: true,
    ...(dealt > boss.health && { overkill: dealt - boss.health }),
  };

  const lifestealPct = itemBonusPercent(character, 'lifesteal');
  const maxHealth = effectiveStat(character, 'health');
  const bloodthornHeal = wasCrit && hasItemEffect(character, 'bloodthorn') ? maxHealth * (TUNING.ITEM_EFFECTS.BLOODTHORN_CRIT_HEAL_PCT / 100) : 0;
  const healed = dealt * (lifestealPct / 100) + bloodthornHeal;
  const reflected =
    hasItemEffect(character, 'null-mirror') || !reflectActive(boss, currentDayKey) ? 0 : dealt * (TUNING.BOSS_SKILLS.REFLECT_PCT / 100);
  const netHealthChange = healed - reflected;
  const newHealth = Math.min(Math.max(character.currentHealth + netHealthChange, 0), maxHealth);
  const stampedCharacter = starfall ? stampEffectDay(wovenCharacter, 'starfall', currentDayKey) : wovenCharacter;
  const newCharacter = netHealthChange !== 0 ? { ...stampedCharacter, currentHealth: newHealth } : stampedCharacter;

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
  allHabits: Habit[],
  boss: Boss,
  currentDayKey: string,
  overdrivePeriodKey: string,
  rng: Rng,
): CombatResult {
  const result = completeHabit(character, habit, allHabits, boss, currentDayKey, rng, { isOverdriveUse: true });
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
 * that same damage, capped at its max health. Boss hits never apply
 * Wounds: that's a boss skill now (see bossSkills.ts). `currentDayKey` must
 * be `dailyPeriodKey(now)`.
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
  // Which of the boss's two attacks the roll below picked — surfaced
  // for the activity log so a boss hit reads as physical or magic.
  attackType: 'physical' | 'magic';
  // Capped at the boss's maxHealth, so this is the actual health gained,
  // not the raw `damage * lifestealPct` — surfaced for the activity log.
  bossLifestealHealed?: number;
} {
  const updatedHabit = resetHabitStreak(habit);
  const attackType: 'physical' | 'magic' = rng() < (boss.physicalShare ?? 0.5) ? 'physical' : 'magic';
  const attack = attackType === 'physical' ? boss.physicalAttack : boss.magicAttack;
  const wasCrit = rng() < boss.critChance;
  const weeklyMultiplier = habit.period === 'weekly' ? TUNING.WEEKLY_MISS_MULTIPLIER : 1;
  const damage =
    attack * TUNING.MISS_DAMAGE_FACTOR * (DIFFICULTY_WEIGHT[habit.difficulty] / 1.5) *
    (wasCrit ? TUNING.CRIT_MULTIPLIER : 1) * weeklyMultiplier;
  // Sunder (a boss skill) halves the player's armor and magic resist.
  const sunderFactor = activeSunder(character, currentDayKey) ? TUNING.BOSS_SKILLS.SUNDER_FACTOR : 1;
  const playerResistStat =
    (attackType === 'physical' ? itemFlatBonus(character, 'armor') : itemFlatBonus(character, 'magicResist')) * sunderFactor;
  // Dawnguard Helm: the first hit each day is softened.
  const dawnguard = hasItemEffect(character, 'dawnguard') && !effectUsedToday(character, 'dawnguard', currentDayKey);
  const mitigatedDamage = applyResist(damage, playerResistStat) * (dawnguard ? TUNING.ITEM_EFFECTS.DAWNGUARD_FACTOR : 1);
  const newHealth = Math.max(0, character.currentHealth - mitigatedDamage);
  // Bloodbound Carapace blocks both the boss's lifesteal and Bloodlust's
  // flat heal (a boss skill), which the log and popup show as lifesteal too.
  const bloodbound = hasItemEffect(character, 'bloodbound');
  const bossLifestealPct = bloodbound ? 0 : boss.lifestealPct;
  const bloodlustHeal =
    !bloodbound && bloodlustActive(boss, currentDayKey) ? boss.maxHealth * (TUNING.BOSS_SKILLS.BLOODLUST_HEAL_PCT / 100) : 0;
  const healedBoss = Math.min(boss.maxHealth, boss.health + mitigatedDamage * bossLifestealPct + bloodlustHeal);
  const bossLifestealHealed = healedBoss - boss.health;
  const newBoss = healedBoss !== boss.health ? { ...boss, health: healedBoss } : boss;

  const hitCharacter = dawnguard ? stampEffectDay(character, 'dawnguard', currentDayKey) : character;

  return {
    character: { ...hitCharacter, currentHealth: newHealth },
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
): { character: Character; boss: Boss; defeated: boolean; levelsGained: number; itemsDropped: ItemDef[]; itemHealed?: number } {
  if (Math.round(boss.health) > 0) {
    return { character, boss, defeated: false, levelsGained: 0, itemsDropped: [] };
  }
  const { character: leveled, levelsGained } = addExpAndResolveLevelUps(character, bossExpReward(boss.index));
  // Soul Lantern: each fallen boss restores health (capped at max).
  const maxHealth = effectiveStat(leveled, 'health');
  const lanternHealth = hasItemEffect(leveled, 'soul-lantern')
    ? Math.min(leveled.currentHealth + maxHealth * (TUNING.ITEM_EFFECTS.SOUL_LANTERN_HEAL_PCT / 100), maxHealth)
    : leveled.currentHealth;
  const itemHealed = lanternHealth - leveled.currentHealth;
  const itemsDropped = rollItemDrops(leveled, boss.index, rng);
  const withItems: Character = {
    ...leveled,
    currentHealth: lanternHealth,
    ownedItemIds: [...leveled.ownedItemIds, ...itemsDropped.map((item) => item.id)],
  };
  // Base (pre-item) health anchors the next boss's attack — see
  // bossAttackAnchorHealth — so equipping health items doesn't just chase
  // the cap upward and cancel itself out.
  const baseMaxHealth = bossAttackAnchorHealth(boss.index + 1, withItems.starterStats.health, withItems.level);
  const generated = generateBoss(boss.index + 1, rng, boss.difficultyModifier, baseMaxHealth);
  // Echoing Blade: the killing blow's overkill carries into the next boss —
  // that boss only, and never down past 1 health, so kills can't chain.
  const carried = hasItemEffect(withItems, 'echoing-blade') ? Math.min(boss.overkill ?? 0, generated.health - 1) : 0;
  // Breakpoints the carry passes are spent without firing.
  const nextBoss = carried > 0 ? spendPassedBreakpoints({ ...generated, health: generated.health - carried }) : generated;
  return { character: withItems, boss: nextBoss, defeated: true, levelsGained, itemsDropped, ...(itemHealed > 0 && { itemHealed }) };
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
    boss: generateBoss(1, rng, undefined, bossAttackAnchorHealth(1, freshCharacter.starterStats.health, freshCharacter.level)),
    habits: habits.map((h) => resetLevelRewards(rerollDamageType(h, rng))),
    died: true,
  };
}
