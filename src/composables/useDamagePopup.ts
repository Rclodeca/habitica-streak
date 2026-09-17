// Purely presentational: watches a health value and, on every decrease,
// emits a brief "hit" flag plus a floating "-N" popup. Shared by
// BossPanel/CharacterPanel so neither duplicates the watch/timeout wiring.
// Deliberately health-based rather than wired through combat results — it
// needs no game-engine or store changes, at the cost of coalescing a
// same-tick "damage + boss defeat" pair of mutations into one watcher
// callback (the killing blow's popup can be skipped/wrong; acceptable for
// MVP polish).

import { ref, watch } from 'vue';

export interface DamagePopup {
  id: number;
  amount: number;
}

const HIT_FLASH_MS = 300;
const POPUP_LIFETIME_MS = 900;

let nextPopupId = 0;

export function useDamagePopup(health: () => number) {
  const popups = ref<DamagePopup[]>([]);
  const isHit = ref(false);

  watch(health, (newValue, oldValue) => {
    const amount = Math.round(oldValue - newValue);
    if (amount <= 0) return;

    isHit.value = true;
    setTimeout(() => {
      isHit.value = false;
    }, HIT_FLASH_MS);

    const id = nextPopupId++;
    popups.value.push({ id, amount });
    setTimeout(() => {
      popups.value = popups.value.filter((popup) => popup.id !== id);
    }, POPUP_LIFETIME_MS);
  });

  return { popups, isHit };
}
