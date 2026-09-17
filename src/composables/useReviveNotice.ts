// Small shared (module-scope) revive-notice flag — same singleton reasoning
// as useDeathScreen/useItemDropQueue: the code that detects a feather-saved
// revive (useCombatActions) and the component that renders the toast
// (ReviveNotice, mounted once in AppShell) must see the same state.
//
// Unlike the death screen, this is non-blocking and self-dismisses after a
// fixed delay — the player doesn't need to acknowledge it to keep playing.

import { ref } from 'vue';

const NOTICE_LIFETIME_MS = 2500;

const visible = ref(false);
let dismissTimeout: ReturnType<typeof setTimeout> | undefined;

export function useReviveNotice() {
  function showReviveNotice() {
    visible.value = true;
    clearTimeout(dismissTimeout);
    dismissTimeout = setTimeout(() => {
      visible.value = false;
    }, NOTICE_LIFETIME_MS);
  }

  return { visible, showReviveNotice };
}
