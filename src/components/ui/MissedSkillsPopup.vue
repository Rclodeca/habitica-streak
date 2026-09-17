<script setup lang="ts">
import { useMissedSkillsGate } from '../../composables/useMissedSkillsGate';
import Modal from './Modal.vue';

const { misses, rewards, hasPending, acknowledge } = useMissedSkillsGate();
</script>

<template>
  <Modal :model-value="hasPending" :dismissible="false" title="Daily update">
    <template v-if="misses.length">
      <p class="missed-intro">You didn't check these off in time — the boss struck back:</p>
      <ul class="missed-list">
        <li v-for="miss in misses" :key="miss.habitId">{{ miss.habitName }}</li>
      </ul>
    </template>

    <template v-if="rewards.length">
      <p class="reward-intro">You resisted these — the boss took damage:</p>
      <ul class="reward-list">
        <li v-for="reward in rewards" :key="reward.habitId">{{ reward.habitName }}</li>
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
  padding-left: 1.25rem;
}

.ok-button {
  display: block;
}
</style>
