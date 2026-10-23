<script setup lang="ts">
// Seven tappable weekdays, Monday first. Lit = due. The last lit day can't
// be turned off, so a daily always falls on at least one day.

import { WEEKDAY_LETTERS, WEEKDAY_SHORT } from './weekdays';

const props = defineProps<{ modelValue: number[] }>();
const emit = defineEmits<{ 'update:modelValue': [days: number[]] }>();

function toggle(day: number) {
  const lit = props.modelValue.includes(day);
  if (lit && props.modelValue.length === 1) return;
  const next = lit ? props.modelValue.filter((d) => d !== day) : [...props.modelValue, day];
  emit('update:modelValue', next.sort((a, b) => a - b));
}
</script>

<template>
  <div class="days">
    <button
      v-for="(letter, day) in WEEKDAY_LETTERS"
      :key="day"
      type="button"
      class="day"
      :class="{ on: modelValue.includes(day) }"
      :aria-pressed="modelValue.includes(day)"
      :aria-label="WEEKDAY_SHORT[day]"
      @click="toggle(day)"
    >
      <span>{{ letter }}</span>
    </button>
  </div>
</template>

<style scoped>
.days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.day {
  position: relative;
  display: grid;
  place-items: center;
  height: 44px;
  padding: 0;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.day.on {
  background: color-mix(in srgb, var(--accent) 14%, var(--code-bg));
  border-color: var(--accent);
  color: var(--text-h);
}

.day:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
