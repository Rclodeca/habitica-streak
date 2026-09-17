<script setup lang="ts">
import { useDailyRollover } from '../../composables/useDailyRollover';
import { useDebugClockStore } from '../../store/debugClockStore';

const debugClockStore = useDebugClockStore();

function skipDay() {
  debugClockStore.skipToNextDay();
  useDailyRollover(debugClockStore.now());
}
</script>

<template>
  <button type="button" class="skip-day" @click="skipDay">Skip to next day (testing)</button>
</template>

<style scoped>
.skip-day {
  align-self: flex-start;
  font-size: 0.8em;
  opacity: 0.7;
  border: 1px dashed var(--border);
  background: transparent;
  color: inherit;
  padding: 0.3rem 0.6rem;
  cursor: pointer;
}

.skip-day:hover {
  opacity: 1;
}
</style>
