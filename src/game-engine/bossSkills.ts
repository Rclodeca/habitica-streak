// Late-game boss skills: hidden skills that wait at a boss's HP breakpoints
// (75/50/25%) and fire when a hit knocks it past one. This module rolls them
// at generation and holds every rule about them; combat.ts calls in from the
// seams that damage the boss. See docs/superpowers/specs/2026-10-25-boss-skills-design.md.

import { TUNING } from './constants/tuning';
import { hasItemEffect } from './items';
import type { ItemEffectId } from './items';
import { pickRandom, pickWeighted } from './rng';
import type { Rng } from './rng';
import { addDaysToDayKey, daysBetweenDayKeys } from './time';
import type { BlindStatusEffect, Boss, BossSkillId, BossSkillSlot, BossStat, Breakpoint, Character, SeverStatusEffect, StatusEffect, SunderStatusEffect } from './types';

const S = TUNING.BOSS_SKILLS;
const STAT_LABEL: Record<BossStat, string> = { physicalAttack: 'Physical attack', magicAttack: 'Magic attack', armor: 'Armor', magicResist: 'Magic resist' };
const SKILL_IDS = Object.keys(S.UNLOCK_INDEX) as BossSkillId[];
const FIRST_SKILL_INDEX = Math.min(...Object.values(S.UNLOCK_INDEX));

/**
 * Rolls a new boss's hidden skills. Before the first unlock it returns none
 * without touching `rng`, so earlier bosses keep their seeded rolls. The
 * count comes from the last band starting at or below `index`; slots fill
 * from the highest breakpoint down, each picking uniformly among skills that
 * are unlocked, not yet on this boss, not a second HP hit, and — for Undying —
 * only the 25% slot (from higher up it would almost never matter). Empower and
 * Ascend only take a boss's last (lowest) slot, so a boss can't carry both.
 */
