<script setup lang="ts">
import { computed } from 'vue';
import { effectiveStat, expToNextLevel, ITEM_CATALOG } from '../../game-engine';
import type { Character } from '../../game-engine';
import Modal from '../ui/Modal.vue';

const props = defineProps<{ modelValue: boolean; character: Character }>();
defineEmits<{ 'update:modelValue': [value: boolean] }>();

const level = computed(() => props.character.level);
const physicalDamage = computed(() => effectiveStat(props.character, 'physicalDamage'));
const magicDamage = computed(() => effectiveStat(props.character, 'magicDamage'));
const healing = computed(() => effectiveStat(props.character, 'healing'));
const maxHealth = computed(() => effectiveStat(props.character, 'health'));
const expNeeded = computed(() => expToNextLevel(level.value));
const equippedItems = computed(() => ITEM_CATALOG.filter((item) => props.character.equippedItemIds.includes(item.id)));
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="Character stats"
    @update:model-value="(value) => $emit('update:modelValue', value)"
  >
    <dl class="stat-list">
      <dt>Level</dt>
      <dd>{{ level }}</dd>

      <dt>EXP</dt>
      <dd>{{ Math.round(character.exp) }} / {{ Math.round(expNeeded) }}</dd>

      <dt>Health</dt>
      <dd>{{ Math.round(character.currentHealth) }} / {{ Math.round(maxHealth) }}</dd>

      <dt>Physical damage</dt>
      <dd>{{ physicalDamage.toFixed(1) }}</dd>

      <dt>Magic damage</dt>
      <dd>{{ magicDamage.toFixed(1) }}</dd>

      <dt>Healing</dt>
      <dd>{{ healing.toFixed(1) }}</dd>
    </dl>

    <h4 class="equipped-heading">Equipped items</h4>
    <p v-if="equippedItems.length === 0" class="empty">None equipped.</p>
    <ul v-else class="equipped-list">
      <li v-for="item in equippedItems" :key="item.id">{{ item.name }} (+{{ item.bonusPercent }}% {{ item.stat }})</li>
    </ul>
  </Modal>
</template>

<style scoped>
.stat-list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.4rem 1rem;
  margin: 0;
}

.stat-list dt {
  font-weight: 600;
  color: var(--text-h);
}

.stat-list dd {
  margin: 0;
  text-align: right;
}

.equipped-heading {
  margin: 1rem 0 0.4rem;
}

.empty {
  opacity: 0.7;
  margin: 0;
}

.equipped-list {
  margin: 0;
  padding-left: 1.2rem;
}
</style>
