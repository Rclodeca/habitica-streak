<script setup lang="ts">
import type { Boss } from '../../game-engine';
import Modal from '../ui/Modal.vue';

defineProps<{ modelValue: boolean; boss: Boss }>();
defineEmits<{ 'update:modelValue': [value: boolean] }>();
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="Boss stats"
    @update:model-value="(value) => $emit('update:modelValue', value)"
  >
    <dl class="stat-list">
      <dt>Index</dt>
      <dd>{{ boss.index }}</dd>

      <dt>Personality</dt>
      <dd>{{ boss.personality }}</dd>

      <dt>Health</dt>
      <dd>{{ Math.round(boss.health) }} / {{ Math.round(boss.maxHealth) }}</dd>

      <dt>Physical attack</dt>
      <dd>{{ boss.physicalAttack.toFixed(1) }}</dd>

      <dt>Magic attack</dt>
      <dd>{{ boss.magicAttack.toFixed(1) }}</dd>

      <dt>Armor</dt>
      <dd>{{ boss.armor.toFixed(1) }}</dd>

      <dt>Magic resist</dt>
      <dd>{{ boss.magicResist.toFixed(1) }}</dd>
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
