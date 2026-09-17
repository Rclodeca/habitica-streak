<script setup lang="ts">
import { computed } from 'vue';

// Simple proportional health bar. `variant` only swaps the fill color so
// player vs. boss bars read as visually distinct at a glance.
const props = defineProps<{
  current: number;
  max: number;
  variant?: 'player' | 'boss';
}>();

const percent = computed(() => {
  if (props.max <= 0) return 0;
  return Math.max(0, Math.min(100, (props.current / props.max) * 100));
});
</script>

<template>
  <div
    class="health-bar"
    :class="variant"
    role="progressbar"
    :aria-valuenow="Math.round(current)"
    aria-valuemin="0"
    :aria-valuemax="Math.round(max)"
  >
    <div class="health-bar-fill" :style="{ width: `${percent}%` }" />
    <span class="health-bar-label">{{ Math.round(current) }} / {{ Math.round(max) }}</span>
  </div>
</template>

<style scoped>
.health-bar {
  position: relative;
  height: 1.1rem;
  border-radius: 999px;
  background: var(--border);
  overflow: hidden;
}

.health-bar-fill {
  height: 100%;
  background: #e5484d;
  transition: width 0.3s ease;
}

.health-bar.boss .health-bar-fill {
  background: #c026d3;
}

.health-bar-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
</style>
