// Events: on every level-up the player picks one of up to 3 randomly drawn
// events. To add an event, append an EventDef to EVENT_DEFS and handle its
// id in useEventChoice (src/composables).

import type { HeroClass } from './character';
import { TUNING } from './constants/tuning';
import { healingAllowed, rerollDamageType } from './habits';
import { availableRelics, doublableItems, equippedDoubledItemIds, unownedDroppableItems } from './items';
import type { ItemDef } from './items';
import { effectiveStat } from './leveling';
import { assignSpecialIfEligible, assignUltIfEligible, grantOverdrive } from './levelRewards';
import { questsOpen } from './quests';
import { shuffle, type Rng } from './rng';
import type { Character, CritBoostStatusEffect, Habit, HealBoostStatusEffect, Quest } from './types';

export type EventId = 'side-quest' | 'special' | 'ult' | 'overdrive' | 'item-slots' | 'item-slots-2' | 'reroll-skill' | 'heal' | 'item-drop' | 'heal-boost' | 'crit-boost' | 'double-item';

export interface EventDef {
  id: EventId;
  title: string;
  description: string;
  minLevel: number;
  /** Once picked, never offered again this run (tracked in Character.takenEventIds). */
  oneTime: boolean;
  /** Level and one-time checks are done by `eligibleEvents`; this covers event-specific requirements. */
  isEligible: (character: Character, habits: Habit[], quests: Quest[]) => boolean;
}

export const EVENTS_PER_CHOICE = 3;

export const EVENT_DEFS: readonly EventDef[] = [
  {
    id: 'side-quest',
    title: 'Side quest',
    description: 'Earn a rare and powerful item.',
    minLevel: 1,
    oneTime: false,
    isEligible: (character, _habits, quests) => questsOpen(character) && availableRelics(character, quests).length > 0,
  },
  {
    id: 'special',
    title: 'Gain a Special',
    description: `A random daily skill permanently deals ×${TUNING.SPECIAL_MULTIPLIER} damage.`,
    minLevel: TUNING.SPECIAL_LEVEL,
    oneTime: true,
    isEligible: (_character, habits) => habits.some((h) => h.period === 'daily' && !h.isBad),
  },
  {
    id: 'ult',
    title: 'Gain an Ult',
    description: `A random weekly skill permanently deals ×${TUNING.ULT_MULTIPLIER} damage.`,
    minLevel: TUNING.ULT_LEVEL,
    oneTime: true,
    isEligible: (_character, habits) => habits.some((h) => h.period === 'weekly' && !h.isBad),
  },
  {
    id: 'overdrive',
    title: 'Gain Overdrive',
    description: `A random good skill can be used ${TUNING.OVERDRIVE_MAX_EXTRA_USES} extra times per period.`,
    minLevel: 1,
    oneTime: false,
    isEligible: (_character, habits) => habits.some((h) => !h.isBad),
  },
  {
    id: 'item-slots',
    title: 'More item slots',
    description: 'Your equipment slots increase from 4 to 6.',
    minLevel: 7,
    oneTime: true,
    isEligible: () => true,
  },
  {
    id: 'item-slots-2',
    title: 'More item slots',
    description: 'Your equipment slots increase from 6 to 8.',
    minLevel: 20,
    oneTime: true,
    isEligible: (character) => character.takenEventIds?.includes('item-slots') ?? false,
  },
  {
    id: 'reroll-skill',
    title: 'Reroll a skill',
    description: 'Choose a skill and re-roll its damage type.',
    minLevel: 3,
    oneTime: false,
    isEligible: (_character, habits) => habits.length > 0,
  },
  {
    id: 'heal',
    title: 'Restore health',
    description: `Heal ${TUNING.EVENT_HEAL_PCT}% of your max health.`,
    minLevel: 1,
    oneTime: false,
    isEligible: (character) => character.currentHealth < effectiveStat(character, 'health'),
  },
  {
    id: 'item-drop',
    title: 'Find an item',
    description: 'Receive one random item.',
    minLevel: 1,
    oneTime: false,
    isEligible: (character) => unownedDroppableItems(character).length > 0,
  },
  {
    id: 'heal-boost',
    title: 'Healing boost',
    description: `+${Math.round(TUNING.HEAL_BOOST_BONUS * 100)}% healing for ${TUNING.HEAL_BOOST_DAYS} days.`,
    minLevel: 1,
    oneTime: false,
    isEligible: () => true,
  },
  {
    id: 'double-item',
    title: 'Enchant an item',
    description: "Increase a random item's stats.",
    minLevel: TUNING.DOUBLE_ITEM_MIN_LEVEL,
    oneTime: false,
    isEligible: (character) => equippedDoubledItemIds(character).length < TUNING.DOUBLE_ITEM_MAX && doublableItems(character).length > 0,
  },
  {
    id: 'crit-boost',
    title: 'Crit boost',
    description: `+${Math.round(TUNING.CRIT_BOOST_BONUS * 100)}% crit chance for ${TUNING.CRIT_BOOST_DAYS} days.`,
    minLevel: 1,
    oneTime: false,
    isEligible: () => true,
  },
];

export function getEventDef(id: EventId): EventDef {
  const def = EVENT_DEFS.find((e) => e.id === id);
  if (!def) throw new Error(`Unknown event: ${id}`);
  return def;
}

/** Every event the character could be offered right now (level gate, one-time already taken, event-specific checks). */
export function eligibleEvents(character: Character, habits: Habit[], quests: Quest[] = []): EventDef[] {
  const taken = character.takenEventIds ?? [];
  return EVENT_DEFS.filter(
    (e) => character.level >= e.minLevel && !(e.oneTime && taken.includes(e.id)) && e.isEligible(character, habits, quests),
  );
}

