import { describe, expect, it } from 'vitest';
import { createCharacter, randomizeStat } from './character';
import { createRng } from './rng';
import { TUNING } from './constants/tuning';

describe('createCharacter', () => {
  it('every starter stat falls within base * [0.95, 1.05] across many real-RNG runs', () => {
    const rng = createRng();
    for (let i = 0; i < 200; i++) {
      const character = createCharacter(rng);
      const { physicalDamage, magicDamage, healing, health } = character.starterStats;

      expect(physicalDamage).toBeGreaterThanOrEqual(TUNING.BASE_STATS.physicalDamage * 0.95);
      expect(physicalDamage).toBeLessThanOrEqual(TUNING.BASE_STATS.physicalDamage * 1.05);

      expect(magicDamage).toBeGreaterThanOrEqual(TUNING.BASE_STATS.magicDamage * 0.95);
      expect(magicDamage).toBeLessThanOrEqual(TUNING.BASE_STATS.magicDamage * 1.05);

      expect(healing).toBeGreaterThanOrEqual(TUNING.BASE_STATS.healing * 0.95);
      expect(healing).toBeLessThanOrEqual(TUNING.BASE_STATS.healing * 1.05);

      expect(health).toBeGreaterThanOrEqual(TUNING.BASE_STATS.health * 0.95);
      expect(health).toBeLessThanOrEqual(TUNING.BASE_STATS.health * 1.05);
    }
  });

  it('starts at level 1 with 0 exp and currentHealth equal to starter health', () => {
    const rng = createRng(42);
    const character = createCharacter(rng);
    expect(character.level).toBe(1);
    expect(character.exp).toBe(0);
    expect(character.currentHealth).toBe(character.starterStats.health);
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
