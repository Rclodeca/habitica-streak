<script setup lang="ts">
import { computed } from 'vue';

// Simple proportional health bar. `variant` only swaps the fill color so
// player vs. boss bars read as visually distinct at a glance. A hit drops the
// fill at once and leaves a pale trail that catches up after a beat; a heal
// just grows the fill (the trail runs under it, out of sight). `marks` are a
// boss's skill breakpoints (fractions from the left edge): generic, never
// which skill, and faded out by a transition once spent, so a reload shows
// spent ones already gone.
const props = defineProps<{
  current: number;
  max: number;
  variant?: 'player' | 'boss';
  marks?: { at: number; state: 'armed' | 'fired' | 'spent' }[];
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
    <div class="health-bar-trail" :style="{ width: `${percent}%` }" />
    <div class="health-bar-fill" :style="{ width: `${percent}%` }" />
    <i
      v-for="mark in marks ?? []"
      :key="mark.at"
      class="health-bar-mark"
      :class="mark.state"
      :style="{ left: `${mark.at * 100}%` }"
      aria-hidden="true"
    />
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

.health-bar-trail {
  position: absolute;
  inset-block: 0;
  left: 0;
  background: var(--hp-trail);
  transition: width 0.55s ease-in 0.45s;
}

.health-bar-fill {
  position: relative;
  height: 100%;
  background: var(--hp-color);
  transition: width 0.15s ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .health-bar-trail,
  .health-bar-fill {
    transition: none;
  }
}

/* A small diamond inside the bar; a spent one fades, a fired one flares out. */
.health-bar-mark {
  position: absolute;
  z-index: 1;
  top: 50%;
  width: 6px;
  height: 6px;
  margin: -3px 0 0 -3px;
  background: var(--text);
  transform: rotate(45deg);
  pointer-events: none;
  transition: opacity 0.5s ease-out;
}

.health-bar-mark.spent {
  opacity: 0;
}

.health-bar-mark.fired {
  opacity: 0;
  transform: rotate(45deg) scale(2.3);
  transition:
    opacity 0.9s ease-out,
    transform 0.9s ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .health-bar-mark.fired {
    transform: rotate(45deg);
  }
}

.health-bar-label {
  position: absolute;
  z-index: 2;
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
