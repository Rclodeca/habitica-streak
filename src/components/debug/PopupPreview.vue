<script setup lang="ts">
import { createHabit, createQuest, createRng } from '../../game-engine';
import { useDeathScreen } from '../../composables/useDeathScreen';
import { useMissedSkillsGate } from '../../composables/useMissedSkillsGate';
import { useQuestCompleteQueue } from '../../composables/useQuestCompleteQueue';
import { useQuestMissGate } from '../../composables/useQuestMissGate';

const { enqueue } = useQuestCompleteQueue();
const { queueMiss } = useQuestMissGate();
const missedSkills = useMissedSkillsGate();
const { triggerDeath } = useDeathScreen();

// Fake quests/habits never enter their stores, so acknowledging a preview is
// a no-op (the resolvers all bail on an unknown id).
function previewComplete() {
  const quest = createQuest('Clean the garage', 'hard', '2099-01-01');
  enqueue({ description: quest.description, difficulty: quest.difficulty, amount: 80 });
}

function previewMiss() {
  queueMiss(createQuest('Clean the garage', 'hard', '2026-01-01'));
  queueMiss(createQuest('File the taxes', 'easy', '2026-01-02'));
}

function previewDaily() {
  const rng = createRng();
  missedSkills.queueMiss(createHabit('Meditate', 'daily', 'medium', false, rng), 'preview');
  missedSkills.queueMiss(createHabit('Read a chapter', 'weekly', 'hard', false, rng), 'preview');
  missedSkills.queueReward(createHabit('Skip dessert', 'daily', 'easy', true, rng), 'preview');
}
</script>

<template>
  <div class="preview">
    <button type="button" @click="previewComplete">Preview quest complete (testing)</button>
    <button type="button" @click="previewDaily">Preview daily update (testing)</button>
    <button type="button" @click="previewMiss">Preview quest failed (testing)</button>
    <button type="button" @click="triggerDeath">Preview death screen (testing)</button>
  </div>
</template>

<style scoped>
.preview {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-self: flex-start;
}

button {
  font-size: 0.8em;
  opacity: 0.7;
  border: 1px dashed var(--border);
  background: transparent;
  color: inherit;
  padding: 0.3rem 0.6rem;
}

button:hover {
  opacity: 1;
}
</style>
