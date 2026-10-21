<script setup lang="ts">
import { computed } from 'vue';
import { dailyPeriodKey, questExpReward } from '../../game-engine';
import type { Difficulty, Quest } from '../../game-engine';
import { useCombatActions } from '../../composables/useCombatActions';
import { useQuestCompleteQueue } from '../../composables/useQuestCompleteQueue';
import { useDebugClockStore } from '../../store/debugClockStore';
import { useQuestStore } from '../../store/questStore';

const questStore = useQuestStore();
const debugClockStore = useDebugClockStore();
const { completeQuest } = useCombatActions();
const { enqueue: enqueueCompletion } = useQuestCompleteQueue();

const PIPS: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };
const MS_PER_DAY = 86_400_000;

const todayKey = computed(() => dailyPeriodKey(debugClockStore.now()));

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

function onCheckOff(quest: Quest) {
  enqueueCompletion({ description: quest.description, difficulty: quest.difficulty, amount: questExpReward(quest) });
  completeQuest(quest.id);
}
</script>

<template>
  <section class="panel quest-section">
    <h2>Quests</h2>
    <ul v-if="questStore.quests.length">
      <li v-for="quest in questStore.quests" :key="quest.id" class="quest-item" :class="urgency(quest)">
        <input type="checkbox" class="check" :aria-label="`Complete ${quest.description}`" @change="onCheckOff(quest)" />
        <div class="body">
          <span class="description">{{ quest.description }}</span>
          <span class="meta">
            <span class="pips" :title="quest.difficulty">
              <span v-for="n in 3" :key="n" class="pip" :class="{ lit: n <= PIPS[quest.difficulty] }" />
            </span>
            <span class="due">{{ dueText(quest) }}</span>
          </span>
        </div>
        <span class="reward">+{{ Math.round(questExpReward(quest)) }} EXP</span>
      </li>
    </ul>
    <p v-else>No active quests.</p>
  </section>
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

.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  text-align: left;
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

.reward {
  flex-shrink: 0;
  color: var(--stat-color);
  font-size: 0.85rem;
}
</style>
