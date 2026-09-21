import { TUNING } from './constants/tuning';
import type { Rng } from './rng';
import { pickWeighted } from './rng';
import type { Boss, Personality } from './types';

/**
 * Total "power budget" a boss at the given index gets to distribute across
 * its stats. Grows exponentially forever so the game never runs out of
 * challenge — see `damageReductionPct` for how the resist formula keeps
 * bosses killable despite this unbounded growth. `difficultyModifier`
 * (default 1, i.e. no change) is the current run's hidden per-run scaling —
 * see `generateBoss`.
 */
export function bossPowerBudget(index: number, difficultyModifier = 1): number {
  return TUNING.BASE_BOSS_POWER * Math.pow(TUNING.BOSS_GROWTH_RATE, index - 1) * difficultyModifier;
}

/**
 * Rolls a new hidden per-run difficulty modifier: a multiplier applied to
 * every boss's power budget for the rest of this run, so some runs are
 * quietly a bit tougher or easier throughout than the tuned baseline —
 * never surfaced in the UI, so the player can't tell how hard their current
 * run is stacked to be.
 */
export function rollRunDifficultyModifier(rng: Rng): number {
  return 1 + (rng() * 2 - 1) * TUNING.RUN_DIFFICULTY_VARIANCE_PCT;
}

/** EXP granted to the player for defeating the boss at the given index. */
export function bossExpReward(index: number): number {
  return TUNING.BASE_BOSS_EXP * Math.pow(TUNING.BOSS_EXP_GROWTH_RATE, index - 1);
}

const PERSONALITY_STAT: Record<Personality, keyof typeof TUNING.BOSS_STAT_SHARE | null> = {
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
 * How many multiples of its fair share of the stat budget each personality's
 * emphasized stat gets. `balanced` never emphasizes anything (PERSONALITY_STAT
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
 * Generates a boss for the given index: rolls a personality, distributes the
 * index's power budget across stats (emphasizing one stat if the personality
 * calls for it), jitters each stat by ±10%, and independently rolls a crit
 * chance, reflect%, and lifesteal% (see TUNING for the odds of each).
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
 */
export function generateBoss(index: number, rng: Rng, difficultyModifier?: number): Boss {
  const resolvedDifficultyModifier = difficultyModifier ?? rollRunDifficultyModifier(rng);
  const personality = pickWeighted<Personality>(personalityWeightsForIndex(index), rng);
  const emphasizedStat = PERSONALITY_STAT[personality];
  const shares: Record<keyof typeof TUNING.BOSS_STAT_SHARE, number> = { ...TUNING.BOSS_STAT_SHARE };
  if (emphasizedStat) shares[emphasizedStat] *= PERSONALITY_MULTIPLIER[personality as Exclude<Personality, 'balanced'>];
  const totalShare = Object.values(shares).reduce((a, b) => a + b, 0);
  const budget = bossPowerBudget(index, resolvedDifficultyModifier);
  const jittered = (share: number) => budget * (share / totalShare) * (1 + (rng() * 2 - 1) * 0.1); // ±10%

  const health = jittered(shares.health); // rolled once, reused for maxHealth below
  const critChance =
    rng() < TUNING.BOSS_RARE_CRIT_CHANCE_PROBABILITY
      ? TUNING.BOSS_RARE_CRIT_CHANCE
      : rng() * TUNING.BOSS_DEFAULT_CRIT_CHANCE_MAX;
  const reflectPct = parseFloat(pickWeighted<string>(TUNING.BOSS_REFLECT_WEIGHTS, rng));
  const lifestealPct = parseFloat(pickWeighted<string>(TUNING.BOSS_LIFESTEAL_WEIGHTS, rng));

  return {
    index,
    personality,
    maxHealth: health,
    health,
    physicalAttack: jittered(shares.physicalAttack),
    magicAttack: jittered(shares.magicAttack),
    armor: jittered(shares.armor),
    magicResist: jittered(shares.magicResist),
    critChance,
    reflectPct,
    lifestealPct,
    difficultyModifier: resolvedDifficultyModifier,
  };
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
