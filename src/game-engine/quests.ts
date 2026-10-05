import { bossExpReward } from './boss';
import { DIFFICULTY_WEIGHT } from './constants/difficulty';
import { TUNING } from './constants/tuning';
import type { Rng } from './rng';
import type { Boss, Difficulty, Quest } from './types';

/** Flat per-boss-kill chance (TUNING.QUEST_DROP_CHANCE) that a kill offers a quest, independent of boss index. */
export function rollQuestOffer(rng: Rng): boolean {
  return rng() < TUNING.QUEST_DROP_CHANCE;
}

/**
 * Bonus EXP for completing `quest` on time: a difficulty-scaled slice of the
 * EXP reward of the boss that offered it (quest.bossIndexAtOffer), NOT
 * whatever boss is current when it's resolved — so procrastinating past
 * later boss kills can't inflate the payout, and the reward automatically
 * inherits BOSS_EXP_GROWTH_RATE's existing curve instead of needing a new one.
 */
export function questExpReward(quest: Quest): number {
  return bossExpReward(quest.bossIndexAtOffer) * TUNING.QUEST_EXP_DIFFICULTY_PCT[quest.difficulty];
}

/**
 * Damage dealt for missing `quest`'s due date: the same attack-stat *
 * MISS_DAMAGE_FACTOR formula bossMissDamage (combat.ts) uses, inlined here
 * rather than imported to avoid a combat.ts <-> quests.ts import cycle
 * (combat.ts imports rollQuestOffer from this module). Uses the CURRENT
 * boss (not quest.bossIndexAtOffer) — consistent with missHabit, which
 * always uses live boss state for damage. Deliberately simpler than a full
 * missHabit resolution: no crit roll, no player armor/magicResist
 * mitigation, no boss lifesteal — quests are a flatter, simpler risk
 * mechanic than habits by design (see the design spec).
 */
export function questMissDamage(quest: Quest, boss: Boss, rng: Rng): number {
  const attackType: 'physical' | 'magic' = rng() < 0.5 ? 'physical' : 'magic';
  const attack = attackType === 'physical' ? boss.physicalAttack : boss.magicAttack;
  return attack * TUNING.MISS_DAMAGE_FACTOR * TUNING.WEEKLY_MISS_MULTIPLIER * (DIFFICULTY_WEIGHT[quest.difficulty] / 1.5);
}

/** Builds a new Quest record with a generated id. */
export function createQuest(description: string, difficulty: Difficulty, dueDateKey: string, bossIndexAtOffer: number): Quest {
  return { id: crypto.randomUUID(), description, difficulty, dueDateKey, bossIndexAtOffer };
}
