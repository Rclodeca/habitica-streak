import { describe, expect, it } from 'vitest';
import { bossExpReward } from './boss';
import { bossMissDamage } from './combat';
import { DIFFICULTY_WEIGHT } from './constants/difficulty';
import { TUNING } from './constants/tuning';
import { createQuest, questExpReward, questMissDamage, rollQuestOffer } from './quests';
import { createRng } from './rng';
import type { Boss, Quest } from './types';

function makeQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'quest-id',
    description: 'Test quest',
    difficulty: 'medium',
    dueDateKey: '2026-01-10',
    bossIndexAtOffer: 1,
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

describe('rollQuestOffer', () => {
  it('returns true when the roll beats QUEST_DROP_CHANCE, false otherwise', () => {
    expect(rollQuestOffer(() => 0)).toBe(true); // 0 < 0.4
    expect(rollQuestOffer(() => 0.99)).toBe(false); // 0.99 >= 0.4
  });

  it('returns true roughly QUEST_DROP_CHANCE of the time across many seeds', () => {
    let offered = 0;
    const trials = 1000;
    for (let seed = 0; seed < trials; seed++) {
      if (rollQuestOffer(createRng(seed))) offered++;
    }
    const rate = offered / trials;
    expect(rate).toBeGreaterThan(TUNING.QUEST_DROP_CHANCE - 0.05);
    expect(rate).toBeLessThan(TUNING.QUEST_DROP_CHANCE + 0.05);
  });
});

describe('questExpReward', () => {
  it('scales by QUEST_EXP_DIFFICULTY_PCT off the boss that offered it', () => {
    const quest = makeQuest({ difficulty: 'medium', bossIndexAtOffer: 5 });
    expect(questExpReward(quest)).toBeCloseTo(bossExpReward(5) * TUNING.QUEST_EXP_DIFFICULTY_PCT.medium, 10);
  });

  it('is unaffected by any boss index other than bossIndexAtOffer', () => {
    const quest = makeQuest({ difficulty: 'hard', bossIndexAtOffer: 2 });
    // A much later "current" boss index must have no bearing on the reward.
    expect(questExpReward(quest)).toBeCloseTo(bossExpReward(2) * TUNING.QUEST_EXP_DIFFICULTY_PCT.hard, 10);
    expect(questExpReward(quest)).not.toBeCloseTo(bossExpReward(50) * TUNING.QUEST_EXP_DIFFICULTY_PCT.hard, 1);
  });

  it('easy rewards less and hard rewards more than medium, for the same bossIndexAtOffer', () => {
    const easy = questExpReward(makeQuest({ difficulty: 'easy', bossIndexAtOffer: 3 }));
    const medium = questExpReward(makeQuest({ difficulty: 'medium', bossIndexAtOffer: 3 }));
    const hard = questExpReward(makeQuest({ difficulty: 'hard', bossIndexAtOffer: 3 }));
    expect(easy).toBeLessThan(medium);
    expect(hard).toBeGreaterThan(medium);
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

  it('uses the CURRENT boss, not quest.bossIndexAtOffer (which it never even reads)', () => {
    const quest = makeQuest({ difficulty: 'medium', bossIndexAtOffer: 1 });
    const weakBoss = makeBoss({ physicalAttack: 10, magicAttack: 10 });
    const strongBoss = makeBoss({ physicalAttack: 1000, magicAttack: 1000 });
    expect(questMissDamage(quest, strongBoss, createRng(1))).toBeGreaterThan(questMissDamage(quest, weakBoss, createRng(1)));
  });
});

describe('createQuest', () => {
  it('builds a Quest with the given fields and a generated id', () => {
    const quest = createQuest('Clean garage', 'hard', '2026-02-01', 7);
    expect(quest.description).toBe('Clean garage');
    expect(quest.difficulty).toBe('hard');
    expect(quest.dueDateKey).toBe('2026-02-01');
    expect(quest.bossIndexAtOffer).toBe(7);
    expect(quest.id).toBeTruthy();
  });

  it('generates different ids for two quests', () => {
    const a = createQuest('A', 'easy', '2026-02-01', 1);
    const b = createQuest('B', 'easy', '2026-02-01', 1);
    expect(a.id).not.toBe(b.id);
  });
});
