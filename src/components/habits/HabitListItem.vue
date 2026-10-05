<script setup lang="ts">
import { computed, ref } from 'vue';
import { habitDamageBreakdown, periodKeyFor } from '../../game-engine';
import type { Habit } from '../../game-engine';
import { useCombatActions } from '../../composables/useCombatActions';
import { useItemDropQueue } from '../../composables/useItemDropQueue';
import { useQuestOfferQueue } from '../../composables/useQuestOfferQueue';
import { useCharacterStore } from '../../store/characterStore';
import { useDebugClockStore } from '../../store/debugClockStore';
import { useHabitStore } from '../../store/habitStore';
import HabitStatsModal from './HabitStatsModal.vue';

const props = defineProps<{ habit: Habit }>();

const { checkOffHabit } = useCombatActions();
const { enqueueDrops } = useItemDropQueue();
const { enqueueOffer } = useQuestOfferQueue();
const debugClockStore = useDebugClockStore();
const characterStore = useCharacterStore();
const habitStore = useHabitStore();

const isCompletedThisPeriod = computed(
  () => props.habit.lastCompletedPeriodKey === periodKeyFor(props.habit.period, debugClockStore.now()),
);

const breakdown = computed(() => {
  const siblings = habitStore.habitsOfType(props.habit.damageType, props.habit.period);
  return habitDamageBreakdown(characterStore.character, props.habit, siblings);
});

const effectiveDamage = computed(() => breakdown.value.effectiveDamage);

const damageTypeColor = computed(() => {
  if (props.habit.damageType === 'healing') return '#22c55e'; // green
  if (props.habit.damageType === 'magic') return '#a855f7'; // purple
  if (props.habit.damageType === 'trueDamage') return '#f9fafb'; // white
  if (props.habit.damageType === 'expGain') return '#60a5fa'; // blue
  return '#ef4444'; // red for physical
});

const metaText = computed(
  () => `${props.habit.difficulty} · streak ${props.habit.streakCount}`,
);

const rewardTag = computed(() => (props.habit.isSpecial ? 'Special' : props.habit.isUlt ? 'Ult' : null));

function onCheckOff() {
  const result = checkOffHabit(props.habit.id);
  if (result.itemsDropped.length > 0) enqueueDrops(result.itemsDropped);
  if (result.questOffered) enqueueOffer(result.bossIndexAtOffer);
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
    <div class="left">
      <span class="name" :class="{ done: isCompletedThisPeriod }">{{ habit.name }}</span>
      <span v-if="rewardTag" class="tag">{{ rewardTag }}</span>
    </div>
    <span class="meta">{{ metaText }}</span>
    <span class="effective-damage" :style="{ color: damageTypeColor }">{{ effectiveDamage.toFixed(0) }}</span>
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

.habit-item input[type="checkbox"] {
  flex-shrink: 0;
}

.left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.habit-item .name {
  flex: 1;
  min-width: 0;
  text-align: left;
  overflow-wrap: anywhere;
}

.habit-item.bad {
  border-left: 3px solid #dc2626;
  padding-left: 0.5rem;
  margin-left: -0.5rem;
}

.done {
  text-decoration: line-through;
  color: var(--text);
  opacity: 0.6;
}

.meta {
  font-size: 0.85em;
  opacity: 0.7;
  flex-shrink: 0;
}

.effective-damage {
  flex-shrink: 0;
  font-weight: 600;
  font-size: 0.9em;
  min-width: 3em;
  text-align: right;
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
