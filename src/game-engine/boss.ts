import { rollBossSkills } from './bossSkills';
import { TUNING } from './constants/tuning';
import { expToNextLevel, statAtLevel } from './leveling';
import type { Rng } from './rng';
import { pickWeighted } from './rng';
import type { Boss, Personality } from './types';

/** The health growth from boss `index - 1` to `index`: the rate of the last BOSS_HEALTH_GROWTH_BANDS row starting at or before it. */
export function bossHealthGrowthRate(index: number): number {
  let rate = TUNING.BOSS_HEALTH_GROWTH_BANDS[0][1];
  for (const [start, bandRate] of TUNING.BOSS_HEALTH_GROWTH_BANDS) if (start <= index) rate = bandRate;
  return rate;
}

/**
 * Un-jittered health a balanced boss at the given index starts with. Grows
 * exponentially forever, band by band, so the game never runs out of
 * challenge. `difficultyModifier` (default 1, i.e. no change) is the current
 * run's hidden per-run scaling — see `generateBoss`.
 */
export function bossBaseHealth(index: number, difficultyModifier = 1): number {
  let health = TUNING.BASE_BOSS_HEALTH;
  for (let k = 2; k <= index; k++) health *= bossHealthGrowthRate(k);
  return health * difficultyModifier;
}

/** Rescales a saved boss from the old flat ×1.27 growth to the bands, keeping its HP percent. Every other field is untouched. */
export function rescaleBossToHealthBands(boss: Boss): Boss {
  const legacy = TUNING.BASE_BOSS_HEALTH * Math.pow(TUNING.LEGACY_BOSS_HEALTH_GROWTH_RATE, boss.index - 1);
  const factor = bossBaseHealth(boss.index) / legacy;
  return { ...boss, health: boss.health * factor, maxHealth: boss.maxHealth * factor };
}

/**
 * Target damage-reduction fraction for a boss's armor or magicResist at this
 * index. Without `tierMultiplier` (the boss isn't armored/warded for this
 * resist) it follows the base line from BOSS_RESIST_BASE_PCT_START to
 * _END, flat after BOSS_RESIST_RAMP_END_INDEX. With one (2-5, from the
 * armored/warded personality tier) it ramps from that base line up to the
 * tier's cap over the same index range, so tanky bosses only pull away from
 * the pack deep into a run. Authored directly as a percent (not derived from
 * an exponential stat) so it can't saturate toward 100% for every boss.
 */
export function resistPctForIndex(index: number, tierMultiplier?: number): number {
  const t = Math.min(1, Math.max(0, (index - 1) / (TUNING.BOSS_RESIST_RAMP_END_INDEX - 1)));
  const base = TUNING.BOSS_RESIST_BASE_PCT_START + (TUNING.BOSS_RESIST_BASE_PCT_END - TUNING.BOSS_RESIST_BASE_PCT_START) * t;
  if (tierMultiplier === undefined) return base;
  return base + (TUNING.BOSS_RESIST_TIER_CAP_PCT[tierMultiplier] - base) * t;
}

/** Inverse of `damageReductionPct`: the resist stat that yields the given reduction fraction. */
function resistStatForReduction(reductionPct: number): number {
  return (TUNING.RESIST_K * reductionPct) / (1 - reductionPct);
}

/**
 * Rolls a new hidden per-run difficulty modifier: a multiplier applied to
 * every boss's health for the rest of this run, so some runs are
 * quietly a bit tougher or easier throughout than the tuned baseline —
 * never surfaced in the UI, so the player can't tell how hard their current
 * run is stacked to be.
 */
export function rollRunDifficultyModifier(rng: Rng): number {
  return 1 + (rng() * 2 - 1) * TUNING.RUN_DIFFICULTY_VARIANCE_PCT;
}

/** EXP for a boss kill at the slayer's level: BOSS_KILL_LEVEL_SHARE of the next level, ±jitter, floored. One rng() per call. */
export function bossExpReward(level: number, rng: Rng): number {
  const jitter = 1 + (rng() * 2 - 1) * TUNING.BOSS_KILL_EXP_JITTER_PCT;
  return Math.max(TUNING.BOSS_KILL_MIN_EXP, expToNextLevel(level) * TUNING.BOSS_KILL_LEVEL_SHARE * jitter);
}

type EmphasizedStat = 'health' | 'physicalAttack' | 'magicAttack' | 'armor' | 'magicResist';

