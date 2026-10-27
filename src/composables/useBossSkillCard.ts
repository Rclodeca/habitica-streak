// Small shared (module-scope) queue of fired boss skills — same singleton
// reasoning as useQuestCompleteQueue: useCombatActions enqueues when a hit
// sets one off and BossSkillPopup (mounted once in AppShell) renders it.
// Purely presentational; the skill already did its work in the engine.
//
// A skill's card waits for the blow that set it off to land on the stage,
// so it opens on the hit rather than ahead of it.

import { computed, ref } from 'vue';
import type { FiredBossSkill } from '../game-engine';

const queue = ref<FiredBossSkill[]>([]);
const timers = new Set<ReturnType<typeof setTimeout>>();

export function useBossSkillCard() {
  const current = computed<FiredBossSkill | null>(() => queue.value[0] ?? null);

  function showBossSkill(fired: FiredBossSkill, landsInMs = 0) {
    if (landsInMs <= 0) {
      queue.value.push(fired);
      return;
    }
    const timer = setTimeout(() => {
      timers.delete(timer);
      queue.value.push(fired);
    }, landsInMs);
    timers.add(timer);
  }

  function dismiss() {
    queue.value.shift();
  }

  function clear() {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    queue.value = [];
  }

  return { current, showBossSkill, dismiss, clear };
}
