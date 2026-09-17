<script setup lang="ts">
import { useHabitStore } from '../../store/habitStore';
import AddHabitForm from './AddHabitForm.vue';
import HabitListItem from './HabitListItem.vue';

const habitStore = useHabitStore();
</script>

<template>
  <section class="panel habit-list">
    <h2>Habits</h2>
    <ul v-if="habitStore.habits.length">
      <HabitListItem v-for="habit in habitStore.habits" :key="habit.id" :habit="habit" />
    </ul>
    <p v-else>No habits yet — add one below.</p>

    <AddHabitForm />
  </section>
</template>

<style scoped>
.habit-list ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
</style>
