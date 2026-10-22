import { describe, expect, it } from 'vitest';
import { bossMissDamage } from './combat';
import { DIFFICULTY_WEIGHT } from './constants/difficulty';
import { TUNING } from './constants/tuning';
import { expToNextLevel } from './leveling';
import {
  createQuest,
  cumulativeSlotWeight,
  migrateQuest,
  questMissDamage,
  questRewardTier,
  questSlotExp,
  questWeekFor,
  questWeeklyTargetExp,
  recordQuestCompletion,
} from './quests';
import { createRng } from './rng';
import type { Boss, Quest } from './types';

function makeQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'quest-id',
    kind: 'regular',
    description: 'Test quest',
    difficulty: 'medium',
    dueDateKey: '2026-01-10',
    ...overrides,
  };
}

function makeBoss(overrides: Partial<Boss> = {}): Boss {
  return {
    index: 1,
    personality: 'balanced',
    maxHealth: 100,
    health: 100,
    physicalAttack: 20,
    magicAttack: 20,
    armor: 10,
    magicResist: 10,
    critChance: 0.01,
    reflectPct: 0,
    lifestealPct: 0,
    ...overrides,
  };
}

// A level whose expToNextLevel is exactly 100 would make the table readable,
// but none is; instead set `fraction` so the weekly target is exactly 100.
const target100 = (level: number) => 100 / expToNextLevel(level);
const slots = (n: number, onCurve: number, difficulty: 'easy' | 'medium' | 'hard' = 'medium') =>
  Array.from({ length: 8 }, (_, i) => questSlotExp(10, difficulty, i, { onCurve, fraction: target100(10) })).slice(0, n);

describe('cumulativeSlotWeight', () => {
  it('sums whole slots and interpolates fractional ones', () => {
    expect(cumulativeSlotWeight(1)).toBe(100);
    expect(cumulativeSlotWeight(1.5)).toBe(130);
    expect(cumulativeSlotWeight(2)).toBe(160);
    expect(cumulativeSlotWeight(3)).toBe(195);
  });

  it('stops growing past the last slot', () => {
    expect(cumulativeSlotWeight(7)).toBe(232);
    expect(cumulativeSlotWeight(50)).toBe(232);
  });
});

describe('questSlotExp', () => {
  it('matches the spec table at N = 1, 1.5, 2, 3 (target 100, medium)', () => {
    const rounded = (onCurve: number) => slots(7, onCurve).map(Math.round);
    expect(rounded(1)).toEqual([100, 60, 35, 20, 10, 5, 2]);
    expect(rounded(1.5).slice(0, 3)).toEqual([77, 46, 27]);
    expect(rounded(2).slice(0, 3)).toEqual([63, 38, 22]);
    expect(rounded(3).slice(0, 3)).toEqual([51, 31, 18]);
  });

  it('the all-slot total is 232% of target at the default N = 1', () => {
    expect(slots(8, 1).reduce((a, b) => a + b, 0)).toBeCloseTo(232, 6);
  });

  it('the first N slots sum to the weekly target for any N in (0.5, 3]', () => {
    for (const onCurve of [0.6, 1, 1.25, 1.5, 2, 2.75, 3]) {
      const whole = Math.floor(onCurve);
      const frac = onCurve - whole;
      const all = slots(8, onCurve);
      const sum = all.slice(0, whole).reduce((a, b) => a + b, 0) + (frac ? all[whole] * frac : 0);
      expect(sum).toBeCloseTo(100, 6);
    }
  });

  it('slot 8 and beyond pays 0', () => {
    expect(questSlotExp(10, 'hard', 7)).toBe(0);
    expect(questSlotExp(10, 'hard', 30)).toBe(0);
  });

  it('applies the easy 0.7x / hard 1.3x multiplier', () => {
    const medium = questSlotExp(10, 'medium', 0);
    expect(questSlotExp(10, 'easy', 0)).toBeCloseTo(medium * 0.7, 10);
    expect(questSlotExp(10, 'hard', 0)).toBeCloseTo(medium * 1.3, 10);
  });

  it('defaults to 15% of expToNextLevel (with a floor) for a medium slot-1 quest', () => {
    for (const level of [1, 5, 10, 25]) {
      expect(questSlotExp(level, 'medium', 0)).toBeCloseTo(Math.max(TUNING.QUEST_MIN_TARGET_EXP, expToNextLevel(level) * 0.15), 10);
    }
  });

  it('pays under one level at level 1 even for a hard slot-1 quest, and grows with level', () => {
    expect(questSlotExp(1, 'hard', 0)).toBeLessThan(expToNextLevel(1));
    expect(questSlotExp(10, 'medium', 0)).toBeGreaterThan(questSlotExp(5, 'medium', 0));
    expect(questSlotExp(25, 'medium', 0)).toBeGreaterThan(questSlotExp(10, 'medium', 0));
  });
});

describe('questWeeklyTargetExp', () => {
  it('is expToNextLevel(level) * fraction', () => {
    expect(questWeeklyTargetExp(10, 0.5)).toBeCloseTo(expToNextLevel(10) * 0.5, 10);
  });
});

