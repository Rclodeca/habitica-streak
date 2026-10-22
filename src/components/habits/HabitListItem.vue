<script setup lang="ts">
import { computed, ref } from 'vue';
import { habitDamageBreakdown, periodKeyFor } from '../../game-engine';
import type { Habit } from '../../game-engine';
import { useCombatActions } from '../../composables/useCombatActions';
import { useItemDropQueue } from '../../composables/useItemDropQueue';
import { useCharacterStore } from '../../store/characterStore';
import { useDebugClockStore } from '../../store/debugClockStore';
import { useHabitStore } from '../../store/habitStore';
import { DAMAGE_TYPE_COLORS } from './damageTypeColors';
import StatIcon from '../ui/StatIcon.vue';
import HabitStatsModal from './HabitStatsModal.vue';

const props = defineProps<{ habit: Habit }>();

const { checkOffHabit } = useCombatActions();
const { enqueueDrops } = useItemDropQueue();
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

const damageTypeColor = computed(() => DAMAGE_TYPE_COLORS[props.habit.damageType]);

const STREAK_TIERS = [
  { weight: 500, size: 0.75, bright: 0 },
  { weight: 600, size: 0.82, bright: 35 },
  { weight: 700, size: 0.92, bright: 70 },
  { weight: 800, size: 1.05, bright: 100 },
];
const streakStyle = computed(() => {
  const n = props.habit.streakCount;
  const tier = STREAK_TIERS[n >= 20 ? 3 : n >= 10 ? 2 : n >= 5 ? 1 : 0];
  return {
    fontWeight: tier.weight,
    fontSize: `${tier.size}rem`,
    color: `color-mix(in srgb, var(--text-h) ${tier.bright}%, var(--text))`,
  };
});
const difficultyPips = computed(() => ({ easy: 1, medium: 2, hard: 3 })[props.habit.difficulty]);

const rewardTag = computed(() => (props.habit.isSpecial ? 'Special' : props.habit.isUlt ? 'Ult' : null));

function onCheckOff() {
  const result = checkOffHabit(props.habit.id);
  if (result.itemsDropped.length > 0) enqueueDrops(result.itemsDropped);
}

const showStatsModal = ref(false);
</script>

<template>
  <li class="habit-item" :class="{ bad: habit.isBad }" :style="{ '--c': damageTypeColor }" @click="showStatsModal = true">
    <input
      type="checkbox"
      class="check"
      :aria-label="`Complete ${habit.name}`"
      :checked="isCompletedThisPeriod"
      :disabled="isCompletedThisPeriod"
      @click.stop
      @change="onCheckOff"
    />
    <div class="left">
      <span class="name" :class="{ done: isCompletedThisPeriod }">{{ habit.name }}</span>
      <span v-if="habit.isBad" class="tag resist">Resist</span>
      <span v-if="rewardTag" class="tag">{{ rewardTag }}</span>
    </div>
    <span class="meta">
      <span class="streak" :style="streakStyle" :title="habit.streakCount > 0 ? `${habit.streakCount} streak` : undefined">
        <template v-if="habit.streakCount > 0"><StatIcon name="streak" :size="12" />{{ habit.streakCount }}</template>
      </span>
      <span class="pips" :title="habit.difficulty">
        <span v-for="n in 3" :key="n" class="pip" :class="{ lit: n <= difficultyPips }" />
      </span>
    </span>
    <span class="damage">{{ effectiveDamage.toFixed(0) }}</span>
  </li>

  <HabitStatsModal v-model="showStatsModal" :habit="habit" />
</template>

<style scoped>
.habit-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.6rem 0.6rem;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.habit-item.bad::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.45rem;
  bottom: 0.45rem;
  width: 3px;
  background: var(--damage-color);
  border-radius: 3px;
}

.habit-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

/* One neutral check color for every row — the type color lives only on the
   damage number, so a long list doesn't turn into a rainbow. */
.check {
  appearance: none;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  margin: 0;
  background: transparent;
  border: 2px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
}

.check:hover:not(:disabled) {
  border-color: var(--accent-border);
}

.check:checked {
  background: var(--accent);
  border-color: var(--accent);
}

.check:checked::after {
  content: '✓';
  color: var(--bg);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
}

.check:disabled {
  cursor: default;
}

.check:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.name {
  min-width: 0;
  text-align: left;
  color: var(--text-h);
  overflow-wrap: anywhere;
}

.name.done {
  text-decoration: line-through;
  color: var(--text);
  opacity: 0.6;
}

.tag {
  flex-shrink: 0;
  padding: 0 0.45rem;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  border-radius: 999px;
  color: var(--accent);
  font-size: 0.65rem;
  font-weight: 600;
}

.tag.resist {
  background: transparent;
  border-color: color-mix(in srgb, var(--damage-color) 60%, transparent);
  color: var(--damage-color);
}

.meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
  font-size: 0.75rem;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.streak {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
  min-width: 3.5rem;
}

.pips {
  display: flex;
  gap: 0.2rem;
}

.pip {
  width: 6px;
  height: 6px;
  background: var(--border);
  border-radius: 50%;
}

.pip.lit {
  background: var(--accent);
}

.damage {
  flex-shrink: 0;
  width: 3rem;
  text-align: right;
  color: var(--c);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 560px) {
  .habit-item {
    gap: 0.6rem;
  }

  .meta {
    gap: 0.5rem;
  }

  .damage {
    width: 2.5rem;
  }
}
</style>
