<script setup lang="ts">
import { createHabit, createQuest, createRng, questExpReward } from '../../game-engine';
import { useMissedSkillsGate } from '../../composables/useMissedSkillsGate';
import { useQuestCompleteQueue } from '../../composables/useQuestCompleteQueue';
import { useQuestMissGate } from '../../composables/useQuestMissGate';
import { useBossStore } from '../../store/bossStore';

const bossStore = useBossStore();
const { enqueue } = useQuestCompleteQueue();
const { queueMiss } = useQuestMissGate();
const missedSkills = useMissedSkillsGate();

// Fake quests/habits never enter their stores, so acknowledging a preview is
// a no-op (the resolvers all bail on an unknown id).
function previewComplete() {
  const quest = createQuest('Clean the garage', 'hard', '2099-01-01', bossStore.boss.index);
  enqueue({ description: quest.description, difficulty: quest.difficulty, amount: questExpReward(quest) });
}

function previewMiss() {
  queueMiss(createQuest('Clean the garage', 'hard', '2026-01-01', bossStore.boss.index));
  queueMiss(createQuest('File the taxes', 'easy', '2026-01-02', bossStore.boss.index));
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
