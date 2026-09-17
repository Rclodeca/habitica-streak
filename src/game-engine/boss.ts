import { TUNING } from './constants/tuning';
import type { Rng } from './rng';
import { pickWeighted } from './rng';
import type { Boss, Personality } from './types';

/**
 * Total "power budget" a boss at the given index gets to distribute across
 * its stats. Grows exponentially forever so the game never runs out of
 * challenge — see `damageReductionPct` for how the resist formula keeps
 * bosses killable despite this unbounded growth.
 */
export function bossPowerBudget(index: number): number {
  return TUNING.BASE_BOSS_POWER * Math.pow(TUNING.BOSS_GROWTH_RATE, index - 1);
}

/** EXP granted to the player for defeating the boss at the given index. */
export function bossExpReward(index: number): number {
  return TUNING.BASE_BOSS_EXP * Math.pow(TUNING.BOSS_EXP_GROWTH_RATE, index - 1);
}

const PERSONALITY_STAT: Record<Personality, keyof typeof TUNING.BOSS_STAT_SHARE | null> = {
  balanced: null,
  tank: 'health',
  armored: 'armor',
  warded: 'magicResist',
  brute: 'physicalAttack',
};

/**
 * Generates a boss for the given index: rolls a personality, distributes the
 * index's power budget across stats (emphasizing one stat if the personality
 * calls for it), and jitters each stat by ±10%.
 *
 * IMPORTANT: `health`/`maxHealth` must share a single jitter roll. Calling
 * the jitter function twice for the same share would re-roll the ±10% swing
 * independently for each field, so `maxHealth` could end up different from
 * `health` at spawn — but a freshly spawned boss must always be at full
 * health, i.e. `maxHealth === health`.
 */
export function generateBoss(index: number, rng: Rng): Boss {
  const personality = pickWeighted<Personality>(TUNING.BOSS_PERSONALITY_WEIGHTS, rng);
  const emphasizedStat = PERSONALITY_STAT[personality];
  const shares: Record<keyof typeof TUNING.BOSS_STAT_SHARE, number> = { ...TUNING.BOSS_STAT_SHARE };
  if (emphasizedStat) shares[emphasizedStat] *= TUNING.PERSONALITY_EMPHASIS_FACTOR;
  const totalShare = Object.values(shares).reduce((a, b) => a + b, 0);
  const budget = bossPowerBudget(index);
  const jittered = (share: number) => budget * (share / totalShare) * (1 + (rng() * 2 - 1) * 0.1); // ±10%

  const health = jittered(shares.health); // rolled once, reused for maxHealth below
  return {
    index,
    personality,
    maxHealth: health,
    health,
    physicalAttack: jittered(shares.physicalAttack),
    magicAttack: jittered(shares.magicAttack),
    armor: jittered(shares.armor),
    magicResist: jittered(shares.magicResist),
    critChance: TUNING.BASE_CRIT_CHANCE, // fixed for every boss — difficulty scales via power budget, not crit
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
