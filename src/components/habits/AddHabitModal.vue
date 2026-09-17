<script setup lang="ts">
// Dedicated add-habit form. No damage-type field: damage type is randomly
// assigned by `createHabit` (see `game-engine/habits.ts`), never user-chosen.

import { ref } from 'vue';
import type { Difficulty, Period } from '../../game-engine';
import { useCombatActions } from '../../composables/useCombatActions';

const { addHabit } = useCombatActions();

const name = ref('');
const period = ref<Period>('daily');
const difficulty = ref<Difficulty>('easy');

function onSubmit() {
  const trimmedName = name.value.trim();
  if (!trimmedName) return;
  addHabit(trimmedName, period.value, difficulty.value);
  name.value = '';
}
</script>

<template>
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
    <button type="submit">Add habit</button>
  </form>
</template>

<style scoped>
.add-habit-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}
</style>
