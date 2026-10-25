// Small shared (module-scope) queue of quest misses detected during the
// last daily rollover — same singleton reasoning as useMissedSkillsGate:
// the code that detects them (useDailyRollover) and the component that
// renders the blocking popup (QuestMissPopup, mounted once in AppShell)
// must see the same state.
//
// Detection and resolution are split the same way useMissedSkillsGate
// splits them: queuing only records which quests are overdue. The actual
// damage/reward is applied by acknowledge(), once the player has seen the
// list and clicked OK.

import { computed, ref } from 'vue';
import { ITEM_CATALOG, questRewardTier } from '../game-engine';
import type { Difficulty, Quest, QuestKind } from '../game-engine';
import { useCombatActions } from './useCombatActions';

interface PendingQuestMiss {
  questId: string;
  description: string;
  dueDateKey: string;
  difficulty: Difficulty;
  kind: QuestKind;
  /** What the player gets if they flag this as "I actually did this": a vague EXP tier, or the item's name for a side quest. */
  rewardText: string;
}

const pending = ref<PendingQuestMiss[]>([]);
const overridden = ref<Set<string>>(new Set());

export function useQuestMissGate() {
  const { completeQuest, failQuest } = useCombatActions();

  const misses = computed(() => pending.value);
  const hasPending = computed(() => pending.value.length > 0);

  /** Whether `questId` is currently flagged as "I actually did this" (resolves as a completion instead of a miss on acknowledge). */
  function isOverridden(questId: string): boolean {
    return overridden.value.has(questId);
  }

  /** Toggles the "I actually did this" flag for `questId`. */
  function toggleOverride(questId: string): void {
    const next = new Set(overridden.value);
    if (next.has(questId)) next.delete(questId);
    else next.add(questId);
    overridden.value = next;
  }

  /** Records an overdue quest for the popup. */
  function queueMiss(quest: Quest): void {
    // The rollover can run again while the popup is still up; a quest stays overdue until acknowledged.
    if (pending.value.some((item) => item.questId === quest.id)) return;
    pending.value.push({
      questId: quest.id,
      description: quest.description,
      dueDateKey: quest.dueDateKey,
      difficulty: quest.difficulty,
      kind: quest.kind,
      rewardText:
        quest.kind === 'side'
          ? (ITEM_CATALOG.find((item) => item.id === quest.rewardItemId)?.name ?? '')
          : `${questRewardTier(quest.difficulty)} EXP`,
    });
  }

  /**
   * Resolves every queued quest (failQuest if not overridden, completeQuest
   * if overridden) and clears the queue.
   */
  function acknowledge(): void {
    for (const item of pending.value) {
      if (overridden.value.has(item.questId)) {
        completeQuest(item.questId);
      } else {
        failQuest(item.questId);
      }
    }
    pending.value = [];
    overridden.value = new Set();
  }

  return { misses, hasPending, queueMiss, isOverridden, toggleOverride, acknowledge };
}
