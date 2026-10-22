// Small shared (module-scoped) note of the hero who just died — same
// singleton reasoning as useDeathScreen. `useCombatActions().restart()`
// records it right before the reset, and the new-hero screen that follows
// reads it to say who fell where. Session-only: after a reload that screen
// simply greets a new hero.

import { ref } from 'vue';

export interface FallenHero {
  name: string;
  bossIndex: number;
}

const fallen = ref<FallenHero | null>(null);

export function useFallenHero() {
  function recordFallen(hero: FallenHero) {
    fallen.value = hero;
  }

  function clearFallen() {
    fallen.value = null;
  }

  return { fallen, recordFallen, clearFallen };
}
