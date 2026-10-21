// Small shared (module-scope) queue of quest-completion celebrations — same
// singleton reasoning as useItemDropQueue: QuestSection enqueues on a live
// check-off and QuestCompletePopup (mounted once in AppShell) renders it.
// Purely presentational; the EXP is already granted by completeQuest.

import { computed, ref } from 'vue';
import type { Difficulty } from '../game-engine';

export interface QuestCompletion {
  description: string;
  difficulty: Difficulty;
  amount: number;
}

const queue = ref<QuestCompletion[]>([]);

export function useQuestCompleteQueue() {
  const current = computed<QuestCompletion | null>(() => queue.value[0] ?? null);

  function enqueue(completion: QuestCompletion) {
    queue.value.push(completion);
  }

  function dismiss() {
    queue.value.shift();
  }

  return { current, enqueue, dismiss };
}
