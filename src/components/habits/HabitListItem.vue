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

const metaText = computed(
  () => `${props.habit.period} · ${props.habit.damageType} · streak ${props.habit.streakCount}`,
);

const rewardTag = computed(() => (props.habit.isSpecial ? 'Special' : props.habit.isUlt ? 'Ult' : null));

function onCheckOff() {
  const itemsDropped = checkOffHabit(props.habit.id);
  if (itemsDropped.length > 0) {
    enqueueDrops(itemsDropped);
  }
}

const showStatsModal = ref(false);
</script>

<template>
  <li class="habit-item" :class="{ bad: habit.isBad }" @click="showStatsModal = true">
    <input
      type="checkbox"
      :aria-label="`Complete ${habit.name}`"
      :checked="isCompletedThisPeriod"
      :disabled="isCompletedThisPeriod"
      @click.stop
      @change="onCheckOff"
    />
    <span class="name" :class="{ done: isCompletedThisPeriod }">{{ habit.name }}</span>
    <span v-if="rewardTag" class="tag">{{ rewardTag }}</span>
    <span class="meta">{{ metaText }}</span>
  </li>

  <HabitStatsModal v-model="showStatsModal" :habit="habit" />
</template>

<style scoped>
.habit-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem 0.75rem;
  padding: 0.4rem 0;
  cursor: pointer;
}

.habit-item .name {
  flex: 1;
  min-width: 0;
  text-align: left;
  overflow-wrap: anywhere;
}

.habit-item.bad {
  outline: 1px solid rgba(220, 38, 38, 0.35);
  border-radius: 4px;
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

.tag {
  flex-shrink: 0;
  background: #16a34a;
  color: white;
  font-size: 0.7em;
  font-weight: 600;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
}
</style>
