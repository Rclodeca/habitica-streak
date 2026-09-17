<script setup lang="ts">
import { computed } from 'vue';
import { ITEM_CATALOG } from '../../game-engine';
import type { Character } from '../../game-engine';
import { useCharacterStore } from '../../store/characterStore';
import Modal from '../ui/Modal.vue';

const props = defineProps<{ modelValue: boolean; character: Character }>();
defineEmits<{ 'update:modelValue': [value: boolean] }>();

const characterStore = useCharacterStore();

const ownedItems = computed(() => ITEM_CATALOG.filter((item) => props.character.ownedItemIds.includes(item.id)));
const equippedCount = computed(() => props.character.equippedItemIds.length);

function isEquipped(itemId: string): boolean {
  return props.character.equippedItemIds.includes(itemId);
}

function toggleEquip(itemId: string) {
  if (isEquipped(itemId)) {
    characterStore.unequipItem(itemId);
  } else {
    characterStore.equipItem(itemId);
  }
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="Inventory"
    @update:model-value="(value) => $emit('update:modelValue', value)"
  >
    <p class="equip-count">{{ equippedCount }} / 4 equipped</p>

    <p v-if="ownedItems.length === 0" class="empty">No items yet — defeat a boss to find your first one.</p>

    <ul v-else class="item-list">
      <li v-for="item in ownedItems" :key="item.id" class="item-row">
        <img class="item-icon" :src="`/sprites/${item.icon}.png`" :alt="item.name" />
        <div class="item-info">
          <span class="item-name">{{ item.name }}</span>
          <span class="item-bonus">+{{ item.bonusPercent }}% {{ item.stat }}</span>
        </div>
        <button
          type="button"
          class="equip-toggle"
          :disabled="!isEquipped(item.id) && equippedCount >= 4"
          @click="toggleEquip(item.id)"
        >
          {{ isEquipped(item.id) ? 'Unequip' : 'Equip' }}
        </button>
      </li>
    </ul>
  </Modal>
</template>

<style scoped>
.equip-count {
  margin: 0 0 0.75rem;
  font-weight: 600;
}

.empty {
  opacity: 0.7;
}

.item-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.item-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.item-name {
  font-weight: 600;
}

.item-bonus {
  font-size: 0.85em;
  opacity: 0.7;
}

.equip-toggle {
  flex-shrink: 0;
}
</style>