/**
 * Up to `count` distinct eligible events in random order; fewer if fewer are eligible.
 * Once TUNING.SIDE_QUEST_GUARANTEE_LEVELS picks have passed with the side-quest
 * event eligible but never offered, it is forced into the choices (replacing the
 * last one) so a run's side-only items stay obtainable.
 */
export function rollEventChoices(character: Character, habits: Habit[], rng: Rng, quests: Quest[] = [], count = EVENTS_PER_CHOICE): EventDef[] {
  const eligible = eligibleEvents(character, habits, quests);
  let choices = shuffle(eligible, rng).slice(0, count);
  const sideQuest = eligible.find((e) => e.id === 'side-quest');
  if (sideQuest && !choices.includes(sideQuest) && (character.sideQuestPicksMissed ?? 0) >= TUNING.SIDE_QUEST_GUARANTEE_LEVELS) {
    choices = [...choices.slice(0, Math.max(0, count - 1)), sideQuest];
  }
  return choices;
}

/**
 * Tracks the side-quest guarantee across picks: a pick where the side-quest
 * event was eligible but not among `offered` counts as a miss; one where it
 * was offered resets the count. Picks where it wasn't eligible leave it alone.
 */
export function recordSideQuestOffer(character: Character, offered: readonly EventId[], sideQuestEligible: boolean): Character {
  if (!sideQuestEligible) return character;
  const missed = offered.includes('side-quest') ? 0 : (character.sideQuestPicksMissed ?? 0) + 1;
  return { ...character, sideQuestPicksMissed: missed };
}

/** Records a pick: marks a one-time event as taken and spends one pending pick. */
export function consumeEventPick(character: Character, id: EventId): Character {
  const taken = character.takenEventIds ?? [];
  return {
    ...character,
    takenEventIds: getEventDef(id).oneTime && !taken.includes(id) ? [...taken, id] : taken,
    pendingEventPicks: Math.max(0, (character.pendingEventPicks ?? 0) - 1),
  };
}

export function applySpecialEvent(habits: Habit[], level: number, rng: Rng): Habit[] {
  return assignSpecialIfEligible(habits, level, rng);
}

export function applyUltEvent(habits: Habit[], level: number, rng: Rng): Habit[] {
  return assignUltIfEligible(habits, level, rng);
}

export function applyOverdriveEvent(habits: Habit[], rng: Rng): { habits: Habit[]; granted: Habit | null } {
  return grantOverdrive(habits, rng);
}

/** Heals EVENT_HEAL_PCT% of max health (capped at max). Returns the new character and the amount actually healed. */
export function applyHealEvent(character: Character): { character: Character; healed: number } {
  const maxHealth = effectiveStat(character, 'health');
  const currentHealth = Math.min(character.currentHealth + maxHealth * (TUNING.EVENT_HEAL_PCT / 100), maxHealth);
  return { character: { ...character, currentHealth }, healed: currentHealth - character.currentHealth };
}

/**
 * Doubles one random equipped item that isn't already doubled. Returns the new
 * character and the chosen item (null if none could be picked).
 */
export function applyDoubleItemEvent(character: Character, rng: Rng): { character: Character; item: ItemDef | null } {
  const candidates = doublableItems(character);
  if (candidates.length === 0) return { character, item: null };
  const item = candidates[Math.floor(rng() * candidates.length)];
  return { character: { ...character, doubledItemIds: [...equippedDoubledItemIds(character), item.id] }, item };
}

/** Grants (or refreshes) the temporary Crit boost, replacing any existing one. */
export function applyCritBoostEvent(character: Character, dayKey: string): Character {
  const boost: CritBoostStatusEffect = {
    type: 'critBoost',
    appliedDayKey: dayKey,
    durationDays: TUNING.CRIT_BOOST_DAYS,
    bonus: TUNING.CRIT_BOOST_BONUS,
  };
  return { ...character, statusEffects: [...(character.statusEffects ?? []).filter((e) => e.type !== 'critBoost'), boost] };
}

/** Grants (or refreshes) the temporary Healing boost, replacing any existing one. */
export function applyHealBoostEvent(character: Character, dayKey: string): Character {
  const boost: HealBoostStatusEffect = {
    type: 'healBoost',
    appliedDayKey: dayKey,
    durationDays: TUNING.HEAL_BOOST_DAYS,
    bonus: TUNING.HEAL_BOOST_BONUS,
  };
  return { ...character, statusEffects: [...(character.statusEffects ?? []).filter((e) => e.type !== 'healBoost'), boost] };
}

/** Re-rolls the chosen skill's damage type to one different from its current type at `heroClass`'s odds, kept off healing past the cap. */
export function applyRerollSkillEvent(habits: Habit[], habitId: string, rng: Rng, heroClass?: HeroClass): Habit[] {
  const excludeHealing = !healingAllowed(habits.filter((h) => h.id !== habitId), habits.length);
  return habits.map((h) => (h.id === habitId ? rerollDamageType(h, rng, true, excludeHealing, heroClass) : h));
}

/**
 * One-time migration for a character saved before events existed
 * (`takenEventIds` undefined): marks as already taken everything the old
 * automatic rules had granted — Special/Ult via the habit flags, and the 6
 * slots the old level-10 rule gave — so none are offered again and the
 * player's slots don't shrink. A character that already has the field passes
 * through untouched.
 */
export function migrateEventState(character: Character, habits: Habit[]): Character {
  if (character.takenEventIds !== undefined) return character;
  const taken: string[] = [];
  if (habits.some((h) => h.isSpecial)) taken.push('special');
  if (habits.some((h) => h.isUlt)) taken.push('ult');
  if (character.level >= 10) taken.push('item-slots');
  return { ...character, takenEventIds: taken, pendingEventPicks: character.pendingEventPicks ?? 0 };
}
