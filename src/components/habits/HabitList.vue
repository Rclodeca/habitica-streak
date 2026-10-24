<script setup lang="ts">
import { computed, ref } from 'vue';
import { isDueOn } from '../../game-engine';
import { useDebugClockStore } from '../../store/debugClockStore';
import { useHabitStore } from '../../store/habitStore';
import AddHabitModal from './AddHabitModal.vue';
import HabitListItem from './HabitListItem.vue';
import HabitStatsModal from './HabitStatsModal.vue';
import { sortByDamageType } from './habitDisplay';

const habitStore = useHabitStore();
const debugClockStore = useDebugClockStore();
const showAddModal = ref(false);

const dailyHabits = computed(() => sortByDamageType(habitStore.habits.filter((habit) => habit.period === 'daily')));
// Set-day skills resting today fold away at the bottom of Daily.
const dueDailyHabits = computed(() => dailyHabits.value.filter((habit) => isDueOn(habit, debugClockStore.now())));
const restingDailyHabits = computed(() => dailyHabits.value.filter((habit) => !isDueOn(habit, debugClockStore.now())));
const weeklyHabits = computed(() =>
  sortByDamageType(habitStore.habits.filter((habit) => habit.period === 'weekly')),
);

// One popup for the whole list, by id, so it stays open when changing a
// skill's days moves its row in or out of the Resting fold.
const openHabitId = ref<string | null>(null);
const openHabit = computed(() => habitStore.habits.find((habit) => habit.id === openHabitId.value));
</script>

<template>
  <section class="panel habit-list">
    <div class="habit-list-header">
      <h2>Skills</h2>
      <button type="button" class="add-button" aria-label="Add habit" @click="showAddModal = true">+ New habit</button>
    </div>

    <p v-if="!habitStore.habits.length">No habits yet — tap + to add one.</p>
    <template v-else>
      <div class="habit-group">
        <h3 class="habit-group-title">Daily</h3>
        <ul v-if="dueDailyHabits.length">
          <HabitListItem v-for="habit in dueDailyHabits" :key="habit.id" :habit="habit" @open="openHabitId = habit.id" />
        </ul>
        <p v-else-if="!dailyHabits.length" class="habit-group-empty">No daily habits yet.</p>
        <details v-if="restingDailyHabits.length" class="rest-fold">
          <summary>Resting <span class="rest-count">{{ restingDailyHabits.length }}</span></summary>
          <ul>
            <HabitListItem v-for="habit in restingDailyHabits" :key="habit.id" :habit="habit" @open="openHabitId = habit.id" />
          </ul>
        </details>
      </div>

      <div class="habit-group">
        <h3 class="habit-group-title">Weekly</h3>
        <ul v-if="weeklyHabits.length">
          <HabitListItem v-for="habit in weeklyHabits" :key="habit.id" :habit="habit" @open="openHabitId = habit.id" />
        </ul>
        <p v-else class="habit-group-empty">No weekly habits yet.</p>
      </div>
    </template>
  </section>

  <AddHabitModal v-model="showAddModal" />
  <HabitStatsModal
    v-if="openHabit"
    :model-value="true"
    :habit="openHabit"
    @update:model-value="(open) => !open && (openHabitId = null)"
  />
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
  padding: 0.35rem 0.9rem;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  border-radius: 999px;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.habit-list ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.habit-group {
  margin-top: 1rem;
}

.habit-group-title {
  margin: 0 0 0.3rem;
  font-size: 0.7rem;
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

.rest-fold summary {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 44px;
  padding: 0 0.6rem;
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--text);
}

.rest-count {
  color: var(--text-h);
  font-weight: 600;
}
</style>
