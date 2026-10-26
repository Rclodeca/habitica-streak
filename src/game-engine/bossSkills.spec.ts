import { describe, expect, it } from 'vitest';
import { generateBoss } from './boss';
import { completeHabit, overdriveHabit, resolveBossDefeatIfDead } from './combat';
import { activeBlind, activeSunder, bloodlustActive, bossSkillMarks, doomDaysLeft, hpHitDamage, resolveBreakpoints, resolveDoom, rollBossSkills, spendPassedBreakpoints, undyingActive } from './bossSkills';
import { createRng } from './rng';
import type { Boss, BossSkillSlot, Character, Habit } from './types';

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

const hero = (overrides: Partial<Character> = {}): Character => ({
  level: 1,
  exp: 0,
  starterStats: { physicalDamage: 10, magicDamage: 10, healing: 6, health: 50, trueDamage: 6 },
  currentHealth: 50,
  ownedItemIds: [],
  equippedItemIds: [],
  critChance: 0.01,
  ...overrides,
});

const foe = (overrides: Partial<Boss> = {}): Boss => ({
  index: 30,
  personality: 'balanced',
  maxHealth: 1000,
  health: 1000,
  physicalAttack: 20,
  magicAttack: 20,
  armor: 10,
  magicResist: 10,
  critChance: 0,
  reflectPct: 0,
  lifestealPct: 0,
  ...overrides,
});

describe('hpHitDamage', () => {
  it('takes the percent of current HP', () => {
    expect(hpHitDamage(1000, 20)).toBe(200);
  });

  it('never leaves the hero below 1 HP and never heals', () => {
    expect(1.4 - hpHitDamage(1.4, 50)).toBeCloseTo(1, 10);
    expect(hpHitDamage(0.6, 40)).toBe(0);
    expect(hpHitDamage(0, 50)).toBe(0);
  });
});

describe('lasting skill effects', () => {
  it('Blind and Sunder last the day they land and the next', () => {
    const effects = [
      { type: 'blind' as const, appliedDayKey: '2026-01-01', durationDays: 2 },
      { type: 'sunder' as const, appliedDayKey: '2026-01-01', durationDays: 2 },
    ];
    const character = hero({ statusEffects: effects });
    expect(activeBlind(character, '2026-01-01')).toEqual(effects[0]);
    expect(activeBlind(character, '2026-01-02')).toEqual(effects[0]);
    expect(activeBlind(character, '2026-01-03')).toBeUndefined();
    expect(activeSunder(character, '2026-01-02')).toEqual(effects[1]);
    expect(activeSunder(character, '2026-01-03')).toBeUndefined();
    expect(activeBlind(hero(), '2026-01-01')).toBeUndefined();
  });

  it('Bloodlust lasts 2 days and Undying only the day it fired', () => {
    const boss = foe({ bloodlustDayKey: '2026-01-01', undyingDayKey: '2026-01-01' });
    expect(bloodlustActive(boss, '2026-01-02')).toBe(true);
    expect(bloodlustActive(boss, '2026-01-03')).toBe(false);
    expect(bloodlustActive(foe(), '2026-01-01')).toBe(false);
    expect(undyingActive(boss, '2026-01-01')).toBe(true);
    expect(undyingActive(boss, '2026-01-02')).toBe(false);
  });

  it('counts down Doom to its landing day', () => {
    const boss = foe({ doomDueDayKey: '2026-01-04' });
    expect(doomDaysLeft(boss, '2026-01-01')).toBe(3);
    expect(doomDaysLeft(boss, '2026-01-04')).toBe(0);
    expect(doomDaysLeft(boss, '2026-01-06')).toBe(0);
    expect(doomDaysLeft(foe(), '2026-01-01')).toBeUndefined();
  });
});

describe('bossSkillMarks', () => {
  it('reports each breakpoint and its state, never the skill', () => {
    const boss = foe({ skills: [{ at: 0.75, skill: 'mend', spent: true, fired: true }, { at: 0.5, skill: 'doom', spent: true }, { at: 0.25, skill: 'blind' }] });
    const marks = bossSkillMarks(boss);
    expect(marks).toEqual([
      { at: 0.75, state: 'fired' },
      { at: 0.5, state: 'spent' },
      { at: 0.25, state: 'armed' },
    ]);
    expect(JSON.stringify(marks)).not.toMatch(/mend|doom|blind|skill/);
    expect(bossSkillMarks(foe())).toEqual([]);
  });
});