export function rollBossSkills(index: number, rng: Rng): BossSkillSlot[] {
  if (index < FIRST_SKILL_INDEX) return [];
  const band = [...S.COUNT_BANDS].reverse().find(([from]) => from <= index);
  if (!band) return [];
  const count = Number(pickWeighted<string>(Object.fromEntries(band[1].map((weight, n) => [n, weight])), rng));

  const slots: BossSkillSlot[] = [];
  const lastAt = S.SLOTS[count]?.at(-1);
  for (const at of S.SLOTS[count] ?? []) {
    const hasHpHit = slots.some((slot) => S.HP_HIT_SKILLS.includes(slot.skill));
    const eligible = SKILL_IDS.filter(
      (skill) =>
        S.UNLOCK_INDEX[skill] <= index &&
        !slots.some((slot) => slot.skill === skill) &&
        !(hasHpHit && S.HP_HIT_SKILLS.includes(skill)) &&
        (skill !== 'undying' || at === 0.25) &&
        (!S.LAST_SLOT_SKILLS.includes(skill) || at === lastAt),
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

/** The character's active Sever as of `currentDayKey`, or undefined. */
export function activeSever(character: Character, currentDayKey: string): SeverStatusEffect | undefined {
  const sever = character.statusEffects?.find((e): e is SeverStatusEffect => e.type === 'sever');
  return sever && daysBetweenDayKeys(sever.appliedDayKey, currentDayKey) < sever.durationDays ? sever : undefined;
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

/** Days of Bloodlust left, counting today, or undefined once it's worn off (or never fired). */
export function bloodlustDaysLeft(boss: Boss, currentDayKey: string): number | undefined {
  if (!bloodlustActive(boss, currentDayKey)) return undefined;
  return S.DURATION_DAYS - daysBetweenDayKeys(boss.bloodlustDayKey!, currentDayKey);
}

/** Whether this boss's Reflect is still running on `currentDayKey`. */
export function reflectActive(boss: Boss, currentDayKey: string): boolean {
  return boss.reflectDayKey !== undefined && daysBetweenDayKeys(boss.reflectDayKey, currentDayKey) < S.DURATION_DAYS;
}

/** Days of Reflect left, counting today, or undefined once it's worn off (or never fired). */
export function reflectDaysLeft(boss: Boss, currentDayKey: string): number | undefined {
  if (!reflectActive(boss, currentDayKey)) return undefined;
  return S.DURATION_DAYS - daysBetweenDayKeys(boss.reflectDayKey!, currentDayKey);
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

/** What share (%) of the hero's current HP a Doom takes — Omen Hourglass cuts it. */
export function doomPct(character: Character): number {
  return S.DOOM_PCT * (hasItemEffect(character, 'omen-hourglass') ? TUNING.ITEM_EFFECTS.OMEN_HOURGLASS_FACTOR : 1);
}

/**
 * One plain line on what a fired skill does, for the log, the hero's effect
 * chips and the boss's stat tiles. `doomShare` is the % of HP a Doom takes
 * (see doomPct); `stat` is the one an Empower doubled. Skills whose hit or heal
 * is logged with a number (Wounds, Mend, Rend, Ravage) have no line.
 */
export function bossSkillEffectText(skill: BossSkillId, doomShare: number = S.DOOM_PCT, stat?: BossStat): string | undefined {
  switch (skill) {
    case 'empower':
      return stat && `${STAT_LABEL[stat]} doubled`;
    case 'ascend':
      return 'All stats doubled';
    case 'bloodlust':
      return `Boss heals ${S.BLOODLUST_HEAL_PCT}% per hit`;
    case 'reflect':
      return `Reflects ${S.REFLECT_PCT}% of your damage`;
    case 'blind':
      return 'No crits';
    case 'sever':
      return 'No lifesteal';
    case 'sunder':
      return 'Armor & resist halved';
    case 'doom':
      return doomShare === 50 ? 'Half your HP' : doomShare === 25 ? 'A quarter of your HP' : `${doomShare}% of your HP`;
    case 'undying':
      return `Can't fall below ${S.UNDYING_FLOOR_PCT}%`;
    default:
      return undefined;
  }
}

/** A skill that just fired: `amount` is the HP it took from the hero (Rend, Ravage) or healed the boss (Mend); `pct` is the share of HP a Doom will take; `stat` is the one an Empower doubled. */
export interface FiredBossSkill {
  skill: BossSkillId;
  outcome: 'landed' | 'failed' | 'resisted';
  amount?: number;
  pct?: number;
  stat?: BossStat;
}

/** `effect` in place of any earlier effect of its type. */
function withStatus(character: Character, effect: StatusEffect): Character {
  return { ...character, statusEffects: [...(character.statusEffects ?? []).filter((e) => e.type !== effect.type), effect] };
}

/** The boss held at Undying's floor (10% of max), with no overkill to carry. */
function heldByUndying(boss: Boss): Boss {
  const floor = boss.maxHealth * (S.UNDYING_FLOOR_PCT / 100);
  if (boss.health >= floor && boss.overkill === undefined) return boss;
  const held = { ...boss, health: Math.max(boss.health, floor) };
  delete held.overkill;
  return held;
}

/** The boss with each of `stats` doubled — for good, there's no timer to run out. */
function doubleStats(boss: Boss, stats: readonly BossStat[]): Boss {
  const doubled = { ...boss };
  for (const stat of stats) doubled[stat] = boss[stat] * 2;
  return doubled;
}

// Skills an equipped item stops outright: Aegis of the Unbroken (Wounds,
// Sunder), Bloodbound Carapace (Bloodlust, Mend: bosses can't heal) and Null
// Mirror (Reflect, Blind).
const RESISTED_BY: Partial<Record<BossSkillId, ItemEffectId>> = {
  wounds: 'unbroken',
  sunder: 'unbroken',
  bloodlust: 'bloodbound',
  mend: 'bloodbound',
  reflect: 'null-mirror',
  blind: 'null-mirror',
};

/** Applies a fired skill's effect to the hero or the boss, unless an equipped item resists it. */
function applySkill(skill: BossSkillId, boss: Boss, character: Character, currentDayKey: string, rng: Rng): { boss: Boss; character: Character; fired: FiredBossSkill } {
  const resistedBy = RESISTED_BY[skill];
  if (resistedBy && hasItemEffect(character, resistedBy)) return { boss, character, fired: { skill, outcome: 'resisted' } };
  const halved = hasItemEffect(character, 'omen-hourglass') ? TUNING.ITEM_EFFECTS.OMEN_HOURGLASS_FACTOR : 1;
  const landed = (changes: { boss?: Boss; character?: Character; amount?: number; pct?: number; stat?: BossStat } = {}) => ({
    boss: changes.boss ?? boss,
    character: changes.character ?? character,
    fired: {
      skill,
      outcome: 'landed' as const,
      ...(changes.amount !== undefined && { amount: changes.amount }),
      ...(changes.pct !== undefined && { pct: changes.pct }),
      ...(changes.stat !== undefined && { stat: changes.stat }),
    },
  });
  switch (skill) {
    case 'wounds':
      return landed({
        character: withStatus(character, { type: 'wounds', appliedDayKey: currentDayKey, durationDays: S.DURATION_DAYS, effectRate: S.WOUNDS_EFFECT_RATE }),
      });
    case 'blind':
    case 'sever':
    case 'sunder':
      return landed({ character: withStatus(character, { type: skill, appliedDayKey: currentDayKey, durationDays: S.DURATION_DAYS }) });
    case 'bloodlust':
      return landed({ boss: { ...boss, bloodlustDayKey: currentDayKey } });
    case 'reflect':
      return landed({ boss: { ...boss, reflectDayKey: currentDayKey } });
    case 'mend': {
      const healed = Math.min(boss.maxHealth - boss.health, boss.maxHealth * (S.MEND_HEAL_PCT / 100));
      return landed({ boss: { ...boss, health: boss.health + healed }, amount: healed });
    }
    case 'rend':
    case 'ravage': {
      const taken = hpHitDamage(character.currentHealth, (skill === 'rend' ? S.REND_PCT : S.RAVAGE_PCT) * halved);
      return landed({ character: { ...character, currentHealth: character.currentHealth - taken }, amount: taken });
    }
    case 'doom':
      return landed({ boss: { ...boss, doomDueDayKey: addDaysToDayKey(currentDayKey, S.DOOM_DELAY_DAYS) }, pct: doomPct(character) });
    case 'undying':
      return landed({ boss: heldByUndying({ ...boss, undyingDayKey: currentDayKey }) });
    case 'empower': {
      const stat = pickRandom(S.DOUBLED_STATS, rng);
      return landed({ boss: doubleStats(boss, [stat]), stat });
    }
    case 'ascend':
      return landed({ boss: doubleStats(boss, S.DOUBLED_STATS) });
  }
}

/**
 * Runs after a hit on the boss: `boss` is the boss after the hit, and
 * `healthBefore` its health before. An Undying boss (fired earlier today)
 * is held at its floor first. Every unspent breakpoint the hit crossed is
 * spent, but only the highest fires — a big hit is rewarded — and nothing
 * fires on a kill. Hushing Bell can make the fired skill fail, and Empower
 * rolls which stat it doubles; those are the only rng() calls this makes, so
 * combat's seeded rolls are untouched.
 */
export function resolveBreakpoints(
  healthBefore: number,
  boss: Boss,
  character: Character,
  currentDayKey: string,
  rng: Rng,
): { boss: Boss; character: Character; fired?: FiredBossSkill } {
  const held = undyingActive(boss, currentDayKey) ? heldByUndying(boss) : boss;
  const line = (slot: BossSkillSlot) => slot.at * held.maxHealth;
  const crossed = (held.skills ?? []).filter((slot) => !slot.spent && healthBefore > line(slot) && held.health <= line(slot));
  if (crossed.length === 0) return { boss: held, character };

  const first = crossed.reduce((top, slot) => (slot.at > top.at ? slot : top));
  const killed = Math.round(held.health) <= 0;
  const skills = (held.skills ?? []).map((slot): BossSkillSlot => {
    if (!crossed.includes(slot)) return slot;
    return slot === first && !killed ? { ...slot, spent: true, fired: true } : { ...slot, spent: true };
  });
  const spent = { ...held, skills };
  if (killed) return { boss: spent, character };

  if (hasItemEffect(character, 'hushing-bell') && rng() < TUNING.ITEM_EFFECTS.HUSHING_BELL_FAIL_CHANCE) {
    return { boss: spent, character, fired: { skill: first.skill, outcome: 'failed' } };
  }
  return applySkill(first.skill, spent, character, currentDayKey, rng);
}

/** Spends, without firing, every breakpoint at or above the boss's health — for a boss that starts below some (Echoing Blade's carry). */
export function spendPassedBreakpoints(boss: Boss): Boss {
  if (!boss.skills) return boss;
  return { ...boss, skills: boss.skills.map((slot) => (!slot.spent && slot.at * boss.maxHealth >= boss.health ? { ...slot, spent: true } : slot)) };
}

/**
 * Lands this boss's Doom once its day has come: half the hero's current HP
 * (a quarter with Omen Hourglass), never past 1 HP, then the countdown is
 * gone. Run from the daily rollover after the day's misses and avoided
 * habits resolve, so a boss killed by them takes its Doom with it (a new
 * boss has none). A no-op before its day, without one, or for a fallen hero.
 */
export function resolveDoom(character: Character, boss: Boss, currentDayKey: string): { character: Character; boss: Boss; amount?: number } {
  if (!boss.doomDueDayKey || daysBetweenDayKeys(boss.doomDueDayKey, currentDayKey) < 0) return { character, boss };
  if (Math.round(character.currentHealth) <= 0) return { character, boss };
  const amount = hpHitDamage(character.currentHealth, doomPct(character));
  const cleared = { ...boss };
  delete cleared.doomDueDayKey;
  return { character: { ...character, currentHealth: character.currentHealth - amount }, boss: cleared, amount };
}
