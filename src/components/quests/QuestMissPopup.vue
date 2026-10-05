<script setup lang="ts">
import { useModalPriority } from '../../composables/useModalPriority';
import { useQuestMissGate } from '../../composables/useQuestMissGate';
import Modal from '../ui/Modal.vue';

const { misses, isOverridden, toggleOverride, acknowledge } = useQuestMissGate();
// This popup competes with DeathScreen/MissedSkillsPopup/QuestOfferModal
// for the same full-screen Teleport-to-body stacking context — see
// useModalPriority for why a shared arbiter is needed instead of a
// pairwise gate per modal.
const { questMissVisible } = useModalPriority();
</script>

<template>
  <Modal :model-value="questMissVisible" :dismissible="false" title="Quest deadline passed">
    <p class="missed-intro">You didn't check these off by their due date — the boss struck back:</p>
    <ul class="missed-list">
      <li v-for="miss in misses" :key="miss.questId" class="outcome-row">
        <span>{{ miss.description }} (due {{ miss.dueDateKey }})</span>
        <label class="override-label">
          <input
            type="checkbox"
            :checked="isOverridden(miss.questId)"
            @change="toggleOverride(miss.questId)"
          />
          I actually did this
        </label>
      </li>
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
