<script setup lang="ts">
import { ref } from 'vue';
import type { Difficulty, Period } from '../../game-engine';
import { useCombatActions } from '../../composables/useCombatActions';
import { useHabitStore } from '../../store/habitStore';
import HabitListItem from './HabitListItem.vue';

const habitStore = useHabitStore();
const { addHabit } = useCombatActions();

// Rough, temporary inline add-habit form — Task 8 replaces this with a
// dedicated AddHabitForm.vue component.
const newHabitName = ref('');
const newHabitPeriod = ref<Period>('daily');
const newHabitDifficulty = ref<Difficulty>('easy');

function onSubmit() {
  const name = newHabitName.value.trim();
  if (!name) return;
  addHabit(name, newHabitPeriod.value, newHabitDifficulty.value);
  newHabitName.value = '';
}
</script>

<template>
  <section class="panel habit-list">
    <h2>Habits</h2>
    <ul v-if="habitStore.habits.length">
      <HabitListItem v-for="habit in habitStore.habits" :key="habit.id" :habit="habit" />
    </ul>
    <p v-else>No habits yet — add one below.</p>

    <form class="add-habit-form" @submit.prevent="onSubmit">
      <input v-model="newHabitName" type="text" placeholder="Habit name" required />
      <select v-model="newHabitPeriod">
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
      </select>
      <select v-model="newHabitDifficulty">
        <option value="easy">Easy</option>
        <option value="medium">Medium</option>
        <option value="hard">Hard</option>
      </select>
      <button type="submit">Add habit</button>
    </form>
  </section>
</template>

<style scoped>
.panel {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
}

.habit-list ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.add-habit-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}
</style>
