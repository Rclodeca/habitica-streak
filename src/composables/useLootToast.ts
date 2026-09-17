// Small shared (module-scoped) toast queue for boss-kill item drops. Unlike
// useDamagePopup (one independent instance per panel), this state must be a
// single singleton: the component that triggers a drop (HabitListItem) and
// the component that renders the queue (LootToast, mounted once in
// AppShell) need to see the same list.

import { ref } from 'vue';

export interface LootToastEntry {
  id: number;
  message: string;
}

const TOAST_LIFETIME_MS = 3000;

const toasts = ref<LootToastEntry[]>([]);
let nextId = 0;

export function useLootToast() {
  function addLoot(itemNames: string[]) {
    for (const name of itemNames) {
      const id = nextId++;
      toasts.value.push({ id, message: `Found: ${name}!` });
      setTimeout(() => {
        toasts.value = toasts.value.filter((toast) => toast.id !== id);
      }, TOAST_LIFETIME_MS);
    }
  }

  return { toasts, addLoot };
}
