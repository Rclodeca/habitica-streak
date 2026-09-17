<script setup lang="ts">
import { computed } from 'vue';
import { ITEM_CATALOG } from '../../game-engine';
import { useItemDropQueue } from '../../composables/useItemDropQueue';
import { useCharacterStore } from '../../store/characterStore';
import Modal from './Modal.vue';

const { current, isFull, dismiss, replace } = useItemDropQueue();
const characterStore = useCharacterStore();

const equippedItems = computed(() =>
  ITEM_CATALOG.filter((item) => characterStore.character.equippedItemIds.includes(item.id)),
);
</script>

<template>
  <Modal
    :model-value="current !== null"
    :dismissible="!isFull"
    title="Item found!"
    @update:model-value="dismiss"
  >
    <template v-if="current">
      <p class="found-item">{{ current.name }} — +{{ current.bonusPercent }}% {{ current.stat }}</p>

      <template v-if="isFull">
        <p class="replace-prompt">Your 4 slots are full — choose one to replace:</p>
        <ul class="replace-list">
          <li v-for="item in equippedItems" :key="item.id" class="replace-row">
            <span>{{ item.name }} (+{{ item.bonusPercent }}% {{ item.stat }})</span>
            <button type="button" @click="replace(item.id)">Replace</button>
          </li>
        </ul>
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
</style>
