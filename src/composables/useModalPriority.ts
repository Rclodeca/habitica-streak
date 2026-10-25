// Shared blocking-modal precedence for EventChoiceModal and QuestMissPopup.
//
// Each of those is a full-screen, non-dismissible-by-backdrop-click Modal
// (same as DeathScreen/ItemDropPopup/MissedSkillsPopup), and more than one
// can become "wants to show" in the very same render — e.g. a single
// rollover-acknowledge pass that both kills the player and levels them up,
// or a quest-miss queued from the same rollover that also queued a
// habit-miss. Without an explicit arbiter, whichever Modal happens to mount
// later in AppShell.vue paints on top and permanently blocks the others'
// buttons (confirmed via manual testing — see the quests design spec's
// review notes). This centralizes the precedence order so it's declared
// once instead of re-derived pairwise per modal:
// death > item drop > habit miss > quest miss > quest complete > quest unlock > event choice.
// Quest unlock and event choice also wait out a kill or level-up still
// playing on the panels (useCelebration), as does the item drop popup itself.

import { computed } from 'vue';
import { questUnlockPending } from '../game-engine';
import { useCelebration } from './useCelebration';
import { useDeathScreen } from './useDeathScreen';
import { useItemDropQueue } from './useItemDropQueue';
import { useMissedSkillsGate } from './useMissedSkillsGate';
import { useQuestCompleteQueue } from './useQuestCompleteQueue';
import { useQuestMissGate } from './useQuestMissGate';
import { useCharacterStore } from '../store/characterStore';
import { useEventChoice } from './useEventChoice';

export function useModalPriority() {
  const { isDead } = useDeathScreen();
  const { current: itemDropCurrent } = useItemDropQueue();
  const { hasPending: habitMissPending } = useMissedSkillsGate();
  const { hasPending: questMissPending } = useQuestMissGate();
  const characterStore = useCharacterStore();
  const { revealed } = useEventChoice();
  const { current: questCompleteCurrent } = useQuestCompleteQueue();
  const { celebrating } = useCelebration();

  /** True only when a quest miss is pending and nothing higher-priority (death, habit miss) is. */
  const questMissVisible = computed(() => questMissPending.value && !isDead.value && !habitMissPending.value);

  /** True when the "Quests unlocked" popup is due and nothing higher-priority is up — it comes before the level-up pick, which may offer a side quest. */
  const questUnlockVisible = computed(
    () =>
      questUnlockPending(characterStore.character) &&
      !celebrating.value &&
      !isDead.value &&
      itemDropCurrent.value === null &&
      !habitMissPending.value &&
      !questMissPending.value &&
      questCompleteCurrent.value === null,
  );

  /** True only when an event pick (or an enchant reveal) is pending and nothing higher-priority (death, item drop, habit miss, quest miss, quest unlock, a celebration) is. */
  const eventChoiceVisible = computed(
    () =>
      ((characterStore.character.pendingEventPicks ?? 0) > 0 || revealed.value !== null) &&
      !celebrating.value &&
      !isDead.value &&
      itemDropCurrent.value === null &&
      !habitMissPending.value &&
      !questMissPending.value &&
      questCompleteCurrent.value === null &&
      !questUnlockPending(characterStore.character),
  );

  /** True while a quest-completion celebration is queued — it shows before any level-up pick its EXP triggered. */
  const questCompleteVisible = computed(
    () => questCompleteCurrent.value !== null && !isDead.value && !habitMissPending.value && !questMissPending.value,
  );

  return { questMissVisible, questUnlockVisible, eventChoiceVisible, questCompleteVisible };
}
