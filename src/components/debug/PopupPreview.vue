<script setup lang="ts">
import { createHabit, createQuest, createRng } from '../../game-engine';
import { useBossSkillCard } from '../../composables/useBossSkillCard';
import { useCelebration } from '../../composables/useCelebration';
import { useDeathScreen } from '../../composables/useDeathScreen';
import { useMissedSkillsGate } from '../../composables/useMissedSkillsGate';
import { useQuestCompleteQueue } from '../../composables/useQuestCompleteQueue';
import { useQuestMissGate } from '../../composables/useQuestMissGate';
import { useBossStore } from '../../store/bossStore';
import { useCharacterStore } from '../../store/characterStore';

const { enqueue } = useQuestCompleteQueue();
const { queueMiss } = useQuestMissGate();
const missedSkills = useMissedSkillsGate();
const { triggerDeath } = useDeathScreen();
const { celebrateBossKill, celebrateLevelUp } = useCelebration();
const { showBossSkill } = useBossSkillCard();
const bossStore = useBossStore();
const characterStore = useCharacterStore();

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

// Plays the current boss's death and its own return, then the hero's last
// level-up again; neither store changes.
function previewKill() {
  celebrateBossKill({ ...bossStore.boss, health: 0 }, bossStore.boss);
  celebrateLevelUp(Math.max(1, characterStore.character.level - 1));
}

function previewBossSkills() {
  showBossSkill({ skill: 'ravage', outcome: 'landed', amount: 1240 });
  showBossSkill({ skill: 'blind', outcome: 'landed' });
  showBossSkill({ skill: 'doom', outcome: 'landed', pct: 50 });
  showBossSkill({ skill: 'empower', outcome: 'landed', stat: 'armor' });
  showBossSkill({ skill: 'ascend', outcome: 'landed' });
  showBossSkill({ skill: 'rend', outcome: 'failed' });
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
    <button type="button" @click="previewKill">Preview boss kill (testing)</button>
    <button type="button" @click="previewBossSkills">Preview boss skills (testing)</button>
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
