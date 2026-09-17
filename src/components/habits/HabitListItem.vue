<script setup lang="ts">
import { computed, ref } from 'vue';
import { periodKeyFor } from '../../game-engine';
import type { Habit } from '../../game-engine';
import { useCombatActions } from '../../composables/useCombatActions';
import { useItemDropQueue } from '../../composables/useItemDropQueue';
import { useDebugClockStore } from '../../store/debugClockStore';
import HabitStatsModal from './HabitStatsModal.vue';

const props = defineProps<{ habit: Habit }>();

const { checkOffHabit } = useCombatActions();
const { enqueueDrops } = useItemDropQueue();
const debugClockStore = useDebugClockStore();

const isCompletedThisPeriod = computed(
  () => props.habit.lastCompletedPeriodKey === periodKeyFor(props.habit.period, debugClockStore.now()),
);

function onCheckOff() {
  const itemsDropped = checkOffHabit(props.habit.id);
  if (itemsDropped.length > 0) {
    enqueueDrops(itemsDropped);
  }
}

const showStatsModal = ref(false);
</script>

<template>
  <li class="habit-item" @click="showStatsModal = true">
    <input
      type="checkbox"
      :aria-label="`Complete ${habit.name}`"
      :checked="isCompletedThisPeriod"
      :disabled="isCompletedThisPeriod"
      @click.stop
      @change="onCheckOff"
    />
    <span class="name" :class="{ done: isCompletedThisPeriod }">{{ habit.name }}</span>
    <span class="meta">{{ habit.period }} · {{ habit.difficulty }} · {{ habit.damageType }} · streak {{ habit.streakCount }}</span>
  </li>

  <HabitStatsModal v-model="showStatsModal" :habit="habit" />
</template>

<style scoped>
.habit-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.4rem 0;
  cursor: pointer;
}

.habit-item .name {
  flex: 1;
  text-align: left;
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
