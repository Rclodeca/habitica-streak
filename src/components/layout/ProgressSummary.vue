<script setup lang="ts">
import { computed } from 'vue';
import { periodKeyFor } from '../../game-engine';
import type { Period } from '../../game-engine';
import { useDebugClockStore } from '../../store/debugClockStore';
import { useHabitStore } from '../../store/habitStore';
import StatIcon from '../ui/StatIcon.vue';

const habitStore = useHabitStore();
const debugClockStore = useDebugClockStore();

// Bad habits are left out: checking one off means you gave in, so counting it
// as "done" would read backwards.
function progress(period: Period) {
  const key = periodKeyFor(period, debugClockStore.now());
  const habits = habitStore.habits.filter((h) => h.period === period && !h.isBad);
  const done = habits.filter((h) => h.lastCompletedPeriodKey === key).length;
  return { done, total: habits.length, percent: habits.length ? (done / habits.length) * 100 : 0 };
}

const daily = computed(() => progress('daily'));
const weekly = computed(() => progress('weekly'));
const bestStreak = computed(() => Math.max(0, ...habitStore.habits.map((h) => h.streakCount)));
</script>

<template>
  <div class="summary">
    <div class="panel stat">
      <span class="ring" :style="{ '--p': daily.percent }" />
      <div>
        <b>{{ daily.done }} / {{ daily.total }}</b>
        <span>Daily done</span>
      </div>
    </div>
    <div class="panel stat">
      <span class="ring" :style="{ '--p': weekly.percent }" />
      <div>
        <b>{{ weekly.done }} / {{ weekly.total }}</b>
        <span>Weekly done</span>
      </div>
    </div>
    <div class="panel stat">
      <span class="streak-icon"><StatIcon name="streak" :size="24" /></span>
      <div>
        <b>{{ bestStreak }}</b>
        <span>Best streak</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.stat {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-width: 0;
}

.ring {
  --p: 0;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  background: conic-gradient(var(--accent) calc(var(--p) * 1%), var(--border) 0);
  border-radius: 50%;
}

.ring::after {
  content: '';
  width: 34px;
  height: 34px;
  background: var(--code-bg);
  border-radius: 50%;
}

.streak-icon {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  font-size: 1.4rem;
}

b {
  display: block;
  color: var(--text-h);
  font-size: 1.15rem;
  line-height: 1.1;
}

span:not(.ring):not(.streak-icon) {
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

@media (max-width: 560px) {
  .summary {
    display: none;
  }
}
</style>
