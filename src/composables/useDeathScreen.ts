// Small shared (module-scoped) death-screen flag — same singleton reasoning
// as useItemDropQueue/useLootToast: the code that detects death
// (useCombatActions) and the component that renders the blocking popup
// (DeathScreen, mounted once in AppShell) must see the same state.
//
// Deliberately just a boolean: the actual character/boss/skill reset is
// performed by `useCombatActions().restart()`, not here, so this stays a
// pure UI flag with no game-engine knowledge.

import { ref } from 'vue';

const isDead = ref(false);

export function useDeathScreen() {
  function triggerDeath() {
    isDead.value = true;
  }

  function dismiss() {
    isDead.value = false;
  }

  return { isDead, triggerDeath, dismiss };
}
