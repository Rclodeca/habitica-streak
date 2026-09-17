<script setup lang="ts">
// Add-habit popup. No damage-type field: damage type is randomly assigned
// by `createHabit` (see `game-engine/habits.ts`), never user-chosen.

import { ref } from 'vue';
import type { Difficulty, Period } from '../../game-engine';
import { useCombatActions } from '../../composables/useCombatActions';
import Modal from '../ui/Modal.vue';

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const { addHabit } = useCombatActions();

const name = ref('');
const period = ref<Period>('daily');
const difficulty = ref<Difficulty>('easy');
const habitType = ref<'good' | 'bad'>('good');

function onSubmit() {
  const trimmedName = name.value.trim();
  if (!trimmedName) return;
  addHabit(trimmedName, period.value, difficulty.value, habitType.value === 'bad');
  name.value = '';
  emit('update:modelValue', false);
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="Add habit"
    @update:model-value="(value) => $emit('update:modelValue', value)"
  >
    <form class="add-habit-form" @submit.prevent="onSubmit">
      <input v-model="name" type="text" placeholder="Habit name" required />
      <select v-model="period">
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
      </select>
      <select v-model="difficulty">
        <option value="easy">Easy</option>
        <option value="medium">Medium</option>
        <option value="hard">Hard</option>
      </select>
      <select v-model="habitType">
        <option value="good">Good Habit</option>
        <option value="bad">Bad Habit</option>
      </select>
      <button type="submit">Add habit</button>
    </form>
  </Modal>
</template>

<style scoped>
.add-habit-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
