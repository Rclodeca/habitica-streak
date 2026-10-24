<script setup lang="ts">
import { computed } from 'vue';
import { describeItemBonus, ITEM_CATALOG, itemDoubleFactor } from '../../game-engine';
import { useItemDropQueue } from '../../composables/useItemDropQueue';
import { useCharacterStore } from '../../store/characterStore';
import ItemHero from './ItemHero.vue';
import Modal from './Modal.vue';

const { current, dismiss, replace } = useItemDropQueue();
const characterStore = useCharacterStore();
const baseUrl = import.meta.env.BASE_URL;

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
    max-width="460px"
    @update:model-value="dismiss"
  >
    <template v-if="current">
      <ItemHero :item="current" />

      <template v-if="!isCurrentEquipped">
        <ul class="replace-list">
          <li v-for="item in equippedItems" :key="item.id" class="replace-row" :class="`rarity-${item.rarity}`">
            <img class="row-icon" :src="`${baseUrl}sprites/${item.icon}.png`" :alt="item.name" />
            <div class="row-text">
              <strong class="row-name">{{ item.name }}</strong>
              <span class="row-bonus" :class="{ enchanted: itemDoubleFactor(characterStore.character, item.id) > 1 }">
                {{ describeItemBonus(item, itemDoubleFactor(characterStore.character, item.id)) }}
              </span>
            </div>
            <button type="button" class="replace-button" @click="replace(item.id)">Replace</button>
          </li>
        </ul>
        <button type="button" class="drop-button" @click="dismiss">Drop {{ current.name }}</button>
      </template>

      <template v-else>
        <p class="equipped-note">✓ Equipped</p>
        <button type="button" class="dismiss-button primary-button" @click="dismiss">Nice!</button>
      </template>
    </template>
  </Modal>
</template>

<style scoped>
.rarity-common {
  --rarity: var(--rarity-common);
}

.rarity-uncommon {
  --rarity: var(--rarity-uncommon);
}

.rarity-rare {
  --rarity: var(--rarity-rare);
}

.rarity-epic {
  --rarity: var(--rarity-epic);
}

.rarity-relic {
  --rarity: var(--side-quest-color);
}

.replace-list {
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.replace-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 0.6rem;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-left: 3px solid var(--rarity);
  border-radius: 8px;
}

.row-icon {
  width: 44px;
  height: 44px;
  object-fit: contain;
  image-rendering: pixelated;
  transform: scale(1.4);
}

.row-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.row-name {
  color: var(--text-h);
  font-size: 0.9rem;
}

.row-bonus {
  color: var(--text);
  font-size: 0.8rem;
}

.replace-button {
  padding: 0.35em 0.9em;
  font-size: 0.85rem;
}

.row-bonus.enchanted {
  color: var(--accent-solid);
}

.equipped-note {
  margin: 0.75rem 0 0;
  text-align: center;
  color: var(--heal-color);
  font-size: 0.9rem;
}

.dismiss-button {
  display: block;
  width: 100%;
  margin-top: 0.5rem;
}

.drop-button {
  display: block;
  width: 100%;
  margin-top: 0.75rem;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-h);
}
</style>
