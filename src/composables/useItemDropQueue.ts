// Small shared (module-scoped) queue for boss-kill item drops — same
// singleton reasoning as the old useLootToast it replaces: the component
// that triggers a drop (HabitListItem) and the component that renders the
// popup (ItemDropPopup, mounted once in AppShell) must see the same state.
//
// Each queued item is resolved one of two ways: if there's an open equip
// slot at the moment it's processed, it's auto-equipped immediately (the
// popup is then purely informational — `dismiss()` just advances the
// queue). If all 4 slots are full, the item waits for `replace(oldItemId)`
// to swap it in. Processing one item at a time (rather than checking room
// once for the whole batch) is what lets a multi-item drop fill any
// remaining slots before the forced-choice popup ever appears.

import { computed, ref } from 'vue';
import type { ItemDef } from '../game-engine';
import { useCharacterStore } from '../store/characterStore';

const queue = ref<ItemDef[]>([]);

export function useItemDropQueue() {
  const characterStore = useCharacterStore();

  const current = computed<ItemDef | null>(() => queue.value[0] ?? null);
  const isFull = computed(() => characterStore.character.equippedItemIds.length >= 4);

  function processFront() {
    const front = current.value;
    if (front && !isFull.value) {
      characterStore.equipItem(front.id);
    }
  }

  function enqueueDrops(items: ItemDef[]) {
    queue.value.push(...items);
    processFront();
  }

  function dismiss() {
    queue.value.shift();
    processFront();
  }

  function replace(oldItemId: string) {
    const front = current.value;
    if (!front) return;
    characterStore.unequipItem(oldItemId);
    characterStore.equipItem(front.id);
    queue.value.shift();
    processFront();
  }

  return { current, isFull, enqueueDrops, dismiss, replace };
}
