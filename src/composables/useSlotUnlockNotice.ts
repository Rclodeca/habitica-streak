// One-time (ever, across runs) notice that equip slots grew from 4 to 6 at
// level 10. The seen-flag lives in its own localStorage key rather than on
// Character so a death reset doesn't make the player re-read it every run.
// Module-scoped for the same singleton reasoning as useDeathScreen.

import { computed, ref } from 'vue';
import { useCharacterStore } from '../store/characterStore';

const STORAGE_KEY = 'habitica-streak:slot-unlock-notice-seen:v1';
const UNLOCK_LEVEL = 10;

const seen = ref(localStorage.getItem(STORAGE_KEY) === '1');

export function useSlotUnlockNotice() {
  const characterStore = useCharacterStore();

  const isPending = computed(() => characterStore.character.level >= UNLOCK_LEVEL && !seen.value);

  function dismiss() {
    seen.value = true;
    localStorage.setItem(STORAGE_KEY, '1');
  }

  return { isPending, dismiss };
}
