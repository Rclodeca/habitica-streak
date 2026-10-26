import { describe, expect, it } from 'vitest';
import {
  applyResist,
  bossAttackAnchorHealth,
  bossExpReward,
  bossBaseHealth,
  damageReductionPct,
  expectedLevelForBossIndex,
  generateBoss,
  PERSONALITY_NAME,
  personalityWeightsForIndex,
  rescaleBossToHealthBands,
  resistPctForIndex,
  rollRunDifficultyModifier,
} from './boss';
import { statAtLevel } from './leveling';
import { createRng, type Rng } from './rng';
import { TUNING } from './constants/tuning';
import type { Personality } from './types';

type EmphasizedStat = 'health' | 'physicalAttack' | 'magicAttack' | 'armor' | 'magicResist';

describe('bossBaseHealth', () => {
  it('grows boss HP in bands', () => {
    const expected: [number, number][] = [[1, 650], [10, 5586.591], [12, 9010.612], [13, 10542.416], [15, 14431.513],
      [20, 31640.343], [30, 152089.698], [31, 168819.565], [40, 431846.681], [60, 2902848.388]];
    for (const [index, hp] of expected) expect(bossBaseHealth(index)).toBeCloseTo(hp, 2);
    expect(bossBaseHealth(100) / 91176784.359).toBeCloseTo(1, 6);
    expect(bossBaseHealth(20, 1.1)).toBeCloseTo(31640.343 * 1.1, 2);
  });

  it('keeps every band rising faster than kills can level', () => {
    const bands = TUNING.BOSS_HEALTH_GROWTH_BANDS;
    expect(bands[0][0]).toBe(1);
    expect(bands.every(([, rate]) => rate > 1.05)).toBe(true);
  });

  it('rescales a saved boss to the bands, keeping its HP percent', () => {
    const boss = { ...generateBoss(24, createRng(3)), maxHealth: 170000, health: 85000 };
    const out = rescaleBossToHealthBands(boss);
    expect(out.maxHealth).toBeCloseTo(170000 * 0.373754, 0);
    expect(out.health / out.maxHealth).toBeCloseTo(0.5);
    expect({ ...out, health: 0, maxHealth: 0 }).toEqual({ ...boss, health: 0, maxHealth: 0 });
    const early = generateBoss(12, createRng(4));
    expect(rescaleBossToHealthBands(early).maxHealth).toBeCloseTo(early.maxHealth);
  });

  it('scales linearly with an explicit difficultyModifier', () => {
    expect(bossBaseHealth(5, 1.1)).toBeCloseTo(bossBaseHealth(5) * 1.1, 10);
    expect(bossBaseHealth(5, 0.9)).toBeCloseTo(bossBaseHealth(5) * 0.9, 10);
  });
});

describe('resistPctForIndex', () => {
  it('starts at BOSS_RESIST_BASE_PCT_START at boss 1 for every tier', () => {
    for (const tier of [undefined, 2, 3, 4, 5]) {
      expect(resistPctForIndex(1, tier)).toBeCloseTo(TUNING.BOSS_RESIST_BASE_PCT_START, 10);
    }
  });

  it('reaches the base END (no tier) and each tier cap at BOSS_RESIST_RAMP_END_INDEX, and stays flat afterward', () => {
    const end = TUNING.BOSS_RESIST_RAMP_END_INDEX;
    expect(resistPctForIndex(end)).toBeCloseTo(TUNING.BOSS_RESIST_BASE_PCT_END, 10);
    expect(resistPctForIndex(end + 50)).toBeCloseTo(TUNING.BOSS_RESIST_BASE_PCT_END, 10);
    for (const tier of [2, 3, 4, 5]) {
      expect(resistPctForIndex(end, tier)).toBeCloseTo(TUNING.BOSS_RESIST_TIER_CAP_PCT[tier], 10);
      expect(resistPctForIndex(end + 50, tier)).toBeCloseTo(TUNING.BOSS_RESIST_TIER_CAP_PCT[tier], 10);
    }
  });

  it('never exceeds the 5x cap, never decreases with index, and higher tiers never reduce less', () => {
    for (let i = 1; i <= 60; i++) {
      let previousTier = resistPctForIndex(i);
      for (const tier of [2, 3, 4, 5]) {
        const pct = resistPctForIndex(i, tier);
        expect(pct).toBeGreaterThanOrEqual(previousTier);
        expect(pct).toBeLessThanOrEqual(TUNING.BOSS_RESIST_TIER_CAP_PCT[5]);
        previousTier = pct;
      }
      if (i > 1) expect(resistPctForIndex(i)).toBeGreaterThanOrEqual(resistPctForIndex(i - 1));
    }
  });
});

