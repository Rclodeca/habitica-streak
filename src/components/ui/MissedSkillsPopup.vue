<script setup lang="ts">
import { useMissedSkillsGate } from '../../composables/useMissedSkillsGate';
import Modal from './Modal.vue';

const { misses, hasPending, acknowledge } = useMissedSkillsGate();
</script>

<template>
  <Modal :model-value="hasPending" :dismissible="false" title="Missed skills">
    <p class="missed-intro">You didn't check these off in time — the boss struck back:</p>
    <ul class="missed-list">
      <li v-for="miss in misses" :key="miss.habitId">{{ miss.habitName }}</li>
    </ul>
    <button type="button" class="ok-button" @click="acknowledge">OK</button>
  </Modal>
</template>

<style scoped>
.missed-intro {
  margin: 0 0 0.75rem;
}

.missed-list {
  margin: 0 0 1rem;
  padding-left: 1.25rem;
}

.ok-button {
  display: block;
}
</style>
