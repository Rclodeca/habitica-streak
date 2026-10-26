import { describe, expect, it } from 'vitest';
import { generateBoss } from './boss';
import { rollBossSkills } from './bossSkills';
import { createRng } from './rng';
import type { BossSkillSlot } from './types';

const SEEDS = 2000;

/** Rolls `SEEDS` bosses' skills at `index`, one seed each. */
function sample(index: number): BossSkillSlot[][] {
  return Array.from({ length: SEEDS }, (_, seed) => rollBossSkills(index, createRng(seed)));
}

/** Share (0-100) of the sampled bosses carrying exactly `count` skills. */
function sharePct(rolls: BossSkillSlot[][], count: number): number {
  return (rolls.filter((slots) => slots.length === count).length / rolls.length) * 100;
}

describe('rollBossSkills', () => {
  it('returns no skills and consumes no rng before boss 15', () => {
    const rng = Object.assign(() => {
      rng.calls += 1;
      return 0.5;
    }, { calls: 0 });
    expect(rollBossSkills(14, rng)).toEqual([]);
    expect(rng.calls).toBe(0);
  });

  it('follows the count odds of each band', () => {
    const at15 = sample(15);
    expect(sharePct(at15, 1)).toBeGreaterThan(30);
    expect(sharePct(at15, 1)).toBeLessThan(40);
    expect(sharePct(at15, 2)).toBe(0);

    const at22 = sample(22);
    expect(sharePct(at22, 0)).toBeGreaterThan(40);
    expect(sharePct(at22, 0)).toBeLessThan(50);
    expect(sharePct(at22, 1)).toBeGreaterThan(30);
    expect(sharePct(at22, 1)).toBeLessThan(40);
    expect(sharePct(at22, 2)).toBeGreaterThan(15);
    expect(sharePct(at22, 2)).toBeLessThan(25);
    expect(sharePct(at22, 3)).toBe(0);

    const at30 = sample(30);
    expect(sharePct(at30, 0)).toBeGreaterThan(20);
    expect(sharePct(at30, 0)).toBeLessThan(30);
    expect(sharePct(at30, 1)).toBeGreaterThan(25);
    expect(sharePct(at30, 1)).toBeLessThan(35);
    expect(sharePct(at30, 2)).toBeGreaterThan(30);
    expect(sharePct(at30, 2)).toBeLessThan(40);
    expect(sharePct(at30, 3)).toBeGreaterThan(5);
    expect(sharePct(at30, 3)).toBeLessThan(15);
  });

  it('places slots by count, highest first', () => {
    const expected: Record<number, number[]> = { 1: [0.5], 2: [0.75, 0.25], 3: [0.75, 0.5, 0.25] };
    for (const slots of sample(30)) {
      if (slots.length === 0) continue;
      expect(slots.map((slot) => slot.at)).toEqual(expected[slots.length]);
    }
  });

  it('only picks skills unlocked at that boss', () => {
    for (const slots of [...sample(15), ...sample(19)]) {
      for (const slot of slots) expect(['wounds', 'bloodlust', 'blind', 'mend']).toContain(slot.skill);
    }
    for (const slots of sample(24)) {
      for (const slot of slots) expect(slot.skill).not.toBe('ravage');
    }
    expect(sample(30).flat().some((slot) => slot.skill === 'ravage')).toBe(true);
  });

  it('puts Undying only in the 25% slot', () => {
    const undying = sample(30).flat().filter((slot) => slot.skill === 'undying');
    expect(undying.length).toBeGreaterThan(0);
    for (const slot of undying) expect(slot.at).toBe(0.25);
  });

  it('never repeats a skill on one boss', () => {
    for (const slots of sample(30)) {
      expect(new Set(slots.map((slot) => slot.skill)).size).toBe(slots.length);
    }
  });

  it('gives a boss at most one HP hit', () => {
    for (const slots of sample(30)) {
      expect(slots.filter((slot) => ['rend', 'ravage', 'doom'].includes(slot.skill)).length).toBeLessThanOrEqual(1);
    }
  });
});

describe('generateBoss — skills', () => {
  it('stores rolled skills on about three in four bosses from boss 30', () => {
    const withSkills = Array.from({ length: 400 }, (_, seed) => generateBoss(30, createRng(seed))).filter((boss) => boss.skills);
    expect(withSkills.length).toBeGreaterThan(260);
    expect(withSkills.length).toBeLessThan(340);
    for (const boss of withSkills) expect(boss.skills!.length).toBeGreaterThan(0);
  });

  it('leaves every other stat as it was before skills existed, for a given seed', () => {
    // Seed 7 at boss 30, captured before skills were added.
    const rest = generateBoss(30, createRng(7));
    delete rest.skills;
    expect(rest).toEqual({
      index: 30,
      personality: 'balanced',
      maxHealth: 924783.6408251054,
      health: 924783.6408251054,
      physicalAttack: 3666.705096759858,
      magicAttack: 3909.1449803130317,
      armor: 857.7095762002356,
      magicResist: 757.230814301548,
      critChance: 0.015643358055967838,
      reflectPct: 0,
      lifestealPct: 0,
      difficultyModifier: 0.9023409506306053,
      physicalShare: 0.5,
    });
  });

  it('gives bosses before 15 no skills field at all', () => {
    for (let seed = 0; seed < 50; seed++) expect('skills' in generateBoss(14, createRng(seed))).toBe(false);
  });
});
