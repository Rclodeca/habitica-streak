<script setup lang="ts">
import { computed, ref } from 'vue';
import { bossExpReward, dailyPeriodKey } from '../../game-engine';
import type { Difficulty } from '../../game-engine';
import { TUNING } from '../../game-engine/constants/tuning';
import { useBossStore } from '../../store/bossStore';
import { useDebugClockStore } from '../../store/debugClockStore';

const emit = defineEmits<{ submit: [description: string, difficulty: Difficulty, dueDateKey: string] }>();

const debugClockStore = useDebugClockStore();
const bossStore = useBossStore();

const todayKey = computed(() => dailyPeriodKey(debugClockStore.now()));

function addDays(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const description = ref('');
const difficulty = ref<Difficulty>('easy');
const dueDate = ref(addDays(todayKey.value, 1));

const difficultyOptions: { value: Difficulty; label: string; pips: number }[] = [
  { value: 'easy', label: 'Easy', pips: 1 },
  { value: 'medium', label: 'Medium', pips: 2 },
  { value: 'hard', label: 'Hard', pips: 3 },
];

const dueChips = computed(() => [
  { label: 'Today', key: todayKey.value },
  { label: 'Tomorrow', key: addDays(todayKey.value, 1) },
  { label: '3 days', key: addDays(todayKey.value, 3) },
  { label: '1 week', key: addDays(todayKey.value, 7) },
]);

const dueLabel = computed(() =>
  dueDate.value
    ? new Date(`${dueDate.value}T00:00:00Z`).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : '',
);

function rewardFor(d: Difficulty): number {
  return Math.round(bossExpReward(bossStore.boss.index) * TUNING.QUEST_EXP_DIFFICULTY_PCT[d]);
}

function onSubmit() {
  const trimmed = description.value.trim();
  if (!trimmed || !dueDate.value) return;
  emit('submit', trimmed, difficulty.value, dueDate.value);
}
</script>

<template>
  <form class="quest-form" @submit.prevent="onSubmit">
    <p class="intro">A single deed, sworn once. Finish it in time and be rewarded. Miss the day and the boss strikes.</p>

    <label class="field">
      <span class="field-label">Deed</span>
      <input v-model="description" class="name-input" type="text" placeholder="What must be done?" required />
    </label>

    <fieldset class="field">
      <legend class="field-label">Difficulty</legend>
      <div class="cards">
        <label v-for="opt in difficultyOptions" :key="opt.value" class="card" :class="{ selected: difficulty === opt.value }">
          <input v-model="difficulty" type="radio" name="quest-difficulty" :value="opt.value" />
          <span class="card-title">{{ opt.label }}</span>
          <span class="pips" aria-hidden="true">
            <span v-for="n in 3" :key="n" class="pip" :class="{ lit: n <= opt.pips }" />
          </span>
          <span class="reward">+{{ rewardFor(opt.value) }} EXP</span>
        </label>
      </div>
    </fieldset>

    <fieldset class="field">
      <legend class="field-label">Deadline</legend>
      <div class="chips">
        <button
          v-for="chip in dueChips"
          :key="chip.label"
          type="button"
          class="chip"
          :class="{ selected: dueDate === chip.key }"
          @click="dueDate = chip.key"
        >
          {{ chip.label }}
        </button>
        <input v-model="dueDate" class="date-input" type="date" :min="todayKey" required aria-label="Deadline date" />
      </div>
      <p v-if="dueLabel" class="due-summary">Due {{ dueLabel }}</p>
    </fieldset>

    <button type="submit" class="submit">Accept quest</button>
  </form>
</template>

<style scoped>
.quest-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  text-align: left;
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

.name-input:focus,
.date-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 14px -4px var(--accent);
}

.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
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

.card:hover {
  border-color: var(--accent-border);
}

.card.selected {
  background: var(--accent-bg);
  border-color: var(--accent);
  box-shadow: 0 0 16px -6px var(--accent);
}

.card:has(input:focus-visible) {
  outline: 2px solid var(--accent);
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
  background: var(--accent);
}

.reward {
  color: var(--stat-color);
  font-size: 0.8rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip {
  padding: 0.4rem 0.9rem;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text-h);
  font-size: 0.85rem;
}

.chip:hover {
  border-color: var(--accent-border);
}

.chip.selected {
  background: var(--accent-bg);
  border-color: var(--accent);
  color: var(--accent);
}

.date-input {
  padding: 0.35rem 0.7rem;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text-h);
  font-family: inherit;
  font-size: 0.85rem;
  color-scheme: dark;
}

.due-summary {
  margin: 0;
  color: var(--text);
  font-size: 0.8rem;
  font-style: italic;
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
