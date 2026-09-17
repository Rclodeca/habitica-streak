<script setup lang="ts">
import { ref } from 'vue';
import { useHabitStore } from '../../store/habitStore';
import AddHabitModal from './AddHabitModal.vue';
import HabitListItem from './HabitListItem.vue';

const habitStore = useHabitStore();
const showAddModal = ref(false);
</script>

<template>
  <section class="panel habit-list">
    <div class="habit-list-header">
      <h2>Skills</h2>
      <button type="button" class="add-button" aria-label="Add habit" @click="showAddModal = true">+</button>
    </div>
    <ul v-if="habitStore.habits.length">
      <HabitListItem v-for="habit in habitStore.habits" :key="habit.id" :habit="habit" />
    </ul>
    <p v-else>No habits yet — tap + to add one.</p>
  </section>

  <AddHabitModal v-model="showAddModal" />
</template>

<style scoped>
.habit-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.habit-list-header h2 {
  margin: 0;
}

.add-button {
  width: 2rem;
  height: 2rem;
  padding: 0;
  font-size: 1.25rem;
  line-height: 1;
  border-radius: 999px;
  flex-shrink: 0;
}

.habit-list ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
</style>
