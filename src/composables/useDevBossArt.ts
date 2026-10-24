// Temporary art trial (see Dev mode in AppMenu): a shared override for the
// boss panel's sprite, cycled one tap at a time through the trial art and
// back to the real sprite. Module-scoped so the menu and the boss panel see
// the same state. Nothing is saved; a reload restores the real boss art.

import { computed, ref } from 'vue';

const TRIAL_ART = ['bosses/dev-troll', 'bosses/dev-guardian'];

// -1 means no override.
const index = ref(-1);

export function useDevBossArt() {
  const override = computed(() => TRIAL_ART[index.value] ?? null);

  function cycle() {
    index.value = index.value + 1 >= TRIAL_ART.length ? -1 : index.value + 1;
  }

  return { override, cycle };
}
