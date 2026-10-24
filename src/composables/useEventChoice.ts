// Drives the level-up event popup (EventChoiceModal). Each level gained adds
// one pending pick (see grantEventPicks in useCombatActions); this rolls up
// to 3 eligible events for the front pick and applies whichever the player
// chooses. Module-scoped options for the same singleton reasoning as
// useItemDropQueue — the modal is mounted once in AppShell.

import { computed, ref } from 'vue';
import {
  applyCritBoostEvent,
  applyDoubleItemEvent,
  applyHealBoostEvent,
  applyHealEvent,
  applyOverdriveEvent,
  applyRerollSkillEvent,
  applySpecialEvent,
  applyUltEvent,
  availableRelics,
  consumeEventPick,
  createRng,
  dailyPeriodKey,
  eligibleEvents,
  maxEquipSlots,
  recordSideQuestOffer,
  rollEventChoices,
} from '../game-engine';
import type { Difficulty, EventDef, EventId, ItemDef } from '../game-engine';
import { TUNING } from '../game-engine/constants/tuning';
import { useActivityLogStore } from '../store/activityLogStore';
import { useBossStore } from '../store/bossStore';
import { useCharacterStore } from '../store/characterStore';
import { useDebugClockStore } from '../store/debugClockStore';
import { useHabitStore } from '../store/habitStore';
import { useQuestStore } from '../store/questStore';
import { useItemDropQueue } from './useItemDropQueue';

const rng = createRng();
const options = ref<EventDef[] | null>(null);
// The item just enchanted, shown on its own screen until the player continues.
const revealed = ref<ItemDef | null>(null);

export function useEventChoice() {
  const characterStore = useCharacterStore();
  const habitStore = useHabitStore();
  const bossStore = useBossStore();
  const questStore = useQuestStore();
  const activityLogStore = useActivityLogStore();
  const debugClockStore = useDebugClockStore();
  const { enqueueDrops } = useItemDropQueue();

  const pending = computed(() => characterStore.character.pendingEventPicks ?? 0);
  const choices = computed(() => options.value ?? []);

  /** Rolls the options for the front pick if none are rolled yet; clears them once no picks remain. */
  function ensureChoices() {
    if (pending.value === 0) options.value = null;
    else if (options.value === null) options.value = rollEventChoices(characterStore.character, habitStore.habits, rng, questStore.quests);
  }

  function finish(id: EventId) {
    const character = characterStore.character;
    const offered = (options.value ?? []).map((e) => e.id);
    // Being offered already proves it was eligible; checking again only matters when it wasn't offered, because
    // the pick itself (e.g. promising the last available relic) can make it ineligible by now.
    const sideQuestEligible =
      offered.includes('side-quest') || eligibleEvents(character, habitStore.habits, questStore.quests).some((e) => e.id === 'side-quest');
    characterStore.setCharacter(recordSideQuestOffer(consumeEventPick(character, id), offered, sideQuestEligible));
    options.value = null;
  }

  /** Picks an event that needs no further input (everything except side-quest and reroll-skill). */
  function choose(id: Exclude<EventId, 'side-quest' | 'reroll-skill'>) {
    const { level } = characterStore.character;
    if (id === 'special') {
      const before = habitStore.habits;
      const habits = applySpecialEvent(before, level, rng);
      const granted = habits.find((h, i) => h.isSpecial && !before[i]?.isSpecial);
      habitStore.setHabits(habits);
      if (granted) activityLogStore.addEntry({ kind: 'special-assigned', habitName: granted.name });
    } else if (id === 'ult') {
      const before = habitStore.habits;
      const habits = applyUltEvent(before, level, rng);
      const granted = habits.find((h, i) => h.isUlt && !before[i]?.isUlt);
      habitStore.setHabits(habits);
      if (granted) activityLogStore.addEntry({ kind: 'ult-assigned', habitName: granted.name });
    } else if (id === 'overdrive') {
      const { habits, granted } = applyOverdriveEvent(habitStore.habits, rng);
      habitStore.setHabits(habits);
      if (granted) activityLogStore.addEntry({ kind: 'overdrive-granted', habitName: granted.name });
    } else if (id === 'heal') {
      const { character, healed } = applyHealEvent(characterStore.character);
      characterStore.setCharacter(character);
      activityLogStore.addEntry({ kind: 'event-heal', amount: healed });
    } else if (id === 'heal-boost') {
      characterStore.setCharacter(applyHealBoostEvent(characterStore.character, dailyPeriodKey(debugClockStore.now())));
      activityLogStore.addEntry({ kind: 'heal-boost-gained', days: TUNING.HEAL_BOOST_DAYS });
    } else if (id === 'double-item') {
      const { character, item } = applyDoubleItemEvent(characterStore.character, rng);
      characterStore.setCharacter(character);
      if (item) {
        activityLogStore.addEntry({ kind: 'item-doubled', itemName: item.name });
        revealed.value = item;
      }
    } else if (id === 'crit-boost') {
      characterStore.setCharacter(applyCritBoostEvent(characterStore.character, dailyPeriodKey(debugClockStore.now())));
      activityLogStore.addEntry({ kind: 'crit-boost-gained', days: TUNING.CRIT_BOOST_DAYS });
    } else if (id === 'item-drop') {
      enqueueDrops(characterStore.grantItemDrops(bossStore.boss.index, rng, 1));
    } else {
      // item-slots / item-slots-2: the cap once this pick is recorded.
      const takenEventIds = [...(characterStore.character.takenEventIds ?? []), id];
      activityLogStore.addEntry({ kind: 'item-slots-gained', slots: maxEquipSlots({ takenEventIds }) });
    }
    finish(id);
  }

  function chooseReroll(habitId: string) {
    const habits = applyRerollSkillEvent(habitStore.habits, habitId, rng);
    habitStore.setHabits(habits);
    const rerolled = habits.find((h) => h.id === habitId);
    if (rerolled) activityLogStore.addEntry({ kind: 'skill-rerolled', habitName: rerolled.name, damageType: rerolled.damageType });
    finish('reroll-skill');
  }

  /** Creates the side quest, promising it one of the currently available relics at random. */
  function chooseSideQuest(description: string, difficulty: Difficulty, dueDateKey: string) {
    const rewards = availableRelics(characterStore.character, questStore.quests);
    const reward = rewards[Math.floor(rng() * rewards.length)];
    questStore.addQuest(description, difficulty, dueDateKey, 'side', reward?.id);
    finish('side-quest');
  }

  function dismissReveal() {
    revealed.value = null;
  }

  return { pending, choices, revealed, ensureChoices, choose, chooseReroll, chooseSideQuest, dismissReveal };
}
