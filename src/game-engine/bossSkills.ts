// Late-game boss skills: hidden skills that wait at a boss's HP breakpoints
// (75/50/25%) and fire when a hit knocks it past one. This module rolls them
// at generation and holds every rule about them; combat.ts calls in from the
// seams that damage the boss. See docs/superpowers/specs/2026-10-25-boss-skills-design.md.

import { TUNING } from './constants/tuning';
import { pickRandom, pickWeighted } from './rng';
import type { Rng } from './rng';
import { daysBetweenDayKeys } from './time';
import type { BlindStatusEffect, Boss, BossSkillId, BossSkillSlot, Breakpoint, Character, SunderStatusEffect } from './types';

const S = TUNING.BOSS_SKILLS;
const SKILL_IDS = Object.keys(S.UNLOCK_INDEX) as BossSkillId[];
const FIRST_SKILL_INDEX = Math.min(...Object.values(S.UNLOCK_INDEX));

/**
 * Rolls a new boss's hidden skills. Before the first unlock it returns none
 * without touching `rng`, so earlier bosses keep their seeded rolls. The
 * count comes from the last band starting at or below `index`; slots fill
 * from the highest breakpoint down, each picking uniformly among skills that
 * are unlocked, not yet on this boss, not a second HP hit, and — for Undying —
 * only the 25% slot (from higher up it would almost never matter).
 */
export function rollBossSkills(index: number, rng: Rng): BossSkillSlot[] {
  if (index < FIRST_SKILL_INDEX) return [];
  const band = [...S.COUNT_BANDS].reverse().find(([from]) => from <= index);
  if (!band) return [];
  const count = Number(pickWeighted<string>(Object.fromEntries(band[1].map((weight, n) => [n, weight])), rng));

  const slots: BossSkillSlot[] = [];
  for (const at of S.SLOTS[count] ?? []) {
    const hasHpHit = slots.some((slot) => S.HP_HIT_SKILLS.includes(slot.skill));
    const eligible = SKILL_IDS.filter(
      (skill) =>
        S.UNLOCK_INDEX[skill] <= index &&
        !slots.some((slot) => slot.skill === skill) &&
        !(hasHpHit && S.HP_HIT_SKILLS.includes(skill)) &&
        (skill !== 'undying' || at === 0.25),
    );
    if (eligible.length > 0) slots.push({ at, skill: pickRandom(eligible, rng) });
  }
  return slots;
}

/**
 * The HP an HP-hit skill (Rend, Ravage, Doom) takes: `pct`% of current
 * health, but never past 1 HP — the death check rounds, so even a fraction
 * of a point left could otherwise read as dead — and never a heal.
 */
export function hpHitDamage(currentHealth: number, pct: number): number {
  return Math.min((currentHealth * pct) / 100, Math.max(0, currentHealth - 1));
}

/** The character's active Blind as of `currentDayKey`, or undefined. Lazy, like activeWoundsEffect. */
export function activeBlind(character: Character, currentDayKey: string): BlindStatusEffect | undefined {
  const blind = character.statusEffects?.find((e): e is BlindStatusEffect => e.type === 'blind');
  return blind && daysBetweenDayKeys(blind.appliedDayKey, currentDayKey) < blind.durationDays ? blind : undefined;
}

/** The character's active Sunder as of `currentDayKey`, or undefined. */
export function activeSunder(character: Character, currentDayKey: string): SunderStatusEffect | undefined {
  const sunder = character.statusEffects?.find((e): e is SunderStatusEffect => e.type === 'sunder');
  return sunder && daysBetweenDayKeys(sunder.appliedDayKey, currentDayKey) < sunder.durationDays ? sunder : undefined;
}

/** Whether this boss's Bloodlust is still running on `currentDayKey`. */
export function bloodlustActive(boss: Boss, currentDayKey: string): boolean {
  return boss.bloodlustDayKey !== undefined && daysBetweenDayKeys(boss.bloodlustDayKey, currentDayKey) < S.DURATION_DAYS;
}

/** Whether this boss is Undying today — it only holds the day it fired. */
export function undyingActive(boss: Boss, currentDayKey: string): boolean {
  return boss.undyingDayKey === currentDayKey;
}

/** Days until this boss's Doom lands (0 once due), or undefined with no Doom counting down. */
export function doomDaysLeft(boss: Boss, currentDayKey: string): number | undefined {
  if (!boss.doomDueDayKey) return undefined;
  return Math.max(0, daysBetweenDayKeys(currentDayKey, boss.doomDueDayKey));
}

/** What the boss bars may show: each breakpoint and whether it's armed, fired or spent — never which skill. */
export function bossSkillMarks(boss: Boss): { at: Breakpoint; state: 'armed' | 'fired' | 'spent' }[] {
  return (boss.skills ?? []).map((slot) => ({ at: slot.at, state: slot.fired ? 'fired' : slot.spent ? 'spent' : 'armed' }));
}