const DAY = '2026-01-01';
const neverRng = () => 0.99;

/** The boss `foe` after a hit took it from `fromPct` to `toPct` of its max HP. */
function hitFoe(skills: BossSkillSlot[], fromPct: number, toPct: number, overrides: Partial<Boss> = {}) {
  const boss = foe({ skills, health: toPct * 1000, ...overrides });
  return { healthBefore: fromPct * 1000, boss };
}

describe('resolveBreakpoints', () => {
  it('fires a skill when a hit crosses its breakpoint', () => {
    const { healthBefore, boss } = hitFoe([{ at: 0.5, skill: 'mend' }], 0.6, 0.45);
    const result = resolveBreakpoints(healthBefore, boss, hero(), DAY, neverRng);
    expect(result.boss.health).toBeCloseTo(550, 10);
    expect(result.boss.skills).toEqual([{ at: 0.5, skill: 'mend', spent: true, fired: true }]);
    expect(result.fired).toEqual({ skill: 'mend', outcome: 'landed', amount: 100 });
  });

  it('fires nothing when no breakpoint is crossed', () => {
    const { healthBefore, boss } = hitFoe([{ at: 0.5, skill: 'mend' }], 0.8, 0.6);
    const result = resolveBreakpoints(healthBefore, boss, hero(), DAY, neverRng);
    expect(result.fired).toBeUndefined();
    expect(result.boss).toEqual(boss);
  });

  it('fires only the first of several lines one hit crosses', () => {
    const { healthBefore, boss } = hitFoe([{ at: 0.75, skill: 'blind' }, { at: 0.25, skill: 'sunder' }], 0.8, 0.2);
    const result = resolveBreakpoints(healthBefore, boss, hero(), DAY, neverRng);
    expect(result.fired?.skill).toBe('blind');
    expect(result.boss.skills).toEqual([
      { at: 0.75, skill: 'blind', spent: true, fired: true },
      { at: 0.25, skill: 'sunder', spent: true },
    ]);
    expect(activeBlind(result.character, DAY)).toBeDefined();
    expect(activeSunder(result.character, DAY)).toBeUndefined();
  });

  it('fires nothing on a kill, but spends every line crossed', () => {
    const { healthBefore, boss } = hitFoe([{ at: 0.75, skill: 'blind' }, { at: 0.25, skill: 'sunder' }], 0.8, 0);
    const character = hero();
    const result = resolveBreakpoints(healthBefore, boss, character, DAY, neverRng);
    expect(result.fired).toBeUndefined();
    expect(result.character).toBe(character);
    expect(result.boss.skills?.every((slot) => slot.spent && !slot.fired)).toBe(true);
  });

  it('fires each breakpoint once, even after the boss heals back above it', () => {
    const first = resolveBreakpoints(600, foe({ skills: [{ at: 0.5, skill: 'mend' }], health: 400 }), hero(), DAY, neverRng);
    const healed = { ...first.boss, health: 700 };
    const second = resolveBreakpoints(700, { ...healed, health: 400 }, hero(), DAY, neverRng);
    expect(second.fired).toBeUndefined();
  });

  it('Undying stops the hit that triggers it at 10%, and holds the floor all day', () => {
    const { healthBefore, boss } = hitFoe([{ at: 0.25, skill: 'undying' }], 0.3, 0.05, { overkill: 0 });
    const fired = resolveBreakpoints(healthBefore, boss, hero(), DAY, neverRng);
    expect(fired.fired).toEqual({ skill: 'undying', outcome: 'landed' });
    expect(fired.boss.health).toBe(100);
    expect(fired.boss.undyingDayKey).toBe(DAY);

    const sameDay = resolveBreakpoints(100, { ...fired.boss, health: 0, overkill: 250 }, hero(), DAY, neverRng);
    expect(sameDay.boss.health).toBe(100);
    expect(sameDay.boss.overkill).toBeUndefined();

    const nextDay = resolveBreakpoints(100, { ...fired.boss, health: 0 }, hero(), '2026-01-02', neverRng);
    expect(nextDay.boss.health).toBe(0);
  });

  it('Rend and Ravage take 20% and 40% of current HP, never below 1', () => {
    const rend = resolveBreakpoints(600, foe({ skills: [{ at: 0.5, skill: 'rend' }], health: 400 }), hero({ currentHealth: 500 }), DAY, neverRng);
    expect(rend.character.currentHealth).toBeCloseTo(400, 10);
    expect(rend.fired).toEqual({ skill: 'rend', outcome: 'landed', amount: 100 });
    const ravage = resolveBreakpoints(600, foe({ skills: [{ at: 0.5, skill: 'ravage' }], health: 400 }), hero({ currentHealth: 500 }), DAY, neverRng);
    expect(ravage.character.currentHealth).toBeCloseTo(300, 10);
    const low = resolveBreakpoints(600, foe({ skills: [{ at: 0.5, skill: 'ravage' }], health: 400 }), hero({ currentHealth: 1.4 }), DAY, neverRng);
    expect(low.character.currentHealth).toBeCloseTo(1, 10);
  });

  it('Rend ignores the hero\'s armor', () => {
    const armored = hero({ currentHealth: 500, equippedItemIds: ['executioners-axe', 'warding-sigil'] });
    const rend = resolveBreakpoints(600, foe({ skills: [{ at: 0.5, skill: 'rend' }], health: 400 }), armored, DAY, neverRng);
    expect(rend.character.currentHealth).toBeCloseTo(400, 10);
  });

  it('Doom sets a countdown 3 days out', () => {
    const doom = resolveBreakpoints(600, foe({ skills: [{ at: 0.5, skill: 'doom' }], health: 400 }), hero(), DAY, neverRng);
    expect(doom.boss.doomDueDayKey).toBe('2026-01-04');
    expect(doom.fired).toEqual({ skill: 'doom', outcome: 'landed' });
  });

  it('Bloodlust starts on the day it fires', () => {
    const lust = resolveBreakpoints(600, foe({ skills: [{ at: 0.5, skill: 'bloodlust' }], health: 400 }), hero(), DAY, neverRng);
    expect(bloodlustActive(lust.boss, '2026-01-02')).toBe(true);
  });

  it('Wounds lands at half healing for 2 days, replacing an older one', () => {
    const old = { type: 'wounds' as const, appliedDayKey: '2025-12-31', durationDays: 3, effectRate: 0.25 };
    const wounds = resolveBreakpoints(600, foe({ skills: [{ at: 0.5, skill: 'wounds' }], health: 400 }), hero({ statusEffects: [old] }), DAY, neverRng);
    expect(wounds.character.statusEffects).toEqual([{ type: 'wounds', appliedDayKey: DAY, durationDays: 2, effectRate: 0.5 }]);
  });

  it('Aegis of the Unbroken resists Wounds', () => {
    const character = hero({ equippedItemIds: ['aegis-of-the-unbroken'] });
    const wounds = resolveBreakpoints(600, foe({ skills: [{ at: 0.5, skill: 'wounds' }], health: 400 }), character, DAY, neverRng);
    expect(wounds.fired).toEqual({ skill: 'wounds', outcome: 'resisted' });
    expect(wounds.character.statusEffects ?? []).toEqual([]);
    expect(wounds.boss.skills?.[0]).toEqual({ at: 0.5, skill: 'wounds', spent: true, fired: true });
  });

  it('Blind and Sunder land for 2 days', () => {
    const sunder = resolveBreakpoints(600, foe({ skills: [{ at: 0.5, skill: 'sunder' }], health: 400 }), hero(), DAY, neverRng);
    expect(sunder.character.statusEffects).toEqual([{ type: 'sunder', appliedDayKey: DAY, durationDays: 2 }]);
  });

  it('only rolls rng for Hushing Bell', () => {
    const rng = Object.assign(() => {
      rng.calls += 1;
      return 0;
    }, { calls: 0 });
    resolveBreakpoints(600, foe({ skills: [{ at: 0.5, skill: 'mend' }], health: 400 }), hero(), DAY, rng);
    expect(rng.calls).toBe(0);
  });
});

