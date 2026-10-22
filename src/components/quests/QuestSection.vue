<script setup lang="ts">
import { computed, ref } from 'vue';
import { dailyPeriodKey, ITEM_CATALOG } from '../../game-engine';
import type { Difficulty, ItemDef, Quest } from '../../game-engine';
import { useCombatActions } from '../../composables/useCombatActions';
import { useQuestCompleteQueue } from '../../composables/useQuestCompleteQueue';
import { useDebugClockStore } from '../../store/debugClockStore';
import { useQuestStore } from '../../store/questStore';
import Modal from '../ui/Modal.vue';
import QuestDetailModal from './QuestDetailModal.vue';
import QuestForm from './QuestForm.vue';

const questStore = useQuestStore();
const debugClockStore = useDebugClockStore();
const { completeQuest } = useCombatActions();
const { enqueue: enqueueCompletion } = useQuestCompleteQueue();

const PIPS: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };
const MS_PER_DAY = 86_400_000;
const baseUrl = import.meta.env.BASE_URL;

const todayKey = computed(() => dailyPeriodKey(debugClockStore.now()));
const showAdd = ref(false);
const detailId = ref<string | null>(null);
const detailQuest = computed(() => questStore.quests.find((q) => q.id === detailId.value) ?? null);

function daysLeft(quest: Quest): number {
  return Math.round((Date.parse(`${quest.dueDateKey}T00:00:00Z`) - Date.parse(`${todayKey.value}T00:00:00Z`)) / MS_PER_DAY);
}

function urgency(quest: Quest): 'urgent' | 'soon' | 'calm' {
  const days = daysLeft(quest);
  if (days <= 0) return 'urgent';
  return days <= 2 ? 'soon' : 'calm';
}

function dueText(quest: Quest): string {
  const days = daysLeft(quest);
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `${days} days left`;
}

function rewardItem(quest: Quest): ItemDef | null {
  return ITEM_CATALOG.find((item) => item.id === quest.rewardItemId) ?? null;
}

function onAdd(description: string, difficulty: Difficulty, dueDateKey: string) {
  questStore.addQuest(description, difficulty, dueDateKey);
  showAdd.value = false;
}

function onCheckOff(quest: Quest) {
  const result = completeQuest(quest.id);
  if (result && result.amount > 0) {
    enqueueCompletion({ description: quest.description, difficulty: quest.difficulty, amount: result.amount });
  }
}
</script>

<template>
  <section class="panel quest-section">
    <div class="quest-header">
      <h2>Quests</h2>
      <button type="button" class="add-button" aria-label="Add quest" @click="showAdd = true">+ New quest</button>
    </div>
    <ul v-if="questStore.quests.length">
      <li v-for="quest in questStore.quests" :key="quest.id" class="quest-item" :class="[urgency(quest), { side: quest.kind === 'side' }]">
        <input type="checkbox" class="check" :aria-label="`Complete ${quest.description}`" @change="onCheckOff(quest)" />
        <button type="button" class="body" @click="detailId = quest.id">
          <span class="description">{{ quest.description }}</span>
          <span class="meta">
            <span class="pips" :title="quest.difficulty">
              <span v-for="n in 3" :key="n" class="pip" :class="{ lit: n <= PIPS[quest.difficulty] }" />
            </span>
            <span class="due">{{ dueText(quest) }}</span>
          </span>
        </button>
        <img v-if="quest.kind === 'side' && rewardItem(quest)" class="reward-icon" :src="`${baseUrl}sprites/${rewardItem(quest)!.icon}.png`" alt="" />
      </li>
    </ul>
    <p v-else>No active quests.</p>
  </section>

  <Modal v-model="showAdd" title="New quest" max-width="480px">
    <QuestForm kind="regular" @submit="onAdd" />
  </Modal>

  <QuestDetailModal :quest="detailQuest" @close="detailId = null" />
</template>

<style scoped>
.quest-section ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.quest-item {
  --tone: var(--border);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.8rem;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-left: 3px solid var(--tone);
  border-radius: 8px;
}

.quest-item.soon {
  --tone: #f59e0b;
}

.quest-item.urgent {
  --tone: var(--damage-color);
  box-shadow: 0 0 14px -8px var(--damage-color);
}

.check {
  appearance: none;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  margin: 0;
  background: transparent;
  border: 2px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
}

.check:hover {
  border-color: var(--accent-border);
}

.check:checked {
  background: var(--accent);
  border-color: var(--accent);
}

.check:checked::after {
  content: '✓';
  color: var(--bg);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
}

.check:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.quest-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.quest-header h2 {
  margin: 0;
}

.add-button {
  padding: 0.35rem 0.9rem;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  border-radius: 999px;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.quest-section ul {
  margin-top: 0.75rem;
}

.quest-item.side {
  --tone: #fbbf24;
  background: linear-gradient(90deg, rgba(251, 191, 36, 0.1), var(--code-bg) 60%);
  box-shadow: 0 0 14px -8px #fbbf24;
}

.quest-item.side.urgent {
  --tone: var(--damage-color);
  box-shadow: 0 0 14px -8px var(--damage-color);
}

.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0;
  text-align: left;
  cursor: pointer;
}

.description {
  color: var(--text-h);
  overflow-wrap: anywhere;
}

.meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.8rem;
}

.pips {
  display: flex;
  gap: 0.25rem;
}

.pip {
  width: 0.5rem;
  height: 0.5rem;
  background: var(--border);
  border-radius: 50%;
}

.pip.lit {
  background: var(--accent);
}

.due {
  color: var(--text);
}

.soon .due {
  color: #f59e0b;
}

.urgent .due {
  color: var(--damage-color);
}

.reward-icon {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  margin: -0.4rem 0;
  image-rendering: pixelated;
}
</style>
