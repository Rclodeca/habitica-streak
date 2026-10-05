// Small shared (module-scoped) queue for boss-kill quest offers — same
// singleton reasoning as useItemDropQueue: the code that detects an offer
// (useCombatActions, via resolveBossDefeatIfDead's questOffered) and the
// component that renders the popup (QuestOfferModal, mounted once in
// AppShell) must see the same state.
//
// Unlike useItemDropQueue, there's nothing to auto-resolve here — every
// offer waits for an explicit accept/reject from the player, so this is
// just a plain FIFO of the boss index each pending offer came from.

import { computed, ref } from 'vue';

const queue = ref<number[]>([]);

export function useQuestOfferQueue() {
  const current = computed<number | null>(() => queue.value[0] ?? null);

  /** Queues a new offer, recording which boss's kill it came from (see Quest.bossIndexAtOffer). */
  function enqueueOffer(bossIndexAtOffer: number) {
    queue.value.push(bossIndexAtOffer);
  }

  /** Advances to the next queued offer, whether the current one was accepted or rejected. */
  function dismiss() {
    queue.value.shift();
  }

  return { current, enqueueOffer, dismiss };
}