describe('rollRunDifficultyModifier', () => {
  it('stays within [1 - RUN_DIFFICULTY_VARIANCE_PCT, 1 + RUN_DIFFICULTY_VARIANCE_PCT]', () => {
    for (let seed = 0; seed < 500; seed++) {
      const modifier = rollRunDifficultyModifier(createRng(seed));
      expect(modifier).toBeGreaterThanOrEqual(1 - TUNING.RUN_DIFFICULTY_VARIANCE_PCT);
      expect(modifier).toBeLessThanOrEqual(1 + TUNING.RUN_DIFFICULTY_VARIANCE_PCT);
    }
  });

  it('varies across seeds rather than always landing on the same value', () => {
    const values = new Set(Array.from({ length: 20 }, (_, seed) => rollRunDifficultyModifier(createRng(seed))));
    expect(values.size).toBeGreaterThan(1);
  });
});

describe('generateBoss difficulty modifier', () => {
  it('rolls and stores a fresh modifier when none is provided', () => {
    const boss = generateBoss(1, createRng(1));
    expect(boss.difficultyModifier).toBeGreaterThanOrEqual(1 - TUNING.RUN_DIFFICULTY_VARIANCE_PCT);
    expect(boss.difficultyModifier).toBeLessThanOrEqual(1 + TUNING.RUN_DIFFICULTY_VARIANCE_PCT);
  });

  it('reuses a provided modifier exactly instead of rolling a new one', () => {
    const boss = generateBoss(4, createRng(1), 1.1);
    expect(boss.difficultyModifier).toBe(1.1);
  });

  it('scales health by the provided modifier, holding the rng seed fixed', () => {
    const baseline = generateBoss(5, createRng(7), 1);
    const harder = generateBoss(5, createRng(7), 1.1);
    // Same seed, same personality/jitter rolls — only the budget differs.
    expect(harder.personality).toBe(baseline.personality);
    expect(harder.health).toBeCloseTo(baseline.health * 1.1, 6);
  });

  it('leaves armor/magicResist untouched by the modifier — they follow resistPctForIndex, not the health curve', () => {
    const baseline = generateBoss(5, createRng(7), 1);
    const harder = generateBoss(5, createRng(7), 1.1);
    expect(harder.armor).toBeCloseTo(baseline.armor, 10);
    expect(harder.magicResist).toBeCloseTo(baseline.magicResist, 10);
  });

  it('leaves physicalAttack/magicAttack untouched by the modifier — they follow missDamagePctForIndex, not the budget', () => {
    const baseline = generateBoss(5, createRng(7), 1);
    const harder = generateBoss(5, createRng(7), 1.1);
    expect(harder.physicalAttack).toBeCloseTo(baseline.physicalAttack, 10);
    expect(harder.magicAttack).toBeCloseTo(baseline.magicAttack, 10);
  });
});

describe('personalityWeightsForIndex', () => {
  it('matches the base weights exactly at index 1', () => {
    expect(personalityWeightsForIndex(1)).toEqual(TUNING.BOSS_PERSONALITY_WEIGHTS);
  });

  it('makes every personality equally likely at and beyond the ramp-end index', () => {
    for (const index of [TUNING.BOSS_PERSONALITY_RAMP_END_INDEX, TUNING.BOSS_PERSONALITY_RAMP_END_INDEX + 50, 200]) {
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
    expect(bossExpReward(1)).toBe(33);
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
      const boss = generateBoss(3, rng, 1);
      expect(boss.maxHealth).toBe(boss.health);
    }
  });

  it('rolls crit chance within [0, rare value], mostly the small default range, regardless of index', () => {
    const rareValue = TUNING.BOSS_RARE_CRIT_CHANCE;
    const results: number[] = [];
    for (let seed = 0; seed < 500; seed++) {
      results.push(generateBoss(1, createRng(seed), 1).critChance);
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
    expect(generateBoss(20, createRng(1), 1).critChance).toBeLessThanOrEqual(rareValue);
  });

  it('never rolls a permanent reflect — Reflect is a boss skill now', () => {
    for (let seed = 0; seed < 100; seed++) {
      const boss = generateBoss(1, createRng(seed), 1);
      expect('reflectPct' in boss).toBe(false);
      expect(boss.reflectDayKey).toBeUndefined();
    }
  });

  it('rolls lifestealPct from the configured tiers, mostly 0', () => {
    const validValues = Object.keys(TUNING.BOSS_LIFESTEAL_WEIGHTS).map(Number);
    const results: number[] = [];
    for (let seed = 0; seed < 500; seed++) {
      results.push(generateBoss(1, createRng(seed), 1).lifestealPct);
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
      const boss = generateBoss(1, rng, 1);
      expect(boss.personality).toBe(personality);
    }
  });

  const EMPHASIZED_STAT: Record<Exclude<Personality, 'balanced'>, EmphasizedStat> = {
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

  // Armored/warded only diverge from balanced as the index climbs — see the
  // resist-personality tests below — so they're excluded from the index-1 checks.
  const RESIST_STATS: EmphasizedStat[] = ['armor', 'magicResist'];

  it.each(
    (Object.entries(EMPHASIZED_STAT) as [Exclude<Personality, 'balanced'>, EmphasizedStat][]).filter(
      ([, stat]) => !RESIST_STATS.includes(stat),
    ),
  )(
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
        emphasizedTotal += generateBoss(1, emphasizedRng, 1)[stat];
        balancedTotal += generateBoss(1, balancedRng, 1)[stat];
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
    { lower: 'brute4x', higher: 'brute5x' },
    { lower: 'arcane', higher: 'arcane3x' },
    { lower: 'arcane3x', higher: 'arcane4x' },
    { lower: 'arcane4x', higher: 'arcane5x' },
  ];

  it.each(MULTIPLIER_TIERS.filter(({ lower }) => !RESIST_STATS.includes(EMPHASIZED_STAT[lower])))(
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
        lowerTotal += generateBoss(1, lowerRng, 1)[stat];
        higherTotal += generateBoss(1, higherRng, 1)[stat];
      }
      expect(higherTotal / iterations).toBeGreaterThan(lowerTotal / iterations);
    },
  );
});