describe('weekly counter', () => {
  it('a missing or stale counter starts the new week at 0', () => {
    expect(questWeekFor(undefined, '2026-W10')).toEqual({ weekKey: '2026-W10', completed: 0 });
    expect(questWeekFor({ weekKey: '2026-W09', completed: 3 }, '2026-W10')).toEqual({ weekKey: '2026-W10', completed: 0 });
  });

  it('keeps the count within the same week', () => {
    expect(questWeekFor({ weekKey: '2026-W10', completed: 2 }, '2026-W10').completed).toBe(2);
  });

  it('recordQuestCompletion increments within a week and restarts across weeks', () => {
    expect(recordQuestCompletion({ weekKey: '2026-W10', completed: 2 }, '2026-W10')).toEqual({ weekKey: '2026-W10', completed: 3 });
    expect(recordQuestCompletion({ weekKey: '2026-W09', completed: 5 }, '2026-W10')).toEqual({ weekKey: '2026-W10', completed: 1 });
    expect(recordQuestCompletion(undefined, '2026-W10')).toEqual({ weekKey: '2026-W10', completed: 1 });
  });
});

describe('questRewardTier', () => {
  it('maps difficulty to a vague tier', () => {
    expect(questRewardTier('easy')).toBe('Small');
    expect(questRewardTier('medium')).toBe('Medium');
    expect(questRewardTier('hard')).toBe('Large');
  });
});

describe('questMissDamage', () => {
  it('matches a missed medium weekly habit exactly, for a medium quest', () => {
    const boss = makeBoss({ physicalAttack: 100, magicAttack: 100 }); // equal, so the coin flip doesn't matter
    const quest = makeQuest({ difficulty: 'medium' });
    const expected = bossMissDamage(100) * TUNING.WEEKLY_MISS_MULTIPLIER * (DIFFICULTY_WEIGHT.medium / 1.5);
    expect(questMissDamage(quest, boss, createRng(1))).toBeCloseTo(expected, 10);
  });

  it('scales proportionally down for easy and up for hard, relative to medium', () => {
    const boss = makeBoss({ physicalAttack: 100, magicAttack: 100 });
    const medium = questMissDamage(makeQuest({ difficulty: 'medium' }), boss, createRng(1));
    const easy = questMissDamage(makeQuest({ difficulty: 'easy' }), boss, createRng(1));
    const hard = questMissDamage(makeQuest({ difficulty: 'hard' }), boss, createRng(1));
    expect(easy).toBeCloseTo(medium * (DIFFICULTY_WEIGHT.easy / DIFFICULTY_WEIGHT.medium), 10);
    expect(hard).toBeCloseTo(medium * (DIFFICULTY_WEIGHT.hard / DIFFICULTY_WEIGHT.medium), 10);
  });

  it('uses the CURRENT boss and is identical for side quests', () => {
    const quest = makeQuest({ difficulty: 'medium' });
    const boss = makeBoss({ physicalAttack: 100, magicAttack: 100 });
    expect(questMissDamage({ ...quest, kind: 'side', rewardItemId: 'x' }, boss, createRng(1))).toBe(questMissDamage(quest, boss, createRng(1)));
    const weakBoss = makeBoss({ physicalAttack: 10, magicAttack: 10 });
    const strongBoss = makeBoss({ physicalAttack: 1000, magicAttack: 1000 });
    expect(questMissDamage(quest, strongBoss, createRng(1))).toBeGreaterThan(questMissDamage(quest, weakBoss, createRng(1)));
  });
});

describe('createQuest', () => {
  it('builds a regular Quest with the given fields and a generated id', () => {
    const quest = createQuest('Clean garage', 'hard', '2026-02-01');
    expect(quest).toMatchObject({ kind: 'regular', description: 'Clean garage', difficulty: 'hard', dueDateKey: '2026-02-01' });
    expect(quest.rewardItemId).toBeUndefined();
    expect(quest.id).toBeTruthy();
  });

  it('builds a side quest carrying its reward item', () => {
    const quest = createQuest('Slay it', 'medium', '2026-02-01', 'side', 'dragons-heart');
    expect(quest).toMatchObject({ kind: 'side', rewardItemId: 'dragons-heart' });
  });

  it('rejects a quest without a due date, regular or side', () => {
    expect(() => createQuest('No date', 'easy', '')).toThrow();
    expect(() => createQuest('No date', 'easy', '', 'side', 'dragons-heart')).toThrow();
  });

  it('generates different ids for two quests', () => {
    const a = createQuest('A', 'easy', '2026-02-01');
    const b = createQuest('B', 'easy', '2026-02-01');
    expect(a.id).not.toBe(b.id);
  });
});

describe('migrateQuest', () => {
  it('backfills kind and drops bossIndexAtOffer, keeping the due date', () => {
    const old = { id: 'q', description: 'Old', difficulty: 'easy' as const, dueDateKey: '2026-01-01', bossIndexAtOffer: 4 };
    const migrated = migrateQuest(old);
    expect(migrated).toEqual({ id: 'q', kind: 'regular', description: 'Old', difficulty: 'easy', dueDateKey: '2026-01-01' });
    expect('bossIndexAtOffer' in migrated).toBe(false);
  });

  it('is idempotent and leaves a side quest alone', () => {
    const side = createQuest('Slay it', 'medium', '2026-02-01', 'side', 'dragons-heart');
    expect(migrateQuest(side)).toEqual(side);
    expect(migrateQuest(migrateQuest(side))).toEqual(side);
  });
});