const PERSONALITY_STAT: Record<Personality, EmphasizedStat | null> = {
  balanced: null,
  tank: 'health',
  armored: 'armor',
  armored3x: 'armor',
  armored4x: 'armor',
  armored5x: 'armor',
  warded: 'magicResist',
  warded3x: 'magicResist',
  warded4x: 'magicResist',
  warded5x: 'magicResist',
  brute: 'physicalAttack',
  brute3x: 'physicalAttack',
  brute4x: 'physicalAttack',
  brute5x: 'physicalAttack',
  arcane: 'magicAttack',
  arcane3x: 'magicAttack',
  arcane4x: 'magicAttack',
  arcane5x: 'magicAttack',
};

/**
 * How strongly each personality emphasizes its stat (attack multiplier, or the
 * armored/warded tier that picks the resist cap). `balanced` never emphasizes anything (PERSONALITY_STAT
 * maps it to null), so it has no entry here.
 */
const PERSONALITY_MULTIPLIER: Record<Exclude<Personality, 'balanced'>, number> = {
  tank: 2,
  armored: 2,
  armored3x: 3,
  armored4x: 4,
  armored5x: 5,
  warded: 2,
  warded3x: 3,
  warded4x: 4,
  warded5x: 5,
  brute: 2,
  brute3x: 3,
  brute4x: 4,
  brute5x: 5,
  arcane: 2,
  arcane3x: 3,
  arcane4x: 4,
  arcane5x: 5,
};

/**
 * Flavor name shown to the player instead of the raw `Personality` id (e.g.
 * `armored3x` reads as "Steel Bulwark", not "armored3x") — mirrors how
 * `ItemDef.rarity` is an internal tier id while `ItemDef.name` is the
 * flavor text shown for items. Each emphasized-stat family escalates
 * thematically across its four tiers instead of spelling out "3x/4x/5x".
 */
export const PERSONALITY_NAME: Record<Personality, string> = {
  balanced: 'Drifter',
  tank: 'Colossus',
  armored: 'Iron Guardian',
  armored3x: 'Steel Bulwark',
  armored4x: 'Adamant Bastion',
  armored5x: 'Mythic Juggernaut',
  warded: 'Arcane Warden',
  warded3x: 'Frost Sentinel',
  warded4x: 'Spectral Aegis',
  warded5x: 'Ethereal Sovereign',
  brute: 'Savage Brute',
  brute3x: 'Raging Berserker',
  brute4x: 'Bloodfang Marauder',
  brute5x: 'Apex Destroyer',
  arcane: 'Arcane Adept',
  arcane3x: 'Spellweaver',
  arcane4x: 'Eldritch Harbinger',
  arcane5x: 'Voidcaller',
};

/**
 * The personality weights in effect at a given boss index. Rarer personalities
 * (armored5x, warded4x, etc.) linearly gain weight toward the common tier's
 * weight as the index climbs from 1 to BOSS_PERSONALITY_RAMP_END_INDEX, so
 * every personality is equally likely from that boss onward.
 */
export function personalityWeightsForIndex(index: number): Record<Personality, number> {
  const rampEnd = TUNING.BOSS_PERSONALITY_RAMP_END_INDEX;
  const progress = Math.min(1, Math.max(0, (index - 1) / (rampEnd - 1)));
  const commonWeight = Math.max(...Object.values(TUNING.BOSS_PERSONALITY_WEIGHTS));
  const weights = {} as Record<Personality, number>;
  for (const [key, baseWeight] of Object.entries(TUNING.BOSS_PERSONALITY_WEIGHTS)) {
    weights[key as Personality] = baseWeight + (commonWeight - baseWeight) * progress;
  }
  return weights;
}

/**
 * Solves a logistic curve's (midpoint, steepness) so it passes exactly
 * through two given (x, y) checkpoints and asymptotes to `ceiling` — used
 * by `missDamagePctForIndex` so that curve's S-shape is authored via
 * intuitive checkpoints ("small at boss 1, 60% by boss 20") instead of raw
 * sigmoid math constants that would each independently control the whole
 * curve's shape (see the BEND_FACTOR approach this replaced: a single knob
 * couldn't move a late checkpoint without also dragging up every earlier
 * one).
 */