describe('generateBoss armor/magicResist by personality', () => {
  // At BOSS_PERSONALITY_RAMP_END_INDEX every personality has equal weight, so
  // a personality's forced roll is just the middle of its slot in key order.
  const keys = Object.keys(TUNING.BOSS_PERSONALITY_WEIGHTS) as Personality[];
  const index = TUNING.BOSS_PERSONALITY_RAMP_END_INDEX;
  const bossFor = (personality: Personality, seed: number) => {
    const roll = (keys.indexOf(personality) + 0.5) / keys.length;
    let usedFirst = false;
    const underlying = createRng(seed);
    const rng: Rng = () => {
      if (!usedFirst) {
        usedFirst = true;
        return roll;
      }
      return underlying();
    };
    return generateBoss(index, rng, 1);
  };
  const reduction = (stat: number) => damageReductionPct(stat);

  it.each([
    ['armored', 'armor', 2],
    ['armored3x', 'armor', 3],
    ['armored4x', 'armor', 4],
    ['armored5x', 'armor', 5],
    ['warded', 'magicResist', 2],
    ['warded3x', 'magicResist', 3],
    ['warded4x', 'magicResist', 4],
    ['warded5x', 'magicResist', 5],
  ] as const)("'%s' reaches its tier's reduction on %s deep in a run, within jitter", (personality, stat, tier) => {
    for (let seed = 0; seed < 40; seed++) {
      const boss = bossFor(personality, seed);
      expect(boss.personality).toBe(personality);
      expect(Math.abs(reduction(boss[stat]) - TUNING.BOSS_RESIST_TIER_CAP_PCT[tier])).toBeLessThanOrEqual(0.0301);
    }
  });

  it('keeps the non-emphasized resist, and brute/arcane/balanced bosses, on the base curve', () => {
    for (let seed = 0; seed < 40; seed++) {
      for (const personality of ['balanced', 'brute5x', 'arcane5x', 'tank'] as const) {
        const boss = bossFor(personality, seed);
        expect(Math.abs(reduction(boss.armor) - TUNING.BOSS_RESIST_BASE_PCT_END)).toBeLessThanOrEqual(0.0301);
        expect(Math.abs(reduction(boss.magicResist) - TUNING.BOSS_RESIST_BASE_PCT_END)).toBeLessThanOrEqual(0.0301);
      }
      expect(reduction(bossFor('armored5x', seed).magicResist)).toBeLessThan(0.4);
    }
  });

  it('never lets jitter push a reduction past the 5x cap or below 0', () => {
    for (let seed = 0; seed < 200; seed++) {
      const boss = bossFor('armored5x', seed);
      expect(reduction(boss.armor)).toBeLessThanOrEqual(TUNING.BOSS_RESIST_TIER_CAP_PCT[5] + 1e-9);
      expect(reduction(boss.magicResist)).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives a tank personality more health than a balanced boss', () => {
    let tankTotal = 0;
    let balancedTotal = 0;
    for (let seed = 0; seed < 100; seed++) {
      tankTotal += bossFor('tank', seed).health;
      balancedTotal += bossFor('balanced', seed).health;
    }
    expect(tankTotal / balancedTotal).toBeCloseTo(TUNING.BOSS_TANK_HEALTH_MULTIPLIER, 1);
  });
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

describe('PERSONALITY_NAME', () => {
  const personalities: Personality[] = [
    'balanced',
    'tank',
    'armored',
    'armored3x',
    'armored4x',
    'armored5x',
    'warded',
    'warded3x',
    'warded4x',
    'warded5x',
    'brute',
    'brute3x',
    'brute4x',
    'brute5x',
    'arcane',
    'arcane3x',
    'arcane4x',
    'arcane5x',
  ];

  it('has a non-empty flavor name for every personality', () => {
    for (const personality of personalities) {
      expect(PERSONALITY_NAME[personality]).toBeTruthy();
    }
  });

  it('never leaks the literal internal "3x/4x/5x" tier suffix into the display name', () => {
    for (const personality of personalities) {
      expect(PERSONALITY_NAME[personality]).not.toMatch(/\dx\b/i);
    }
  });
});

describe('generateBoss — hidden attack lean', () => {
  // generateBoss is passed difficultyModifier 1 so the forced first roll is the personality pick.
  const bossFor = (personality: Personality, seed: number) =>
    generateBoss(1, forcedPersonalityRng(FORCED_ROLL_FOR[personality], seed), 1);

  it('always rolls a physicalShare of 0.3, 0.4, 0.5, 0.6 or 0.7', () => {
    for (let seed = 0; seed < 300; seed++) {
      const share = generateBoss(1, createRng(seed)).physicalShare;
      expect([0.3, 0.4, 0.5, 0.6, 0.7].some((allowed) => Math.abs((share as number) - allowed) < 1e-9)).toBe(true);
    }
  });

  it('rolls an even split about half the time, 60/40 about a quarter and 70/30 about a quarter', () => {
    const iterations = 4000;
    let even = 0;
    let sixty = 0;
    let seventy = 0;
    for (let seed = 0; seed < iterations; seed++) {
      const share = generateBoss(1, createRng(seed)).physicalShare as number;
      const favored = Math.max(share, 1 - share);
      if (Math.abs(favored - 0.5) < 1e-9) even++;
      else if (Math.abs(favored - 0.6) < 1e-9) sixty++;
      else seventy++;
    }
    expect(even / iterations).toBeGreaterThan(0.45);
    expect(even / iterations).toBeLessThan(0.55);
    expect(sixty / iterations).toBeGreaterThan(0.2);
    expect(sixty / iterations).toBeLessThan(0.3);
    expect(seventy / iterations).toBeGreaterThan(0.2);
    expect(seventy / iterations).toBeLessThan(0.3);
  });

  it.each(['brute', 'brute3x', 'brute4x', 'brute5x'] as const)("never leans a '%s' boss toward magic", (personality) => {
    for (let seed = 0; seed < 300; seed++) {
      expect(bossFor(personality, seed).physicalShare).toBeGreaterThanOrEqual(0.5);
    }
  });

  it.each(['arcane', 'arcane3x', 'arcane4x', 'arcane5x'] as const)("never leans an '%s' boss toward physical", (personality) => {
    for (let seed = 0; seed < 300; seed++) {
      expect(bossFor(personality, seed).physicalShare).toBeLessThanOrEqual(0.5);
    }
  });

  it.each(['balanced', 'tank', 'armored', 'warded'] as const)("leans a '%s' boss either way", (personality) => {
    let towardPhysical = 0;
    let towardMagic = 0;
    for (let seed = 0; seed < 600; seed++) {
      const share = bossFor(personality, seed).physicalShare as number;
      if (share > 0.5 + 1e-9) towardPhysical++;
      if (share < 0.5 - 1e-9) towardMagic++;
    }
    expect(towardPhysical).toBeGreaterThan(50);
    expect(towardMagic).toBeGreaterThan(50);
  });

  it('leaves every other rolled stat exactly as it was before the lean existed, for a given seed', () => {
    // Rolled after the Wounds ability, so the lean can't shift any earlier rng() draw.
    // Seed 42 at index 5 was captured before the lean was added, and re-captured
    // when Reflect left the roll order, the boss health/attack curves eased, and
    // health moved to growth bands (a float-rounding change only, at boss 5).
    const { physicalShare, ...rest } = generateBoss(5, createRng(42));
    expect(physicalShare).toBeDefined();
    expect(rest).toEqual({
      index: 5,
      personality: 'warded',
      maxHealth: 1846.742266679831,
      health: 1846.742266679831,
      physicalAttack: 574.6747075954526,
      magicAttack: 616.995697460808,
      armor: 278.1175695000878,
      magicResist: 352.1594129276755,
      critChance: 0.005244416962377727,
      lifestealPct: 0,
      difficultyModifier: 1.0202207503840328,
    });
  });
});

describe('expectedLevelForBossIndex', () => {
  const points = TUNING.EXPECTED_LEVEL_BY_BOSS_INDEX;

  it('returns the control-point level exactly at each control point', () => {
    for (const [index, level] of points) expect(expectedLevelForBossIndex(index)).toBeCloseTo(level, 10);
  });

  it('interpolates linearly between control points', () => {
    const [[x1, y1], [x2, y2]] = [points[2], points[3]];
    expect(expectedLevelForBossIndex((x1 + x2) / 2)).toBeCloseTo((y1 + y2) / 2, 10);
  });

  it('extrapolates past the last control point along the last segment, and never drops below level 1', () => {
    const [[x1, y1], [x2, y2]] = [points[points.length - 2], points[points.length - 1]];
    const slope = (y2 - y1) / (x2 - x1);
    expect(expectedLevelForBossIndex(x2 + 10)).toBeCloseTo(y2 + slope * 10, 10);
    expect(expectedLevelForBossIndex(-100)).toBe(1);
  });

  it('is non-decreasing in boss index', () => {
    let prev = expectedLevelForBossIndex(1);
    for (let i = 2; i <= 80; i++) {
      const next = expectedLevelForBossIndex(i);
      expect(next).toBeGreaterThanOrEqual(prev);
      prev = next;
    }
  });
});

describe('bossAttackAnchorHealth / boss attack vs. player level', () => {
  const starterHealth: number = TUNING.BASE_STATS.health;
  const INDEX = 15;

  function withFollow<T>(follow: number, fn: () => T): T {
    const original = TUNING.BOSS_ATTACK_LEVEL_FOLLOW;
    (TUNING as { BOSS_ATTACK_LEVEL_FOLLOW: number }).BOSS_ATTACK_LEVEL_FOLLOW = follow;
    try {
      return fn();
    } finally {
      (TUNING as { BOSS_ATTACK_LEVEL_FOLLOW: number }).BOSS_ATTACK_LEVEL_FOLLOW = original;
    }
  }

  const attackFor = (level: number, health: number = starterHealth) =>
    generateBoss(INDEX, createRng(7), 1, bossAttackAnchorHealth(INDEX, health, level)).physicalAttack;
  const hitPctOfMaxHp = (level: number, health: number = starterHealth) =>
    (attackFor(level, health) * TUNING.MISS_DAMAGE_FACTOR) / statAtLevel(health, level);

  it('FOLLOW = 0: the attack ignores the player level entirely', () => {
    withFollow(0, () => {
      expect(attackFor(3)).toBeCloseTo(attackFor(40), 8);
    });
  });

  it("FOLLOW = 1: reproduces the old behaviour (anchor is the player's real level-scaled health)", () => {
    withFollow(1, () => {
      for (const level of [1, 8, 25]) {
        expect(bossAttackAnchorHealth(INDEX, starterHealth, level)).toBeCloseTo(statAtLevel(starterHealth, level), 8);
      }
    });
  });

  it('FOLLOW = 0.5: the hit as a % of max HP falls as level rises and rises when below expected', () => {
    withFollow(0.5, () => {
      const expected = Math.round(expectedLevelForBossIndex(INDEX));
      const below = hitPctOfMaxHp(expected - 5);
      const on = hitPctOfMaxHp(expected);
      const above = hitPctOfMaxHp(expected + 5);
      expect(below).toBeGreaterThan(on);
      expect(on).toBeGreaterThan(above);
      let prev = hitPctOfMaxHp(1);
      for (let level = 2; level <= 60; level++) {
        const next = hitPctOfMaxHp(level);
        expect(next).toBeLessThan(prev);
        prev = next;
      }
    });
  });

  it('at exactly the expected level the anchor equals the expected-level health', () => {
    const level = expectedLevelForBossIndex(INDEX);
    expect(bossAttackAnchorHealth(INDEX, starterHealth, level)).toBeCloseTo(statAtLevel(starterHealth, level), 8);
  });

  it("scales with the character's own starterStats.health (per-run variation)", () => {
    expect(attackFor(10, starterHealth * 2)).toBeCloseTo(attackFor(10, starterHealth) * 2, 6);
  });
});
