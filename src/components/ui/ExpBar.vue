<script setup lang="ts">
import { computed } from 'vue';

// Same proportional-fill pattern as HealthBar, styled distinctly for exp.
const props = defineProps<{ current: number; max: number }>();

const percent = computed(() => {
  if (props.max <= 0) return 0;
  return Math.max(0, Math.min(100, (props.current / props.max) * 100));
});
</script>

<template>
  <div
    class="exp-bar"
    role="progressbar"
    :aria-valuenow="Math.round(current)"
    aria-valuemin="0"
    :aria-valuemax="Math.round(max)"
  >
    <div class="exp-bar-fill" :style="{ width: `${percent}%` }" />
    <span class="exp-bar-label">{{ Math.round(current) }} / {{ Math.round(max) }}</span>
  </div>
</template>

<style scoped>
.exp-bar {
  position: relative;
  height: 0.9rem;
  border-radius: 999px;
  background: var(--border);
  overflow: hidden;
}

.exp-bar-fill {
  height: 100%;
  background: #3b82f6;
  transition: width 0.3s ease;
}

.exp-bar-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
</style>
