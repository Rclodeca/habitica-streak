<script setup lang="ts">
import { useMissedSkillsGate } from '../../composables/useMissedSkillsGate';
import Modal from './Modal.vue';

const { misses, rewards, hasPending, isOverridden, toggleOverride, acknowledge } = useMissedSkillsGate();
</script>

<template>
  <Modal :model-value="hasPending" :dismissible="false" title="Daily update">
    <template v-if="misses.length">
      <p class="missed-intro">You didn't check these off in time — the boss struck back:</p>
      <ul class="missed-list">
        <li v-for="miss in misses" :key="miss.habitId" class="outcome-row">
          <span>{{ miss.habitName }}</span>
          <label class="override-label">
            <input
              type="checkbox"
              :checked="isOverridden(miss.habitId)"
              @change="toggleOverride(miss.habitId)"
            />
            I actually did this
          </label>
        </li>
      </ul>
    </template>

    <template v-if="rewards.length">
      <p class="reward-intro">You resisted these — the boss took damage:</p>
      <ul class="reward-list">
        <li v-for="reward in rewards" :key="reward.habitId" class="outcome-row">
          <span>{{ reward.habitName }}</span>
          <label class="override-label">
            <input
              type="checkbox"
              :checked="isOverridden(reward.habitId)"
              @change="toggleOverride(reward.habitId)"
            />
            I actually did this
          </label>
        </li>
      </ul>
    </template>

    <button type="button" class="ok-button" @click="acknowledge">OK</button>
  </Modal>
</template>

<style scoped>
.missed-intro {
  margin: 0 0 0.75rem;
}

.missed-list,
.reward-list {
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
}

.outcome-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.2rem 0;
}

.override-label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--text-h);
  white-space: nowrap;
}

.ok-button {
  display: block;
}
</style>