describe('spendPassedBreakpoints', () => {
  it('spends every line at or above the boss\'s health without firing', () => {
    const boss = foe({ health: 600, skills: [{ at: 0.75, skill: 'blind' }, { at: 0.25, skill: 'sunder' }] });
    expect(spendPassedBreakpoints(boss).skills).toEqual([
      { at: 0.75, skill: 'blind', spent: true },
      { at: 0.25, skill: 'sunder' },
    ]);
  });
});

describe('boss skills through combat', () => {
  const habit = (overrides: Partial<Habit> = {}): Habit => ({
    id: 'h', name: 'Train', period: 'daily', difficulty: 'medium', damageType: 'physical', isBad: false,
    streakCount: 0, lastCompletedPeriodKey: null, lastCheckedPeriodKey: null, ...overrides,
  });

  /** A boss sized so one hit dealing `dealt` takes it from 60% to 35% of its max HP. */
  const sized = (dealt: number, skills: BossSkillSlot[]) => foe({ armor: 0, magicResist: 0, maxHealth: dealt * 4, health: dealt * 2.4, skills });

  it('completeHabit fires a crossed skill and reports it', () => {
    const h = habit();
    const dealt = completeHabit(hero(), h, [h], foe({ armor: 0, health: 1e9, maxHealth: 1e9 }), DAY, neverRng).damageDealt!;
    const result = completeHabit(hero(), h, [h], sized(dealt, [{ at: 0.5, skill: 'doom' }]), DAY, neverRng);
    expect(result.bossSkill).toEqual({ skill: 'doom', outcome: 'landed' });
    expect(result.boss.doomDueDayKey).toBe('2026-01-04');
  });

  it('an Overdrive use fires a crossed skill', () => {
    const h = habit({ isOverdrive: true, lastCompletedPeriodKey: DAY });
    const dealt = overdriveHabit(hero(), h, [h], foe({ armor: 0, health: 1e9, maxHealth: 1e9 }), DAY, DAY, neverRng).damageDealt!;
    const result = overdriveHabit(hero(), h, [h], sized(dealt, [{ at: 0.5, skill: 'bloodlust' }]), DAY, DAY, neverRng);
    expect(result.bossSkill).toEqual({ skill: 'bloodlust', outcome: 'landed' });
  });

  it('Torch of Wrath\'s heal-damage fires a crossed skill', () => {
    const h = habit({ damageType: 'healing' });
    const torch = hero({ currentHealth: 1, equippedItemIds: ['censer-of-wrath'] });
    const dealt = completeHabit(torch, h, [h], foe({ health: 1e9, maxHealth: 1e9 }), DAY, neverRng).damageDealt!;
    const result = completeHabit(torch, h, [h], sized(dealt, [{ at: 0.5, skill: 'mend' }]), DAY, neverRng);
    expect(result.bossSkill?.skill).toBe('mend');
  });

  it('Echoing Blade carry spends the lines it passes on the next boss, without firing them', () => {
    let found = 0;
    for (let seed = 0; seed < 200 && found < 3; seed++) {
      const character = hero({ equippedItemIds: ['echoing-blade'] });
      const dead = foe({ index: 29, health: 0, overkill: 1e12 });
      const next = resolveBossDefeatIfDead(character, dead, createRng(seed)).boss;
      if (!next.skills) continue;
      found++;
      for (const slot of next.skills) {
        expect(slot.fired).toBeUndefined();
        expect(slot.spent).toBe(true); // the carry leaves the new boss at 1 HP, past every line
      }
    }
    expect(found).toBeGreaterThan(0);
  });
});

