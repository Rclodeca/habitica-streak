<script setup lang="ts">
import { computed, ref } from 'vue';
import type { DamageType, Habit } from '../../game-engine';
import { useHabitStore } from '../../store/habitStore';
import AddHabitModal from './AddHabitModal.vue';
import HabitListItem from './HabitListItem.vue';

const habitStore = useHabitStore();
const showAddModal = ref(false);

// Healing first, then physical, then magic — stable sort preserves each
// damage type's original relative order.
const DAMAGE_TYPE_ORDER: DamageType[] = ['healing', 'physical', 'magic'];
function sortByDamageType(habits: Habit[]): Habit[] {
  return [...habits].sort(
    (a, b) => DAMAGE_TYPE_ORDER.indexOf(a.damageType) - DAMAGE_TYPE_ORDER.indexOf(b.damageType),
  );
}

const dailyHabits = computed(() => sortByDamageType(habitStore.habits.filter((habit) => habit.period === 'daily')));
const weeklyHabits = computed(() =>
  sortByDamageType(habitStore.habits.filter((habit) => habit.period === 'weekly')),
);
</script>

<template>
  <section class="panel habit-list">
    <div class="habit-list-header">
      <h2>Skills</h2>
      <button type="button" class="add-button" aria-label="Add habit" @click="showAddModal = true">+</button>
    </div>

    <p v-if="!habitStore.habits.length">No habits yet — tap + to add one.</p>
    <template v-else>
      <div class="habit-group">
        <h3 class="habit-group-title">Daily</h3>
        <ul v-if="dailyHabits.length">
          <HabitListItem v-for="habit in dailyHabits" :key="habit.id" :habit="habit" />
        </ul>
        <p v-else class="habit-group-empty">No daily habits yet.</p>
      </div>

      <div class="habit-group">
        <h3 class="habit-group-title">Weekly</h3>
        <ul v-if="weeklyHabits.length">
          <HabitListItem v-for="habit in weeklyHabits" :key="habit.id" :habit="habit" />
        </ul>
        <p v-else class="habit-group-empty">No weekly habits yet.</p>
      </div>
    </template>
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

.habit-group + .habit-group {
  margin-top: 1.25rem;
}

.habit-group-title {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text);
}

.habit-group-empty {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text);
}
</style>
