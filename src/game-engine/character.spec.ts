import { describe, expect, it } from 'vitest';
import { createCharacter, randomizeStat } from './character';
import { createRng } from './rng';
import { TUNING } from './constants/tuning';

describe('createCharacter', () => {
  it('every starter stat falls within its possible range (split ratio + ±5% jitter) across many real-RNG runs', () => {
    const rng = createRng();
    const damagePool = TUNING.BASE_STATS.physicalDamage + TUNING.BASE_STATS.magicDamage;
    const shares = TUNING.DAMAGE_SPLIT_RATIOS.map(([physicalShare]) => physicalShare);
    const minShare = Math.min(...shares);
    const maxShare = Math.max(...shares);

    for (let i = 0; i < 200; i++) {
      const character = createCharacter(rng);
      const { physicalDamage, magicDamage, healing, health } = character.starterStats;

      expect(physicalDamage).toBeGreaterThanOrEqual(damagePool * minShare * 0.95);
      expect(physicalDamage).toBeLessThanOrEqual(damagePool * maxShare * 1.05);

      expect(magicDamage).toBeGreaterThanOrEqual(damagePool * minShare * 0.95);
      expect(magicDamage).toBeLessThanOrEqual(damagePool * maxShare * 1.05);

      // Every split ratio pairs physical/magic shares that sum to 1, so
      // their combined range is tighter than either stat's individual range.
      expect(physicalDamage + magicDamage).toBeGreaterThanOrEqual(damagePool * 0.95);
      expect(physicalDamage + magicDamage).toBeLessThanOrEqual(damagePool * 1.05);

      expect(healing).toBeGreaterThanOrEqual(TUNING.BASE_STATS.healing * 0.95);
      expect(healing).toBeLessThanOrEqual(TUNING.BASE_STATS.healing * 1.05);

      expect(health).toBeGreaterThanOrEqual(TUNING.BASE_STATS.health * 0.95);
      expect(health).toBeLessThanOrEqual(TUNING.BASE_STATS.health * 1.05);
    }
  });

  it('picks each configured physical/magic split ratio at least once over many seeds', () => {
    const damagePool = TUNING.BASE_STATS.physicalDamage + TUNING.BASE_STATS.magicDamage;
    const seenShares = new Set<number>();

    for (let seed = 0; seed < 500; seed++) {
      const character = createCharacter(createRng(seed));
      // Reverse the jitter-free share out of the jittered stat by rounding
      // to the nearest configured share — jitter is only ±5%, well inside
      // the gap between adjacent configured shares (10%).
      const approxShare = character.starterStats.physicalDamage / damagePool;
      const closest = TUNING.DAMAGE_SPLIT_RATIOS.map(([p]) => p).reduce((best, p) =>
        Math.abs(p - approxShare) < Math.abs(best - approxShare) ? p : best,
      );
      seenShares.add(closest);
    }

    expect(seenShares.size).toBe(TUNING.DAMAGE_SPLIT_RATIOS.length);
  });

  it('starts at level 1 with 0 exp and currentHealth equal to starter health', () => {
    const rng = createRng(42);
    const character = createCharacter(rng);
    expect(character.level).toBe(1);
    expect(character.exp).toBe(0);
    expect(character.currentHealth).toBe(character.starterStats.health);
  });

  it('starts with no owned or equipped items', () => {
    const character = createCharacter(createRng(1));
    expect(character.ownedItemIds).toEqual([]);
    expect(character.equippedItemIds).toEqual([]);
  });

  it('starts with the base crit chance', () => {
    const character = createCharacter(createRng(1));
    expect(character.critChance).toBe(TUNING.BASE_CRIT_CHANCE);
  });

  it('is deterministic: the same seed produces the same character', () => {
    const characterA = createCharacter(createRng(12345));
    const characterB = createCharacter(createRng(12345));
    expect(characterA).toEqual(characterB);
  });

  it('different seeds produce different characters', () => {
    const characterA = createCharacter(createRng(1));
    const characterB = createCharacter(createRng(2));
    expect(characterA).not.toEqual(characterB);
  });
});

describe('randomizeStat', () => {
  it('stays within base * [1 - pct, 1 + pct] for a deterministic rng sweep', () => {
    // Sweep rng() across [0, 1) via a fake sequence to hit both jitter extremes.
    const samples = [0, 0.25, 0.5, 0.75, 0.999999];
    for (const sample of samples) {
      const rng = () => sample;
      const result = randomizeStat(100, rng);
      expect(result).toBeGreaterThanOrEqual(100 * (1 - TUNING.STAT_RANDOMIZATION_PCT));
      expect(result).toBeLessThanOrEqual(100 * (1 + TUNING.STAT_RANDOMIZATION_PCT));
    }
  });
});
