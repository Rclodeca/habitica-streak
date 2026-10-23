<script setup lang="ts">
// Add-habit popup. No damage-type field: damage type is randomly assigned
// by `createHabit` (see `game-engine/habits.ts`), never user-chosen.

import { computed, ref, watch } from 'vue';
import type { Difficulty, Period } from '../../game-engine';
import { useCombatActions } from '../../composables/useCombatActions';
import Modal from '../ui/Modal.vue';
import DayPicker from './DayPicker.vue';
import { ALL_DAYS, dayCountLabel } from './weekdays';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const { addHabit } = useCombatActions();

const name = ref('');
const period = ref<Period>('daily');
const difficulty = ref<Difficulty>('easy');
const habitType = ref<'good' | 'bad'>('good');
// A daily's due days; every day each time the form opens.
const days = ref<number[]>([...ALL_DAYS]);
watch(
  () => props.modelValue,
  (open) => {
    if (open) days.value = [...ALL_DAYS];
  },
);

const periodOptions = computed<{ value: Period; label: string; hint: string }[]>(() => [
  { value: 'daily', label: 'Daily', hint: dayCountLabel(days.value) },
  { value: 'weekly', label: 'Weekly', hint: 'Every week' },
]);

const difficultyOptions: { value: Difficulty; label: string; pips: number }[] = [
  { value: 'easy', label: 'Easy', pips: 1 },
  { value: 'medium', label: 'Medium', pips: 2 },
  { value: 'hard', label: 'Hard', pips: 3 },
];

const typeOptions: { value: 'good' | 'bad'; label: string; hint: string }[] = [
  { value: 'good', label: 'Good', hint: 'Do it' },
  { value: 'bad', label: 'Bad', hint: 'Resist it' },
];

const pledge = computed(() =>
  habitType.value === 'bad'
    ? 'Resist it and the boss bleeds. Give in and you do.'
    : 'Do it and the boss bleeds. Skip it and you do.',
);

function onSubmit() {
  const trimmedName = name.value.trim();
  if (!trimmedName) return;
  addHabit(trimmedName, period.value, difficulty.value, habitType.value === 'bad', period.value === 'daily' ? days.value : undefined);
  name.value = '';
  emit('update:modelValue', false);
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="Forge a habit"
    max-width="480px"
    @update:model-value="(value) => $emit('update:modelValue', value)"
  >
    <form class="add-habit-form" @submit.prevent="onSubmit">
      <p class="intro">Every habit is a weapon. Keep it, and it strikes the boss. Fail it, and the boss strikes back.</p>

      <label class="field">
        <span class="field-label">Name</span>
        <input v-model="name" class="name-input" type="text" placeholder="What will you keep?" required />
      </label>

      <fieldset class="field">
        <legend class="field-label">Type</legend>
        <div class="cards two">
          <label
            v-for="opt in typeOptions"
            :key="opt.value"
            class="card"
            :class="[`type-${opt.value}`, { selected: habitType === opt.value }]"
          >
            <input v-model="habitType" type="radio" name="habit-type" :value="opt.value" />
            <span class="card-title">{{ opt.label }}</span>
            <span class="card-hint">{{ opt.hint }}</span>
          </label>
        </div>
        <p class="pledge" :class="`type-${habitType}`">{{ pledge }}</p>
      </fieldset>

      <fieldset class="field">
        <legend class="field-label">Cadence</legend>
        <div class="cards two">
          <label v-for="opt in periodOptions" :key="opt.value" class="card" :class="{ selected: period === opt.value }">
            <input v-model="period" type="radio" name="habit-period" :value="opt.value" />
            <span class="card-title">{{ opt.label }}</span>
            <span class="card-hint">{{ opt.hint }}</span>
          </label>
        </div>
        <DayPicker v-if="period === 'daily'" v-model="days" class="cadence-days" />
      </fieldset>

      <fieldset class="field">
        <legend class="field-label">Difficulty</legend>
        <div class="cards three">
          <label
            v-for="opt in difficultyOptions"
            :key="opt.value"
            class="card"
            :class="{ selected: difficulty === opt.value }"
          >
            <input v-model="difficulty" type="radio" name="habit-difficulty" :value="opt.value" />
            <span class="card-title">{{ opt.label }}</span>
            <span class="pips" aria-hidden="true">
              <span v-for="n in 3" :key="n" class="pip" :class="{ lit: n <= opt.pips }" />
            </span>
          </label>
        </div>
      </fieldset>

      <button type="submit" class="submit">Forge</button>
    </form>
  </Modal>
</template>

<style scoped>
.cadence-days {
  margin-top: 0.5rem;
}

.add-habit-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.intro {
  margin: 0;
  padding: 0.6rem 0.8rem;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
  border-radius: 8px;
  color: var(--text);
  font-size: 0.85rem;
  line-height: 1.4;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  border: none;
  min-width: 0;
}

.field-label {
  padding: 0;
  color: var(--text);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.name-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.8rem 1rem;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-h);
  font-family: inherit;
  font-size: 1.1rem;
}

.name-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 14px -4px var(--accent);
}

.cards {
  display: grid;
  gap: 0.5rem;
}

.cards.two {
  grid-template-columns: repeat(2, 1fr);
}

.cards.three {
  grid-template-columns: repeat(3, 1fr);
}

.card {
  --tone: var(--accent);
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  min-height: 4.25rem;
  padding: 0.7rem 0.5rem;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  text-align: center;
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    background 0.2s;
}

.card.type-good {
  --tone: var(--heal-color);
}

.card.type-bad {
  --tone: var(--damage-color);
}

.card:hover {
  border-color: color-mix(in srgb, var(--tone) 60%, transparent);
}

.card.selected {
  background: color-mix(in srgb, var(--tone) 14%, var(--code-bg));
  border-color: var(--tone);
  box-shadow: 0 0 16px -6px var(--tone);
}

.card:has(input:focus-visible) {
  outline: 2px solid var(--tone);
  outline-offset: 2px;
}

.card input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.card-title {
  color: var(--text-h);
  font-size: 1rem;
  font-weight: 600;
}

.card-hint {
  color: var(--text);
  font-size: 0.8rem;
}

.pips {
  display: flex;
  gap: 0.3rem;
}

.pip {
  width: 0.55rem;
  height: 0.55rem;
  background: var(--border);
  border-radius: 50%;
}

.pip.lit {
  background: var(--tone);
}

.pledge {
  margin: 0;
  font-size: 0.8rem;
  font-style: italic;
}

.pledge.type-good {
  color: var(--heal-color);
}

.pledge.type-bad {
  color: var(--damage-color);
}

.submit {
  padding: 0.8rem 1.2rem;
  background: var(--accent-bg);
  border-color: var(--accent-border);
  color: var(--text-h);
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.submit:hover {
  box-shadow: 0 0 16px -4px var(--accent);
}
</style>