function solveLogisticParams(
  ceiling: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { midpoint: number; steepness: number } {
  const z1 = Math.log(ceiling / y1 - 1);
  const z2 = Math.log(ceiling / y2 - 1);
  const steepness = (z1 - z2) / (x2 - x1);
  const midpoint = x1 + z1 / steepness;
  return { midpoint, steepness };
}

const MISS_DAMAGE_CURVE = solveLogisticParams(
  TUNING.MISS_DAMAGE_CEILING_PCT_OF_MAX_HP,
  TUNING.MISS_DAMAGE_CURVE_EARLY_INDEX,
  TUNING.MISS_DAMAGE_CURVE_EARLY_PCT,
  TUNING.MISS_DAMAGE_CURVE_TARGET_INDEX,
  TUNING.MISS_DAMAGE_CURVE_TARGET_PCT,
);

/**
 * The target miss-damage-as-%-of-base-max-HP for a non attack-emphasized
 * boss at this index: an S-curve that starts small, rises through the two
 * checkpoints in TUNING.MISS_DAMAGE_CURVE_*, and plateaus near
 * MISS_DAMAGE_CEILING_PCT_OF_MAX_HP afterward — unlike boss
 * health, which grows unbounded forever. See
 * `generateBoss` for how this becomes an actual attack stat, and how
 * brute/arcane personalities multiply past it.
 */
export function missDamagePctForIndex(index: number): number {
  const { midpoint, steepness } = MISS_DAMAGE_CURVE;
  return TUNING.MISS_DAMAGE_CEILING_PCT_OF_MAX_HP / (1 + Math.exp(-steepness * (index - midpoint)));
}

/** The level an average player has when boss `index` spawns (TUNING.EXPECTED_LEVEL_BY_BOSS_INDEX, linear, extrapolated past both ends, floored at 1). */
export function expectedLevelForBossIndex(index: number): number {
  const points = TUNING.EXPECTED_LEVEL_BY_BOSS_INDEX;
  let i = 0;
  while (i < points.length - 2 && index > points[i + 1][0]) i++;
  const [x1, y1] = points[i];
  const [x2, y2] = points[i + 1];
  return Math.max(1, y1 + ((index - x1) * (y2 - y1)) / (x2 - x1));
}

/**
 * The base max health generateBoss sizes boss `index`'s attack against:
 * the health of the expected level for that boss, blended toward the
 * player's real level-scaled health by TUNING.BOSS_ATTACK_LEVEL_FOLLOW.
 * Items don't count (base health only), and the character's own
 * starterStats.health keeps per-run variation.
 */
export function bossAttackAnchorHealth(index: number, starterHealth: number, level: number): number {
  const expected = statAtLevel(starterHealth, expectedLevelForBossIndex(index), 'health');
  const actual = statAtLevel(starterHealth, level, 'health');
  return expected * Math.pow(actual / expected, TUNING.BOSS_ATTACK_LEVEL_FOLLOW);
}

/** Rolls the ±3-point jitter on a resist's target reduction, clamped to the top tier's cap, and converts it to a stat. */
function jitteredResistStat(index: number, tierMultiplier: number | undefined, rng: Rng): number {
  const maxPct = TUNING.BOSS_RESIST_TIER_CAP_PCT[5];
  const pct = resistPctForIndex(index, tierMultiplier) + (rng() * 2 - 1) * 0.03;
  return resistStatForReduction(Math.min(maxPct, Math.max(0, pct)));
}

/**
 * Generates a boss for the given index: rolls a personality, scales health
 * off the index's exponential curve (tank personalities get more), sets
 * armor/magicResist from the authored `resistPctForIndex` curve (armored/
 * warded personalities ramp higher), jitters each, and independently rolls a crit chance and lifesteal% (see TUNING
 * for the odds of each). physicalAttack/magicAttack are handled separately
 * — see below.
 *
 * `difficultyModifier`, if provided, is the current run's hidden per-run
 * scaling — carried forward from the previous boss so it stays constant for
 * the whole run (see `resolveBossDefeatIfDead`). If omitted (a brand new
 * run: app boot, or right after `resolvePlayerDeathIfDead`), a fresh one is
 * rolled via `rollRunDifficultyModifier` and stored on the returned boss so
 * later bosses this run can carry it forward the same way.
 *
 * IMPORTANT: `health`/`maxHealth` must share a single jitter roll. Calling
 * the jitter function twice for the same share would re-roll the ±10% swing
 * independently for each field, so `maxHealth` could end up different from
 * `health` at spawn — but a freshly spawned boss must always be at full
 * health, i.e. `maxHealth === health`.
 *
 * `baseMaxHealth` (pre-item health to size the attack against — callers pass
 * `bossAttackAnchorHealth(index, character.starterStats.health, character.level)`)
 * anchors `missDamagePctForIndex`'s target below. Defaults to the
 * character-creation baseline for callers that don't have a character in
 * scope yet (e.g. this store's initial state), which is only ever wrong for
 * an index-1 boss anyway, where the curve's target is already at its
 * smallest.
 */
export function generateBoss(
  index: number,
  rng: Rng,
  difficultyModifier?: number,
  baseMaxHealth: number = TUNING.BASE_STATS.health,
): Boss {
  const resolvedDifficultyModifier = difficultyModifier ?? rollRunDifficultyModifier(rng);
  const personality = pickWeighted<Personality>(personalityWeightsForIndex(index), rng);
  const emphasizedStat = PERSONALITY_STAT[personality];
  const tierMultiplier = emphasizedStat ? PERSONALITY_MULTIPLIER[personality as Exclude<Personality, 'balanced'>] : undefined;
  const healthMultiplier = emphasizedStat === 'health' ? TUNING.BOSS_TANK_HEALTH_MULTIPLIER : 1;

  const health = bossBaseHealth(index, resolvedDifficultyModifier) * healthMultiplier * (1 + (rng() * 2 - 1) * 0.1); // ±10%, rolled once, reused for maxHealth below
  const critChance =
    rng() < TUNING.BOSS_RARE_CRIT_CHANCE_PROBABILITY
      ? TUNING.BOSS_RARE_CRIT_CHANCE
      : rng() * TUNING.BOSS_DEFAULT_CRIT_CHANCE_MAX;
  const lifestealPct = parseFloat(pickWeighted<string>(TUNING.BOSS_LIFESTEAL_WEIGHTS, rng));

  // The non-emphasized baseline attack value for this index — deliberately
  // NOT derived from the boss health curve, since the whole point is to
  // author its growth against the player's own health curve instead.
  // Jittered ±10%, then a brute/arcane boss's own emphasized
  // attack multiplies past this baseline (asymptoting near ceiling *
  // multiplier instead), while the other attack type and every other
  // personality's attacks stay on the curve.
  const targetAttack = (missDamagePctForIndex(index) * baseMaxHealth) / TUNING.MISS_DAMAGE_FACTOR;
  const attackJitter = () => 1 + (rng() * 2 - 1) * 0.1;
  const physicalMultiplier = emphasizedStat === 'physicalAttack' ? PERSONALITY_MULTIPLIER[personality as Exclude<Personality, 'balanced'>] : 1;
  const magicMultiplier = emphasizedStat === 'magicAttack' ? PERSONALITY_MULTIPLIER[personality as Exclude<Personality, 'balanced'>] : 1;

  const boss: Boss = {
    index,
    personality,
    maxHealth: health,
    health,
    physicalAttack: targetAttack * attackJitter() * physicalMultiplier,
    magicAttack: targetAttack * attackJitter() * magicMultiplier,
    armor: jitteredResistStat(index, emphasizedStat === 'armor' ? tierMultiplier : undefined, rng),
    magicResist: jitteredResistStat(index, emphasizedStat === 'magicResist' ? tierMultiplier : undefined, rng),
    critChance,
    lifestealPct,
    difficultyModifier: resolvedDifficultyModifier,
  };

  // Rolled after every other stat above, so the lean never shifts an earlier
  // rng() draw. A brute/arcane boss leans toward its own attack; a side-less
  // one picks a side, but only when it actually leans, so an even split costs
  // no extra roll.
  const lean = parseFloat(pickWeighted<string>(TUNING.BOSS_ATTACK_LEAN_WEIGHTS, rng));
  let leansPhysical = true;
  if (emphasizedStat === 'magicAttack') leansPhysical = false;
  else if (emphasizedStat !== 'physicalAttack' && lean > 0.5) leansPhysical = rng() < 0.5;
  const physicalShare = leansPhysical ? lean : Math.round((1 - lean) * 100) / 100;

  // Rolled after the lean for the same reason; none before boss 15.
  const skills = rollBossSkills(index, rng);
  return skills.length > 0 ? { ...boss, physicalShare, skills } : { ...boss, physicalShare };
}

/**
 * Damage-reduction fraction from a resist stat, using diminishing returns
 * (`resist / (resist + K)`). This is the critical correctness detail in the
 * whole engine: as boss stats grow exponentially forever, a naive
 * linear-percent reduction would eventually make bosses unkillable (100%+
 * reduction). This formula instead asymptotically approaches — but never
 * reaches — 1, so it stays strictly within `[0, 1)` for any non-negative
 * resist value, no matter how large.
 */
export function damageReductionPct(resistStat: number): number {
  return resistStat / (resistStat + TUNING.RESIST_K);
}

/** Applies a resist stat's damage reduction to a raw damage amount. */
export function applyResist(rawDamage: number, resistStat: number): number {
  return rawDamage * (1 - damageReductionPct(resistStat));
}
