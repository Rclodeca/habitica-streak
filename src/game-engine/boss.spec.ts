import { describe, expect, it } from 'vitest';
import { applyResist, bossExpReward, bossPowerBudget, damageReductionPct, generateBoss } from './boss';
import { createRng, type Rng } from './rng';
import { TUNING } from './constants/tuning';
import type { Personality } from './types';

describe('bossPowerBudget', () => {
  it('matches BASE_BOSS_POWER * BOSS_GROWTH_RATE^(index-1) exactly at index 1, 5, 10', () => {
    expect(bossPowerBudget(1)).toBeCloseTo(TUNING.BASE_BOSS_POWER * Math.pow(TUNING.BOSS_GROWTH_RATE, 0), 10);
    expect(bossPowerBudget(5)).toBeCloseTo(TUNING.BASE_BOSS_POWER * Math.pow(TUNING.BOSS_GROWTH_RATE, 4), 10);
    expect(bossPowerBudget(10)).toBeCloseTo(TUNING.BASE_BOSS_POWER * Math.pow(TUNING.BOSS_GROWTH_RATE, 9), 10);
    expect(bossPowerBudget(1)).toBe(80);
  });
});

describe('bossExpReward', () => {
  it('matches BASE_BOSS_EXP * BOSS_EXP_GROWTH_RATE^(index-1) exactly at index 1, 5, 10', () => {
    expect(bossExpReward(1)).toBeCloseTo(TUNING.BASE_BOSS_EXP * Math.pow(TUNING.BOSS_EXP_GROWTH_RATE, 0), 10);
    expect(bossExpReward(5)).toBeCloseTo(TUNING.BASE_BOSS_EXP * Math.pow(TUNING.BOSS_EXP_GROWTH_RATE, 4), 10);
    expect(bossExpReward(10)).toBeCloseTo(TUNING.BASE_BOSS_EXP * Math.pow(TUNING.BOSS_EXP_GROWTH_RATE, 9), 10);
    expect(bossExpReward(1)).toBe(40);
  });
});

/**
 * Builds an rng whose first call returns `firstValue` (to force a specific
 * `pickWeighted` outcome for personality selection) and whose subsequent
 * calls delegate to a real seeded rng (for stat jitter).
 */
function forcedPersonalityRng(firstValue: number, seed: number): Rng {
  let usedFirst = false;
  const underlying = createRng(seed);
  return () => {
    if (!usedFirst) {
      usedFirst = true;
      return firstValue;
    }
    return underlying();
  };
}

// BOSS_PERSONALITY_WEIGHTS are all 0.2, in declared order balanced, tank,
// armored, warded, brute — pickWeighted subtracts weights in that order, so
// these first-roll values land squarely inside each personality's bucket.
const FORCED_ROLL_FOR: Record<Personality, number> = {
  balanced: 0.1,
  tank: 0.3,
  armored: 0.5,
  warded: 0.7,
  brute: 0.9,
};

describe('generateBoss', () => {
  it('always spawns with maxHealth === health (jitter rolled once, reused)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const rng = createRng(seed);
      const boss = generateBoss(3, rng);
      expect(boss.maxHealth).toBe(boss.health);
    }
  });

  it('generates the requested personality when forced', () => {
    for (const personality of Object.keys(FORCED_ROLL_FOR) as Personality[]) {
      const rng = forcedPersonalityRng(FORCED_ROLL_FOR[personality], 1);
      const boss = generateBoss(1, rng);
      expect(boss.personality).toBe(personality);
    }
  });

  const EMPHASIZED_STAT: Record<Exclude<Personality, 'balanced'>, keyof typeof TUNING.BOSS_STAT_SHARE> = {
    tank: 'health',
    armored: 'armor',
    warded: 'magicResist',
    brute: 'physicalAttack',
  };

  it.each(Object.entries(EMPHASIZED_STAT) as [Exclude<Personality, 'balanced'>, keyof typeof TUNING.BOSS_STAT_SHARE][])(
    "personality '%s' makes its emphasized stat '%s' statistically higher than the balanced baseline",
    (personality, stat) => {
      const iterations = 150;
      let emphasizedTotal = 0;
      let balancedTotal = 0;
      for (let seed = 0; seed < iterations; seed++) {
        const emphasizedRng = forcedPersonalityRng(FORCED_ROLL_FOR[personality], seed * 2 + 1);
        const balancedRng = forcedPersonalityRng(FORCED_ROLL_FOR.balanced, seed * 2 + 2);
        emphasizedTotal += generateBoss(5, emphasizedRng)[stat];
        balancedTotal += generateBoss(5, balancedRng)[stat];
      }
      const emphasizedAvg = emphasizedTotal / iterations;
      const balancedAvg = balancedTotal / iterations;
      // Emphasis doubles the stat's share of the (renormalized) budget, so
      // the average should be meaningfully higher than balanced — well
      // outside the ±10% per-sample jitter noise once averaged.
      expect(emphasizedAvg).toBeGreaterThan(balancedAvg * 1.2);
    },
  );
});

describe('damageReductionPct', () => {
  it('is 0 at resist 0 and approaches, but never reaches, 1 as resist grows without bound', () => {
    expect(damageReductionPct(0)).toBe(0);
    expect(damageReductionPct(TUNING.RESIST_K)).toBeCloseTo(0.5, 10);
  });

  it('regression: stays strictly within [0, 1) for resist values up to at least 1e9', () => {
    const values = [0, 1, 10, 100, 1_000, 1e6, 1e9, 1e12];
    for (const resist of values) {
      const pct = damageReductionPct(resist);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThan(1);
    }
  });

  it('regression: applyResist always leaves at least some positive damage even for enormous resist', () => {
    for (const resist of [1e9, 1e12]) {
      const remaining = applyResist(1000, resist);
      expect(remaining).toBeGreaterThan(0);
    }
  });
});
