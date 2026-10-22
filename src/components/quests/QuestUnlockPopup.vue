<script setup lang="ts">
import { Gift, ScrollText, Swords } from 'lucide-vue-next';
import { useModalPriority } from '../../composables/useModalPriority';
import { useCharacterStore } from '../../store/characterStore';
import Modal from '../ui/Modal.vue';
import RuleList from '../ui/RuleList.vue';
import type { Rule } from '../ui/RuleList.vue';

// Shown every run on reaching QUESTS_UNLOCK_LEVEL, unless quests carried over
// from the last run (those open the section from the start) — see
// questUnlockPending. "Onward" is what unseals the section.
const { questUnlockVisible } = useModalPriority();
const characterStore = useCharacterStore();

const RULES: Rule[] = [
  { icon: ScrollText, tone: 'accent', title: 'Swear', text: 'Name a deed and a deadline.' },
  { icon: Gift, tone: 'solid', title: 'Keep', text: 'Done in time, receive a reward.' },
  { icon: Swords, tone: 'danger', title: 'Break', text: 'Miss the deadline, the boss strikes.' },
];
</script>

<template>
  <Modal :model-value="questUnlockVisible" :dismissible="false" title="Quests unlocked" max-width="440px">
    <div class="emblem" aria-hidden="true">
      <ScrollText :size="34" :stroke-width="1.5" />
    </div>
    <p class="tagline">Some deeds are sworn only once.</p>
    <RuleList :rules="RULES" />
    <button type="button" class="onward primary-button" @click="characterStore.unlockQuests()">Onward</button>
  </Modal>
</template>

<style scoped>
.emblem {
  display: grid;
  place-items: center;
  width: 84px;
  height: 84px;
  margin: 0.25rem auto 0.9rem;
  color: var(--accent);
  background: radial-gradient(circle, var(--accent-bg), transparent 70%);
  border: 1px solid var(--accent-border);
  border-radius: 50%;
  box-shadow: 0 0 24px -8px var(--accent);
}

.tagline {
  margin: 0 0 1.1rem;
  color: var(--text);
  font-style: italic;
  text-align: center;
}

.onward {
  display: block;
  width: 100%;
  padding: 0.8rem 1.2rem;
}
</style>
