<script setup lang="ts">
import { computed, ref } from 'vue';
import { dailyPeriodKey } from '../../game-engine';
import type { Difficulty } from '../../game-engine';
import { useDebugClockStore } from '../../store/debugClockStore';

const emit = defineEmits<{ submit: [description: string, difficulty: Difficulty, dueDateKey: string] }>();

const debugClockStore = useDebugClockStore();
const description = ref('');
const difficulty = ref<Difficulty>('easy');
const dueDate = ref('');
const todayKey = computed(() => dailyPeriodKey(debugClockStore.now()));

function onSubmit() {
  const trimmed = description.value.trim();
  if (!trimmed || !dueDate.value) return;
  emit('submit', trimmed, difficulty.value, dueDate.value);
}
</script>

<template>
  <form class="quest-form" @submit.prevent="onSubmit">
    <input v-model="description" type="text" placeholder="What's the task?" required />
    <select v-model="difficulty">
      <option value="easy">Easy</option>
      <option value="medium">Medium</option>
      <option value="hard">Hard</option>
    </select>
    <input v-model="dueDate" type="date" :min="todayKey" required />
    <button type="submit">Accept quest</button>
  </form>
</template>

<style scoped>
.quest-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
