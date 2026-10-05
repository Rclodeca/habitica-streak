// Shared blocking-modal precedence for QuestOfferModal and QuestMissPopup.
//
// Each of those two is a full-screen, non-dismissible-by-backdrop-click
// Modal (same as DeathScreen/ItemDropPopup/MissedSkillsPopup), and more
// than one of these five can become "wants to show" in the very same
// render — e.g. a single rollover-acknowledge pass that both kills the
// player and offers a quest, or a quest-miss queued from the same rollover
// that also queued a habit-miss. Without an explicit arbiter, whichever
// Modal happens to mount later in AppShell.vue paints on top and
// permanently blocks the others' buttons (confirmed via manual testing —
// see the design spec's review notes). This centralizes the precedence
// order so it's declared once instead of re-derived pairwise per modal:
// death > item drop > habit miss > quest miss > quest offer.

import { computed } from 'vue';
import { useDeathScreen } from './useDeathScreen';
import { useItemDropQueue } from './useItemDropQueue';
import { useMissedSkillsGate } from './useMissedSkillsGate';
import { useQuestMissGate } from './useQuestMissGate';
import { useQuestOfferQueue } from './useQuestOfferQueue';

export function useModalPriority() {
  const { isDead } = useDeathScreen();
  const { current: itemDropCurrent } = useItemDropQueue();
  const { hasPending: habitMissPending } = useMissedSkillsGate();
  const { hasPending: questMissPending } = useQuestMissGate();
  const { current: questOfferCurrent } = useQuestOfferQueue();

  /** True only when a quest miss is pending and nothing higher-priority (death, habit miss) is. */
  const questMissVisible = computed(() => questMissPending.value && !isDead.value && !habitMissPending.value);

  /** True only when a quest offer is queued and nothing higher-priority (death, item drop, quest miss) is. */
  const questOfferVisible = computed(
    () => questOfferCurrent.value !== null && !isDead.value && itemDropCurrent.value === null && !questMissPending.value,
  );

  return { questMissVisible, questOfferVisible };
}
