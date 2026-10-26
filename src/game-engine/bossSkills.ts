// Late-game boss skills: hidden skills that wait at a boss's HP breakpoints
// (75/50/25%) and fire when a hit knocks it past one. This module rolls them
// at generation and holds every rule about them; combat.ts calls in from the
// seams that damage the boss. See docs/superpowers/specs/2026-10-25-boss-skills-design.md.

import { TUNING } from './constants/tuning';
import { pickRandom, pickWeighted } from './rng';
import type { Rng } from './rng';
import type { BossSkillId, BossSkillSlot } from './types';

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
