<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { dailyPeriodKey } from '../../game-engine';
import type { Difficulty } from '../../game-engine';
import { useItemDropQueue } from '../../composables/useItemDropQueue';
import { useQuestOfferQueue } from '../../composables/useQuestOfferQueue';
import { useDebugClockStore } from '../../store/debugClockStore';
import { useQuestStore } from '../../store/questStore';
import Modal from '../ui/Modal.vue';

const { current, dismiss } = useQuestOfferQueue();
// Both this modal and ItemDropPopup are full-screen, non-dismissible-by-
// backdrop-click Modals that can be queued by the exact same boss-kill (a
// kill can drop an item AND offer a quest at once) — without this gate,
// whichever is mounted later in AppShell renders on top and permanently
// blocks the other's buttons, since neither Modal yields to the other.
// Deferring the quest offer until any pending item drop is resolved first
// keeps exactly one full-screen modal interactable at a time.
const { current: itemDropCurrent } = useItemDropQueue();
const questStore = useQuestStore();
const debugClockStore = useDebugClockStore();

// Resets to the accept/reject prompt whenever a new offer becomes current —
// covers both "dismiss advanced the queue" and "a second offer queued while
// the form was open" without needing a separate watcher per case.
const step = ref<'offer' | 'form'>('offer');
watch(current, (value) => {
  if (value !== null) step.value = 'offer';
});

const description = ref('');
const difficulty = ref<Difficulty>('easy');
const dueDate = ref('');
const todayKey = computed(() => dailyPeriodKey(debugClockStore.now()));

function accept() {
  step.value = 'form';
}

function reject() {
  dismiss();
}

function onSubmit() {
  const trimmed = description.value.trim();
  if (!trimmed || !dueDate.value || current.value === null) return;
  questStore.addQuest(trimmed, difficulty.value, dueDate.value, current.value);
  description.value = '';
  difficulty.value = 'easy';
  dueDate.value = '';
  dismiss();
}
</script>

<template>
  <Modal :model-value="current !== null && itemDropCurrent === null" :dismissible="false" title="Quest">
    <template v-if="step === 'offer'">
      <p>A quest has appeared! Will you accept it?</p>
      <div class="offer-actions">
        <button type="button" class="accept-button" @click="accept">Accept</button>
        <button type="button" class="reject-button" @click="reject">Reject</button>
      </div>
    </template>
    <form v-else class="quest-form" @submit.prevent="onSubmit">
      <input v-model="description" type="text" placeholder="What's the task?" required />
      <select v-model="difficulty">
        <option value="easy">Easy</option>
        <option value="medium">Medium</option>
        <option value="hard">Hard</option>
      </select>
      <input v-model="dueDate" type="date" :min="todayKey" required />
      <button type="submit">Accept quest</button>
    </form>
  </Modal>
</template>

<style scoped>
.offer-actions {
  display: flex;
  gap: 0.5rem;
}

.accept-button {
  background: #16a34a;
  color: white;
  border: none;
}

.reject-button {
  background: transparent;
  border: 1px solid var(--border);
}

.quest-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
