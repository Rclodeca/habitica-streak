<script setup lang="ts">
import { computed } from 'vue';
import { periodKeyFor } from '../../game-engine';
import type { Habit } from '../../game-engine';
import { useCombatActions } from '../../composables/useCombatActions';

const props = defineProps<{ habit: Habit }>();

const { checkOffHabit } = useCombatActions();

const isCompletedThisPeriod = computed(
  () => props.habit.lastCompletedPeriodKey === periodKeyFor(props.habit.period, new Date()),
);

function onCheckOff() {
  checkOffHabit(props.habit.id);
}
</script>

<template>
  <li class="habit-item">
    <label>
      <input type="checkbox" :checked="isCompletedThisPeriod" :disabled="isCompletedThisPeriod" @change="onCheckOff" />
      <span :class="{ done: isCompletedThisPeriod }">{{ habit.name }}</span>
    </label>
    <span class="meta">{{ habit.period }} · {{ habit.difficulty }} · {{ habit.damageType }} · streak {{ habit.streakCount }}</span>
  </li>
</template>

<style scoped>
.habit-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.4rem 0;
}

.habit-item label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.done {
  text-decoration: line-through;
  color: var(--text);
  opacity: 0.6;
}

.meta {
  font-size: 0.85em;
  opacity: 0.7;
}
</style>
