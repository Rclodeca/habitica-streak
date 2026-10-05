<script setup lang="ts">
import { useMissedSkillsGate } from '../../composables/useMissedSkillsGate';
import { useQuestMissGate } from '../../composables/useQuestMissGate';
import Modal from '../ui/Modal.vue';

const { misses, hasPending, isOverridden, toggleOverride, acknowledge } = useQuestMissGate();
// useDailyRollover can queue a habit miss AND a quest miss in the same
// synchronous call, so both this popup and MissedSkillsPopup could become
// pending at once — same full-screen-modal collision as QuestOfferModal
// vs. ItemDropPopup (see that component's comment). Deferring until the
// habit-miss gate is clear keeps exactly one blocking modal up at a time.
const { hasPending: habitMissHasPending } = useMissedSkillsGate();
</script>

<template>
  <Modal :model-value="hasPending && !habitMissHasPending" :dismissible="false" title="Quest deadline passed">
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
