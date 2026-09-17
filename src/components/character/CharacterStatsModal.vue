<script setup lang="ts">
import { computed } from 'vue';
import { expToNextLevel, statAtLevel } from '../../game-engine';
import type { Character } from '../../game-engine';
import Modal from '../ui/Modal.vue';

const props = defineProps<{ modelValue: boolean; character: Character }>();
defineEmits<{ 'update:modelValue': [value: boolean] }>();

const level = computed(() => props.character.level);
const physicalDamage = computed(() => statAtLevel(props.character.starterStats.physicalDamage, level.value));
const magicDamage = computed(() => statAtLevel(props.character.starterStats.magicDamage, level.value));
const healing = computed(() => statAtLevel(props.character.starterStats.healing, level.value));
const maxHealth = computed(() => statAtLevel(props.character.starterStats.health, level.value));
const expNeeded = computed(() => expToNextLevel(level.value));
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
</style>
