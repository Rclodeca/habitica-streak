import { describe, expect, it } from 'vitest';
import {
  applyResist,
  bossExpReward,
  bossPowerBudget,
  damageReductionPct,
  generateBoss,
  personalityWeightsForIndex,
} from './boss';
import { createRng, type Rng } from './rng';
import { TUNING } from './constants/tuning';
import type { Personality } from './types';

describe('bossPowerBudget', () => {
  it('matches BASE_BOSS_POWER * BOSS_GROWTH_RATE^(index-1) exactly at index 1, 5, 10', () => {
    expect(bossPowerBudget(1)).toBeCloseTo(TUNING.BASE_BOSS_POWER * Math.pow(TUNING.BOSS_GROWTH_RATE, 0), 10);
    expect(bossPowerBudget(5)).toBeCloseTo(TUNING.BASE_BOSS_POWER * Math.pow(TUNING.BOSS_GROWTH_RATE, 4), 10);
    expect(bossPowerBudget(10)).toBeCloseTo(TUNING.BASE_BOSS_POWER * Math.pow(TUNING.BOSS_GROWTH_RATE, 9), 10);
    expect(bossPowerBudget(1)).toBe(TUNING.BASE_BOSS_POWER);
  });
});

describe('personalityWeightsForIndex', () => {
  it('matches the base weights exactly at index 1', () => {
    expect(personalityWeightsForIndex(1)).toEqual(TUNING.BOSS_PERSONALITY_WEIGHTS);
  });

  it('makes every personality equally likely at and beyond the ramp-end index', () => {
    for (const index of [TUNING.BOSS_PERSONALITY_RAMP_END_INDEX, 20, 100]) {
      const weights = Object.values(personalityWeightsForIndex(index));
      const commonWeight = Math.max(...Object.values(TUNING.BOSS_PERSONALITY_WEIGHTS));
      for (const weight of weights) {
        expect(weight).toBeCloseTo(commonWeight, 10);
      }
    }
  });

  it('linearly closes the gap for a rare personality between index 1 and the ramp end', () => {
    const rampEnd = TUNING.BOSS_PERSONALITY_RAMP_END_INDEX;
    const midIndex = Math.round((1 + rampEnd) / 2);
    const base = TUNING.BOSS_PERSONALITY_WEIGHTS.armored5x;
    const mid = personalityWeightsForIndex(midIndex).armored5x;
    const end = personalityWeightsForIndex(rampEnd).armored5x;
    expect(mid).toBeGreaterThan(base);
    expect(mid).toBeLessThan(end);
  });

  it('leaves already-common personalities unchanged at every index', () => {
    for (const index of [1, 5, 15, 30]) {
      expect(personalityWeightsForIndex(index).balanced).toBe(TUNING.BOSS_PERSONALITY_WEIGHTS.balanced);
    }
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
 * calls delegate to a real seeded rng (for stat jitter, crit/reflect/
 * lifesteal rolls, etc).
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

// pickWeighted normalizes TUNING.BOSS_PERSONALITY_WEIGHTS and subtracts
// weights in declared-key order, so each personality's roll (its running
// total right before its own weight is subtracted, expressed as a fraction
// of the grand total) lands squarely inside that personality's bucket.
const PERSONALITY_WEIGHT_TOTAL = Object.values(TUNING.BOSS_PERSONALITY_WEIGHTS).reduce((a, b) => a + b, 0);
const FORCED_ROLL_FOR = (() => {
  const rolls: Partial<Record<Personality, number>> = {};
  let runningTotal = 0;
  for (const [key, weight] of Object.entries(TUNING.BOSS_PERSONALITY_WEIGHTS)) {
    rolls[key as Personality] = (runningTotal + weight / 2) / PERSONALITY_WEIGHT_TOTAL;
    runningTotal += weight;
  }
  return rolls as Record<Personality, number>;
})();

describe('generateBoss', () => {
  it('always spawns with maxHealth === health (jitter rolled once, reused)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const rng = createRng(seed);
      const boss = generateBoss(3, rng);
      expect(boss.maxHealth).toBe(boss.health);
    }
  });

  it('rolls crit chance within [0, rare value], mostly the small default range, regardless of index', () => {
    const rareValue = TUNING.BOSS_RARE_CRIT_CHANCE;
    const results: number[] = [];
    for (let seed = 0; seed < 500; seed++) {
      results.push(generateBoss(1, createRng(seed)).critChance);
    }
    for (const critChance of results) {
      expect(critChance).toBeGreaterThanOrEqual(0);
      expect(critChance).toBeLessThanOrEqual(rareValue);
    }
    const rareCount = results.filter((c) => c === rareValue).length;
    expect(rareCount).toBeGreaterThan(0); // the rare 20% override does happen sometimes
    const defaultCount = results.filter((c) => c <= TUNING.BOSS_DEFAULT_CRIT_CHANCE_MAX).length;
    expect(defaultCount).toBeGreaterThan(results.length * 0.8); // BOSS_RARE_CRIT_CHANCE_PROBABILITY is only 5%

    // Same [0, rareValue] bound holds at a much higher boss index.
    expect(generateBoss(20, createRng(1)).critChance).toBeLessThanOrEqual(rareValue);
  });

  it('rolls reflectPct from the configured tiers, mostly 0', () => {
    const validValues = Object.keys(TUNING.BOSS_REFLECT_WEIGHTS).map(Number);
    const results: number[] = [];
    for (let seed = 0; seed < 500; seed++) {
      results.push(generateBoss(1, createRng(seed)).reflectPct);
    }
    for (const reflectPct of results) {
      expect(validValues).toContain(reflectPct);
    }
    expect(results.filter((r) => r === 0).length).toBeGreaterThan(results.length * 0.6);
    expect(results.some((r) => r > 0)).toBe(true);
  });

  it('rolls lifestealPct from the configured tiers, mostly 0', () => {
    const validValues = Object.keys(TUNING.BOSS_LIFESTEAL_WEIGHTS).map(Number);
    const results: number[] = [];
    for (let seed = 0; seed < 500; seed++) {
      results.push(generateBoss(1, createRng(seed)).lifestealPct);
    }
    for (const lifestealPct of results) {
      expect(validValues).toContain(lifestealPct);
    }
    expect(results.filter((l) => l === 0).length).toBeGreaterThan(results.length * 0.6);
    expect(results.some((l) => l > 0)).toBe(true);
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
    arcane: 'magicAttack',
    arcane3x: 'magicAttack',
    arcane4x: 'magicAttack',
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
        // Forced at index 1 — FORCED_ROLL_FOR's boundaries are computed from
        // the base weights, which only match the effective weights (see
        // personalityWeightsForIndex) at index 1, before the rarity ramp
        // shifts them.
        emphasizedTotal += generateBoss(1, emphasizedRng)[stat];
        balancedTotal += generateBoss(1, balancedRng)[stat];
      }
      const emphasizedAvg = emphasizedTotal / iterations;
      const balancedAvg = balancedTotal / iterations;
      // Every multiplier tier (2x-5x) at least doubles the stat's share of
      // the (renormalized) budget, so the average should be meaningfully
      // higher than balanced — well outside the ±10% per-sample jitter noise
      // once averaged.
      expect(emphasizedAvg).toBeGreaterThan(balancedAvg * 1.2);
    },
  );

  const MULTIPLIER_TIERS: Array<{ lower: Exclude<Personality, 'balanced'>; higher: Exclude<Personality, 'balanced'> }> = [
    { lower: 'armored', higher: 'armored3x' },
    { lower: 'armored3x', higher: 'armored4x' },
    { lower: 'armored4x', higher: 'armored5x' },
    { lower: 'warded', higher: 'warded3x' },
    { lower: 'warded3x', higher: 'warded4x' },
    { lower: 'warded4x', higher: 'warded5x' },
    { lower: 'brute', higher: 'brute3x' },
    { lower: 'brute3x', higher: 'brute4x' },
    { lower: 'arcane', higher: 'arcane3x' },
    { lower: 'arcane3x', higher: 'arcane4x' },
  ];

  it.each(MULTIPLIER_TIERS)(
    "personality '$higher' emphasizes its stat more than '$lower'",
    ({ lower, higher }) => {
      const stat = EMPHASIZED_STAT[lower];
      const iterations = 150;
      let lowerTotal = 0;
      let higherTotal = 0;
      for (let seed = 0; seed < iterations; seed++) {
        const lowerRng = forcedPersonalityRng(FORCED_ROLL_FOR[lower], seed * 2 + 1);
        const higherRng = forcedPersonalityRng(FORCED_ROLL_FOR[higher], seed * 2 + 2);
        // Forced at index 1 for the same reason as the emphasized-stat test
        // above — FORCED_ROLL_FOR only lines up with the effective weights
        // before the rarity ramp kicks in.
        lowerTotal += generateBoss(1, lowerRng)[stat];
        higherTotal += generateBoss(1, higherRng)[stat];
      }
      expect(higherTotal / iterations).toBeGreaterThan(lowerTotal / iterations);
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