describe('resolveDoom', () => {
  const dooming = foe({ doomDueDayKey: '2026-01-04' });

  it('waits until its landing day', () => {
    const character = hero({ currentHealth: 1000 });
    const early = resolveDoom(character, dooming, '2026-01-03');
    expect(early.character).toBe(character);
    expect(early.boss).toBe(dooming);
    expect(early.amount).toBeUndefined();
  });

  it('takes half the hero\'s current HP on its day, once', () => {
    const landed = resolveDoom(hero({ currentHealth: 1000 }), dooming, '2026-01-04');
    expect(landed.character.currentHealth).toBeCloseTo(500, 10);
    expect(landed.amount).toBeCloseTo(500, 10);
    expect(landed.boss.doomDueDayKey).toBeUndefined();
    expect(resolveDoom(landed.character, landed.boss, '2026-01-04').amount).toBeUndefined();
  });

  it('lands once at the next rollover when the app stayed closed past its day', () => {
    const late = resolveDoom(hero({ currentHealth: 1000 }), dooming, '2026-01-10');
    expect(late.amount).toBeCloseTo(500, 10);
    expect(resolveDoom(late.character, late.boss, '2026-01-11').amount).toBeUndefined();
  });

  it('never hits a fallen hero', () => {
    const fallen = hero({ currentHealth: 0 });
    expect(resolveDoom(fallen, dooming, '2026-01-04').character).toBe(fallen);
  });
});
