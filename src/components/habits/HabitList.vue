<script setup lang="ts">
import { computed, ref } from 'vue';
import type { DamageType, Habit } from '../../game-engine';
import { useHabitStore } from '../../store/habitStore';
import AddHabitModal from './AddHabitModal.vue';
import { DAMAGE_TYPE_COLORS, DAMAGE_TYPE_LABELS } from './damageTypeColors';
import HabitListItem from './HabitListItem.vue';

const habitStore = useHabitStore();
const showAddModal = ref(false);

// Healing first, then physical, then magic, then true damage
// — stable sort preserves each damage type's original relative order.
const DAMAGE_TYPE_ORDER: DamageType[] = ['healing', 'physical', 'magic', 'trueDamage'];
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
      <button type="button" class="add-button" aria-label="Add habit" @click="showAddModal = true">+ New habit</button>
    </div>

    <ul class="damage-key" aria-label="Damage type colors">
      <li v-for="type in DAMAGE_TYPE_ORDER" :key="type" :style="{ '--c': DAMAGE_TYPE_COLORS[type] }">
        <span class="swatch" />{{ DAMAGE_TYPE_LABELS[type] }}
      </li>
    </ul>

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

.habit-list ul.damage-key {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;
  margin: 0.6rem 0 0;
  font-size: 0.75rem;
  color: var(--text);
}

.damage-key li {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.swatch {
  width: 8px;
  height: 8px;
  background: var(--c);
  border-radius: 50%;
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
</style>
