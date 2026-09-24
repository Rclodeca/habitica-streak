<script setup lang="ts">
import { computed } from 'vue';
import { describeItemBonus, ITEM_CATALOG } from '../../game-engine';
import { useItemDropQueue } from '../../composables/useItemDropQueue';
import { useCharacterStore } from '../../store/characterStore';
import Modal from './Modal.vue';

const { current, dismiss, replace } = useItemDropQueue();
const characterStore = useCharacterStore();

const equippedItems = computed(() =>
  ITEM_CATALOG.filter((item) => characterStore.character.equippedItemIds.includes(item.id)),
);

// `current` can already be sitting in `equippedItemIds` if it auto-equipped
// into the last open slot (see `useItemDropQueue.processFront` — an
// auto-equipped item stays queued so its informational popup still shows,
// it just isn't shifted out). Branching on this instead of the live `isFull`
// is what keeps the just-picked-up item from appearing in `equippedItems`
// as a candidate to replace itself.
const isCurrentEquipped = computed(
  () => current.value !== null && characterStore.character.equippedItemIds.includes(current.value.id),
);
</script>

<template>
  <Modal
    :model-value="current !== null"
    :dismissible="isCurrentEquipped"
    title="Item found!"
    @update:model-value="dismiss"
  >
    <template v-if="current">
      <p class="found-item">{{ current.name }} — {{ describeItemBonus(current) }}</p>

      <template v-if="!isCurrentEquipped">
        <p class="replace-prompt">Your 4 slots are full — choose one to replace, or drop the new item:</p>
        <ul class="replace-list">
          <li v-for="item in equippedItems" :key="item.id" class="replace-row">
            <span>{{ item.name }} ({{ describeItemBonus(item) }})</span>
            <button type="button" @click="replace(item.id)">Replace</button>
          </li>
        </ul>
        <button type="button" class="drop-button" @click="dismiss">Drop {{ current.name }}</button>
      </template>

      <button v-else type="button" class="dismiss-button" @click="dismiss">Nice!</button>
    </template>
  </Modal>
</template>

<style scoped>
.found-item {
  font-weight: 600;
  margin: 0 0 0.75rem;
}

.replace-prompt {
  margin: 0 0 0.5rem;
}

.replace-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.replace-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.dismiss-button {
  display: block;
}

.drop-button {
  display: block;
  margin-top: 0.75rem;
  background: transparent;
}
</style>
